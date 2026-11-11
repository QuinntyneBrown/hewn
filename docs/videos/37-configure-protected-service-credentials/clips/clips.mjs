// Captures the outputs and screens for the journey 37 video (Configure protected service credentials). With
// HEWN_SECRET_STORE=os and HEWN_KEY_STORE_SERVICE=hewn-video, supply the worker token, model key and webhook secret:
//   printf '%s\n' "$value" | dotnet run --project backend/src/Hewn.Cli -- secret set worker-token   (and the others)
// start the API from the keychain, with no HEWN_WORKER_TOKEN in the environment:
//   pwsh eng/Start-Api.ps1 -Database cred-video.db -DevSignIn > api.log   (Hewn__Fakes__Enabled=true, then `hewn seed`)
// serve Mission Control against it (ng serve --port 4301 --proxy-config proxy.conf.json), then from the repo root:
//   API_LOG=api.log node docs/videos/37-configure-protected-service-credentials/clips/clips.mjs
// The script starts the scripted worker itself, reading its credentials from the same keychain service.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const { chromium, request } = createRequire(join(repo, "e2e/package.json"))("@playwright/test");
const { ProjectPage } = await import(join(repo, "e2e/pages/project.page.ts"));
const { Theme } = await import(join(repo, "e2e/pages/theme.ts"));

const api = process.env.API_URL ?? "http://localhost:5200";
const app = process.env.APP_URL ?? "http://localhost:4301";
const service = process.env.HEWN_KEY_STORE_SERVICE ?? "hewn-video";
const screens = resolve(here, "../screens");
mkdirSync(screens, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const records = {};
const env = { ...process.env, HEWN_SECRET_STORE: "os", HEWN_KEY_STORE_SERVICE: service };
delete env.HEWN_WORKER_TOKEN;

const sh = (file, args, input) => {
  try {
    return execFileSync(file, args, { cwd: repo, env, input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trimEnd();
  } catch (e) {
    return `${e.stdout ?? ""}${e.stderr ?? ""}`.trimEnd();
  }
};
const hewn = (args, input) => sh("dotnet", ["run", "--no-build", "--project", "backend/src/Hewn.Cli", "--", ...args], input);

// 1. Supplying a credential: the value goes in on standard input, and only its reference comes back (L2-040 AC1).
const magicPatternsToken = "mp_live_VideoDemoToken0123456789abcdef";
records.set = `$ hewn secret set magic-patterns-token < magic-patterns-token.txt\n${hewn(["secret", "set", "magic-patterns-token"], `${magicPatternsToken}\n`)}`;
records.list = `$ hewn secret list\n${hewn(["secret", "list"])}`;
records.refused = `$ echo 1000000 | hewn secret set budget\n${hewn(["secret", "set", "budget"], "1000000\n")}`;
const item = sh("security", ["find-generic-password", "-s", service, "-a", "magic-patterns-token"]);
records.keychain = `$ security find-generic-password -s ${service} -a magic-patterns-token\n${item
  .split("\n")
  .filter((l) => /keychain:|class:|"acct"|"svce"|"mdat"/.test(l))
  .join("\n")}`;

const owner = await request.newContext({ baseURL: api });
if ((await owner.post("/api/auth/dev/sign-in", { data: { login: "quinntynebrown" } })).status() !== 204) throw new Error("sign in");
await owner.get("/api/me");
const xsrf = (await owner.storageState()).cookies.find((c) => c.name === "XSRF-TOKEN").value;
const credentials = await (await owner.get("/api/settings/credentials")).json();
records.credentials = `$ curl /api/settings/credentials   (signed in as an Owner)\n${JSON.stringify(credentials, null, 2)}`;
if (JSON.stringify(credentials).includes("mp_live")) throw new Error("a credential value was returned");

// 2. A run that writes credentials into its workspace (stage 1) and fails with planted tokens (stage 2).
let submitted;
for (const name of ["Seed Swap", ...Array.from({ length: 30 }, (_, n) => `Seed Swap ${n + 2}`)]) {
  submitted = await owner.post("/api/projects", {
    headers: { "X-XSRF-TOKEN": xsrf },
    data: { name, idea: `${name}: a register for a community garden.`, stackPreference: null, repositoryUrl: null, budgetUsd: 300 },
  });
  if (submitted.status() === 201) break;
}
if (submitted.status() !== 201) throw new Error(`submit: ${submitted.status()}`);
const projectId = (await submitted.json()).projectId;
const modelKey = "sk-ant-api03-VideoDemoModelKey0123456789abcdef";
const planted =
  `model call refused: the agent pasted ${modelKey} into a request, ` +
  "pushed with ghp_PlantedInARepositoryReadme0123456789 and read AccountKey=Zm9vYmFyYmF6cXV4MDEyMzQ1Njc4OWFiY2Q= from a mock";
const worker = spawn("node", ["worker/src/main.ts"], {
  cwd: repo,
  env: {
    ...env,
    HEWN_API_URL: api,
    HEWN_WORKER_NAME: "local-worker-1",
    HEWN_EXECUTOR: "scripted",
    HEWN_SCRIPTED_STEP_MS: "4000",
    HEWN_SCRIPTED_CREDENTIALS_STAGE: "1",
    HEWN_SCRIPTED_FAIL_STAGE: "2",
    HEWN_SCRIPTED_FAIL_REASON: planted,
  },
  stdio: ["ignore", "pipe", "pipe"],
});
const workerLines = [];
worker.stdout.on("data", (d) => workerLines.push(...String(d).split("\n").filter(Boolean)));

const project = async () => (await owner.get(`/api/projects/${projectId}`)).json();
const runOf = async (stage, status) => {
  const p = await project();
  const detail = await (await owner.get(`/api/projects/${projectId}/directions/${p.directions[0].id}/stages/${stage}`)).json();
  const runs = (detail.runs ?? []).map((r) => ({ ...r, stageName: p.directions[0].stages[stage].name }));
  return status ? runs.find((r) => r.status === status) : runs[0];
};
const lines = async (runId) => (await owner.get(`/api/projects/${projectId}/runs/${runId}/logs?after=0`)).json();

// While stage 1 runs: the credentials are in its workspace.
let workspace;
for (let i = 0; i < 120 && !workspace; i++) {
  await sleep(250);
  const run = await runOf(1).catch(() => undefined);
  if (!run) continue;
  const wrote = (await lines(run.id)).find((l) => l.text.startsWith("Wrote .git-credentials"));
  if (wrote) workspace = wrote.text.replace(/^.* to /, "");
}
if (!workspace) throw new Error("stage 1 never wrote its credentials");
records.during = `$ ls -A ${workspace}\n${sh("ls", ["-A", workspace])}\n\n$ cat ${workspace}/.git-credentials\n${sh("cat", [join(workspace, ".git-credentials")])}`;
for (let i = 0; i < 120 && existsSync(workspace); i++) await sleep(250);
records.after = `$ ls -A ${workspace}   (stage 1 has ended)\n${sh("ls", ["-A", workspace])}`;

// Stage 2 fails with the planted tokens; everything that leaves the worker or reaches the database says ***.
let failed;
for (let i = 0; i < 160 && !failed; i++) {
  await sleep(250);
  failed = await runOf(2, "Failed").catch(() => undefined);
}
if (!failed) throw new Error("stage 2 never failed");
// It fails every retry too, until the direction is Blocked; then the stage's latest run is a failed one.
for (let i = 0; i < 400 && (await project()).directions[0].status !== "Blocked"; i++) await sleep(250);
failed = await runOf(2);
if (failed.status !== "Failed") throw new Error(`stage 2's latest run is ${failed.status}`);
const failedRunId = failed.id;
records.planted = planted;
records.runLog = (await lines(failedRunId)).map((l) => l.text);
records.failure = failed.error ?? null;
await sleep(1500);
const apiLog = readFileSync(resolve(repo, process.env.API_LOG ?? "../api37v.log"), "utf8").split("\n");
records.apiLog = apiLog.filter((l) => l.includes(failedRunId) && l.includes("Run failed")).slice(-1);
records.workerLog = workerLines.filter((l) => l.includes("OS key store") || (l.includes(failedRunId) && /Run failed|Leased run/.test(l)));
worker.kill("SIGTERM");
const everything = JSON.stringify([records.runLog, records.failure, records.apiLog, records.workerLog]);
for (const secret of [modelKey, "ghp_Planted", "Zm9vYmFy"]) if (everything.includes(secret)) throw new Error(`${secret} leaked`);

// 3. Mission Control: the failed stage and its log, desktop light and dark, and phone.
const browser = await chromium.launch();
async function shoot(file, { width = 1280, height = 800, scheme = "light" } = {}) {
  const ctx = await browser.newContext({ baseURL: app, viewport: { width, height }, deviceScaleFactor: width < 600 ? 2 : 1, colorScheme: scheme });
  const page = await ctx.newPage();
  if ((await page.request.post("/api/auth/dev/sign-in", { data: { login: "quinntynebrown" } })).status() !== 204) throw new Error("sign in");
  const projectPage = new ProjectPage(page);
  await projectPage.open(projectId);
  await projectPage.selectStage(failed.stageName);
  await projectPage.tab("Log").click();
  await projectPage.logLines.last().waitFor();
  await new Theme(page).settle();
  await page.waitForTimeout(400);
  // On a phone, the failure and its log are below the pipeline: scroll them into view.
  if (width < 600) await projectPage.detail.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(screens, `${file}.png`), caret: "hide" });
  await ctx.close();
}
await shoot("log-desktop-light");
await shoot("log-desktop-dark", { scheme: "dark" });
await shoot("log-phone", { width: 390, height: 844 });
await browser.close();

writeFileSync(join(screens, "records.json"), JSON.stringify(records, null, 2) + "\n");
console.log("captured", Object.keys(records).join(", "));
