// Captures the screens and the clip for video 01 part 8 from the running app, reusing the e2e page objects
// and starting real workers (stages 0 to 8 run for real; stage 10 delivers each increment through a pull request).
// Start the stack first (API on 5300 via eng/Start-E2eApi.ps1, Mission Control on 4300 with
// proxy.e2e.conf.json), then from the repo root:
//   node docs/videos/01-build-a-new-product-part-8/clips/clips.mjs
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
const { startWorkers } = await import(join(repo, 'e2e/support/workers.ts'));

const base = process.env.APP_URL ?? 'http://localhost:4300';
const screens = resolve(here, '../screens');
mkdirSync(screens, { recursive: true });
const suffix = Date.now().toString(36).slice(-4);
const idea = 'Booking firing slots for a shared pottery kiln, with deposits and a waitlist.';

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

const browser = await chromium.launch();
let stopWorkers = startWorkers(1, 900);
try {
  for (const [width, height, tag, dark] of [[1280, 900, 'desktop', false], [390, 844, 'phone-dark', true]]) {
    const { ctx, page, nd, project } = await context(browser, { width, height, dark });
    await nd.open();
    await nd.fill({ name: `Kiln Booking ${suffix}${tag === 'desktop' ? '' : ` ${tag}`}`, idea, budget: '300.00' });
    await nd.submit();
    await project.pipeline.waitFor();
    await project.completeCallout.waitFor({ timeout: 120_000 });
    await shot(page, `complete-${tag}`);
    await ctx.close();
  }
  await stopWorkers();

  // Clip: submit; stages 0 to 10 run; stage 10 merges each increment and the direction completes (1408x792).
  stopWorkers = startWorkers(1, 700);
  const raw = join(here, '.raw');
  rmSync(raw, { recursive: true, force: true });
  const { ctx, page, nd, project } = await context(browser, { width: 1408, height: 792, video: raw });
  await nd.open();
  await page.waitForTimeout(500);
  await nd.name.pressSequentially(`Glaze Library ${suffix}`, { delay: 45 });
  await nd.idea.pressSequentially('A shared catalogue of glaze recipes with firing results.', { delay: 18 });
  await page.waitForTimeout(1200);
  await nd.submit();
  await project.repository.waitFor({ timeout: 60_000 });
  await project.stage('Increments').locator('[aria-current="step"]').waitFor({ timeout: 90_000 });
  await project.completeCallout.waitFor({ timeout: 120_000 });
  await page.waitForTimeout(2500);
  await ctx.close();
  const webm = readdirSync(raw).find((f) => f.endsWith('.webm'));
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', join(raw, webm), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', join(here, 'increments.mp4')]);
  rmSync(raw, { recursive: true, force: true });
} finally {
  await stopWorkers();
  await browser.close();
}
console.log(`screens in ${screens}, clip in ${join(here, 'increments.mp4')}`);
