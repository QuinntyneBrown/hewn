// Captures the screens and clips for the journey 35 video (Choose a theme). Start the stack:
//   pwsh eng/Start-E2eApi.ps1
//   cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
// then from the repo root:
//   node docs/videos/35-choose-a-theme/clips/clips.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const e2e = createRequire(join(repo, "e2e/package.json"));
const { chromium } = e2e("@playwright/test");
const AxeBuilder = e2e("@axe-core/playwright").default;
const { Navigation } = await import(join(repo, "e2e/pages/navigation.ts"));
const { ProjectPage } = await import(join(repo, "e2e/pages/project.page.ts"));
const { SettingsPage } = await import(join(repo, "e2e/pages/settings.page.ts"));
const { Theme } = await import(join(repo, "e2e/pages/theme.ts"));
const { mockProjects } = await import(join(repo, "e2e/support/mock-projects.ts"));
const { serveProjects } = await import(join(repo, "e2e/support/projects.ts"));

const base = process.env.APP_URL ?? "http://localhost:4300";
const screens = resolve(here, "../screens");
mkdirSync(screens, { recursive: true });
const records = {};

async function context(browser, { width = 1280, height = 800, scheme = "light", login = "quinntynebrown", video } = {}) {
  const ctx = await browser.newContext({
    baseURL: base,
    viewport: { width, height },
    deviceScaleFactor: width < 600 ? 2 : 1,
    colorScheme: scheme,
    ...(video ? { recordVideo: { dir: video, size: { width, height } } } : {}),
  });
  const page = await ctx.newPage();
  const r = await page.request.post("/api/auth/dev/sign-in", { data: { login } });
  if (r.status() !== 204) throw new Error(`sign in: ${r.status()}`);
  // The mock's seven projects, so Projects looks as its mock does rather than the shared database's test rows.
  await serveProjects(page, mockProjects(new Date()));
  return { ctx, page, nav: new Navigation(page), project: new ProjectPage(page), settings: new SettingsPage(page), theme: new Theme(page) };
}

const shot = async (c, file, locator) => {
  await c.theme.settle();
  await c.page.waitForTimeout(300);
  await (locator ?? c.page).screenshot({ path: join(screens, `${file}.png`), caret: "hide" });
};

/** Records a clip; `at(n)` waits until n seconds into the recording, to pace it to the narration. */
async function record(browser, name, opts, body) {
  const raw = join(here, `.raw-${name}`);
  rmSync(raw, { recursive: true, force: true });
  const c = await context(browser, { ...opts, video: raw });
  const t0 = Date.now();
  const at = (seconds) => c.page.waitForTimeout(Math.max(0, t0 + seconds * 1_000 - Date.now()));
  await body(c, at);
  await c.ctx.close();
  const webm = readdirSync(raw).find((f) => f.endsWith(".webm"));
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", join(raw, webm), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", join(here, `${name}.mp4`)]);
  rmSync(raw, { recursive: true, force: true });
}

/** A caption added for the recording only (aria-hidden), saying what the clip can't show: the OS setting. */
async function caption(page, text) {
  await page.evaluate((t) => {
    let box = document.getElementById("clip-caption");
    if (!box) {
      box = document.createElement("div");
      box.id = "clip-caption";
      box.setAttribute("aria-hidden", "true");
      box.style.cssText =
        "position:fixed;right:24px;bottom:24px;z-index:9999;padding:12px 18px;border-radius:10px;background:#101828;" +
        "color:#fff;font:500 18px/1.4 Inter,system-ui,sans-serif;box-shadow:0 8px 24px rgb(0 0 0/.35)";
      document.body.append(box);
    }
    box.textContent = t;
  }, text);
}

async function violations(page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const contrast = [...results.passes, ...results.violations].find((r) => r.id === "color-contrast");
  return { violations: results.violations.length, contrastChecked: contrast?.nodes.length ?? 0 };
}

const browser = await chromium.launch();
try {
  // A project from the e2e database to show on the phone (page.request isn't routed to the mock's rows).
  {
    const c = await context(browser);
    const all = await (await c.page.request.get("/api/projects")).json();
    records.projectId = (all.find((p) => p.status === "Running") ?? all[0])?.id;
    await c.ctx.close();
  }

  // 1. Choosing Light, Dark and System in Settings, with a reload after each saved choice (L2-048 AC2).
  await record(browser, "choose", { width: 1280, height: 800, scheme: "light" }, async (c, at) => {
    await c.settings.open();
    await c.settings.themeChoice("System").waitFor();
    await at(7.5);
    await c.settings.themeChoice("Dark").check();
    await at(11);
    await c.page.reload();
    await c.settings.themeChoice("Dark").waitFor();
    await at(14.5);
    await c.settings.themeChoice("Light").check();
    await at(16.5);
    await c.page.reload();
    await c.settings.themeChoice("Light").waitFor();
    await at(19.5);
    await c.settings.themeChoice("System").check();
    await at(22.1);
  });

  // 2. System follows the OS live: the OS switches and the page follows, no reload (L2-048 AC1).
  await record(browser, "os", { width: 1280, height: 800, scheme: "light" }, async (c, at) => {
    await c.nav.visit("/projects");
    await c.page.waitForLoadState("networkidle");
    await caption(c.page, "Theme: System · OS: Light");
    await at(4);
    for (const [t, scheme] of [[4, "dark"], [6.5, "light"], [9, "dark"], [11.5, "light"]]) {
      await at(t);
      await c.theme.osPrefers(scheme);
      await caption(c.page, `Theme: System · OS: ${scheme === "dark" ? "Dark" : "Light"}`);
    }
    await at(15.7);
  });

  // 3. Settings' Appearance in both themes, and pages on the desktop in dark.
  for (const scheme of ["light", "dark"]) {
    const c = await context(browser, { scheme });
    await c.settings.open();
    await c.settings.themeChoice("System").waitFor();
    await shot(c, `appearance-${scheme}`, c.settings.appearance);
    await shot(c, `settings-${scheme}`);
    await c.nav.visit("/projects");
    await c.page.waitForLoadState("networkidle");
    await shot(c, `projects-${scheme}`);
    await c.ctx.close();
  }

  // 4. A Viewer on a phone chooses Dark: the drawer, Projects and a project page (L2-048 AC2).
  {
    const c = await context(browser, { width: 390, height: 844, login: "ada" });
    await c.settings.open();
    await c.settings.themeChoice("Dark").check();
    await shot(c, "phone-settings-dark");
    await c.nav.visit("/projects");
    await c.page.waitForLoadState("networkidle");
    await shot(c, "phone-projects-dark");
    await c.nav.openMenu();
    await shot(c, "phone-drawer-dark");
    await c.page.keyboard.press("Escape");
    if (records.projectId) {
      await c.project.open(records.projectId);
      await shot(c, "phone-project-dark");
    }
    await c.ctx.close();
    // The four side by side, as one picture for the slide.
    const phones = ["settings", "projects", "drawer", "project"].map((n) => join(screens, `phone-${n}-dark.png`));
    execFileSync("ffmpeg", ["-y", "-v", "error", ...phones.flatMap((f) => ["-i", f]), "-filter_complex",
      "[0]crop=iw:ih*0.75:0:0[a];[1]crop=iw:ih*0.75:0:0[b];[2]crop=iw:ih*0.75:0:0[c];[3]crop=iw:ih*0.75:0:0[d];" +
      "[a]pad=iw+40:ih:0:0:white@0[a2];[b]pad=iw+40:ih:0:0:white@0[b2];[c]pad=iw+40:ih:0:0:white@0[c2];[a2][b2][c2][d]hstack=4",
      join(screens, "phone-strip.png")]);
  }

  // 5. axe-core in both themes: violations, and how many text elements its contrast rule checked.
  records.axe = [];
  for (const scheme of ["light", "dark"]) {
    const c = await context(browser, { scheme });
    for (const [what, path] of [["Projects", "/projects"], ["New direction", "/projects/new"], ["Workers", "/workers"], ["Audit", "/audit"], ["Settings", "/settings"]]) {
      await c.nav.visit(path);
      await c.page.waitForLoadState("networkidle");
      await c.theme.settle();
      records.axe.push({ what, scheme, ...(await violations(c.page)) });
    }
    await c.ctx.close();
  }

  writeFileSync(join(screens, "records.json"), `${JSON.stringify(records, null, 2)}\n`);
} finally {
  await browser.close();
}
console.log(JSON.stringify(records));
