// Captures the Mission Control screens and clips for the journey 7 video (Cancel a direction) from the
// running app, reusing the e2e page objects and a real scripted worker.
// Start the stack first (API on 5300 via eng/Start-E2eApi.ps1, Mission Control on 4300 with
// proxy.e2e.conf.json), then from the repo root:
//   node docs/videos/07-cancel-a-direction/clips/clips.mjs
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

/** Starts a direction and waits until `ready` holds on its page; returns the project's ID and repository. */
async function submit(name, ready) {
  const { ctx, page, nd, project } = await context(browser);
  await nd.open();
  await nd.fill({ name: `${name} ${suffix}`, idea });
  await nd.submit();
  await ready(project);
  const projectId = new URL(page.url()).pathname.split("/").at(-1);
  const repository = (await project.repository.innerText().catch(() => "")).trim();
  await ctx.close();
  return { projectId, repository };
}

let stopWorkers = () => Promise.resolve();
try {
  await drain();
  // Scripted stages of three 1.5-second steps; Scaffold opens a pull request at the start of its main step.
  stopWorkers = startWorkers(1, 1_500, { executor: "scripted", logLines: 12, pullRequestStage: 6 });
  const scaffold = await submit("Kiln Booking", (project) =>
    project.logLines.filter({ hasText: "Scaffold · line 1 of 12" }).waitFor({ timeout: 120_000 }),
  );

  // 1. Cancel mid-Scaffold, with pull request #1 open: the dialog, Cancelling…, then the cancelled page.
  await clip("cancel", scaffold.projectId, async (page, project) => {
    await page.waitForTimeout(1_500);
    await shot(page, "running-desktop");
    await project.cancelButton.click();
    await project.cancelDialogSettled();
    await page.waitForTimeout(2_500);
    await shot(page, "cancel-dialog-desktop");
    // Hold the request a moment so the busy state shows; the API then answers as it would.
    await page.route("**/cancel", async (route) => {
      await new Promise((r) => setTimeout(r, 1_200));
      await route.continue();
    });
    await project.cancelConfirm.click();
    await project.cancelling.waitFor();
    await shot(page, "cancel-busy-desktop");
    await project.cancelledCallout.waitFor({ timeout: 15_000 });
    await page.waitForTimeout(4_000);
    await shot(page, "cancelled-desktop");
  });

  // 2. The labelled pull request in the fake GitHub, and the cancelled page in dark mode, on a phone and for a Viewer.
  {
    // The fake GitHub's record of the pull request, formatted for the screen.
    const ctx = await browser.newContext({ baseURL: base, viewport: { width: 640, height: 380 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.request.post("/api/auth/dev/sign-in", { data: { login: "quinntynebrown" } });
    const path = `/api/fakes/github/${scaffold.repository}/pulls`;
    const json = JSON.stringify(await (await page.request.get(path)).json(), null, 2);
    await page.setContent(
      `<body style="margin:0;padding:20px 24px;background:#fff;font:17px/1.5 ui-monospace,Menlo,monospace;color:#1d1d1f">` +
        `<div style="color:#666;margin-bottom:8px">GET ${path}</div><pre style="margin:0;font:inherit"></pre></body>`,
    );
    await page.locator("pre").evaluate((el, text) => (el.textContent = text), json);
    await page.screenshot({ path: join(screens, "pull-request-json.png") });
    await ctx.close();
  }
  for (const [width, height, tag, dark, login] of [
    [1280, 900, "desktop-dark", true, "quinntynebrown"],
    [390, 844, "phone", false, "quinntynebrown"],
    [1280, 900, "viewer-desktop", false, "ada"],
  ]) {
    const { ctx, page, project } = await context(browser, { width, height, dark, login });
    await project.open(scaffold.projectId);
    await project.cancelledCallout.waitFor();
    await page.waitForTimeout(600);
    await shot(page, `cancelled-${tag}`);
    await ctx.close();
  }

  // 3. A queued direction starts once the active one is cancelled.
  await stopWorkers();
  stopWorkers = startWorkers(1, 4_000, { executor: "scripted", logLines: 4 });
  const queued = await submit("Glaze Library", (project) =>
    project.liveStep("Bootstrap").filter({ hasText: "Run Bootstrap" }).waitFor({ timeout: 60_000 }),
  );
  {
    const { ctx, page } = await context(browser);
    const token = (await page.request.get("/api/me"), (await ctx.cookies()).find((c) => c.name === "XSRF-TOKEN")?.value ?? "");
    const r = await page.request.post(`/api/projects/${queued.projectId}/directions`, {
      data: { idea: "Add CSV export to the firing schedule.", budgetUsd: 50 },
      headers: { "X-XSRF-TOKEN": token },
    });
    if (r.status() !== 201) throw new Error(`queue: ${r.status()}`);
    await ctx.close();
  }
  await clip("queue", queued.projectId, async (page, project) => {
    await page.waitForTimeout(2_500);
    await shot(page, "queued-desktop");
    await project.cancelButton.click();
    await project.cancelDialogSettled();
    await page.waitForTimeout(1_500);
    await project.cancelConfirm.click();
    await project.cancelDialog.waitFor({ state: "detached", timeout: 15_000 });
    await project.liveStep("Idea").filter({ hasText: "Run Idea" }).waitFor({ timeout: 30_000 });
    await page.waitForTimeout(3_000);
    await shot(page, "next-direction-desktop");
  });

  // 4. A worker that stops answering: the failed dialog names it.
  const silent = await submit("Clay Ledger", (project) =>
    project.liveStep("Bootstrap").filter({ hasText: "Run Bootstrap" }).waitFor({ timeout: 60_000 }),
  );
  await stopWorkers();
  stopWorkers = () => Promise.resolve();
  {
    const { ctx, page, project } = await context(browser);
    await project.open(silent.projectId);
    await project.cancelButton.click();
    await project.cancelConfirm.click();
    await project.cancelTryAgain.waitFor({ timeout: 20_000 });
    await page.waitForTimeout(600);
    await shot(page, "cancel-failed-desktop");
    await ctx.close();
  }
} finally {
  await stopWorkers();
  await browser.close();
}
console.log(`screens in ${screens}, clips in ${here}`);
