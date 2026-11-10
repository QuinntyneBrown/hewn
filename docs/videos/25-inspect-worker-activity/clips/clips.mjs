// Captures the Mission Control screens and clips for the journey 25 video (Inspect worker activity) from a FRESH e2e
// stack, so Workers starts empty: two workers connect, one leases a direction and goes idle when it is cancelled,
// and the other stops and turns Offline 60 seconds after its last heartbeat. Start the stack first:
//   pwsh eng/Start-E2eApi.ps1
//   cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
// then from the repo root:
//   node docs/videos/25-inspect-worker-activity/clips/clips.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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
const tag = Date.now().toString(36).slice(-4);
const laptop = `laptop-${tag}`;
const cloud = `cloud-${tag}`;

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
  return { ctx, page, newDirection: new NewDirectionPage(page), project: new ProjectPage(page), workers: new WorkersPage(page) };
}

const shot = async (page, file, locator) => (
  await page.mouse.move(0, 0),
  (locator ?? page).screenshot({ path: join(screens, `${file}.png`), animations: "disabled", caret: "hide" })
);
const pause = (page, ms = 1_200) => page.waitForTimeout(ms);

/** Cancels a project's first direction as the signed-in Owner. */
async function cancelDirection(page, projectId) {
  await page.request.get("/api/me");
  const xsrf = (await page.context().cookies()).find((c) => c.name === "XSRF-TOKEN")?.value ?? "";
  const project = await (await page.request.get(`/api/projects/${projectId}`)).json();
  const r = await page.request.post(`/api/projects/${projectId}/directions/${project.directions[0].id}/cancel`, {
    data: {},
    headers: { "X-XSRF-TOKEN": xsrf },
  });
  if (!r.ok()) throw new Error(`cancel: ${r.status()}`);
}

const browser = await chromium.launch();

async function clip(file, act, opts = {}) {
  const raw = join(here, `.raw-${file}`);
  rmSync(raw, { recursive: true, force: true });
  const c = await context(browser, { width: 1408, height: 792, video: raw, ...opts });
  await act(c);
  await c.ctx.close();
  const webm = readdirSync(raw).find((f) => f.endsWith(".webm"));
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", join(raw, webm), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", join(here, `${file}.mp4`)]);
  rmSync(raw, { recursive: true, force: true });
}

const stops = [];
const records = {};
try {
  // 1. Before any worker connects: the empty state, for an Owner and a Viewer.
  for (const [file, login] of [["empty-owner", "quinntynebrown"], ["empty-viewer", "ada"]]) {
    const { ctx, page, workers } = await context(browser, { login });
    await workers.open();
    await workers.empty.waitFor();
    await pause(page, 400);
    await shot(page, file);
    await ctx.close();
  }

  // 2. Workers is open and empty; a Local and a Cloud worker connect and appear without a reload.
  await clip("connect", async ({ page, workers }) => {
    await workers.open();
    await workers.empty.waitFor();
    await pause(page, 2_500);
    const started = Date.now();
    stops.push(startWorkers(1, 1_500, { executor: "scripted", namePrefix: laptop, location: "Local" }));
    await workers.row(`${laptop}-1`).waitFor({ timeout: 10_000 });
    records.laptopShownAfterMs = Date.now() - started;
    await pause(page, 1_500);
    stops.push(startWorkers(1, 1_500, { executor: "scripted", namePrefix: cloud, location: "Cloud" }));
    await workers.row(`${cloud}-1`).waitFor({ timeout: 10_000 });
    await pause(page, 3_500);
  });

  // 3. A direction is submitted elsewhere: one worker shows Leased with the project, then Idle once it is cancelled.
  await clip("lease-and-idle", async ({ page, workers }) => {
    await workers.open();
    await pause(page, 1_500);
    const other = await context(browser);
    await other.newDirection.open();
    await other.newDirection.fill({ name: `Seed Swap ${tag}`, idea: "A seed swap register for a community garden." });
    await other.newDirection.submit();
    await other.project.currentStage().waitFor({ timeout: 20_000 });
    const projectId = new URL(other.page.url()).pathname.split("/")[2];
    await workers.rows.filter({ hasText: `Seed Swap ${tag}` }).waitFor({ timeout: 15_000 });
    await pause(page, 7_000);
    await shot(page, "workers-leased");
    await cancelDirection(other.page, projectId);
    await other.ctx.close();
    await workers.rows.filter({ hasText: `Seed Swap ${tag}` }).waitFor({ state: "detached", timeout: 20_000 });
    await pause(page, 3_500);
  });

  // 4. The Cloud worker stops; 60 seconds after it was last heard from, Workers shows it Offline.
  const cloudStop = stops.pop();
  await cloudStop();
  {
    const { ctx, workers } = await context(browser);
    const last = (await workers.workers()).workers.find((w) => w.name === `${cloud}-1`);
    records.offlineDueAt = Date.parse(last.lastSeenAt) + 60_000;
    await ctx.close();
  }
  while (Date.now() < records.offlineDueAt - 8_000) await new Promise((r) => setTimeout(r, 250));
  await clip("offline", async ({ page, workers }) => {
    await workers.open();
    await workers.details(`${cloud}-1`).status.filter({ hasText: "Offline" }).waitFor({ timeout: 20_000 });
    records.offlineShownAfterDueMs = Date.now() - records.offlineDueAt;
    await pause(page, 4_000);
    await shot(page, "workers-offline");
  });

  // 5. Loading and failed, then the page in dark mode and on a phone.
  {
    const { ctx, page, workers } = await context(browser);
    await workers.answerWorkers("hold");
    await page.goto("/workers");
    await workers.loading.waitFor();
    await shot(page, "loading");
    await page.unroute("**/api/workers");
    await workers.answerWorkers(503);
    await workers.open();
    await workers.loadFailure.waitFor();
    await shot(page, "error");
    await ctx.close();
  }
  for (const [file, opts] of [["workers-dark", { dark: true }], ["workers-phone", { width: 390, height: 844 }]]) {
    const { ctx, page, workers } = await context(browser, opts);
    await workers.open();
    await workers.rows.first().waitFor();
    await pause(page, 600);
    await shot(page, file);
    await ctx.close();
  }
  writeFileSync(join(screens, "records.json"), `${JSON.stringify(records, null, 2)}\n`);
} finally {
  await browser.close();
  await Promise.all(stops.map((stop) => stop()));
}
console.log(`screens in ${screens}, clips in ${here}`);
