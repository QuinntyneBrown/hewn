// Captures the Mission Control screens and clips for the journey 8 video (Stop and restart all workers) from the
// running app, reusing the e2e page objects and two real scripted workers.
// Start the stack first (API on 5300 via eng/Start-E2eApi.ps1, Mission Control on 4300 with
// proxy.e2e.conf.json), then from the repo root:
//   node docs/videos/08-stop-and-restart-all-workers/clips/clips.mjs
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
const { WorkersPage } = await import(join(repo, "e2e/pages/workers.page.ts"));
const { startWorkers } = await import(join(repo, "e2e/support/workers.ts"));

const base = process.env.APP_URL ?? "http://localhost:4300";
const screens = resolve(here, "../screens");
mkdirSync(screens, { recursive: true });
const suffix = Date.now().toString(36).slice(-4);
const idea = "A web app for small accounting teams to reconcile bank and card statements.";

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
  return { ctx, page, nd: new NewDirectionPage(page), project: new ProjectPage(page), workers: new WorkersPage(page) };
}

const shot = async (page, name) => (
  await page.mouse.move(0, 0),
  page.screenshot({ path: join(screens, `${name}.png`), animations: "disabled", caret: "hide" })
);

const browser = await chromium.launch();

/** Runs whatever is left queued with fast workers, so this video's directions start at once. */
async function drain() {
  const stop = startWorkers(3, 50);
  const { ctx, page } = await context(browser);
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

/** Records `act` in a 1408x792 page opened at `path` and writes it to clips/<name>.mp4. */
async function clip(name, path, act) {
  const raw = join(here, `.raw-${name}`);
  rmSync(raw, { recursive: true, force: true });
  const { ctx, page, project, workers } = await context(browser, { width: 1408, height: 792, video: raw });
  await page.goto(path);
  await act(page, project, workers);
  await ctx.close();
  const webm = readdirSync(raw).find((f) => f.endsWith(".webm"));
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", join(raw, webm), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", join(here, `${name}.mp4`)]);
  rmSync(raw, { recursive: true, force: true });
}

/** Starts a direction and waits until its Bootstrap run has started; returns the project's ID. */
async function submit(name) {
  const { ctx, page, nd, project } = await context(browser);
  await nd.open();
  await nd.fill({ name: `${name} ${suffix}`, idea });
  await nd.submit();
  await project.logLines.filter({ hasText: "Bootstrap · line 2 of" }).waitFor({ timeout: 120_000 });
  const projectId = new URL(page.url()).pathname.split("/").at(-1);
  await ctx.close();
  return projectId;
}

/** Leasing is global: always switch it back on. */
async function startLeasing() {
  const { ctx, workers } = await context(browser);
  await workers.post("start");
  await ctx.close();
}

let stopWorkers = () => Promise.resolve();
try {
  await drain();
  // The drain's workers have exited; let them drop out of "online" (60 s without a heartbeat) before filming.
  await new Promise((r) => setTimeout(r, 65_000));
  // Scripted stages of three 3-second steps with twelve log lines each, on two workers.
  stopWorkers = startWorkers(2, 3_000, { executor: "scripted", logLines: 12 });
  const ledgerline = await submit("Ledgerline");
  const tidewater = await submit("Tidewater");

  // 1. Two projects running; Stop all workers from the Workers page: the dialog, Stopping…, then the banner.
  await clip("stop", "/workers", async (page, _project, workers) => {
    await workers.withStatus("Leased").nth(1).waitFor({ timeout: 30_000 });
    await page.waitForTimeout(2_000);
    await shot(page, "workers-running-desktop");
    await workers.stopAllButton.click();
    await workers.stopDialogSettled();
    await page.waitForTimeout(3_000);
    await shot(page, "stop-dialog-desktop");
    // Hold the request a moment so the busy state shows; the API then answers as it would.
    await page.route("**/api/workers/stop", async (route) => {
      await new Promise((r) => setTimeout(r, 1_200));
      await route.continue();
    });
    await workers.stopConfirm.click();
    await workers.stopping.waitFor();
    await shot(page, "stop-busy-desktop");
    await workers.stoppedBanner.waitFor({ timeout: 15_000 });
    await workers.rows.filter({ hasText: "Holding at checkpoint" }).nth(1).waitFor({ timeout: 10_000 });
    await page.waitForTimeout(4_000);
    await shot(page, "workers-stopped-desktop");
  });

  // 2. The halted project, and the stopped Workers page in dark mode, on a phone and for a Viewer.
  {
    const { ctx, page, project } = await context(browser);
    await project.open(ledgerline);
    await project.logLines.filter({ hasText: "Run halted at step" }).waitFor({ timeout: 10_000 });
    await page.waitForTimeout(800);
    await shot(page, "project-halted-desktop");
    await ctx.close();
  }
  for (const [width, height, tag, dark, login] of [
    [1280, 900, "desktop-dark", true, "quinntynebrown"],
    [390, 844, "phone", false, "quinntynebrown"],
    [1280, 900, "viewer-desktop", false, "ada"],
  ]) {
    const { ctx, page, workers } = await context(browser, { width, height, dark, login });
    await workers.open();
    await workers.stoppedBanner.waitFor();
    await page.waitForTimeout(800);
    await shot(page, `workers-stopped-${tag}`);
    await ctx.close();
  }

  // 3. Start workers on the halted project: the banner goes, the run is queued again and carries on from its checkpoint.
  await clip("start", `/projects/${ledgerline}`, async (page, project, workers) => {
    await workers.stoppedBanner.waitFor();
    await page.waitForTimeout(3_000);
    await workers.startWorkersButton.click();
    await workers.stoppedBanner.waitFor({ state: "detached", timeout: 15_000 });
    await project.logLines.filter({ hasText: "Queued again: workers started by" }).waitFor({ timeout: 15_000 });
    await page.waitForTimeout(7_000);
    await shot(page, "project-resumed-desktop");
  });
  {
    const { ctx, page, workers } = await context(browser);
    await workers.open();
    await workers.withStatus("Leased").nth(1).waitFor({ timeout: 30_000 });
    await page.waitForTimeout(800);
    await shot(page, "workers-resumed-desktop");
    await ctx.close();
  }

  // 4. A worker that stops answering: the failed dialog names it.
  await stopWorkers();
  stopWorkers = () => Promise.resolve();
  {
    const { ctx, page, workers } = await context(browser);
    await workers.open();
    await workers.stopAllButton.click();
    await workers.stopConfirm.click();
    await workers.stopTryAgain.waitFor({ timeout: 20_000 });
    await page.waitForTimeout(600);
    await shot(page, "stop-failed-desktop");
    await ctx.close();
  }
  void tidewater;
} finally {
  await startLeasing();
  await stopWorkers();
  await browser.close();
}
console.log(`screens in ${screens}, clips in ${here}`);
