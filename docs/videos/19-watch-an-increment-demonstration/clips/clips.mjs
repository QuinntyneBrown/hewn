// Captures the Mission Control screens and clips for the journey 19 video (Watch an increment demonstration) from the
// running app, reusing the e2e page objects. A real worker builds Kiln Booking end to end, so each increment's
// walkthrough is one stage 10 recorded, committed and merged, and the page plays it through the API. The failed and
// waiting states use the e2e mock increment. Start a fresh stack:
//   pwsh eng/Start-E2eApi.ps1
//   cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
// then from the repo root:
//   node docs/videos/19-watch-an-increment-demonstration/clips/clips.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const { chromium } = createRequire(join(repo, "e2e/package.json"))("@playwright/test");
const { IncrementPage } = await import(join(repo, "e2e/pages/increment.page.ts"));
const { BacklogPage } = await import(join(repo, "e2e/pages/backlog.page.ts"));
const { startWorkers } = await import(join(repo, "e2e/support/workers.ts"));
const { serveIncrement } = await import(join(repo, "e2e/support/increment.ts"));
const { mockIncrement } = await import(join(repo, "e2e/support/mock-increment.ts"));
async function xsrfToken(page) {
  await page.request.get("/api/me");
  return (await page.context().cookies()).find((c) => c.name === "XSRF-TOKEN")?.value ?? "";
}

const base = process.env.APP_URL ?? "http://localhost:4300";
const screens = resolve(here, "../screens");
mkdirSync(screens, { recursive: true });

async function context(browser, { width = 1280, height = 900, dark = false, video, login = "quinntynebrown", scale } = {}) {
  const ctx = await browser.newContext({
    baseURL: base,
    viewport: { width, height },
    deviceScaleFactor: scale ?? (width < 600 ? 2 : 1),
    colorScheme: dark ? "dark" : "light",
    ...(video ? { recordVideo: { dir: video, size: { width, height } } } : {}),
  });
  const page = await ctx.newPage();
  const r = await page.request.post("/api/auth/dev/sign-in", { data: { login } });
  if (r.status() !== 204) throw new Error(`sign in: ${r.status()}`);
  return { ctx, page, increment: new IncrementPage(page), backlog: new BacklogPage(page) };
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
  const { ctx, page, increment, backlog } = await context(browser, { width: 1408, height: 792, video: raw });
  await page.goto(path);
  await act(page, increment, backlog);
  await ctx.close();
  const webm = readdirSync(raw).find((f) => f.endsWith(".webm"));
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", join(raw, webm), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", join(here, `${name}.mp4`)]);
  rmSync(raw, { recursive: true, force: true });
}

const owner = await context(browser);
const headers = { "X-XSRF-TOKEN": await xsrfToken(owner.page) };
const get = async (url) => (await owner.page.request.get(url)).json();
async function submit(name, idea) {
  const r = await owner.page.request.post("/api/projects", {
    data: { name, idea, stackPreference: null, repositoryUrl: null, budgetUsd: 300 },
    headers,
  });
  if (r.status() !== 201) throw new Error(`submit ${name}: ${r.status()}`);
  return (await r.json()).projectId;
}
async function cancel(id) {
  const project = await get(`/api/projects/${id}`);
  const d = project.directions.at(-1);
  if (["Cancelled", "Complete"].includes(d.status)) return;
  await owner.page.request.post(`/api/projects/${id}/directions/${d.id}/cancel`, { data: {}, headers });
}
const pause = (page, ms = 1_200) => page.waitForTimeout(ms);
const loaded = (increment) => increment.position.filter({ hasNotText: "/ 0:00" }).waitFor();

let stopWorkers = () => Promise.resolve();
try {
  // 1. Kiln Booking: a real worker builds it end to end, recording and merging each increment's walkthrough.
  const kiln = await submit("Kiln Booking", "Studio time booking for shared ceramics kilns, with firing schedules and costs.");
  stopWorkers = startWorkers(1, 150);
  for (let i = 0; ; i++) {
    const project = await get(`/api/projects/${kiln}`);
    if (project.directions[0].status === "Complete") break;
    if (i > 600) throw new Error("Kiln Booking never completed");
    await owner.page.waitForTimeout(500);
  }
  await stopWorkers();

  // What the API answers and what the pull request says, for the slides.
  const detail = await get(`/api/projects/${kiln}/increments/1`);
  const { video, videoNote, videoAt, videoUrl, captionsUrl } = detail;
  writeFileSync(join(screens, "answer.json"), `${JSON.stringify({ number: 1, title: detail.title, status: detail.status, video, videoNote, videoAt, videoUrl, captionsUrl }, null, 2)}\n`);
  writeFileSync(join(screens, "pull-request.json"), `${JSON.stringify(detail.pullRequest, null, 2)}\n`);
  const vtt = await (await owner.page.request.get(captionsUrl)).text();
  writeFileSync(join(screens, "captions.vtt"), vtt);

  // 2. From the backlog to the increment, then playing, seeking and captions off and on.
  await clip("watch", `/projects/${kiln}/backlog`, async (page, increment, backlog) => {
    await backlog.row(1).title.waitFor();
    await pause(page, 1_500);
    await backlog.row(1).title.click();
    await loaded(increment);
    await pause(page, 2_000);
    // Keyboard only: Space plays, the arrows and Home seek, Enter toggles captions.
    await increment.play.focus();
    await pause(page, 800);
    await page.keyboard.press("Space");
    await pause(page, 3_500);
    await page.keyboard.press("Tab");
    await pause(page, 800);
    await page.keyboard.press("Home");
    await pause(page, 1_200);
    await page.keyboard.press("ArrowRight");
    await pause(page, 1_200);
    await page.keyboard.press("ArrowLeft");
    await pause(page, 1_200);
    await page.keyboard.press("Tab");
    await pause(page, 800);
    await page.keyboard.press("Enter");
    await pause(page, 1_500);
    await page.keyboard.press("Enter");
    await pause(page, 1_200);
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Space");
    await pause(page, 3_500);
  });

  // 3. Screens: the player, a caption over the picture, a Viewer in dark, a phone.
  for (const [tag, opts] of [
    ["player", {}],
    ["dark", { dark: true, login: "ada" }],
    ["phone", { width: 390, height: 844 }],
  ]) {
    const { ctx, page, increment } = await context(browser, opts);
    await increment.open(kiln, 1);
    await loaded(increment);
    await pause(page, 800);
    await shot(page, `increment-${tag}`);
    await ctx.close();
  }
  {
    const { ctx, page, increment } = await context(browser, { scale: 2 });
    await increment.open(kiln, 1);
    await loaded(increment);
    await increment.seek.focus();
    await page.keyboard.press("ArrowRight");
    await increment.caption.waitFor();
    await page.mouse.move(0, 0);
    await increment.player.screenshot({ path: join(screens, "player-caption.png"), animations: "disabled" });
    await ctx.close();
  }

  // 4. The failed and waiting states, from the e2e mock increment.
  {
    const { ctx, page, increment } = await context(browser);
    const parcel = await submit("Parcel Post", "Parcel lockers for a small town's post office.");
    await cancel(parcel);
    for (const state of ["video-failed", "implementing", "blocked"]) {
      await page.unrouteAll();
      await serveIncrement(page, mockIncrement(state));
      await increment.open(parcel, 7);
      await increment.videoPlaceholder.waitFor();
      await pause(page, 800);
      await shot(page, `increment-${state}`);
    }
    await ctx.close();
  }
} finally {
  await stopWorkers();
  await owner.ctx.close();
  await browser.close();
}
console.log(`screens in ${screens}, clips in ${here}`);
