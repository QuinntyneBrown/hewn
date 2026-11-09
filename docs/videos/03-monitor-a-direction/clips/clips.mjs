// Captures the Mission Control screens and the clip for the journey 3 video (Monitor a direction) from the running app, reusing
// the e2e page objects and starting a real scripted worker.
// Start the stack first (API on 5300 via eng/Start-E2eApi.ps1, Mission Control on 4300 with
// proxy.e2e.conf.json), then from the repo root:
//   node docs/videos/03-monitor-a-direction/clips/clips.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const { chromium } = createRequire(join(repo, "e2e/package.json"))(
  "@playwright/test",
);
const { NewDirectionPage } = await import(
  join(repo, "e2e/pages/new-direction.page.ts")
);
const { ProjectPage } = await import(join(repo, "e2e/pages/project.page.ts"));
const { startWorkers } = await import(join(repo, "e2e/support/workers.ts"));

const base = process.env.APP_URL ?? "http://localhost:4300";
const screens = resolve(here, "../screens");
mkdirSync(screens, { recursive: true });
const suffix = Date.now().toString(36).slice(-4);
const idea = "A web app for small accounting teams to reconcile bank and card statements.";

async function context(browser, { width, height, dark = false, video } = {}) {
  const ctx = await browser.newContext({
    baseURL: base,
    viewport: { width, height },
    deviceScaleFactor: width < 600 ? 2 : 1,
    colorScheme: dark ? "dark" : "light",
    ...(video ? { recordVideo: { dir: video, size: { width, height } } } : {}),
  });
  const page = await ctx.newPage();
  const r = await page.request.post("/api/auth/dev/sign-in", {
    data: { login: "quinntynebrown" },
  });
  if (r.status() !== 204) throw new Error(`sign in: ${r.status()}`);
  return {
    ctx,
    page,
    nd: new NewDirectionPage(page),
    project: new ProjectPage(page),
  };
}

const shot = async (page, name) => (
  await page.mouse.move(0, 0),
  page.screenshot({
    path: join(screens, `${name}.png`),
    animations: "disabled",
    caret: "hide",
  })
);

const browser = await chromium.launch();

/** Records one clip at 1408x792 while `act` drives the page, and converts it to H.264. */
async function clip(name, act) {
  const raw = join(here, `.raw-${name}`);
  rmSync(raw, { recursive: true, force: true });
  const { ctx, page, nd, project } = await context(browser, { width: 1408, height: 792, video: raw });
  await act(page, nd, project);
  await ctx.close();
  const webm = readdirSync(raw).find((f) => f.endsWith(".webm"));
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", join(raw, webm), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", join(here, `${name}.mp4`)]);
  rmSync(raw, { recursive: true, force: true });
}

async function submit(nd, name) {
  await nd.open();
  await nd.fill({ name, idea, budget: "300.00" });
  await nd.submit();
}

/** Runs whatever is left queued with fast workers, so each clip's direction starts at once. */
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

let stopWorkers = () => Promise.resolve();
try {
  // 1. Stages turning over live: a running stage's step and latest line, then Succeeded as the next starts.
  await drain();
  stopWorkers = startWorkers(1, 1800, { executor: "scripted", logLines: 12 });
  await clip("stages", async (page, nd, project) => {
    await submit(nd, `Ledgerline ${suffix}`);
    await project.liveLine("Bootstrap").waitFor({ timeout: 30_000 });
    await page.waitForTimeout(9_000);
  });
  await stopWorkers();

  // 2. The live log: following, scrolled up with the jump bar, then back to the latest.
  await drain();
  stopWorkers = startWorkers(1, 20_000, { executor: "scripted", logLines: 400 });
  await clip("log", async (page, nd, project) => {
    await submit(nd, `Glaze Library ${suffix}`);
    await project.log.waitFor({ timeout: 30_000 });
    // The first step writes nothing; follow the log for a few seconds once lines arrive.
    await project.logLines.nth(20).waitFor({ timeout: 40_000 });
    await page.waitForTimeout(4_000);
    // Scroll up in small steps, as a reader would.
    const { top } = await project.logPosition();
    for (let i = 1; i <= 12; i++) {
      await project.scrollLogTo(Math.max(0, Math.round(top * (1 - i / 12))));
      await page.waitForTimeout(80);
    }
    await project.jumpToLatest.waitFor();
    await page.waitForTimeout(3_500);
    await project.jumpToLatest.click();
    await page.waitForTimeout(3_000);
  });
  for (const [width, height, tag, dark] of [
    [1280, 900, "desktop", false],
    [1280, 900, "desktop-dark", true],
    [390, 844, "phone", false],
  ]) {
    const { ctx, page, project } = await context(browser, { width, height, dark });
    const list = await (await page.request.get("/api/projects")).json();
    await project.open(list.find((p) => p.name === `Glaze Library ${suffix}`).id);
    await project.log.waitFor();
    await page.waitForTimeout(1_500);
    await shot(page, `running-${tag}`);
    if (tag === "desktop") {
      await project.scrollLogTo(0);
      await project.jumpToLatest.waitFor();
      await shot(page, "log-scrolled-desktop");
    }
    await ctx.close();
  }
  await stopWorkers();

  // 3. A past stage, real executors: runs, log, artifacts and decisions.
  await drain();
  stopWorkers = startWorkers(1, 300, { executor: "stages" });
  const pastName = `Kiln Booking ${suffix}`;
  {
    const { ctx, nd, project } = await context(browser, { width: 1280, height: 900 });
    await submit(nd, pastName);
    await project.completeCallout.waitFor({ timeout: 150_000 });
    await ctx.close();
  }
  await stopWorkers();
  await clip("past-stage", async (page, _nd, project) => {
    const list = await (await page.request.get("/api/projects")).json();
    await project.open(list.find((p) => p.name === pastName).id);
    await page.waitForTimeout(1_500);
    await project.selectStage("Idea");
    await page.waitForTimeout(2_500);
    for (const tab of ["Runs", "Artifacts", "Decisions"]) {
      await project.tab(tab).click();
      await page.waitForTimeout(2_500);
    }
  });
  for (const [width, height, tag, dark] of [
    [1280, 900, "desktop", false],
    [1280, 900, "desktop-dark", true],
    [390, 844, "phone-dark", true],
  ]) {
    const { ctx, page, project } = await context(browser, { width, height, dark });
    const list = await (await page.request.get("/api/projects")).json();
    await project.open(list.find((p) => p.name === pastName).id);
    await project.selectStage("Idea");
    for (const tab of tag === "desktop" ? ["Log", "Runs", "Artifacts", "Decisions"] : ["Decisions"]) {
      await project.tab(tab).click();
      await page.waitForTimeout(600);
      await shot(page, `past-${tab.toLowerCase()}-${tag}`);
    }
    await ctx.close();
  }

  // 4. Waiting for a worker, with none running.
  {
    const { ctx, page, nd, project } = await context(browser, { width: 1280, height: 900 });
    await submit(nd, `Waiting ${suffix}`);
    await project.notice.waitFor();
    await shot(page, "waiting-desktop");
    await ctx.close();
  }
} finally {
  await stopWorkers();
  await browser.close();
}
console.log(`screens in ${screens}, clips in ${here}`);
