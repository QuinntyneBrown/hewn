// Captures the Mission Control screens and clips for the journey 10 video (Queue further directions) from the
// running app, reusing the e2e page objects and a real scripted worker.
// Start the stack first, with the default limit of 10 directions a minute (the e2e stack allows 30):
//   Hewn__RateLimit__DirectionsPerMinute=10 pwsh eng/Start-E2eApi.ps1
//   cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
// then from the repo root:
//   node docs/videos/10-queue-further-directions/clips/clips.mjs
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
/** The anti-forgery token, as e2e/support/queue.ts reads it. */
async function xsrfToken(page) {
  await page.request.get("/api/me");
  return (await page.context().cookies()).find((c) => c.name === "XSRF-TOKEN")?.value ?? "";
}

const base = process.env.APP_URL ?? "http://localhost:4300";
const screens = resolve(here, "../screens");
mkdirSync(screens, { recursive: true });
const suffix = Date.now().toString(36).slice(-4);
const idea = "A web app for small accounting teams to reconcile bank statements against the ledger.";
const csv = "Add a CSV export to the reconciliation report, so accountants can open it in Excel.";
const email = "Email a summary to the reviewer when a month is closed, with the totals per account.";

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
  // Scripted stages of three 1.2-second steps.
  stopWorkers = startWorkers(1, 1_200, { executor: "scripted", logLines: 3 });
  const name = `Ledgerline ${suffix}`;
  let projectId;
  {
    const { ctx, page, nd, project } = await context(browser);
    await nd.open();
    await nd.fill({ name, idea });
    await nd.submit();
    await project.logLines.filter({ hasText: "Bootstrap · line 2 of" }).waitFor({ timeout: 120_000 });
    projectId = new URL(page.url()).pathname.split("/").at(-1);
    await ctx.close();
  }

  // 1. Two feature directions submitted while the product direction runs; both queue on the project page.
  await clip("queue", `/projects/${projectId}`, async (page, project) => {
    const nd = new NewDirectionPage(page);
    // Paced to the narration: about 25 seconds in all.
    await page.waitForTimeout(3_500);
    for (const feature of [csv, email]) {
      await nd.open();
      await page.waitForTimeout(1_000);
      await nd.fillFeature({ product: name, feature, budget: "60.00" });
      await page.waitForTimeout(2_500);
      await nd.submit();
      await project.queuedCallout.waitFor();
      await page.waitForTimeout(4_000);
    }
    await project.queuedCallout.filter({ hasText: "2 directions queued" }).waitFor();
    await project.queuedCallout.scrollIntoViewIfNeeded();
    await page.waitForTimeout(3_500);
  });
  for (const [width, height, tag, dark, login] of [
    [1280, 900, "desktop", false, "quinntynebrown"],
    [1280, 900, "desktop-dark", true, "quinntynebrown"],
    [390, 844, "phone", false, "quinntynebrown"],
  ]) {
    const { ctx, page, project } = await context(browser, { width, height, dark, login });
    await project.open(projectId);
    await project.queuedCallout.filter({ hasText: "2 directions queued" }).waitFor();
    await project.queuedCallout.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await shot(page, `queued-${tag}`);
    await ctx.close();
  }

  // 2. The product direction completes and the CSV feature starts by itself; the email feature still waits.
  {
    const { ctx, project } = await context(browser);
    await project.open(projectId);
    for (let i = 0; i < 400 && !["Running", "Succeeded"].includes((await project.stageStatuses())[9]); i++)
      await project.heading.page().waitForTimeout(500);
    await ctx.close();
  }
  await clip("next", `/projects/${projectId}`, async (page, project) => {
    await project.headerMeta.filter({ hasText: "Feature direction" }).waitFor({ timeout: 120_000 });
    await project.queuedCallout.filter({ hasText: "1 direction queued" }).waitFor();
    await page.waitForTimeout(6_000);
    await shot(page, "next-desktop");
  });

  // 3. Over the limit: grace fills the minute, then New direction shows the rate-limited state.
  {
    const { ctx, page } = await context(browser, { login: "grace" });
    const headers = { "X-XSRF-TOKEN": await xsrfToken(page) };
    const made = [];
    for (;;) {
      const r = await page.request.post("/api/projects", {
        data: { name: `Limit ${suffix} ${made.length}`, idea, stackPreference: null, repositoryUrl: null, budgetUsd: 50 },
        headers,
      });
      if (r.status() === 429) break;
      if (r.status() !== 201) throw new Error(`submit: ${r.status()}`);
      made.push((await r.json()).projectId);
    }
    await ctx.close();
    for (const [width, height, tag, dark] of [
      [1280, 900, "desktop", false],
      [1280, 900, "desktop-dark", true],
      [390, 844, "phone", false],
    ]) {
      const { ctx: c, page: p, nd: n } = await context(browser, { width, height, dark, login: "grace" });
      await n.open();
      await n.fill({ name: `Tidewater ${suffix}`, idea });
      await n.submit();
      await n.rateLimited.waitFor();
      await n.rateLimited.scrollIntoViewIfNeeded();
      await p.waitForTimeout(600);
      await shot(p, `rate-limited-${tag}`);
      await c.close();
    }
    // Cancel what grace queued, so nothing is left to run.
    const { ctx: c, page: p } = await context(browser, { login: "grace" });
    const h = { "X-XSRF-TOKEN": await xsrfToken(p) };
    for (const id of made) {
      const proj = await (await p.request.get(`/api/projects/${id}`)).json();
      await p.request.post(`/api/projects/${id}/directions/${proj.directions[0].id}/cancel`, { data: {}, headers: h });
    }
    await c.close();
  }
} finally {
  await stopWorkers();
  await browser.close();
}
console.log(`screens in ${screens}, clips in ${here}`);
