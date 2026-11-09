// Captures the Mission Control screens and the clip for the journey 2 video (Add a feature) from the running app, reusing
// the e2e page objects and starting a real scripted worker.
// Start the stack first (API on 5300 via eng/Start-E2eApi.ps1, Mission Control on 4300 with
// proxy.e2e.conf.json), then from the repo root:
//   node docs/videos/02-add-a-feature/clips/clips.mjs
// The before-and-after documents come from clips/artifacts.ts.
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const { chromium } = createRequire(join(repo, "e2e/package.json"))(
  "@playwright/test",
);
const { NewDirectionPage } = await import(
  join(repo, "e2e/pages/new-direction.page.ts")
);
const { ProjectPage } = await import(join(repo, "e2e/pages/project.page.ts"));
const { startWorkers } = await import(join(repo, "e2e/support/workers.ts"));

const base = process.env.APP_URL ?? "http://localhost:4300";
const screens = resolve(here, "../screens");
mkdirSync(screens, { recursive: true });
const suffix = Date.now().toString(36).slice(-4);
const idea = "An operations portal for shift supervisors, with rosters and incident reports.";
const noUi = "Add a CSV export of the shift report, one row per shift, with crew, hours and incidents.";
const withUi = "Add a shift calendar page with a week view of every crew.";

async function context(browser, { width, height, dark = false, video } = {}) {
  const ctx = await browser.newContext({
    baseURL: base,
    viewport: { width, height },
    deviceScaleFactor: width < 600 ? 2 : 1,
    colorScheme: dark ? "dark" : "light",
    ...(video ? { recordVideo: { dir: video, size: { width, height } } } : {}),
  });
  const page = await ctx.newPage();
  const r = await page.request.post("/api/auth/dev/sign-in", {
    data: { login: "quinntynebrown" },
  });
  if (r.status() !== 204) throw new Error(`sign in: ${r.status()}`);
  return {
    ctx,
    page,
    nd: new NewDirectionPage(page),
    project: new ProjectPage(page),
  };
}

const shot = async (page, name) => (
  await page.mouse.move(0, 0),
  page.screenshot({
    path: join(screens, `${name}.png`),
    animations: "disabled",
    caret: "hide",
  })
);

const browser = await chromium.launch();

/** Submits a product direction and waits for it to complete; returns its name. */
async function completeProduct(page, nd, project, name) {
  await nd.open();
  await nd.fill({ name, idea, budget: "300.00" });
  await nd.submit();
  await project.completeCallout.waitFor({ timeout: 150_000 });
  return name;
}

let stopWorkers = startWorkers(1, 300);
try {
  // A product that is complete, and one still running, for the Product list and the queue.
  {
    const { ctx, page, nd, project } = await context(browser, { width: 1280, height: 900 });
    await completeProduct(page, nd, project, `Northwind Ops ${suffix}`);
    await ctx.close();
  }
  for (const [width, height, tag, dark] of [
    [1280, 900, "desktop", false],
    [1280, 900, "desktop-dark", true],
    [390, 844, "phone", false],
  ]) {
    const { ctx, page, nd } = await context(browser, { width, height, dark });
    await nd.open();
    await nd.fillFeature({ product: `Northwind Ops ${suffix}`, feature: noUi, budget: "60.00" });
    await page.locator("h1").click();
    await shot(page, `feature-form-${tag}`);
    await ctx.close();
  }
  {
    const { ctx, page, nd } = await context(browser, { width: 1280, height: 900 });
    await nd.open();
    await nd.featureMode.click();
    await nd.feature.fill("CSV only");
    await nd.submit();
    await nd.errorFor("feature").waitFor();
    await shot(page, "feature-invalid-desktop");
    await ctx.close();
  }

  // No UI change: run the feature to completion on desktop, light, with screenshots along the way.
  {
    const { ctx, page, nd, project } = await context(browser, { width: 1280, height: 900 });
    await nd.open();
    await nd.fillFeature({ product: `Northwind Ops ${suffix}`, feature: noUi, budget: "60.00" });
    await nd.submit();
    await project.directionMeta.waitFor();
    await project.currentStage().waitFor({ timeout: 90_000 });
    await shot(page, "feature-running-desktop");
    await project.featureCompleteCallout.waitFor({ timeout: 150_000 });
    await shot(page, "feature-complete-desktop");
    await ctx.close();
  }
  for (const [width, height, tag, dark] of [
    [1280, 900, "desktop-dark", true],
    [390, 844, "phone-dark", true],
  ]) {
    const { ctx, page, project } = await context(browser, { width, height, dark });
    const list = await (await page.request.get("/api/projects")).json();
    const northwind = list.find((p) => p.name === `Northwind Ops ${suffix}`);
    await project.open(northwind.id);
    await project.featureCompleteCallout.waitFor();
    await shot(page, `feature-complete-${tag}`);
    await ctx.close();
  }

  // A UI feature runs Designs and Design system.
  {
    const { ctx, page, nd, project } = await context(browser, { width: 1280, height: 900 });
    await nd.open();
    await nd.fillFeature({ product: `Northwind Ops ${suffix}`, feature: withUi, budget: "60.00" });
    await nd.submit();
    await project.featureCompleteCallout.waitFor({ timeout: 150_000 });
    await shot(page, "feature-ui-complete-desktop");
    await ctx.close();
  }
  await stopWorkers();

  // The queue: with no worker, a product stays at stage 0 and a feature queues behind it.
  {
    const { ctx, page, nd, project } = await context(browser, { width: 1280, height: 900 });
    const name = `Ledgerline ${suffix}`;
    await nd.open();
    await nd.fill({ name, idea: "A web app for small accounting teams to reconcile statements.", budget: "400.00" });
    await nd.submit();
    await project.heading.filter({ hasText: name }).waitFor();
    await nd.open();
    await nd.featureMode.click();
    await shot(page, "feature-products-desktop");
    await nd.fillFeature({ product: name, feature: "Export a reconciled period as PDF.", budget: "60.00" });
    await nd.submit();
    await project.queuedCallout.waitFor();
    await shot(page, "feature-queued-desktop");
    await ctx.close();
  }

  // Clip: choose Feature for a product, describe a no-UI feature, submit, and watch it run to completion (1408x792).
  stopWorkers = startWorkers(1, 700);
  const raw = join(here, ".raw");
  rmSync(raw, { recursive: true, force: true });
  const { ctx, page, nd, project } = await context(browser, { width: 1408, height: 792, video: raw });
  await nd.open();
  await page.waitForTimeout(800);
  await nd.featureMode.click();
  await page.waitForTimeout(900);
  const option = nd.productOption(`Northwind Ops ${suffix}`);
  await nd.product.selectOption({ label: (await option.textContent()).trim() });
  await page.waitForTimeout(500);
  await nd.feature.pressSequentially("Add an incident summary to the weekly email digest.", { delay: 30 });
  await page.waitForTimeout(600);
  await nd.submit();
  await project.featureCompleteCallout.waitFor({ timeout: 150_000 });
  await page.waitForTimeout(2500);
  await ctx.close();
  const webm = readdirSync(raw).find((f) => f.endsWith(".webm"));
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", join(raw, webm), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", join(here, "feature.mp4")]);
  rmSync(raw, { recursive: true, force: true });
} finally {
  await stopWorkers();
  await browser.close();
}
console.log(`screens in ${screens}, clip in ${join(here, "feature.mp4")}`);
