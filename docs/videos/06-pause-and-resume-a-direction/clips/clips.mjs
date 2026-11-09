// Captures the Mission Control screens and clips for the journey 6 video (Pause and resume a direction) from the
// running app, reusing the e2e page objects and a real scripted worker.
// Start the stack first (API on 5300 via eng/Start-E2eApi.ps1, Mission Control on 4300 with
// proxy.e2e.conf.json), then from the repo root:
//   node docs/videos/06-pause-and-resume-a-direction/clips/clips.mjs
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
  return { ctx, page, nd: new NewDirectionPage(page), project: new ProjectPage(page) };
}

const shot = async (page, name) => (
  await page.mouse.move(0, 0),
  page.screenshot({ path: join(screens, `${name}.png`), animations: "disabled", caret: "hide" })
);

const browser = await chromium.launch();

/** Runs whatever is left queued with fast workers, so this video's direction starts at once. */
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

/** Records `act` in a 1408x792 page and writes it to clips/<name>.mp4. */
async function clip(name, projectId, act) {
  const raw = join(here, `.raw-${name}`);
  rmSync(raw, { recursive: true, force: true });
  const { ctx, page, project } = await context(browser, { width: 1408, height: 792, video: raw });
  await project.open(projectId);
  await act(page, project);
  await ctx.close();
  const webm = readdirSync(raw).find((f) => f.endsWith(".webm"));
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", join(raw, webm), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", join(here, `${name}.mp4`)]);
  rmSync(raw, { recursive: true, force: true });
}

let stopWorkers = () => Promise.resolve();
try {
  await drain();
  // Each scripted stage runs three 5-second steps: Prepare workspace, Run <stage>, Commit artifacts.
  stopWorkers = startWorkers(1, 5_000, { executor: "scripted", logLines: 5 });
  let projectId;
  {
    const { ctx, page, nd, project } = await context(browser);
    await nd.open();
    await nd.fill({ name: `Kiln Booking ${suffix}`, idea });
    await nd.submit();
    await project.liveStep("Bootstrap").waitFor({ timeout: 60_000 });
    projectId = new URL(page.url()).pathname.split("/").at(-1);
    await ctx.close();
  }

  // 1. Pause mid-step: Pausing… while Run Bootstrap finishes, then Paused at its checkpoint.
  await clip("pause", projectId, async (page, project) => {
    await project.liveStep("Bootstrap").filter({ hasText: "Run Bootstrap" }).waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1_500);
    await shot(page, "running-desktop");
    await project.pauseButton.click();
    await project.pausingButton.waitFor();
    await page.waitForTimeout(300);
    await shot(page, "pausing-desktop");
    await project.pausedCallout.waitFor({ timeout: 30_000 });
    await page.waitForTimeout(3_500);
    await shot(page, "paused-desktop");
  });

  // 2. The paused page in dark mode, on a phone, and for a Viewer.
  for (const [width, height, tag, dark, login] of [
    [1280, 900, "desktop-dark", true, "quinntynebrown"],
    [390, 844, "phone", false, "quinntynebrown"],
    [1280, 900, "viewer-desktop", false, "ada"],
  ]) {
    const { ctx, page, project } = await context(browser, { width, height, dark, login });
    await project.open(projectId);
    await project.pausedCallout.waitFor();
    await page.waitForTimeout(600);
    await shot(page, `paused-${tag}`);
    await ctx.close();
  }

  // 3. Resume: the same run carries on with Commit artifacts, then Idea starts.
  await clip("resume", projectId, async (page, project) => {
    await page.waitForTimeout(2_000);
    await project.resumeButton.click();
    await project.pauseButton.waitFor();
    await project.liveStep("Idea").waitFor({ timeout: 60_000 });
    await page.waitForTimeout(3_000);
    await project.selectStage("Bootstrap");
    await page.waitForTimeout(3_000);
    await shot(page, "bootstrap-log-desktop");
  });
} finally {
  await stopWorkers();
  await browser.close();
}
console.log(`screens in ${screens}, clips in ${here}`);
