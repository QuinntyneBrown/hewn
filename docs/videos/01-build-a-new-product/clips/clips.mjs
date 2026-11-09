// Captures the Mission Control screens and the clip for the full journey 1 video from the running app, reusing the e2e page objects
// and starting real workers (stages 0 to 8 run for real; every stage runs for real).
// Start the stack first (API on 5300 via eng/Start-E2eApi.ps1, Mission Control on 4300 with
// proxy.e2e.conf.json), then from the repo root:
//   node docs/videos/01-build-a-new-product/clips/clips.mjs
// The target repository's artifacts come from clips/artifacts.ts.
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
const idea =
  "Booking firing slots for a shared pottery kiln, with deposits and a waitlist.";

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
let stopWorkers = startWorkers(1, 900);
try {
  for (const [width, height, tag, dark] of [
    [1280, 900, "desktop", false],
    [1280, 900, "desktop-dark", true],
    [390, 844, "phone-dark", true],
  ]) {
    const { ctx, page, nd, project } = await context(browser, {
      width,
      height,
      dark,
    });
    await nd.open();
    await shot(page, `new-direction-${tag}`);
    if (tag === "desktop") {
      await nd.submit();
      await nd.errorSummary.waitFor();
      await shot(page, "new-direction-invalid-desktop");
    }
    await nd.fill({
      name: `Kiln Booking ${suffix} ${tag}`,
      idea,
      budget: "300.00",
    });
    await nd.submit();
    await project.pipeline.waitFor();
    if (tag === "desktop") {
      await project
        .stage("Designs")
        .locator('[aria-current="step"]')
        .waitFor({ timeout: 90_000 });
      await shot(page, "project-running-desktop");
    }
    await project.completeCallout.waitFor({ timeout: 150_000 });
    await shot(page, `complete-${tag}`);
    await ctx.close();
  }
  await stopWorkers();

  // Clip: an inline error, the fix, submit, and every stage to Complete with no input after submission (1408x792).
  stopWorkers = startWorkers(1, 700);
  const raw = join(here, ".raw");
  rmSync(raw, { recursive: true, force: true });
  const { ctx, page, nd, project } = await context(browser, {
    width: 1408,
    height: 792,
    video: raw,
  });
  await nd.open();
  await page.waitForTimeout(600);
  await nd.name.pressSequentially(`Glaze Library ${suffix}`, { delay: 45 });
  await nd.idea.pressSequentially("Glazes", { delay: 60 });
  await page.waitForTimeout(400);
  await nd.submit();
  await nd.errorFor("idea").waitFor();
  await page.waitForTimeout(1800);
  await nd.idea.click();
  await nd.idea.pressSequentially(
    " catalogue for a shared studio, with firing results.",
    { delay: 30 },
  );
  await page.waitForTimeout(500);
  await nd.submit();
  await project.pipeline.waitFor();
  await project.completeCallout.waitFor({ timeout: 150_000 });
  await page.waitForTimeout(2500);
  await ctx.close();
  const webm = readdirSync(raw).find((f) => f.endsWith(".webm"));
  execFileSync("ffmpeg", [
    "-y",
    "-v",
    "error",
    "-i",
    join(raw, webm),
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-an",
    join(here, "journey.mp4"),
  ]);
  rmSync(raw, { recursive: true, force: true });
} finally {
  await stopWorkers();
  await browser.close();
}
console.log(`screens in ${screens}, clip in ${join(here, "journey.mp4")}`);
