// Captures the screens and clips for the journey 28 video (Configure automatic descoping). Start the stack first:
//   pwsh eng/Start-E2eApi.ps1
//   cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
// then from the repo root:
//   node docs/videos/28-configure-automatic-descoping/clips/clips.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const { chromium } = createRequire(join(repo, "e2e/package.json"))("@playwright/test");
const { SettingsPage } = await import(join(repo, "e2e/pages/settings.page.ts"));
const { NewDirectionPage } = await import(join(repo, "e2e/pages/new-direction.page.ts"));
const { ProjectPage } = await import(join(repo, "e2e/pages/project.page.ts"));
const { BacklogPage } = await import(join(repo, "e2e/pages/backlog.page.ts"));
const { startWorkers } = await import(join(repo, "e2e/support/workers.ts"));

const base = process.env.APP_URL ?? "http://localhost:4300";
const screens = resolve(here, "../screens");
mkdirSync(screens, { recursive: true });
const tag = Date.now().toString(36).slice(-4);
const records = {};

async function context(browser, { width = 1280, height = 900, dark = false, video, login = "quinntynebrown" } = {}) {
  const ctx = await browser.newContext({
    baseURL: base,
    viewport: { width, height },
    deviceScaleFactor: width < 600 ? 2 : 1,
    colorScheme: dark ? "dark" : "light",
    ...(video ? { recordVideo: { dir: video, size: { width, height } } } : {}),
  });
  const page = await ctx.newPage();
  const r = await page.request.post("/api/auth/dev/sign-in", { data: { login } });
  if (r.status() !== 204) throw new Error(`sign in: ${r.status()}`);
  return {
    ctx,
    page,
    settings: new SettingsPage(page),
    newDirection: new NewDirectionPage(page),
    project: new ProjectPage(page),
    backlog: new BacklogPage(page),
  };
}

const shot = async (page, file, locator) => {
  await page.mouse.move(0, 0);
  const options = { path: join(screens, `${file}.png`), animations: "disabled", caret: "hide" };
  return locator ? locator.screenshot(options) : page.screenshot(options);
};

async function recording(browser, file, opts = {}) {
  const raw = join(here, `.raw-${file}`);
  rmSync(raw, { recursive: true, force: true });
  const c = await context(browser, { width: 1408, height: 792, video: raw, ...opts });
  return {
    ...c,
    done: async () => {
      await c.ctx.close();
      const webm = readdirSync(raw).find((f) => f.endsWith(".webm"));
      execFileSync("ffmpeg", ["-y", "-v", "error", "-i", join(raw, webm), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", join(here, `${file}.mp4`)]);
      rmSync(raw, { recursive: true, force: true });
    },
  };
}

const typeSlowly = async (locator, text) => (await locator.fill(""), locator.pressSequentially(text, { delay: 120 }));

const browser = await chromium.launch();
let stop = null;
try {
  // 1. An Owner tries half a day, is refused with a linked error, then saves 1 day.
  const s = await recording(browser, "set-the-threshold");
  await s.settings.open();
  await s.settings.defaults.scrollIntoViewIfNeeded();
  await s.page.waitForTimeout(1_500);
  await typeSlowly(s.settings.threshold, "0.5");
  await s.page.waitForTimeout(600);
  await s.settings.save.click();
  await s.settings.thresholdError.waitFor();
  records.invalid = await s.settings.thresholdError.innerText();
  await s.page.waitForTimeout(2_500);
  await shot(s.page, "settings-invalid", s.settings.defaults);
  await s.settings.errorSummary.getByRole("link", { name: "Descope threshold must be 1 to 20 days" }).click();
  await s.page.waitForTimeout(1_200);
  await typeSlowly(s.settings.threshold, "1");
  await s.page.waitForTimeout(600);
  await s.settings.save.click();
  await s.settings.savedCallout.waitFor();
  records.saved = await s.settings.savedCallout.innerText();
  await s.page.waitForTimeout(3_000);
  await shot(s.page, "settings-saved", s.settings.defaults);
  await s.done();

  // 2. A new direction; a worker runs it; stage 9 defers every 2-day design against the 1-day threshold.
  const d = await recording(browser, "stage-9-defers");
  await d.newDirection.open();
  await d.newDirection.fill({ name: `Kiln Booking ${tag}`, idea: "Studio time booking for shared ceramics kilns, with firing schedules." });
  await d.page.waitForTimeout(800);
  await d.newDirection.submit();
  await d.page.waitForURL(/\/projects\/[^/]+$/, { timeout: 20_000 });
  await d.project.pipeline.waitFor();
  await d.page.waitForTimeout(1_200);
  const projectId = new URL(d.page.url()).pathname.split("/")[2];
  await d.backlog.open(projectId);
  await d.page.waitForTimeout(1_500);
  const started = Date.now();
  stop = startWorkers(1, 400);
  await d.backlog.deferredItem(0).reason.waitFor({ timeout: 180_000 });
  records.plannedAfterMs = Date.now() - started;
  records.deferredCount = await d.backlog.deferred.count();
  records.reason = await d.backlog.deferredItem(0).reason.innerText();
  await d.page.waitForTimeout(2_000);
  await d.backlog.deferredSection.scrollIntoViewIfNeeded();
  await d.page.waitForTimeout(3_000);
  await d.done();
  {
    const b = await context(browser);
    await b.backlog.open(projectId);
    await b.backlog.deferredItem(0).reason.waitFor();
    await shot(b.page, "backlog-deferred");
    await b.ctx.close();
  }
  await stop();
  stop = null;

  // 3. The Viewer's read-only view, dark mode and a phone.
  for (const [file, opts] of [
    ["settings-viewer", { login: "ada" }],
    ["settings-dark", { dark: true }],
    ["settings-phone", { width: 390, height: 844 }],
  ]) {
    const c = await context(browser, opts);
    await c.settings.open();
    await c.settings.threshold.waitFor();
    await c.page.waitForTimeout(500);
    await shot(c.page, file, file === "settings-phone" ? undefined : c.settings.defaults);
    if (file === "settings-phone") {
      await c.settings.threshold.scrollIntoViewIfNeeded();
      await shot(c.page, file);
    }
    await c.ctx.close();
  }
  writeFileSync(join(screens, "records.json"), `${JSON.stringify(records, null, 2)}\n`);
} finally {
  await stop?.();
  const c = await context(browser);
  await c.settings.resetDefaultBudget();
  await c.ctx.close();
  await browser.close();
}
console.log(JSON.stringify(records));
