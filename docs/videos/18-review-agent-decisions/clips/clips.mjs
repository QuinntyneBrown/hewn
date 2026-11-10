// Captures the Mission Control screens and clips for the journey 18 video (Review agent decisions) from the running
// app, reusing the e2e page objects. A real worker builds Kiln Booking end to end, so every decision on the page is
// one a stage's agent recorded in docs/decisions.md and committed. Start a fresh stack:
//   pwsh eng/Start-E2eApi.ps1
//   cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
// then from the repo root:
//   node docs/videos/18-review-agent-decisions/clips/clips.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const { chromium } = createRequire(join(repo, "e2e/package.json"))("@playwright/test");
const { DecisionsPage } = await import(join(repo, "e2e/pages/decisions.page.ts"));
const { startWorkers } = await import(join(repo, "e2e/support/workers.ts"));
async function xsrfToken(page) {
  await page.request.get("/api/me");
  return (await page.context().cookies()).find((c) => c.name === "XSRF-TOKEN")?.value ?? "";
}

const base = process.env.APP_URL ?? "http://localhost:4300";
const screens = resolve(here, "../screens");
mkdirSync(screens, { recursive: true });
const STACK = "Which stack should the product use?";

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
  return { ctx, page, decisions: new DecisionsPage(page) };
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
  const { ctx, page, decisions } = await context(browser, { width: 1408, height: 792, video: raw });
  await page.goto(path);
  await act(page, decisions, ctx);
  await ctx.close();
  const webm = readdirSync(raw).find((f) => f.endsWith(".webm"));
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", join(raw, webm), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", join(here, `${name}.mp4`)]);
  rmSync(raw, { recursive: true, force: true });
}

const owner = await context(browser);
const headers = { "X-XSRF-TOKEN": await xsrfToken(owner.page) };
const get = async (url) => (await owner.page.request.get(url)).json();
const text = async (url) => (await owner.page.request.get(url)).text();
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
const escape = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

let stopWorkers = () => Promise.resolve();
try {
  // 1. Kiln Booking: a real worker builds it end to end, so each stage's agent records its decisions.
  const kiln = await submit("Kiln Booking", "Studio time booking for shared ceramics kilns, with firing schedules and costs.");
  stopWorkers = startWorkers(1, 150);
  for (let i = 0; ; i++) {
    const project = await get(`/api/projects/${kiln}`);
    if (project.directions[0].status === "Complete") break;
    if (i > 600) throw new Error("Kiln Booking never completed");
    await owner.page.waitForTimeout(500);
  }
  await stopWorkers();

  // What the API answers and what the repository holds, for the slides.
  const listed = await get(`/api/projects/${kiln}/decisions`);
  const stack = listed.decisions.find((d) => d.question === STACK);
  writeFileSync(join(screens, "answer.json"), `${JSON.stringify(stack, null, 2)}\n`);
  const repository = listed.repository;
  const log = await text(`/api/fakes/github/${repository}/contents/docs/decisions.md?ref=${stack.commit}`);
  writeFileSync(join(screens, "decisions.md"), log);
  const commits = await get(`/api/fakes/github/${repository}/commits`);
  const recorded = commits.find((c) => c.sha === stack.commit);

  // The commit page the link opens, served by the capture from the fake GitHub's record of that commit.
  const commitPage = `<!doctype html><meta charset="utf-8"><title>${recorded.sha.slice(0, 7)}</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:0;background:#f6f7f9;color:#1d2433}
header{background:#fff;border-bottom:1px solid #dde1e7;padding:16px 32px}header small{color:#5b6475}
main{padding:24px 32px;max-width:1100px}h1{font-size:20px;margin:4px 0}code,pre{font:13px/1.5 ui-monospace,monospace}
.card{background:#fff;border:1px solid #dde1e7;border-radius:8px;margin-top:16px}.card h2{font-size:14px;margin:0;padding:10px 16px;border-bottom:1px solid #dde1e7}
pre{margin:0;padding:12px 16px;white-space:pre-wrap}.hit{background:#e7f6ec;display:block}ul{margin:0;padding:12px 32px}</style>
<header><small>e2e fake GitHub · ${escape(repository)}</small><h1>${escape(recorded.message)}</h1><code>commit ${recorded.sha}</code></header>
<main><div class="card"><h2>${recorded.paths.length} files changed</h2><ul>${recorded.paths.map((p) => `<li><code>${escape(p)}</code></li>`).join("")}</ul></div>
<div class="card"><h2>docs/decisions.md at ${recorded.sha.slice(0, 7)}</h2><pre>${escape(log)
    .split("\n## ")
    .map((entry, i) => (i === 0 ? entry : entry.includes(STACK) ? `<span class="hit">## ${entry}</span>` : `## ${entry}`))
    .join("\n")}</pre></div></main>`;

  // 2. The list, the stage filter and no results, as one clip.
  await clip("decisions", `/projects/${kiln}`, async (page, decisions) => {
    await pause(page, 1_000);
    await decisions.tab("Decisions").click();
    await decisions.decisions.first().waitFor();
    await pause(page, 2_500);
    await page.mouse.wheel(0, 700);
    await pause(page, 2_000);
    await page.mouse.wheel(0, -700);
    await pause(page, 1_000);
    for (const stage of ["Stack", "Increments", "Scaffold"]) {
      await decisions.filterBy(stage);
      await pause(page, 2_500);
    }
    await decisions.showAllStages.click();
    await decisions.decisions.first().waitFor();
    await pause(page, 2_000);
  });

  // 3. Opening the commit behind the stack decision.
  await clip("commit", `/projects/${kiln}/decisions?stage=4`, async (page, decisions) => {
    await page.route(/^https:\/\/github\.com\//, (route) => route.fulfill({ contentType: "text/html", body: commitPage }));
    const link = decisions.decision(STACK).commit;
    await link.waitFor();
    await pause(page, 2_000);
    await link.hover();
    await pause(page, 1_200);
    // In the recording the commit opens in the same tab, so the clip shows it.
    await link.evaluate((a) => a.removeAttribute("target"));
    await link.click();
    await page.waitForLoadState();
    await pause(page, 3_000);
    await page.mouse.wheel(0, 500);
    await pause(page, 3_000);
  });

  // 4. Screens: the list, one stage, the entry beside its rendering, a Viewer in dark, a phone.
  for (const [stage, tag, opts] of [
    [undefined, "default", {}],
    [4, "filtered", {}],
    [6, "no-results", {}],
    [undefined, "dark", { dark: true, login: "ada" }],
    [undefined, "phone", { width: 390, height: 844 }],
  ]) {
    const { ctx, page, decisions } = await context(browser, opts);
    await decisions.open(kiln, stage);
    await (tag === "no-results" ? decisions.noResults : decisions.decisions.first()).waitFor();
    await pause(page, 800);
    await shot(page, `decisions-${tag}`);
    await ctx.close();
  }

  // The stack decision alone, sharp enough to sit beside its entry in docs/decisions.md.
  {
    const { ctx, page, decisions } = await context(browser, { scale: 2 });
    await decisions.open(kiln);
    await decisions.decision(STACK).item.waitFor();
    await pause(page, 500);
    await page.mouse.move(0, 0);
    await decisions.decision(STACK).item.screenshot({ path: join(screens, "stack-entry.png"), animations: "disabled" });
    await ctx.close();
  }

  // 5. The empty and error states.
  {
    const { ctx, page, decisions } = await context(browser);
    const parcel = await submit("Parcel Post", "Parcel lockers for a small town's post office.");
    await cancel(parcel);
    await decisions.open(parcel);
    await decisions.empty.waitFor();
    await pause(page, 800);
    await shot(page, "empty-desktop");
    await page.route(/\/api\/projects\/[^/]+\/decisions$/, (route) =>
      route.fulfill({ status: 503, json: { status: 503, title: "The Hewn database didn’t answer", code: "unavailable" } }),
    );
    await decisions.open(kiln);
    await decisions.failure.waitFor();
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
