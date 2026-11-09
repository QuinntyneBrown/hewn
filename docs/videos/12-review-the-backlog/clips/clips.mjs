// Captures the Mission Control screens and clips for the journey 12 video (Review the backlog) from the running app,
// reusing the e2e page objects and real workers running the stage executors against the fakes. Start a fresh stack
// first, so no other suite's directions are queued:
//   pwsh eng/Start-E2eApi.ps1
//   cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
// then from the repo root:
//   node docs/videos/12-review-the-backlog/clips/clips.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const { chromium } = createRequire(join(repo, "e2e/package.json"))("@playwright/test");
const { BacklogPage } = await import(join(repo, "e2e/pages/backlog.page.ts"));
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
const ideas = {
  "Parcel Post": "A shared mailroom log for coworking spaces, with parcels in and signatures out.",
  "Kiln Booking": "Studio time booking for shared ceramics kilns, with firing schedules. Nice to have: review history.",
};

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
  return { ctx, page, backlog: new BacklogPage(page) };
}

const shot = async (page, name) => (
  await page.mouse.move(0, 0),
  page.screenshot({ path: join(screens, `${name}.png`), animations: "disabled", caret: "hide" })
);

const browser = await chromium.launch();


/** Records `act` in a 1408x792 page opened at `path` and writes it to clips/<name>.mp4. */
async function clip(name, path, act) {
  const raw = join(here, `.raw-${name}`);
  rmSync(raw, { recursive: true, force: true });
  const { ctx, page, backlog } = await context(browser, { width: 1408, height: 792, video: raw });
  await page.goto(path);
  await act(page, backlog);
  await ctx.close();
  const webm = readdirSync(raw).find((f) => f.endsWith(".webm"));
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", join(raw, webm), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", join(here, `${name}.mp4`)]);
  rmSync(raw, { recursive: true, force: true });
}

const owner = await context(browser);
const headers = { "X-XSRF-TOKEN": await xsrfToken(owner.page) };
const ids = {};
async function submit(name) {
  const r = await owner.page.request.post("/api/projects", {
    data: { name, idea: ideas[name], stackPreference: null, repositoryUrl: null, budgetUsd: 300 },
    headers,
  });
  if (r.status() !== 201) throw new Error(`submit ${name}: ${r.status()}`);
  ids[name] = (await r.json()).projectId;
}
const backlogOf = async (name) => (await owner.page.request.get(`/api/projects/${ids[name]}/backlog`)).json();
async function until(name, test, seconds = 240) {
  for (let i = 0; i < seconds * 2; i++) {
    if (test(await backlogOf(name))) return;
    await owner.page.waitForTimeout(500);
  }
  throw new Error(`${name} never got there`);
}

let stopWorkers = () => Promise.resolve();
try {
  // 1. Parcel Post: its Main workflow increment is never implemented, so it blocks after 10 iterations. (The stage
  // executors run against fakes and report no model usage, so spend stays $0.00.)
  await submit("Parcel Post");
  stopWorkers = startWorkers(1, 150, { blockIncrement: "Main workflow", incrementMs: 1_500 });
  await until("Parcel Post", (b) => b.increments.some((i) => i.status === "Blocked"), 400);
  await stopWorkers();
  for (const [width, height, tag, dark] of [
    [1280, 900, "desktop", false],
    [1280, 900, "desktop-dark", true],
    [390, 844, "phone", false],
  ]) {
    const { ctx, page, backlog } = await context(browser, { width, height, dark });
    await backlog.open(ids["Parcel Post"]);
    await backlog.blockedCallout.waitFor();
    await page.waitForTimeout(800);
    await shot(page, `blocked-${tag}`);
    await ctx.close();
  }

  // 2. Kiln Booking, live: the Backlog is open before stage 9, then a slowed worker builds and merges each increment.
  await submit("Kiln Booking");
  {
    const { ctx, page, backlog } = await context(browser);
    await backlog.open(ids["Kiln Booking"]);
    await backlog.emptyTitle.waitFor();
    await page.waitForTimeout(500);
    await shot(page, "empty-desktop");
    await ctx.close();
  }
  await clip("live", `/projects/${ids["Kiln Booking"]}/backlog`, async (page, backlog) => {
    await backlog.emptyTitle.waitFor();
    await page.waitForTimeout(2_000);
    // Each stage 10 session takes 4 seconds, so each increment is In progress for a while.
    stopWorkers = startWorkers(1, 150, { incrementMs: 4_000 });
    await backlog.rows.first().waitFor({ timeout: 120_000 });
    await page.waitForTimeout(1_500);
    await backlog.deferredSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(3_000);
    await page.mouse.wheel(0, -2_000);
    await backlog.row(1).status.filter({ hasText: "In progress" }).waitFor({ timeout: 60_000 });
    await page.waitForTimeout(1_000);
    await shot(page, "in-progress-desktop");
    await backlog.row(1).status.filter({ hasText: "Merged" }).waitFor({ timeout: 120_000 });
    await page.waitForTimeout(2_500);
    await backlog.row(2).status.filter({ hasText: "Merged" }).waitFor({ timeout: 120_000 });
    await page.waitForTimeout(2_000);
  });
  await until("Kiln Booking", (b) => b.percentComplete === 100);
  await stopWorkers();
  for (const [width, height, tag, dark] of [
    [1280, 900, "desktop", false],
    [1280, 900, "desktop-dark", true],
    [390, 844, "phone", false],
  ]) {
    const { ctx, page, backlog } = await context(browser, { width, height, dark });
    await backlog.open(ids["Kiln Booking"]);
    await backlog.deferred.first().waitFor();
    await page.waitForTimeout(800);
    await shot(page, `merged-${tag}`);
    await ctx.close();
  }

  // Leave nothing running: Parcel Post is blocked, so cancel it.
  const parcel = await (await owner.page.request.get(`/api/projects/${ids["Parcel Post"]}`)).json();
  await owner.page.request.post(`/api/projects/${ids["Parcel Post"]}/directions/${parcel.directions.at(-1).id}/cancel`, { data: {}, headers });
} finally {
  await stopWorkers();
  await owner.ctx.close();
  await browser.close();
}
console.log(`screens in ${screens}, clips in ${here}`);
