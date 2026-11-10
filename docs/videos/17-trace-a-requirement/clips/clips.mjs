// Captures the Mission Control screens and clips for the journey 17 video (Trace a requirement) from the running app,
// reusing the e2e page objects. A real worker builds Kiln Booking end to end, so its trace comes from what the stages
// wrote and merged; a seeded repository shows No acceptance test and Deferred. Start a fresh stack:
//   pwsh eng/Start-E2eApi.ps1
//   cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
// then from the repo root:
//   node docs/videos/17-trace-a-requirement/clips/clips.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const { chromium } = createRequire(join(repo, "e2e/package.json"))("@playwright/test");
const { TraceabilityPage } = await import(join(repo, "e2e/pages/traceability.page.ts"));
const { startWorkers } = await import(join(repo, "e2e/support/workers.ts"));
const { tracedFiles } = await import(join(repo, "e2e/support/traced-files.ts"));
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
  return { ctx, page, trace: new TraceabilityPage(page) };
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
  const { ctx, page, trace } = await context(browser, { width: 1408, height: 792, video: raw });
  await page.goto(path);
  await act(page, trace);
  await ctx.close();
  const webm = readdirSync(raw).find((f) => f.endsWith(".webm"));
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", join(raw, webm), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", join(here, `${name}.mp4`)]);
  rmSync(raw, { recursive: true, force: true });
}

const owner = await context(browser);
const headers = { "X-XSRF-TOKEN": await xsrfToken(owner.page) };
const get = async (url) => (await owner.page.request.get(url)).json();
async function submit(name, idea, repositoryUrl = null) {
  const r = await owner.page.request.post("/api/projects", {
    data: { name, idea, stackPreference: null, repositoryUrl, budgetUsd: 300 },
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
async function seeded(name, files, pulls = []) {
  const repository = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  await owner.page.request.put(`/api/fakes/github/hewn-builds/${repository}/files`, { data: files });
  for (const pull of pulls) await owner.page.request.post(`/api/fakes/github/hewn-builds/${repository}/pulls`, { data: pull });
  const id = await submit(name, "A web app for small accounting teams to reconcile statements.", `https://github.com/hewn-builds/${repository}`);
  await cancel(id);
  return id;
}
const pause = (page, ms = 1_200) => page.waitForTimeout(ms);

let stopWorkers = () => Promise.resolve();
try {
  // 1. Kiln Booking: a real worker builds it end to end, so every L2 has a design, a journey, a test and a merged PR.
  const kiln = await submit("Kiln Booking", "Studio time booking for shared ceramics kilns, with firing schedules and costs.");
  stopWorkers = startWorkers(1, 150);
  for (let i = 0; ; i++) {
    const project = await get(`/api/projects/${kiln}`);
    if (project.directions[0].status === "Complete") break;
    if (i > 600) throw new Error("Kiln Booking never completed");
    await owner.page.waitForTimeout(500);
  }
  await stopWorkers();

  // What the API answers, for the slides: the first L2's trace.
  const traced = await get(`/api/projects/${kiln}/traceability`);
  writeFileSync(join(screens, "answer.json"), `${JSON.stringify({ commit: traced.commit, requirements: traced.requirements.slice(0, 1) }, null, 2)}\n`);

  // 2. Ledgerline, seeded: one L2 without a test, one deferred.
  const ledgerline = await seeded("Ledgerline", tracedFiles(), [
    { title: "Reconcile a card statement (journey 4, L2-018)", merged: true },
    { title: "Snap a receipt (journey 3, L2-013)", merged: false },
  ]);

  // 3. Browsing Kiln Booking's trace, then Ledgerline's gaps, as clips.
  await clip("kiln", `/projects/${kiln}`, async (page, trace) => {
    await pause(page, 1_000);
    await trace.tab("Traceability").click();
    await trace.id.waitFor();
    await pause(page, 3_000);
    for (const link of await trace.links.all()) {
      await link.click();
      await pause(page, 1_800);
    }
  });
  await clip("ledgerline", `/projects/${ledgerline}/traceability?l2=L2-018`, async (page, trace) => {
    await trace.id.waitFor();
    await pause(page, 2_500);
    await trace.link("L2-020").click();
    await pause(page, 2_500);
    await trace.link("L2-031").click();
    await pause(page, 2_500);
    await trace.search.click();
    await trace.search.pressSequentially("close", { delay: 120 });
    await pause(page, 1_500);
    await trace.search.fill("");
    await trace.search.pressSequentially("L2-099", { delay: 120 });
    await pause(page, 2_500);
  });

  // 4. Screens: a full trace, No acceptance test, Deferred, Viewer in dark, a phone.
  for (const [project, l2, tag, opts] of [
    [kiln, "L2-001", "kiln", {}],
    [ledgerline, "L2-018", "trace", {}],
    [ledgerline, "L2-020", "no-test", {}],
    [ledgerline, "L2-031", "deferred", {}],
    [ledgerline, "L2-018", "dark", { dark: true, login: "ada" }],
    [ledgerline, "L2-018", "phone", { width: 390, height: 844 }],
  ]) {
    const { ctx, page, trace } = await context(browser, opts);
    await trace.open(project, l2);
    await trace.id.waitFor();
    await pause(page, 800);
    await shot(page, `trace-${tag}`);
    await ctx.close();
  }

  // 5. The empty and error states.
  {
    const { ctx, page, trace } = await context(browser);
    const parcel = await seeded("Parcel Post", { "docs/brief.md": "# Brief\n" });
    await trace.open(parcel);
    await trace.empty.waitFor();
    await pause(page, 800);
    await shot(page, "empty-desktop");
    const files = tracedFiles();
    files["docs/specs/L2.md"] += "\n## L2-040 Missing its colon\n";
    const harbour = await seeded("Harbour Rota", files);
    await trace.open(harbour);
    await trace.failure.waitFor();
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
