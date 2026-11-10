// Captures the Mission Control screens and clips for the journey 16 video (Inspect versioned artifacts) from the
// running app, reusing the e2e page objects. A real worker runs the first stages against the fakes while the
// Artifacts tab is open, so each stage's files appear with the commit that holds them. Start a fresh stack:
//   pwsh eng/Start-E2eApi.ps1
//   cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
// then from the repo root:
//   node docs/videos/16-inspect-versioned-artifacts/clips/clips.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const { chromium } = createRequire(join(repo, "e2e/package.json"))("@playwright/test");
const { ArtifactsPage } = await import(join(repo, "e2e/pages/artifacts.page.ts"));
const { startWorkers } = await import(join(repo, "e2e/support/workers.ts"));
async function xsrfToken(page) {
  await page.request.get("/api/me");
  return (await page.context().cookies()).find((c) => c.name === "XSRF-TOKEN")?.value ?? "";
}

const base = process.env.APP_URL ?? "http://localhost:4300";
const screens = resolve(here, "../screens");
mkdirSync(screens, { recursive: true });

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
  return { ctx, page, artifacts: new ArtifactsPage(page) };
}

const shot = async (page, name, fullPage = false) => (
  await page.mouse.move(0, 0),
  page.screenshot({ path: join(screens, `${name}.png`), animations: "disabled", caret: "hide", fullPage })
);

const browser = await chromium.launch();
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
  if (["Cancelled", "Completed"].includes(d.status)) return;
  await owner.page.request.post(`/api/projects/${id}/directions/${d.id}/cancel`, { data: {}, headers });
}
const pause = (page, ms = 1_200) => page.waitForTimeout(ms);
async function untilStage(id, stage) {
  for (let i = 0; ; i++) {
    const project = await get(`/api/projects/${id}`);
    if (project.directions[0].stages[stage].status === "Succeeded") return;
    if (i > 600) throw new Error(`Stage ${stage} never finished`);
    await owner.page.waitForTimeout(250);
  }
}

let stopWorkers = () => Promise.resolve();
try {
  // 1. Kiln Booking, live: the Artifacts tab is open while a real worker runs stages 0 to 5.
  const kiln = await submit("Kiln Booking", "Studio time booking for shared ceramics kilns, with firing schedules and costs.");
  const raw = join(here, ".raw-live");
  rmSync(raw, { recursive: true, force: true });
  {
    const { ctx, page, artifacts } = await context(browser, { width: 1408, height: 792, video: raw });
    await page.goto(`/projects/${kiln}`);
    await pause(page, 1_000);
    await artifacts.tab("Artifacts").click();
    await artifacts.empty.waitFor();
    await pause(page, 2_500);
    stopWorkers = startWorkers(1, 1_500);
    await untilStage(kiln, 5);
    await cancel(kiln);
    await stopWorkers();
    await pause(page, 2_000);
    await artifacts.row("Idea", "docs/brief.md").open.hover();
    await pause(page, 2_000);
    await page.mouse.wheel(0, 500);
    await pause(page, 2_500);
    await artifacts.row("Bootstrap", ".hewn/skills.lock").open.hover();
    await pause(page, 2_000);
    await ctx.close();
  }
  const webm = readdirSync(raw).find((f) => f.endsWith(".webm"));
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", join(raw, webm), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", join(here, "live.mp4")]);
  rmSync(raw, { recursive: true, force: true });

  // What the API answers, for the slides: the first stage's first artifact.
  const listed = await get(`/api/projects/${kiln}/artifacts`);
  const idea = listed.stages.find((s) => s.stage === 1);
  writeFileSync(join(screens, "answer.json"), `${JSON.stringify({ repository: listed.repository, stages: [{ ...idea, artifacts: idea.artifacts.slice(0, 1) }] }, null, 2)}\n`);

  // 2. As a Viewer, light and dark, and on a phone.
  for (const [width, height, tag, dark] of [
    [1280, 900, "desktop", false],
    [1280, 900, "desktop-dark", true],
    [390, 844, "phone", false],
  ]) {
    const { ctx, page, artifacts } = await context(browser, { width, height, dark, login: "ada" });
    await artifacts.open(kiln);
    await artifacts.stages.first().waitFor();
    await pause(page, 1_000);
    await shot(page, `artifacts-${tag}`);
    await ctx.close();
  }

  // 3. The empty and error states.
  {
    const { ctx, page, artifacts } = await context(browser);
    const parcel = await submit("Parcel Post", "A shared mailroom log for coworking spaces, with parcels in and signatures out.");
    await cancel(parcel);
    await artifacts.open(parcel);
    await artifacts.empty.waitFor();
    await pause(page, 800);
    await shot(page, "empty-desktop");
    await page.route(
      (url) => /^\/api\/projects\/[^/]+\/artifacts$/.test(url.pathname),
      (route) => route.fulfill({ status: 502, json: { status: 502, title: "GitHub returned 502 while listing commits", code: "github_failed" } }),
    );
    await artifacts.open(parcel);
    await artifacts.failure.waitFor();
    await pause(page, 800);
    await shot(page, "error-desktop");
    await ctx.close();
  }
} finally {
  await stopWorkers();
  await owner.ctx.close();
  await browser.close();
}
console.log(`screens in ${screens}, clips in ${here}`);
