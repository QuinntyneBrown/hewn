// Captures the screens and clips for the journey 27 video (Reconnect Mission Control). The live connection is cut
// through Playwright (the e2e LiveConnection page object) while a worker keeps logging, then restored. Start the
// stack first:
//   pwsh eng/Start-E2eApi.ps1
//   cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
// then from the repo root:
//   node docs/videos/27-reconnect-mission-control/clips/clips.mjs
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
const { LiveConnection } = await import(join(repo, "e2e/pages/live-connection.ts"));
const { startWorkers } = await import(join(repo, "e2e/support/workers.ts"));

const base = process.env.APP_URL ?? "http://localhost:4300";
const screens = resolve(here, "../screens");
mkdirSync(screens, { recursive: true });
const tag = Date.now().toString(36).slice(-4);
const records = {};

async function context(browser, { width = 1280, height = 900, dark = false, video, negotiateDelayMs, clock } = {}) {
  const ctx = await browser.newContext({
    baseURL: base,
    viewport: { width, height },
    deviceScaleFactor: width < 600 ? 2 : 1,
    colorScheme: dark ? "dark" : "light",
    ...(video ? { recordVideo: { dir: video, size: { width, height } } } : {}),
  });
  const page = await ctx.newPage();
  const live = new LiveConnection(page);
  await live.intercept({ negotiateDelayMs });
  if (clock) await page.clock.install();
  const r = await page.request.post("/api/auth/dev/sign-in", { data: { login: "quinntynebrown" } });
  if (r.status() !== 204) throw new Error(`sign in: ${r.status()}`);
  return { ctx, page, live, newDirection: new NewDirectionPage(page), project: new ProjectPage(page), workers: new WorkersPage(page) };
}

const shot = async (page, file) => (
  await page.mouse.move(0, 0), page.screenshot({ path: join(screens, `${file}.png`), animations: "disabled", caret: "hide" })
);

async function recording(browser, file, opts = {}) {
  const raw = join(here, `.raw-${file}`);
  rmSync(raw, { recursive: true, force: true });
  const c = await context(browser, { width: 1408, height: 792, video: raw, ...opts });
  return {
    ...c,
    done: async () => {
      await c.ctx.close();
      const webm = readdirSync(raw).find((f) => f.endsWith(".webm"));
      execFileSync("ffmpeg", ["-y", "-v", "error", "-i", join(raw, webm), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", join(here, `${file}.mp4`)]);
      rmSync(raw, { recursive: true, force: true });
    },
  };
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

const browser = await chromium.launch();
let stop = startWorkers(1, 2_500, { executor: "scripted", namePrefix: `steady-${tag}`, logLines: 2 });
let projectId = "";
try {
  // 1. A project runs; the network drops; the log freezes while the worker carries on; it reconnects and catches up.
  const c = await recording(browser, "drop-and-catch-up");
  await c.newDirection.open();
  await c.newDirection.fill({ name: `Seed Swap ${tag}`, idea: "A seed swap register for a community garden." });
  await c.newDirection.submit();
  await c.project.currentStage().waitFor({ timeout: 20_000 });
  projectId = new URL(c.page.url()).pathname.split("/")[2];
  await c.project.selectStage("Bootstrap");
  await c.project.logLines.first().waitFor({ timeout: 15_000 });
  await c.page.waitForTimeout(3_000);
  await c.live.drop();
  records.droppedAt = Date.now();
  await c.live.banner.filter({ hasText: "next attempt in" }).waitFor();
  records.linesWhenDropped = await c.project.logLines.count();
  await c.page.waitForTimeout(1_500);
  await shot(c.page, "project-reconnecting");
  await c.page.waitForTimeout(6_000);
  records.linesBeforeReconnect = await c.project.logLines.count();
  c.live.restore();
  await c.live.banner.filter({ hasText: "Reconnected." }).waitFor({ timeout: 15_000 });
  records.reconnectedAfterMs = Date.now() - records.droppedAt;
  records.caughtUp = await c.live.banner.innerText();
  records.linesAfterReconnect = await c.project.logLines.count();
  await shot(c.page, "project-reconnected");
  await c.live.banner.waitFor({ state: "hidden", timeout: 10_000 });
  await c.page.waitForTimeout(2_000);
  await c.done();

  // 2. Workers, on a fake clock: the schedule runs out and the connection counts as lost; Retry now brings it back.
  const l = await recording(browser, "lost-and-retry", { clock: true });
  await l.workers.open();
  await l.live.state.filter({ hasText: "Live" }).waitFor();
  await l.page.waitForTimeout(1_500);
  await l.live.drop();
  for (const [ms, next] of [[2_000, /in (9|10) s/], [10_000, /in (29|30) s/]]) {
    await l.live.banner.waitFor();
    await l.page.waitForTimeout(1_500);
    await l.page.clock.runFor(ms);
    await l.live.banner.filter({ hasText: next }).waitFor();
  }
  await shot(l.page, "workers-reconnecting");
  await l.page.waitForTimeout(1_500);
  await l.page.clock.runFor(30_000);
  await l.live.retryNow.waitFor();
  await l.page.waitForTimeout(2_000);
  await shot(l.page, "workers-lost");
  l.live.restore();
  await l.live.retryNow.hover();
  await l.page.waitForTimeout(800);
  await l.live.retryNow.click();
  await l.live.banner.filter({ hasText: "Reconnected." }).waitFor();
  await l.page.waitForTimeout(2_500);
  await l.done();

  // 3. A slow first connection; then the reconnecting strip in dark mode and on a phone.
  {
    const s = await context(browser, { negotiateDelayMs: 4_000 });
    await s.page.goto("/workers");
    await s.live.banner.filter({ hasText: "Connecting" }).waitFor();
    await shot(s.page, "connecting");
    await s.ctx.close();
  }
  for (const [file, opts] of [["project-reconnecting-dark", { dark: true }], ["project-reconnecting-phone", { width: 390, height: 844 }]]) {
    const d = await context(browser, opts);
    await d.page.goto(`/projects/${projectId}`);
    await d.project.currentStage().waitFor();
    await d.live.state.filter({ hasText: "Live" }).waitFor({ timeout: 10_000 }).catch(() => undefined);
    await d.live.drop();
    await d.live.banner.filter({ hasText: "next attempt in" }).waitFor();
    await shot(d.page, file);
    await d.ctx.close();
  }
  writeFileSync(join(screens, "records.json"), `${JSON.stringify(records, null, 2)}\n`);
} finally {
  await stop();
  if (projectId) {
    const c = await context(browser);
    await cancel(c.page, projectId);
    await c.ctx.close();
  }
  await browser.close();
}
console.log(JSON.stringify(records));
