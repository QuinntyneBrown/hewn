// Captures the Mission Control screens and clips for the journey 4 video (Limit spending) from the running app,
// reusing the e2e page objects and starting a real scripted worker that reports model calls.
// Start the stack first (API on 5300 via eng/Start-E2eApi.ps1, Mission Control on 4300 with
// proxy.e2e.conf.json), then from the repo root:
//   node docs/videos/04-limit-spending/clips/clips.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const { chromium } = createRequire(join(repo, "e2e/package.json"))("@playwright/test");
const { NewDirectionPage } = await import(join(repo, "e2e/pages/new-direction.page.ts"));
const { ProjectPage } = await import(join(repo, "e2e/pages/project.page.ts"));
const { SettingsPage } = await import(join(repo, "e2e/pages/settings.page.ts"));
const { startWorkers } = await import(join(repo, "e2e/support/workers.ts"));

const base = process.env.APP_URL ?? "http://localhost:4300";
const screens = resolve(here, "../screens");
mkdirSync(screens, { recursive: true });
const suffix = Date.now().toString(36).slice(-4);
const idea = "A web app for small accounting teams to reconcile bank and card statements.";

async function context(browser, { width, height, dark = false, video, login = "quinntynebrown" } = {}) {
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
    nd: new NewDirectionPage(page),
    project: new ProjectPage(page),
    settings: new SettingsPage(page),
  };
}

const shot = async (page, name) => (
  await page.mouse.move(0, 0),
  page.screenshot({ path: join(screens, `${name}.png`), animations: "disabled", caret: "hide" })
);

const browser = await chromium.launch();

/** Records one clip at 1408x792 while `act` drives the page, and converts it to H.264. */
async function clip(name, act) {
  const raw = join(here, `.raw-${name}`);
  rmSync(raw, { recursive: true, force: true });
  const c = await context(browser, { width: 1408, height: 792, video: raw });
  await act(c);
  await c.ctx.close();
  const webm = readdirSync(raw).find((f) => f.endsWith(".webm"));
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", join(raw, webm), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", join(here, `${name}.mp4`)]);
  rmSync(raw, { recursive: true, force: true });
}

/** Runs whatever is left queued with fast workers, so the clip's direction starts at once. */
async function drain() {
  const stop = startWorkers(3, 50);
  const { ctx, page } = await context(browser, { width: 1280, height: 900 });
  try {
    for (let i = 0; i < 300; i++) {
      const list = await (await page.request.get("/api/projects")).json();
      if (!list.some((p) => p.status === "Running")) return;
      await page.waitForTimeout(1_000);
    }
    throw new Error("the queue did not drain");
  } finally {
    await ctx.close();
    await stop();
  }
}

/** Types like a person, so the clip shows the value going in. */
async function type(locator, text) {
  await locator.fill("");
  await locator.pressSequentially(text, { delay: 120 });
}

let stopWorkers = () => Promise.resolve();
try {
  // 1. Settings: one validation error, then a saved default.
  if (!process.env.SKIP_SETTINGS) await clip("settings", async ({ page, settings }) => {
    await settings.open();
    await page.waitForTimeout(1_500);
    await type(settings.defaultBudget, "5");
    await settings.save.click();
    await settings.errorSummary.waitFor();
    await page.waitForTimeout(3_000);
    await settings.errorSummary.getByRole("link").click();
    await type(settings.defaultBudget, "350");
    await settings.save.click();
    await settings.savedCallout.waitFor();
    await page.waitForTimeout(3_500);
  });
  for (const [width, height, tag, dark] of process.env.SKIP_SETTINGS ? [] : [
    [1280, 900, "desktop", false],
    [1280, 900, "desktop-dark", true],
    [390, 844, "phone", false],
  ]) {
    const { ctx, page, settings } = await context(browser, { width, height, dark });
    await settings.resetDefaultBudget(300);
    await settings.open();
    await shot(page, `settings-${tag}`);
    if (tag !== "phone") {
      await settings.setDefaultBudget("5");
      await settings.errorSummary.waitFor();
      await settings.defaultBudget.blur();
      await shot(page, `settings-invalid-${tag}`);
    }
    if (tag === "desktop") {
      await settings.setDefaultBudget("350");
      await settings.savedCallout.waitFor();
      await shot(page, "settings-saved-desktop");
      await settings.resetDefaultBudget(300);
    }
    await ctx.close();
  }
  {
    const { ctx, page, settings } = await context(browser, { width: 1280, height: 900, login: "ada" });
    await settings.open();
    await settings.readOnlyCallout.waitFor();
    await shot(page, "settings-viewer-desktop");
    await ctx.close();
  }

  // 2. Spend climbing live, the 80% warning, then the pause at 100%. Each call is $0.60 on a $10 budget.
  await drain();
  stopWorkers = startWorkers(1, 5000, { executor: "scripted", logLines: 10, modelCalls: 10, callTokens: 100_000 });
  const name = `Kiln Booking ${suffix}`;
  await clip("spend", async ({ page, nd, project }) => {
    await nd.open();
    await nd.fill({ name, idea, budget: "10.00" });
    await page.waitForTimeout(1_000);
    await nd.submit();
    const warning = project.toasts.filter({ hasText: "at 80% of budget" });
    await warning.waitFor({ timeout: 90_000 });
    await page.waitForTimeout(250);
    await shot(page, "warning-desktop");
    await project.budgetReachedCallout.waitFor({ timeout: 60_000 });
    await page.waitForTimeout(5_000);
  });
  await stopWorkers();
  for (const [width, height, tag, dark] of [
    [1280, 900, "desktop", false],
    [1280, 900, "desktop-dark", true],
    [390, 844, "phone", false],
    [390, 844, "phone-dark", true],
  ]) {
    const { ctx, page, project } = await context(browser, { width, height, dark });
    const list = await (await page.request.get("/api/projects")).json();
    await project.open(list.find((p) => p.name === name).id);
    await project.budgetReachedCallout.waitFor();
    await page.waitForTimeout(800);
    await shot(page, `budget-reached-${tag}`);
    await ctx.close();
  }
} finally {
  await stopWorkers();
  await browser.close();
}
console.log(`screens in ${screens}, clips in ${here}`);
