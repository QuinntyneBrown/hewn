// Captures the screens and the clip for the journey 33 video (Use Mission Control on mobile). Start the stack first:
//   pwsh eng/Start-E2eApi.ps1
//   cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
// then from the repo root:
//   node docs/videos/33-use-mission-control-on-mobile/clips/clips.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const { chromium } = createRequire(join(repo, "e2e/package.json"))("@playwright/test");
const { Navigation } = await import(join(repo, "e2e/pages/navigation.ts"));
const { ProjectPage } = await import(join(repo, "e2e/pages/project.page.ts"));
const { ProjectsPage } = await import(join(repo, "e2e/pages/projects.page.ts"));

const base = process.env.APP_URL ?? "http://localhost:4300";
const screens = resolve(here, "../screens");
mkdirSync(screens, { recursive: true });
const tag = Date.now().toString(36).slice(-4);
const records = {};

async function xsrf(page) {
  await page.request.get("/api/me");
  return (await page.context().cookies()).find((c) => c.name === "XSRF-TOKEN")?.value ?? "";
}

/** A real project with a queued direction, as New direction makes one. */
async function aProject(page, name) {
  const r = await page.request.post("/api/projects", {
    data: { name, idea: "Reconcile bank and card statements against receipts.", stackPreference: null, repositoryUrl: null, budgetUsd: 300 },
    headers: { "X-XSRF-TOKEN": await xsrf(page) },
  });
  if (!r.ok()) throw new Error(`create ${name}: ${r.status()} ${await r.text()}`);
  return (await r.json()).projectId;
}

async function context(browser, { width = 1280, height = 800, dark = false, video } = {}) {
  const ctx = await browser.newContext({
    baseURL: base,
    viewport: { width, height },
    deviceScaleFactor: width < 600 ? 2 : 1,
    colorScheme: dark ? "dark" : "light",
    ...(video ? { recordVideo: { dir: video, size: { width, height } } } : {}),
  });
  const page = await ctx.newPage();
  const r = await page.request.post("/api/auth/dev/sign-in", { data: { login: "quinntynebrown" } });
  if (r.status() !== 204) throw new Error(`sign in: ${r.status()}`);
  return { ctx, page, nav: new Navigation(page), project: new ProjectPage(page), projects: new ProjectsPage(page) };
}

const shot = async (page, file) => {
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(screens, `${file}.png`), animations: "disabled", caret: "hide" });
};

/** Each page's sideways scroll and its controls under the target size, as the acceptance tests measure them. */
async function measure(c, path, width, min) {
  await c.nav.width(width);
  await c.nav.visit(path);
  return { scroll: await c.nav.horizontalScroll(), small: (await c.nav.smallTargets(min)).length };
}

const browser = await chromium.launch();
try {
  const setup = await context(browser);
  const name = `Ledgerline ${tag}`;
  const projectId = await aProject(setup.page, name);
  await setup.ctx.close();

  // 1. One project at desktop, tablet and phone widths (L2-046 AC1-AC3).
  for (const [file, opts] of [
    ["project-desktop", { width: 1280, height: 800 }],
    ["project-tablet", { width: 768, height: 1024 }],
    ["project-phone", { width: 390, height: 844 }],
  ]) {
    const c = await context(browser, opts);
    await c.project.open(projectId);
    await c.project.stage("Bootstrap").waitFor();
    await shot(c.page, file);
    await c.ctx.close();
  }

  // 2. The top bar and the drawer on a phone, light and dark; a form's 44 px controls.
  for (const dark of [false, true]) {
    const c = await context(browser, { width: 390, height: 844, dark });
    await c.nav.visit("/projects");
    if (!dark) await shot(c.page, "topbar-phone");
    await c.nav.openMenu();
    await shot(c.page, dark ? "drawer-dark" : "drawer-light");
    await c.ctx.close();
  }
  {
    const c = await context(browser, { width: 390, height: 844 });
    await c.nav.visit("/projects/new");
    await shot(c.page, "touch-phone");
    records.widths = {};
    for (const [width, min] of [[375, 44], [768, 44], [1280, 24]]) {
      records.widths[width] = await measure(c, `/projects/${projectId}`, width, min);
    }
    await c.ctx.close();
  }

  // 3. The clip: on a phone, open the menu, close it with Escape, go to Projects, open a project. Paced to the
  // narration (captions): `at(n)` waits until n seconds into the recording.
  const raw = join(here, ".raw-menu");
  rmSync(raw, { recursive: true, force: true });
  const m = await context(browser, { width: 390, height: 792, video: raw });
  const t0 = Date.now();
  const at = (seconds) => m.page.waitForTimeout(Math.max(0, t0 + seconds * 1_000 - Date.now()));
  await m.nav.visit("/workers");
  await at(1.2);
  await m.nav.menuButton.click();
  await m.nav.drawer.waitFor();
  records.drawerLinks = await m.nav.drawerNav.getByRole("link").allInnerTexts();
  await at(6.4);
  await m.page.keyboard.press("Tab");
  await at(7.6);
  await m.page.keyboard.press("Tab");
  await at(9.6);
  await m.page.keyboard.press("Escape");
  await m.nav.drawer.waitFor({ state: "detached" });
  records.focusAfterEscape = await m.page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  await at(13.4);
  await m.nav.menuButton.click();
  await m.nav.drawer.waitFor();
  await at(15.4);
  await m.nav.drawerLink("Projects").click();
  await m.nav.drawer.waitFor({ state: "detached" });
  await m.projects.rows.first().waitFor();
  await at(19.8);
  await m.projects.row(name).title.click();
  await m.project.stage("Bootstrap").waitFor();
  await at(24.5);
  await m.ctx.close();
  const webm = readdirSync(raw).find((f) => f.endsWith(".webm"));
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", join(raw, webm), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", join(here, "menu.mp4")]);
  rmSync(raw, { recursive: true, force: true });

  writeFileSync(join(screens, "records.json"), `${JSON.stringify(records, null, 2)}\n`);
} finally {
  await browser.close();
}
console.log(JSON.stringify(records));
