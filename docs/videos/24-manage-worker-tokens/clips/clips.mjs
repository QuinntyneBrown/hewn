// Captures the Mission Control screens and clips for the journey 24 video (Manage worker tokens) from the running e2e
// stack. An Owner creates a token, a worker started with Docker on it registers under the token's name, and revoking
// it while it holds a lease stops it within 10 seconds while a second worker picks the run up.
// Start a fresh stack and build the image first:
//   pwsh eng/Start-E2eApi.ps1
//   cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
//   docker build -t hewn-worker:dev worker
// then from the repo root:
//   node docs/videos/24-manage-worker-tokens/clips/clips.mjs
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
const name = `studio-mac-${tag}`;
const standby = `standby-${tag}`;

async function context(browser, { width = 1280, height = 900, dark = false, video, login = "quinntynebrown" } = {}) {
  const ctx = await browser.newContext({
    baseURL: base,
    viewport: { width, height },
    deviceScaleFactor: width < 600 ? 2 : 1,
    colorScheme: dark ? "dark" : "light",
    permissions: ["clipboard-read", "clipboard-write"],
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

/** The command the dialog shows, pointed at the e2e API from inside Docker. */
function dockerWorker(token) {
  execFileSync("docker", [
    "run", "-d", "--name", name,
    "-e", "HEWN_API_URL=http://host.docker.internal:5300",
    "-e", `HEWN_WORKER_TOKEN=${token}`,
    "-e", "HEWN_EXECUTOR=scripted",
    "-e", "HEWN_SCRIPTED_STEP_MS=8000",
    "hewn-worker:dev",
  ], { stdio: "ignore" });
}
const dockerState = () => {
  try {
    return execFileSync("docker", ["inspect", "-f", "{{.State.Status}} {{.State.ExitCode}}", name]).toString().trim();
  } catch {
    return "gone";
  }
};
const removeDocker = () => {
  try {
    execFileSync("docker", ["rm", "-f", name], { stdio: "ignore" });
  } catch {}
};

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

let stopStandby = async () => {};
const records = {};
let token = "";
try {
  // 1. An Owner creates a token: name, location, expiry; it is shown once, copied, and the dialog closes on Done.
  await clip("create-token", async ({ page, workers }) => {
    await workers.open();
    await pause(page, 1_500);
    await workers.newTokenButton.click();
    await pause(page, 600);
    await workers.tokenName.pressSequentially(name, { delay: 70 });
    await workers.tokenLocation("Local").check();
    await pause(page, 500);
    await workers.tokenExpiry.selectOption({ label: "In 90 days" });
    await pause(page, 800);
    await workers.createToken.click();
    await workers.tokenCreated.waitFor();
    token = (await workers.createdToken.innerText()).trim();
    await pause(page, 2_500);
    await workers.copyToken.click();
    records.copied = (await page.evaluate(() => navigator.clipboard.readText())) === token;
    await pause(page, 2_500);
    await shot(page, "token-shown-once", workers.tokenPanel);
    await workers.tokenDone.click();
    await pause(page, 1_500);
  });

  // What Hewn kept: the hash, never the token; and no API response carries it.
  {
    const { ctx, workers } = await context(browser);
    records.tokenPrefix = token.slice(0, 4);
    records.tokenLength = token.length;
    records.workersResponseHasToken = (await workers.rawWorkers()).includes(token);
    const stored = execFileSync("sqlite3", [join(repo, "backend/e2e.db"), `select Id, Name, Hash, ExpiresAt from worker_tokens where Name = '${name}';`]).toString().trim();
    records.stored = stored;
    records.storedHasToken = stored.includes(token);
    await ctx.close();
  }

  // 2. The worker started with the token appears under the token's name, then leases a direction.
  await clip("worker-registers", async ({ page, newDirection, project, workers }) => {
    await workers.open();
    await pause(page, 1_500);
    dockerWorker(token);
    await workers.row(name).waitFor({ timeout: 20_000 });
    await pause(page, 2_500);
    await newDirection.open();
    await newDirection.fill({ name: `Tool Library ${tag}`, idea: "A tool library ledger for a village hall: loans, returns and reminders." });
    await newDirection.submit();
    await project.heading.waitFor();
    await project.currentStage().waitFor({ timeout: 20_000 });
    await pause(page, 2_000);
    await workers.open();
    await workers.details(name).workingOn.filter({ hasText: `Tool Library ${tag}` }).waitFor({ timeout: 20_000 });
    await pause(page, 3_000);
  });

  // A second worker stands by to pick the run up.
  stopStandby = startWorkers(1, 8_000, { executor: "scripted", namePrefix: standby });
  {
    const { ctx, page, workers } = await context(browser);
    await workers.open();
    await workers.details(`${standby}-1`).status.filter({ hasText: "Idle" }).waitFor({ timeout: 20_000 });
    await pause(page, 600);
    await shot(page, "workers-owner");
    await ctx.close();
  }

  // 3. Revoke the leased worker: it leaves Workers within 10 seconds, the container exits, the standby takes the run.
  await clip("revoke", async ({ page, workers }) => {
    await workers.open();
    await pause(page, 2_000);
    await workers.revoke(name).click();
    await workers.revokeDialog.waitFor();
    await pause(page, 2_500);
    await shot(page, "revoke-dialog", workers.revokePanel);
    const revoked = Date.now();
    await workers.revokeConfirm.click();
    await workers.row(name).waitFor({ state: "detached", timeout: 10_000 });
    records.rowGoneAfterMs = Date.now() - revoked;
    while (!dockerState().startsWith("exited") && Date.now() - revoked < 10_000) await page.waitForTimeout(200);
    records.containerAfterRevoke = dockerState();
    records.containerExitedAfterMs = Date.now() - revoked;
    await workers.details(`${standby}-1`).workingOn.filter({ hasText: `Tool Library ${tag}` }).waitFor({ timeout: 30_000 });
    records.resumedOnStandbyAfterMs = Date.now() - revoked;
    await pause(page, 4_000);
  });
  records.containerLogTail = execFileSync("docker", ["logs", "--tail", "3", name], { stdio: ["ignore", "pipe", "pipe"] }).toString().trim().split("\n");

  // 4. A Viewer sees Workers without the controls; Workers in dark and on a phone.
  for (const [file, opts] of [["workers-viewer", { login: "ada" }], ["workers-dark", { dark: true }], ["workers-phone", { width: 390, height: 844 }]]) {
    const { ctx, page, workers } = await context(browser, opts);
    await workers.open();
    await pause(page, 600);
    await shot(page, file);
    await ctx.close();
  }
  writeFileSync(join(screens, "records.json"), `${JSON.stringify(records, null, 2)}\n`);
} finally {
  removeDocker();
  await browser.close();
  await stopStandby();
}
console.log(`screens in ${screens}, clips in ${here}`);
