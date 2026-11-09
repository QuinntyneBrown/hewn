// Captures the Mission Control screens and clips for the journey 11 video (Find a project) from the running app,
// reusing the e2e page objects and real scripted workers. Start a fresh stack first (the empty states need a
// database with no projects), and run `npm run test:perf` in e2e/ for the Lighthouse report:
//   pwsh eng/Start-E2eApi.ps1
//   cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
// then from the repo root:
//   node docs/videos/11-find-a-project/clips/clips.mjs
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const { chromium } = createRequire(join(repo, "e2e/package.json"))("@playwright/test");
const { ProjectsPage } = await import(join(repo, "e2e/pages/projects.page.ts"));
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
  "Field Notes": "Offline survey capture for ecology field teams, synced when they're back in range.",
  "Parcel Post": "A shared mailroom log for coworking spaces: parcels in, members notified, signatures out.",
  "Harbor CRM": "A lightweight CRM for marina slip rentals, with renewals and waiting lists.",
  "Kiln Booking": "Studio time booking for shared ceramics kilns, with firing schedules and costs.",
  "Ledgerline": "Expense reconciliation for small accounting teams, matching statements to receipts.",
  "Tidewater": "A tide and swell planner for small-boat charters, with go and no-go calls.",
  "Northwind Ops": "A shift report for a warehouse operations team, with handovers and incidents.",
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
  return { ctx, page, projects: new ProjectsPage(page) };
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
  const { ctx, page, projects } = await context(browser, { width: 1408, height: 792, video: raw });
  await page.goto(path);
  await act(page, projects);
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
const detail = async (name) => (await owner.page.request.get(`/api/projects/${ids[name]}`)).json();
async function until(name, status, seconds = 180) {
  for (let i = 0; i < seconds * 2; i++) {
    if ((await detail(name)).status === status) return;
    await owner.page.waitForTimeout(500);
  }
  throw new Error(`${name} never became ${status}`);
}
async function control(name, action) {
  const d = await detail(name);
  const r = await owner.page.request.post(`/api/projects/${ids[name]}/directions/${d.directions.at(-1).id}/${action}`, { data: {}, headers });
  if (!r.ok()) throw new Error(`${action} ${name}: ${r.status()}`);
}

let stopWorkers = () => Promise.resolve();
try {
  // 1. Empty: run against a freshly started API, before any project exists.
  if ((await (await owner.page.request.get("/api/projects")).json()).length > 0) throw new Error("start a fresh e2e API first");
  for (const [width, height, tag, login] of [
    [1280, 900, "owner-desktop", "quinntynebrown"],
    [1280, 900, "viewer-desktop", "ada"],
    [390, 844, "owner-phone", "quinntynebrown"],
  ]) {
    const { ctx, page, projects } = await context(browser, { width, height, login });
    await projects.open();
    await projects.emptyTitle.waitFor();
    await page.waitForTimeout(500);
    await shot(page, `empty-${tag}`);
    await ctx.close();
  }

  // 2. Projects in every state the list shows, each run by real scripted workers.
  await submit("Field Notes");
  stopWorkers = startWorkers(1, 40, { executor: "scripted", logLines: 1, modelCalls: 1, callTokens: 150_000 });
  await until("Field Notes", "Idle");
  await stopWorkers();

  await submit("Parcel Post");
  stopWorkers = startWorkers(1, 200, { executor: "scripted", logLines: 1, modelCalls: 1, callTokens: 150_000, fail: { stage: 5, times: 4, reason: "Validation failed: docs/specs/L2.md has criteria with no Given" } });
  await until("Parcel Post", "Blocked");
  await stopWorkers();

  await submit("Harbor CRM");
  await control("Harbor CRM", "cancel");
  await until("Harbor CRM", "Cancelled");

  for (const name of ["Kiln Booking", "Ledgerline", "Tidewater"]) await submit(name);
  // Slow scripted stages of three 2.5-second steps, one worker each.
  stopWorkers = startWorkers(3, 2_500, { executor: "scripted", logLines: 2, modelCalls: 1, callTokens: 150_000 });
  await until("Kiln Booking", "Running");
  await owner.page.waitForTimeout(9_000);
  await control("Kiln Booking", "pause");
  await until("Kiln Booking", "Paused", 60);

  for (const [width, height, tag, dark] of [
    [1280, 900, "desktop", false],
    [1280, 900, "desktop-dark", true],
    [390, 844, "phone", false],
  ]) {
    const { ctx, page, projects } = await context(browser, { width, height, dark });
    await projects.open();
    await projects.rows.nth(5).waitFor();
    await page.waitForTimeout(800);
    await shot(page, `list-${tag}`);
    await ctx.close();
  }

  // 3. Filter by Blocked, reload, and the filter is still there.
  await clip("filter", "/projects", async (page, projects) => {
    await projects.rows.nth(5).waitFor();
    await page.waitForTimeout(2_500);
    await projects.tab("Blocked").click();
    await page.waitForTimeout(3_500);
    await page.reload();
    await projects.rows.first().waitFor();
    await page.waitForTimeout(3_500);
    await shot(page, "filtered-desktop");
    await projects.tab("Running").click();
    await page.waitForTimeout(3_000);
    await projects.tab("All").click();
    await page.waitForTimeout(2_000);
  });

  // 4. Live: rows move on as the workers run, and a new project's row appears.
  await clip("live", "/projects", async (page, projects) => {
    await projects.rows.nth(5).waitFor();
    await page.waitForTimeout(6_000);
    await submit("Northwind Ops");
    await projects.row("Northwind Ops").root.waitFor();
    await page.waitForTimeout(12_000);
    await shot(page, "live-desktop");
  });

  // 5. The Lighthouse report from `npm run test:perf`, if it has run.
  const report = join(repo, "e2e/perf-results/lighthouse-report.html");
  if (existsSync(report)) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`file://${report}`);
    await page.waitForTimeout(1_500);
    await shot(page, "lighthouse");
    await ctx.close();
  }

  // Leave nothing running for later runs.
  await stopWorkers();
  for (const name of ["Ledgerline", "Tidewater", "Kiln Booking", "Northwind Ops"]) await control(name, "cancel").catch(() => undefined);
} finally {
  await stopWorkers();
  await owner.ctx.close();
  await browser.close();
}
console.log(`screens in ${screens}, clips in ${here}`);
