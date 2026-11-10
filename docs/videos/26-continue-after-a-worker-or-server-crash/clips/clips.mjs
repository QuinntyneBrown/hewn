// Captures the screens and clips for the journey 26 video (Continue after a worker or server crash). A worker is
// killed mid-run and a standby resumes after its checkpoint; then the API is killed and restarted on the same
// database while a run is under way. Start the stack first:
//   pwsh eng/Start-E2eApi.ps1
//   cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
// then from the repo root:
//   node docs/videos/26-continue-after-a-worker-or-server-crash/clips/clips.mjs
// The script restarts the API itself with `pwsh eng/Start-E2eApi.ps1 -KeepDatabase` and leaves it running.
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, openSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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
const records = {};

async function context(browser, { width = 1280, height = 900, dark = false, video } = {}) {
  const ctx = await browser.newContext({
    baseURL: base,
    viewport: { width, height },
    deviceScaleFactor: width < 600 ? 2 : 1,
    colorScheme: dark ? "dark" : "light",
    ...(video ? { recordVideo: { dir: video, size: { width, height } } } : {}),
  });
  const page = await ctx.newPage();
  const r = await page.request.post("/api/auth/dev/sign-in", { data: { login: "quinntynebrown" } });
  if (r.status() !== 204) throw new Error(`sign in: ${r.status()}`);
  return { ctx, page, newDirection: new NewDirectionPage(page), project: new ProjectPage(page), workers: new WorkersPage(page) };
}

const shot = async (page, file) => (
  await page.mouse.move(0, 0), page.screenshot({ path: join(screens, `${file}.png`), animations: "disabled", caret: "hide" })
);

async function encode(raw, file, startSec = 0) {
  const webm = readdirSync(raw).find((f) => f.endsWith(".webm"));
  execFileSync("ffmpeg", ["-y", "-v", "error", "-ss", String(startSec), "-i", join(raw, webm), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", join(here, `${file}.mp4`)]);
  rmSync(raw, { recursive: true, force: true });
}

/** Opens a recording context; the clip is encoded when `done` is called. */
async function recording(browser, file, opts = {}) {
  const raw = join(here, `.raw-${file}`);
  rmSync(raw, { recursive: true, force: true });
  const c = await context(browser, { width: 1408, height: 792, video: raw, ...opts });
  const startedAt = Date.now();
  // `keepFrom` drops the wait before a moment worth watching, keeping 10 s before it.
  return {
    ...c,
    done: async (keepFrom) => (
      await c.ctx.close(), await encode(raw, file, keepFrom ? Math.max(0, (keepFrom - startedAt) / 1000 - 10) : 0)
    ),
  };
}

async function submit(c, name) {
  await c.newDirection.open();
  await c.newDirection.fill({ name, idea: "A seed swap register for a community garden." });
  await c.newDirection.submit();
  await c.project.currentStage().waitFor({ timeout: 20_000 });
  return new URL(c.page.url()).pathname.split("/")[2];
}

async function cancel(page, projectId) {
  await page.request.get("/api/me");
  const xsrf = (await page.context().cookies()).find((c) => c.name === "XSRF-TOKEN")?.value ?? "";
  const project = await (await page.request.get(`/api/projects/${projectId}`)).json();
  await page.request.post(`/api/projects/${projectId}/directions/${project.directions[0].id}/cancel`, {
    data: {},
    headers: { "X-XSRF-TOKEN": xsrf },
  });
}

const health = async () => fetch("http://localhost:5300/health/live").then((r) => r.ok, () => false);

const browser = await chromium.launch();
const stops = [];
try {
  // 1. A Local worker leases a direction; a Cloud standby waits. The laptop is killed after its first checkpoint.
  stops.push(startWorkers(1, 8_000, { executor: "scripted", namePrefix: laptop, location: "Local", logLines: 3 }));
  const crash = await recording(browser, "kill");
  await crash.workers.open();
  await crash.workers.row(`${laptop}-1`).waitFor({ timeout: 10_000 });
  const setup = await context(browser);
  const crashProject = await submit(setup, `Seed Swap ${tag}`);
  stops.push(startWorkers(1, 7_000, { executor: "scripted", namePrefix: cloud, location: "Cloud", logLines: 3 }));
  await crash.workers.details(`${laptop}-1`).status.filter({ hasText: "Leased" }).waitFor({ timeout: 15_000 });
  await crash.workers.row(`${cloud}-1`).waitFor({ timeout: 10_000 });
  await crash.page.waitForTimeout(11_000);
  await shot(crash.page, "workers-before-kill");
  await stops[0]("SIGKILL");
  records.killedAt = Date.now();
  await crash.page.waitForTimeout(4_000);
  await crash.done();

  // 2. On the project page: the lease expires about 60 s after the last heartbeat and the standby resumes.
  while (Date.now() < records.killedAt + 45_000) await new Promise((r) => setTimeout(r, 250));
  const resume = await recording(browser, "resume");
  await resume.page.goto(`/projects/${crashProject}`);
  await resume.project.selectStage("Bootstrap");
  await resume.project.logLines.filter({ hasText: `Resumed by ${cloud}-1 after step 1` }).waitFor({ timeout: 60_000 });
  const resumedAt = Date.now();
  records.resumedAfterKillMs = resumedAt - records.killedAt;
  await resume.page.waitForTimeout(3_000);
  await shot(resume.page, "project-resumed");
  await resume.done(resumedAt);
  {
    const { ctx, page, workers } = await context(browser);
    await workers.open();
    await workers.details(`${laptop}-1`).status.filter({ hasText: "Offline" }).waitFor({ timeout: 20_000 });
    await shot(page, "workers-after-resume");
    for (const [file, opts] of [["project-resumed-dark", { dark: true }], ["project-resumed-phone", { width: 390, height: 844 }]]) {
      const c = await context(browser, opts);
      await c.page.goto(`/projects/${crashProject}`);
      await c.project.currentStage().waitFor();
      await c.project.selectStage("Bootstrap");
      const line = c.project.logLines.filter({ hasText: "Resumed by" }).first();
      // On a phone the log sits below the pipeline; bring it into view when it is there.
      if (await line.waitFor({ timeout: 5_000 }).then(() => true, () => false)) await line.scrollIntoViewIfNeeded();
      await c.page.waitForTimeout(400);
      await shot(c.page, file);
      await c.ctx.close();
    }
    await cancel(page, crashProject);
    await ctx.close();
  }

  // 3. A new direction runs on the Cloud worker; the API is killed and started again on the same database.
  const restartProject = await submit(setup, `Kiln Booking ${tag}`);
  const restart = await recording(browser, "restart");
  await restart.page.goto(`/projects/${restartProject}`);
  await restart.page.waitForTimeout(4_000);
  const pids = execFileSync("lsof", ["-ti", "tcp:5300", "-sTCP:LISTEN"]).toString().trim().split("\n").filter(Boolean);
  for (const pid of pids) process.kill(Number(pid), "SIGKILL");
  records.apiKilledAt = Date.now();
  const log = openSync(join(here, ".api-restart.log"), "w");
  spawn("pwsh", [join(repo, "eng/Start-E2eApi.ps1"), "-KeepDatabase"], { cwd: repo, stdio: ["ignore", log, log], detached: true }).unref();
  while (await health()) await new Promise((r) => setTimeout(r, 100));
  while (!(await health())) await new Promise((r) => setTimeout(r, 250));
  records.apiDownMs = Date.now() - records.apiKilledAt;
  await restart.page.reload();
  await restart.project.currentStage().waitFor({ timeout: 20_000 });
  await restart.page.waitForTimeout(8_000);
  await shot(restart.page, "project-after-restart");
  await restart.done();
  const after = await (await setup.page.request.get(`/api/projects/${restartProject}`)).json();
  records.afterRestart = after.directions[0].stages.filter((s) => s.status !== "Pending").map((s, i) => `${s.number ?? s.stage ?? i}:${s.status}`);
  await cancel(setup.page, restartProject);
  await setup.ctx.close();
  writeFileSync(join(screens, "records.json"), `${JSON.stringify(records, null, 2)}\n`);
} finally {
  await browser.close();
  await Promise.all(stops.map((stop) => stop()));
}
console.log(JSON.stringify(records));
