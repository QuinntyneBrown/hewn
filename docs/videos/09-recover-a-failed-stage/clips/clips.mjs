// Captures the Mission Control screens and clips for the journey 9 video (Recover a failed stage) from the running
// app, reusing the e2e page objects and a real scripted worker whose Idea stage fails four times, then passes.
// Start the stack first, with retry waits long enough to watch (the e2e default is 2, 3 and 4 seconds):
//   Hewn__Retry__BackoffSeconds=5,8,12 pwsh eng/Start-E2eApi.ps1
//   cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
// then from the repo root:
//   node docs/videos/09-recover-a-failed-stage/clips/clips.mjs
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
const idea = "A web app for a parcel courier to book, track and reroute deliveries.";
const reason = "Validation failed: docs/brief.md has no success measures the idea can support";

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

/** Records `act` in a 1408x792 page opened at `path` and writes it to clips/<name>.mp4. */
async function clip(name, path, act) {
  const raw = join(here, `.raw-${name}`);
  rmSync(raw, { recursive: true, force: true });
  const { ctx, page, project } = await context(browser, { width: 1408, height: 792, video: raw });
  await page.goto(path);
  await act(page, project);
  await ctx.close();
  const webm = readdirSync(raw).find((f) => f.endsWith(".webm"));
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", join(raw, webm), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", join(here, `${name}.mp4`)]);
  rmSync(raw, { recursive: true, force: true });
}

let stopWorkers = () => Promise.resolve();
try {
  await drain();
  await new Promise((r) => setTimeout(r, 65_000));
  // Scripted stages of three 0.8-second steps; Idea fails four times (the run and its three retries), then passes.
  stopWorkers = startWorkers(1, 800, { executor: "scripted", logLines: 4, fail: { stage: 1, times: 4, reason } });
  let projectId;
  {
    const { ctx, page, nd, project } = await context(browser);
    await nd.open();
    await nd.fill({ name: `Parcel Post ${suffix}`, idea });
    await nd.submit();
    await project.logLines.filter({ hasText: "Bootstrap · line 2 of" }).waitFor({ timeout: 120_000 });
    projectId = new URL(page.url()).pathname.split("/").at(-1);
    await ctx.close();
  }

  // 1. Idea fails; each retry counts down in its live line; the third retry fails and the stage blocks.
  await clip("retries", `/projects/${projectId}`, async (page, project) => {
    await project.liveStep("Idea").filter({ hasText: /Retry 1 of 3 in 0:0[3-5]/ }).waitFor({ timeout: 60_000 });
    await shot(page, "retrying-desktop");
    await project.projectStatus.filter({ hasText: "Blocked" }).waitFor({ timeout: 90_000 });
    await project.blockedToast.waitFor();
    await page.waitForTimeout(2_500);
    await shot(page, "blocked-desktop");
  });

  // 2. The Blocked page: every attempt on the Runs tab, dark mode, a phone, and a Viewer.
  {
    const { ctx, page, project } = await context(browser);
    await project.open(projectId);
    await project.blockedCallout.waitFor();
    await project.tab("Runs").click();
    await project.runRows.nth(3).waitFor();
    await page.waitForTimeout(600);
    await shot(page, "blocked-runs-desktop");
    await ctx.close();
  }
  for (const [width, height, tag, dark, login] of [
    [1280, 900, "desktop-dark", true, "quinntynebrown"],
    [390, 844, "phone", false, "quinntynebrown"],
    [1280, 900, "viewer-desktop", false, "ada"],
  ]) {
    const { ctx, page, project } = await context(browser, { width, height, dark, login });
    await project.open(projectId);
    await project.blockedCallout.waitFor();
    if (width < 600) await project.blockedCallout.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await shot(page, `blocked-${tag}`);
    await ctx.close();
  }

  // 3. Retry stage: Idea runs again from its start, succeeds, and the direction carries on.
  await clip("retry", `/projects/${projectId}`, async (page, project) => {
    await project.blockedCallout.waitFor();
    await page.waitForTimeout(2_500);
    await project.calloutRetryStage.click();
    await project.projectStatus.filter({ hasText: "Running" }).waitFor({ timeout: 10_000 });
    for (let i = 0; i < 60 && (await project.stageStatuses())[1] !== "Succeeded"; i++) await page.waitForTimeout(500);
    await page.waitForTimeout(3_000);
    await shot(page, "retried-desktop");
  });
} finally {
  await stopWorkers();
  await browser.close();
}
console.log(`screens in ${screens}, clips in ${here}`);
