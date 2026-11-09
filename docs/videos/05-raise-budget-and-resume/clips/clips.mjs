// Captures the Mission Control screens and the clip for the journey 5 video (Raise budget and resume) from the
// running app, reusing the e2e page objects and a real scripted worker that reports model calls.
// Start the stack first (API on 5300 via eng/Start-E2eApi.ps1, Mission Control on 4300 with
// proxy.e2e.conf.json), then from the repo root:
//   node docs/videos/05-raise-budget-and-resume/clips/clips.mjs
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

let stopWorkers = () => Promise.resolve();
try {
  // A direction with a $10 budget, paused at "Budget reached" by a worker reporting $0.60 calls.
  await drain();
  stopWorkers = startWorkers(1, 1500, { executor: "scripted", logLines: 10, modelCalls: 10, callTokens: 100_000 });
  const name = `Kiln Booking ${suffix}`;
  let projectId;
  {
    const { ctx, page, nd, project } = await context(browser);
    await nd.open();
    await nd.fill({ name, idea, budget: "10.00" });
    await nd.submit();
    await project.budgetReachedCallout.waitFor({ timeout: 60_000 });
    projectId = new URL(page.url()).pathname.split("/").at(-1);
    await ctx.close();
  }

  // 1. Screens of the pause and the dialog in each state.
  for (const [width, height, tag, dark] of [
    [1280, 900, "desktop", false],
    [1280, 900, "desktop-dark", true],
    [390, 844, "phone", false],
  ]) {
    const { ctx, page, project } = await context(browser, { width, height, dark });
    await project.open(projectId);
    await project.budgetReachedCallout.waitFor();
    await page.waitForTimeout(600);
    await shot(page, `budget-reached-${tag}`);
    await project.raiseBudget.click();
    await project.dialogBudget.waitFor();
    await page.waitForTimeout(600);
    await shot(page, `dialog-${tag}`);
    if (tag === "desktop") {
      await project.dialogBudget.fill("10.00");
      await project.dialogConfirm.click();
      await project.dialogBudgetError.waitFor();
      await project.restInDialog();
      await shot(page, "dialog-invalid-desktop");
    }
    await ctx.close();
  }
  {
    const { ctx, page, project } = await context(browser, { login: "ada" });
    await project.open(projectId);
    await project.budgetReachedCallout.waitFor();
    await page.waitForTimeout(600);
    await shot(page, "viewer-budget-reached-desktop");
    await ctx.close();
  }

  // A second Owner session opens the dialog now, and confirms only after the clip raised the budget.
  const other = await context(browser);
  await other.project.open(projectId);
  await other.project.raiseBudget.click();
  await other.project.dialogBudget.fill("30.00");

  // 2. The clip: an amount at or below the spend is refused inline; $20 raises the budget and the run resumes.
  const raw = join(here, ".raw-raise");
  rmSync(raw, { recursive: true, force: true });
  {
    const { ctx, page, project } = await context(browser, { width: 1408, height: 792, video: raw });
    await project.open(projectId);
    await project.budgetReachedCallout.waitFor();
    await page.waitForTimeout(2_500);
    await project.calloutNewBudget.fill("");
    await project.calloutNewBudget.pressSequentially("10", { delay: 150 });
    await project.raiseBudget.click();
    await page.waitForTimeout(1_200);
    await project.dialogConfirm.click();
    await project.dialogBudgetError.waitFor();
    await page.waitForTimeout(3_000);
    await project.dialogBudget.fill("");
    await project.dialogBudget.pressSequentially("20", { delay: 150 });
    await page.waitForTimeout(800);
    await project.dialogConfirm.click();
    await project.raiseDialog.waitFor({ state: "detached" });
    await page.waitForTimeout(9_000);
    await shot(page, "resumed-desktop");
    await ctx.close();
  }
  const webm = readdirSync(raw).find((f) => f.endsWith(".webm"));
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", join(raw, webm), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", join(here, "raise.mp4")]);
  rmSync(raw, { recursive: true, force: true });

  // 3. The other session's stale dialog: the API answers 409 and nothing changes.
  await other.project.dialogConfirm.click();
  await other.project.dialogFailure.waitFor();
  await other.project.restInDialog();
  await shot(other.page, "dialog-failed-desktop");
  await other.ctx.close();
} finally {
  await stopWorkers();
  await browser.close();
}
console.log(`screens in ${screens}, clips in ${here}`);
