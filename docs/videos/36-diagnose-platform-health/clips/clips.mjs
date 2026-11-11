// Captures the outputs, screens and clips for the journey 36 video (Diagnose platform health). Start the stack:
//   pwsh eng/Start-Observability.ps1
//   pwsh eng/Start-Api.ps1 -Database obs-video.db -DevSignIn -Observability > api.log   (Hewn__Fakes__Enabled=true,
//     HEWN_WORKER_TOKEN and HEWN_ALLOWED_GITHUB_USERS set; then `hewn seed` against the same database)
//   HEWN_SCRIPTED_MODEL_CALLS=2 HEWN_SCRIPTED_LOG_LINES=3 pwsh eng/Start-Worker.ps1 -StepMs 600 -Observability > worker.log
// then from the repo root:
//   HEWN_DB_FILE=backend/obs-video.db API_LOG=api.log WORKER_LOG=worker.log node docs/videos/36-diagnose-platform-health/clips/clips.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const { chromium, request } = createRequire(join(repo, "e2e/package.json"))("@playwright/test");

const api = process.env.API_URL ?? "http://localhost:5200";
const jaeger = process.env.JAEGER_URL ?? "http://localhost:16686";
const prometheus = process.env.PROMETHEUS_URL ?? "http://localhost:9090";
const metricsToken = process.env.HEWN_METRICS_TOKEN ?? "local-metrics-token-not-a-secret";
const dbFile = resolve(repo, process.env.HEWN_DB_FILE ?? "backend/obs-video.db");
const screens = resolve(here, "../screens");
mkdirSync(screens, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const records = {};

// 1. Health with the database in place, moved away, and back (L2-051).
async function health(label) {
  const out = [];
  for (const path of ["/health/live", "/health/ready"]) {
    const response = await fetch(`${api}${path}`);
    out.push(`$ curl -i ${path}\nHTTP/1.1 ${response.status} ${response.statusText}\n${await response.text()}`);
  }
  records[`health-${label}`] = out.join("\n\n");
}
await health("up");
renameSync(dbFile, `${dbFile}.away`);
try {
  await health("down");
} finally {
  renameSync(`${dbFile}.away`, dbFile);
}
await health("back");

// 2. A direction, run by the scripted worker to the end.
const owner = await request.newContext({ baseURL: api });
if ((await owner.post("/api/auth/dev/sign-in", { data: { login: "quinntynebrown" } })).status() !== 204) throw new Error("sign in");
await owner.get("/api/me");
const xsrf = (await owner.storageState()).cookies.find((c) => c.name === "XSRF-TOKEN").value;
// Names are unique, so a rerun on the same database takes the next one.
let submitted;
for (const name of ["Seed Swap", ...Array.from({ length: 30 }, (_, n) => `Seed Swap ${n + 2}`)]) {
  submitted = await owner.post("/api/projects", {
    headers: { "X-XSRF-TOKEN": xsrf },
    data: { name, idea: `${name}: a register for a community garden.`, stackPreference: null, repositoryUrl: null, budgetUsd: 300 },
  });
  if (submitted.status() === 201) break;
}
if (submitted.status() !== 201) throw new Error(`submit: ${submitted.status()}`);
const { projectId, directionId } = await submitted.json();
records.projectId = projectId;
for (let i = 0; i < 180; i++) {
  const project = await (await owner.get(`/api/projects/${projectId}`)).json();
  if (["Complete", "Idle", "Blocked", "Cancelled"].includes(project.status)) break;
  await sleep(1_000);
}
await sleep(4_000); // the worker exports its spans every 2 s

// 3. One run's log lines from both sides, by its run ID (L2-049 AC1).
const lines = (file) => readFileSync(resolve(repo, file), "utf8").split("\n").filter((l) => l.startsWith("{")).map((l) => JSON.parse(l));
const worker = lines(process.env.WORKER_LOG ?? "worker.log").filter((l) => l.directionId === directionId);
const run = worker.find((l) => l.message === "Leased run" && l.stage === 5);
records.runId = run.runId;
records.traceId = run.traceId;
const pick = ({ timestamp, level, message, projectId, directionId, stage, runId, traceId }) =>
  JSON.stringify({ timestamp, level, message, projectId, directionId, stage, runId, traceId });
records.workerLog = worker.filter((l) => l.runId === run.runId).map(pick);
records.apiLog = lines(process.env.API_LOG ?? "api.log")
  .filter((l) => l.runId === run.runId && l.category === "Hewn.Api.Controllers.WorkerController")
  .map(pick);

// 4. The scrape, without and with the token (L2-049 AC3).
records.metricsRefused = (await fetch(`${api}/metrics`)).status;
const scrape = await (await fetch(`${api}/metrics`, { headers: { authorization: `Bearer ${metricsToken}` } })).text();
records.metrics = scrape.split("\n").filter((l) => l.startsWith("hewn_") && !l.includes("_bucket")).map((l) => l.replace('otel_scope_name="Hewn",', "").replace('{otel_scope_name="Hewn"}', ""));

// 5. The trace in Jaeger, and the success rate in Prometheus (L2-049 AC2, AC3).
const browser = await chromium.launch();
try {
  const shot = async (page, file) => page.screenshot({ path: join(screens, `${file}.png`) });
  const ctx = await browser.newContext({ viewport: { width: 1408, height: 792 } });
  const page = await ctx.newPage();
  await page.goto(`${jaeger}/search?service=hewn-worker&limit=20`);
  await page.getByText("POST api/projects", { exact: false }).first().waitFor();
  await sleep(1_000);
  await shot(page, "jaeger-search");
  await page.goto(`${jaeger}/trace/${run.traceId}`);
  await page.getByText("Run queued").first().waitFor();
  await sleep(1_000);
  await shot(page, "jaeger-trace");
  await page.goto(`${prometheus}/query?g0.expr=${encodeURIComponent("sum by (stage, outcome) (hewn_stage_runs_total)")}&g0.tab=table`);
  await page.getByText("outcome", { exact: false }).first().waitFor();
  await sleep(1_500);
  await shot(page, "prometheus-runs");
  await page.goto(`${prometheus}/query?g0.expr=${encodeURIComponent("hewn_model_tokens_total")}&g0.tab=table`);
  await page.getByText("kind", { exact: false }).first().waitFor();
  await sleep(1_500);
  await shot(page, "prometheus-tokens");
  await ctx.close();

  // The clip, paced to the narration: the trace opens, a model call's span opens to show its tags, then the trace's statistics show both services.
  const raw = join(here, ".raw-trace");
  rmSync(raw, { recursive: true, force: true });
  const rec = await browser.newContext({ viewport: { width: 1408, height: 792 }, recordVideo: { dir: raw, size: { width: 1408, height: 792 } } });
  const p = await rec.newPage();
  const t0 = Date.now();
  const at = (s) => p.waitForTimeout(Math.max(0, t0 + s * 1_000 - Date.now()));
  await p.goto(`${jaeger}/trace/${run.traceId}`);
  await p.getByText("Run queued").first().waitFor();
  await at(11);
  // Stage 0's first model call opens to show its model and token counts.
  const model = p.getByText("Model call", { exact: true }).first();
  await model.click();
  await at(15.5);
  await model.click();
  // Then the trace's statistics: both services, every span.
  await at(16);
  await p.getByText("Trace Timeline").click();
  await p.getByText("Trace Statistics").click();
  await p.mouse.move(600, 600);
  await at(23.5);
  await rec.close();
  const webm = readdirSync(raw).find((f) => f.endsWith(".webm"));
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", join(raw, webm), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", join(here, "trace.mp4")]);
  rmSync(raw, { recursive: true, force: true });
} finally {
  await browser.close();
}

writeFileSync(join(screens, "records.json"), `${JSON.stringify(records, null, 2)}\n`);
console.log(JSON.stringify({ runId: records.runId, traceId: records.traceId, workerLog: records.workerLog.length, apiLog: records.apiLog.length, metrics: records.metrics.length }));
