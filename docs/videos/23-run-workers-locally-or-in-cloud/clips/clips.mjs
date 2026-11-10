// Captures the Mission Control screens and clips for the journey 23 video (Run workers locally or in the cloud) from
// the running e2e stack. Two workers start from the one worker image with Docker, one configured Local and one Cloud;
// a third, run from source, plays an agent that tries a tool and a host it may not use.
// Start a fresh stack and build the image first:
//   pwsh eng/Start-E2eApi.ps1
//   cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
//   docker build -t hewn-worker:dev worker
// then from the repo root:
//   node docs/videos/23-run-workers-locally-or-in-cloud/clips/clips.mjs
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
const { startWorkers, E2E_WORKER_TOKEN } = await import(join(repo, "e2e/support/workers.ts"));

const base = process.env.APP_URL ?? "http://localhost:4300";
const screens = resolve(here, "../screens");
mkdirSync(screens, { recursive: true });
const tag = Date.now().toString(36).slice(-4);
const local = `laptop-${tag}`;
const cloud = `cloud-${tag}`;

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

const shot = async (page, name, locator) => (
  await page.mouse.move(0, 0),
  (locator ?? page).screenshot({ path: join(screens, `${name}.png`), animations: "disabled", caret: "hide" })
);
const pause = (page, ms = 1_200) => page.waitForTimeout(ms);

/** `docker run` of the one worker image; only the variables differ between Local and Cloud. */
function dockerWorker(name, location) {
  execFileSync("docker", [
    "run", "-d", "--rm", "--name", name,
    "-e", "HEWN_API_URL=http://host.docker.internal:5300",
    "-e", `HEWN_WORKER_TOKEN=${E2E_WORKER_TOKEN}`,
    "-e", `HEWN_LOCATION=${location}`,
    "-e", `HEWN_WORKER_NAME=${name}`,
    "-e", "HEWN_EXECUTOR=scripted",
    "-e", "HEWN_SCRIPTED_STEP_MS=6000",
    "hewn-worker:dev",
  ], { stdio: "ignore" });
}
const stopDocker = () => {
  for (const name of [local, cloud]) {
    try {
      execFileSync("docker", ["stop", "-t", "2", name], { stdio: "ignore" });
    } catch {}
  }
};

const browser = await chromium.launch();

async function clip(name, act) {
  const raw = join(here, `.raw-${name}`);
  rmSync(raw, { recursive: true, force: true });
  const c = await context(browser, { width: 1408, height: 792, video: raw });
  await act(c);
  await c.ctx.close();
  const webm = readdirSync(raw).find((f) => f.endsWith(".webm"));
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", join(raw, webm), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", join(here, `${name}.mp4`)]);
  rmSync(raw, { recursive: true, force: true });
}

let stopProbe = async () => {};
const records = {};
try {
  // 1. Workers is open; a Local and a Cloud worker start from the same image and appear without a reload.
  await clip("workers-appear", async ({ page, workers }) => {
    await workers.open();
    await pause(page, 2_000);
    const started = Date.now();
    dockerWorker(local, "Local");
    await workers.row(local).waitFor({ timeout: 20_000 });
    records.localShownAfterMs = Date.now() - started;
    await pause(page, 1_500);
    dockerWorker(cloud, "Cloud");
    await workers.row(cloud).waitFor({ timeout: 20_000 });
    await pause(page, 3_000);
  });

  {
    const { ctx, page, workers } = await context(browser);
    await workers.open();
    await workers.row(cloud).waitFor();
    await pause(page, 400);
    await shot(page, "workers-local-and-cloud");
    records.local = { location: (await workers.details(local).location.innerText()).trim(), status: (await workers.details(local).status.innerText()).trim() };
    records.cloud = { location: (await workers.details(cloud).location.innerText()).trim(), status: (await workers.details(cloud).status.innerText()).trim() };
    await ctx.close();
  }

  // 2. A new direction is pushed to an idle worker at once; Workers shows it leased and heartbeating.
  await clip("run-leased", async ({ page, newDirection, project, workers }) => {
    await newDirection.open();
    await newDirection.name.pressSequentially(`Lifeguard Rota ${tag}`, { delay: 60 });
    await newDirection.idea.fill("A rota planner for volunteer lifeguards at a lido, with swaps and reminders.");
    await pause(page, 800);
    await newDirection.submit();
    await project.heading.waitFor();
    await project.currentStage().waitFor({ timeout: 20_000 });
    await pause(page, 2_500);
    await workers.open();
    await pause(page, 12_000);
  });

  {
    const { ctx, page, workers } = await context(browser);
    await workers.open();
    await pause(page, 600);
    await shot(page, "workers-leased");
    await ctx.close();
  }
  stopDocker();

  // 3. A worker plays a misled agent in stage 1: the tool call is denied, the request blocked, and both are logged.
  stopProbe = startWorkers(1, 400, { namePrefix: `isolated-${tag}`, probeStage: 1 });
  await clip("isolation-log", async ({ page, newDirection, project }) => {
    await newDirection.open();
    await newDirection.fill({ name: `Kiln Rota ${tag}`, idea: "Book firing slots for a shared pottery kiln." });
    await newDirection.submit();
    await project.heading.waitFor();
    await project.stageStatus("Idea").filter({ hasText: "Succeeded" }).waitFor({ timeout: 60_000 });
    await pause(page, 1_500);
    await project.selectStage("Idea");
    await project.logLines.filter({ hasText: "Security event" }).waitFor();
    await pause(page, 1_000);
    await project.logLines.filter({ hasText: "Security event" }).hover();
    await pause(page, 6_000);
    records.log = await project.logLines.allInnerTexts();
    await shot(page, "isolation-log", project.log);
  });

  // 4. Workers in dark and on a phone.
  for (const [name, opts] of [["workers-dark", { dark: true }], ["workers-phone", { width: 390, height: 844 }]]) {
    const { ctx, page, workers } = await context(browser, opts);
    await workers.open();
    await pause(page, 600);
    await shot(page, name);
    await ctx.close();
  }
  writeFileSync(join(screens, "records.json"), `${JSON.stringify(records, null, 2)}\n`);
} finally {
  stopDocker();
  await browser.close();
  await stopProbe();
}
console.log(`screens in ${screens}, clips in ${here}`);
