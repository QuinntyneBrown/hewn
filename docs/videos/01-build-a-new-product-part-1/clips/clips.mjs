// Captures the screens and the clip for video 01 part 1 from the running app, reusing the e2e page objects.
// Start the stack first (API on 5300 via eng/Start-E2eApi.ps1, Mission Control on 4300 with
// proxy.e2e.conf.json), then from the repo root:
//   node docs/videos/01-build-a-new-product-part-1/clips/clips.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../../..');
const { chromium } = createRequire(join(repo, 'e2e/package.json'))('@playwright/test');
const { NewDirectionPage } = await import(join(repo, 'e2e/pages/new-direction.page.ts'));
const { ProjectPage } = await import(join(repo, 'e2e/pages/project.page.ts'));

const base = process.env.APP_URL ?? 'http://localhost:4300';
const screens = resolve(here, '../screens');
mkdirSync(screens, { recursive: true });
const suffix = Date.now().toString(36).slice(-4);
const idea =
  'A web app for small accounting teams (2–10 people) to reconcile bank and card statements against receipts. Connect a bank feed or import a CSV, match each transaction to a receipt photo, split transactions across categories, and close a month once a second person reviews it.';

async function context(browser, { width, height, dark = false, login = 'quinntynebrown', video } = {}) {
  const ctx = await browser.newContext({
    baseURL: base,
    viewport: { width, height },
    deviceScaleFactor: width < 600 ? 2 : 1,
    colorScheme: dark ? 'dark' : 'light',
    ...(video ? { recordVideo: { dir: video, size: { width, height } } } : {}),
  });
  const page = await ctx.newPage();
  const r = await page.request.post('/api/auth/dev/sign-in', { data: { login } });
  if (r.status() !== 204) throw new Error(`sign in as ${login}: ${r.status()}`);
  return { ctx, page, nd: new NewDirectionPage(page), project: new ProjectPage(page) };
}

const shot = async (page, name) => (await page.mouse.move(0, 0), page.screenshot({ path: join(screens, `${name}.png`), animations: 'disabled', caret: 'hide' }));

const browser = await chromium.launch();
try {
  // Desktop, light: default, invalid, repo-no-access, project page.
  {
    const { ctx, page, nd, project } = await context(browser, { width: 1280, height: 900 });
    await nd.open();
    await nd.fill({ name: 'Ledgerline', idea, budget: '400.00' });
    await shot(page, 'new-direction-desktop');
    await nd.fill({ name: '', idea: 'Expenses', repository: 'gitlab.com/ledgerline', budget: '400.00' });
    await nd.submit();
    await nd.errorSummary.waitFor();
    await shot(page, 'new-direction-invalid');
    await nd.fill({ name: `Ledgerline ${suffix}`, idea, repository: 'https://github.com/northwind/handover', budget: '400.00' });
    await nd.submit();
    await nd.errorFor('repo').waitFor();
    await shot(page, 'new-direction-repo-no-access');
    await nd.fill({ name: `Ledgerline ${suffix}`, idea, budget: '400.00' });
    await nd.submit();
    await project.pipeline.waitFor();
    await shot(page, 'project-desktop');
    await ctx.close();
  }
  // Viewer: forbidden.
  {
    const { ctx, page, nd } = await context(browser, { width: 1280, height: 900, login: 'ada' });
    await nd.open();
    await nd.forbidden.waitFor();
    await shot(page, 'new-direction-forbidden');
    await ctx.close();
  }
  // Phone, light and dark.
  for (const dark of [false, true]) {
    const { ctx, page, nd, project } = await context(browser, { width: 390, height: 844, dark });
    await nd.open();
    await nd.fill({ name: `Tidewater ${suffix}${dark ? 'd' : ''}`, idea, budget: '300.00' });
    await shot(page, `new-direction-phone${dark ? '-dark' : ''}`);
    await nd.submit();
    await project.pipeline.waitFor();
    await shot(page, `project-phone${dark ? '-dark' : ''}`);
    await ctx.close();
  }
  // Desktop, dark.
  {
    const { ctx, page, nd } = await context(browser, { width: 1280, height: 900, dark: true });
    await nd.open();
    await nd.fill({ name: 'Ledgerline', idea, budget: '400.00' });
    await shot(page, 'new-direction-dark');
    await ctx.close();
  }
  // Clip: an inline error, the fix, then submit and land on the project page (1408x792).
  {
    const raw = join(here, '.raw');
    rmSync(raw, { recursive: true, force: true });
    const { ctx, page, nd, project } = await context(browser, { width: 1408, height: 792, video: raw });
    await nd.open();
    await page.waitForTimeout(600);
    await nd.name.pressSequentially(`Kiln Booking ${suffix}`, { delay: 45 });
    await nd.idea.pressSequentially('Pottery', { delay: 60 });
    await page.waitForTimeout(400);
    await nd.submit();
    await nd.errorFor('idea').waitFor();
    await page.waitForTimeout(1800);
    await nd.idea.click();
    await nd.idea.pressSequentially(' studio class booking with waitlists and deposits.', { delay: 30 });
    await page.waitForTimeout(500);
    await nd.submit();
    await project.pipeline.waitFor();
    await page.waitForTimeout(2500);
    await ctx.close();
    const webm = readdirSync(raw).find((f) => f.endsWith('.webm'));
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', join(raw, webm), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', join(here, 'submit.mp4')]);
    rmSync(raw, { recursive: true, force: true });
  }
} finally {
  await browser.close();
}
console.log(`screens in ${screens}, clip in ${join(here, 'submit.mp4')}`);
