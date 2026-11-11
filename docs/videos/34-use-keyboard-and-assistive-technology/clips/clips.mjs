// Captures the screens and clips for the journey 34 video (Use keyboard and assistive technology). Start the stack:
//   pwsh eng/Start-E2eApi.ps1
//   cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
// then from the repo root:
//   node docs/videos/34-use-keyboard-and-assistive-technology/clips/clips.mjs
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
const { Keyboard } = await import(join(repo, "e2e/pages/keyboard.ts"));
const { Motion } = await import(join(repo, "e2e/pages/motion.ts"));
const { Navigation } = await import(join(repo, "e2e/pages/navigation.ts"));
const { NewDirectionPage } = await import(join(repo, "e2e/pages/new-direction.page.ts"));
const { PageStates } = await import(join(repo, "e2e/pages/page-states.ts"));
const { ProjectPage } = await import(join(repo, "e2e/pages/project.page.ts"));
const { startWorkers } = await import(join(repo, "e2e/support/workers.ts"));

const base = process.env.APP_URL ?? "http://localhost:4300";
const screens = resolve(here, "../screens");
mkdirSync(screens, { recursive: true });
const tag = Date.now().toString(36).slice(-4);
const idea = "Book firing slots for a shared pottery kiln, with a waiting list when the kiln is full.";
const records = {};

async function context(browser, { width = 1280, height = 800, dark = false, reduced = false, video } = {}) {
  const ctx = await browser.newContext({
    baseURL: base,
    viewport: { width, height },
    deviceScaleFactor: width < 600 ? 2 : 1,
    colorScheme: dark ? "dark" : "light",
    reducedMotion: reduced ? "reduce" : "no-preference",
    ...(video ? { recordVideo: { dir: video, size: { width, height } } } : {}),
  });
  const page = await ctx.newPage();
  const r = await page.request.post("/api/auth/dev/sign-in", { data: { login: "quinntynebrown" } });
  if (r.status() !== 204) throw new Error(`sign in: ${r.status()}`);
  return {
    ctx,
    page,
    keyboard: new Keyboard(page),
    motion: new Motion(page),
    nav: new Navigation(page),
    newDirection: new NewDirectionPage(page),
    project: new ProjectPage(page),
    states: new PageStates(page),
  };
}

const shot = async (page, file, locator) => {
  await page.waitForTimeout(400);
  await (locator ?? page).screenshot({ path: join(screens, `${file}.png`), caret: "hide" });
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

/** Runs what earlier tests left queued with fast workers, as e2e/support/queue.ts does, so the clip's worker is free. */
async function drainQueue(page) {
  const stop = startWorkers(3, 50);
  try {
    for (let i = 0; i < 180; i++) {
      const projects = await (await page.request.get("/api/projects")).json();
      if (!projects.some((p) => p.status === "Running")) return;
      await page.waitForTimeout(1_000);
    }
  } finally {
    await stop();
  }
}

async function violations(page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  return { rules: results.passes.length, violations: results.violations.length, serious: results.violations.filter((v) => ["serious", "critical"].includes(v.impact)).length };
}

const browser = await chromium.launch();
let stopWorkers = null;
try {
  // 1. The keyboard journey: New direction, a stage and its tabs, Cancel with Escape, then cancelling (L2-047 AC2).
  const name = `Kiln Booking ${tag}`;
  await record(browser, "keyboard", { width: 1280, height: 800 }, async (c, at) => {
    await c.page.goto("/projects");
    await c.page.waitForLoadState("networkidle");
    await at(1);
    await c.keyboard.tabTo(c.nav.sidebarLink("New direction"));
    await at(3.5);
    await c.keyboard.press("Enter");
    await c.newDirection.name.waitFor();
    await at(5.5);
    await c.keyboard.tabTo(c.newDirection.name);
    await c.page.keyboard.type(name, { delay: 60 });
    await c.keyboard.tabTo(c.newDirection.idea);
    await c.page.keyboard.type(idea, { delay: 25 });
    await c.keyboard.tabTo(c.newDirection.start);
    await at(13);
    await c.keyboard.press("Enter");
    await c.project.stage("Bootstrap").waitFor();
    records.projectId = c.project.projectIdFromUrl();
    await at(17);
    await c.keyboard.tabTo(c.project.stage("Idea").getByRole("link"));
    await at(18.5);
    await c.keyboard.press("Enter");
    await at(20);
    await c.keyboard.tabTo(c.project.tab("Log"));
    await at(21);
    await c.keyboard.press("ArrowRight");
    await at(22.5);
    await c.keyboard.press("ArrowRight");
    await at(24);
    await c.keyboard.tabTo(c.project.cancelButton);
    await at(25);
    await c.keyboard.press("Enter");
    await c.project.cancelDialog.waitFor();
    await at(28);
    await c.keyboard.press("Escape");
    records.focusAfterEscape = await c.page.evaluate(() => document.activeElement?.textContent?.trim());
    await at(31);
    await c.keyboard.press("Enter");
    await at(33.5);
    await c.keyboard.tabTo(c.project.cancelConfirm);
    await at(35);
    await c.keyboard.press("Enter");
    await c.project.cancelledCallout.waitFor({ timeout: 30_000 });
    await at(37.4);
  });

  // 2. Focus rings at rest: a field and a button on desktop; a drawer link on a phone in dark.
  {
    const c = await context(browser);
    await c.newDirection.open();
    await c.keyboard.tabTo(c.newDirection.name);
    await c.page.keyboard.type("Kiln Booking");
    await shot(c.page, "focus-field", c.newDirection.form);
    await c.keyboard.tabTo(c.newDirection.start);
    await shot(c.page, "focus-button");
    await c.ctx.close();
  }
  {
    const c = await context(browser, { width: 390, height: 844, dark: true });
    await c.nav.visit("/projects");
    await c.nav.openMenu();
    await c.keyboard.tabTo(c.nav.drawerLink("Audit"));
    await shot(c.page, "focus-phone-dark");
    await c.ctx.close();
  }

  // 3. Settings while its saved defaults load: the section skeletons.
  {
    const c = await context(browser);
    await c.states.hold("/api/settings/direction-defaults");
    await c.page.goto("/settings");
    await c.states.busy.waitFor();
    await shot(c.page, "settings-loading");
    await c.ctx.close();
  }

  // 4. axe-core on pages in several states, as the suite runs it.
  {
    const c = await context(browser);
    const id = records.projectId;
    const scans = [];
    const scan = async (what) => scans.push({ what, ...(await violations(c.page)) });
    await c.page.goto("/projects");
    await c.page.waitForLoadState("networkidle");
    await scan("Projects");
    await c.project.open(id);
    await scan("Project, cancelled");
    for (const [path, api] of [
      ["/projects", "/api/projects"],
      [`/projects/${id}/backlog`, `/api/projects/${id}/backlog`],
      ["/audit", "/api/audit"],
      ["/settings", "/api/settings/direction-defaults"],
    ]) {
      await c.states.hold(api);
      await c.page.goto(path);
      await c.states.busy.waitFor();
      await scan(`${path.replace(id, "…")} loading`);
      await c.states.fail(api);
      await c.page.goto(path);
      await c.states.failure.waitFor();
      await scan(`${path.replace(id, "…")} failed`);
    }
    await c.states.release();
    records.axe = scans;
    await c.ctx.close();
  }

  // 5. Reduced motion: the drawer 60 ms after Open menu, with and without the preference (L2-047 AC4).
  records.motion = {};
  for (const reduced of [false, true]) {
    const c = await context(browser, { width: 390, height: 844, reduced });
    await c.nav.visit("/projects");
    await c.nav.menuButton.click();
    await c.page.waitForTimeout(60);
    await c.page.screenshot({ path: join(screens, `drawer-${reduced ? "reduced" : "motion"}.png`) });
    records.motion[reduced ? "reduced" : "full"] = await c.motion.longerThan(0.01);
    await c.ctx.close();
  }

  // 6. The live region on a running project, mirrored on screen as a caption (L2-047 AC3).
  const announced = `Tidewater ${tag}`;
  {
    const c = await context(browser);
    await drainQueue(c.page);
    await c.newDirection.open();
    await c.newDirection.fill({ name: announced, idea });
    await c.newDirection.submit();
    await c.project.stage("Bootstrap").waitFor();
    records.announcedProject = c.project.projectIdFromUrl();
    await c.ctx.close();
  }
  await record(browser, "announce", { width: 1280, height: 800 }, async (c, at) => {
    await c.project.open(records.announcedProject);
    await c.project.announcer.evaluate((region) => {
      const box = document.createElement("div");
      box.setAttribute("aria-hidden", "true");
      box.style.cssText =
        "position:fixed;right:24px;bottom:24px;z-index:9999;max-width:460px;padding:14px 18px;border-radius:10px;" +
        "background:#101828;color:#fff;font:500 18px/1.4 Inter,system-ui,sans-serif;box-shadow:0 8px 24px rgb(0 0 0/.35)";
      box.innerHTML = '<div style="font-size:13px;opacity:.7;margin-bottom:4px">Live region (polite) says</div><div id="said">…</div>';
      document.body.append(box);
      const said = box.querySelector("#said");
      const log = [];
      window.__said = log;
      new MutationObserver(() => {
        const text = region.textContent?.trim() ?? "";
        said.textContent = text;
        log.push({ at: performance.now(), text });
      }).observe(region, { childList: true, characterData: true, subtree: true });
    });
    await at(1);
    stopWorkers = startWorkers(1, 900, { executor: "scripted", logLines: 3 });
    await at(26);
    records.said = await c.page.evaluate(() => window.__said);
  });
  await stopWorkers?.();
  stopWorkers = null;

  writeFileSync(join(screens, "records.json"), `${JSON.stringify(records, null, 2)}\n`);
} finally {
  await stopWorkers?.();
  await browser.close();
}
console.log(JSON.stringify({ ...records, axe: records.axe?.length, said: records.said?.length }));
