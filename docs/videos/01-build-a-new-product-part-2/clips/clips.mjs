// Captures the screens and the clip for video 01 part 2 from the running app, reusing the e2e page objects
// and starting real workers with the scripted executor. Start the stack first (API on 5300 via
// eng/Start-E2eApi.ps1, Mission Control on 4300 with proxy.e2e.conf.json), then from the repo root:
//   node docs/videos/01-build-a-new-product-part-2/clips/clips.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../../..');
const { chromium } = createRequire(join(repo, 'e2e/package.json'))('@playwright/test');
const { NewDirectionPage } = await import(join(repo, 'e2e/pages/new-direction.page.ts'));
const { ProjectPage } = await import(join(repo, 'e2e/pages/project.page.ts'));
const { startScriptedWorkers } = await import(join(repo, 'e2e/support/scripted-workers.ts'));

const base = process.env.APP_URL ?? 'http://localhost:4300';
const screens = resolve(here, '../screens');
mkdirSync(screens, { recursive: true });
const suffix = Date.now().toString(36).slice(-4);
const idea =
  'A web app for small accounting teams (2–10 people) to reconcile bank and card statements against receipts.';

async function context(browser, { width, height, dark = false, video } = {}) {
  const ctx = await browser.newContext({
    baseURL: base,
    viewport: { width, height },
    deviceScaleFactor: width < 600 ? 2 : 1,
    colorScheme: dark ? 'dark' : 'light',
    ...(video ? { recordVideo: { dir: video, size: { width, height } } } : {}),
  });
  const page = await ctx.newPage();
  const r = await page.request.post('/api/auth/dev/sign-in', { data: { login: 'quinntynebrown' } });
  if (r.status() !== 204) throw new Error(`sign in: ${r.status()}`);
  return { ctx, page, nd: new NewDirectionPage(page), project: new ProjectPage(page) };
}

const shot = async (page, name) => (await page.mouse.move(0, 0), page.screenshot({ path: join(screens, `${name}.png`), animations: 'disabled', caret: 'hide' }));

/** Submits a direction and waits until the given stage is running. */
async function submitAndWaitFor(nd, project, name, stageName) {
  await nd.open();
  await nd.fill({ name, idea, budget: '400.00' });
  await nd.submit();
  await project.pipeline.waitFor();
  await project.stage(stageName).locator('[aria-current="step"]').waitFor({ timeout: 60_000 });
}

const browser = await chromium.launch();
// Slow steps for stills (a stage runs about 2.4 s); the clip uses its own pace below.
let stopWorkers = startScriptedWorkers(2, 800);
try {
  for (const [width, height, label] of [[1280, 900, 'desktop'], [390, 844, 'phone']]) {
    for (const dark of [false, true]) {
      if (label === 'phone' && !dark) continue;
      const { ctx, page, nd, project } = await context(browser, { width, height, dark });
      const tag = `${label}${dark ? '-dark' : ''}`;
      await submitAndWaitFor(nd, project, `Ledgerline ${suffix}${tag}`, 'Stack');
      await shot(page, `running-${tag}`);
      await project.completeCallout.waitFor({ timeout: 90_000 });
      await shot(page, `complete-${tag}`);
      await ctx.close();
    }
  }
  {
    const { ctx, page, nd, project } = await context(browser, { width: 390, height: 844 });
    await submitAndWaitFor(nd, project, `Tidewater ${suffix}`, 'Design system');
    await shot(page, 'running-phone');
    await ctx.close();
  }
  await stopWorkers();

  // Clip: submit, then the pipeline runs live to Complete (1408x792).
  stopWorkers = startScriptedWorkers(1, 350);
  const raw = join(here, '.raw');
  rmSync(raw, { recursive: true, force: true });
  const { ctx, page, nd, project } = await context(browser, { width: 1408, height: 792, video: raw });
  await nd.open();
  await page.waitForTimeout(500);
  await nd.name.pressSequentially(`Kiln Booking ${suffix}`, { delay: 40 });
  await nd.idea.pressSequentially('Booking firing slots for a shared pottery kiln.', { delay: 20 });
  await page.waitForTimeout(400);
  await nd.submit();
  await project.completeCallout.waitFor({ timeout: 90_000 });
  await page.waitForTimeout(2500);
  await ctx.close();
  const webm = readdirSync(raw).find((f) => f.endsWith('.webm'));
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', join(raw, webm), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', join(here, 'pipeline.mp4')]);
  rmSync(raw, { recursive: true, force: true });
} finally {
  await stopWorkers();
  await browser.close();
}
console.log(`screens in ${screens}, clip in ${join(here, 'pipeline.mp4')}`);
