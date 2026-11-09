// Acceptance Test
// Traces to: L2-045
// Description: The production build of Projects has a Largest Contentful Paint of 2.5 s or less on Lighthouse's mobile profile (a mid-tier phone on throttled 4G) and ships 500 KB or less of initial JavaScript, gzipped

import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '../../fixtures/test';
import { buildMissionControl, initialJavaScript, serveMissionControl } from '../../support/prod-server';

const port = 4310;
const debuggingPort = 9323;

test('Projects loads within the LCP and initial JavaScript budgets', async () => {
  test.setTimeout(300_000);
  buildMissionControl();
  const js = initialJavaScript();
  const server = await serveMissionControl(port);
  const browser = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'hewn-lh-')), {
    args: [`--remote-debugging-port=${debuggingPort}`],
  });
  try {
    const signIn = await browser.request.post(`http://localhost:${port}/api/auth/dev/sign-in`, {
      data: { login: 'quinntynebrown' },
    });
    expect(signIn.status()).toBe(204);

    // Lighthouse's default profile is mobile: an emulated mid-tier phone with simulated slow 4G and a 4x slower CPU.
    const result = await lighthouse(`http://localhost:${port}/projects`, {
      port: debuggingPort,
      output: ['json', 'html'],
      logLevel: 'error',
      onlyCategories: ['performance'],
      disableStorageReset: true,
    });
    const lhr = result!.lhr;
    const lcpMs = lhr.audits['largest-contentful-paint']!.numericValue!;
    const report = {
      url: lhr.finalDisplayedUrl,
      formFactor: lhr.configSettings.formFactor,
      throttling: lhr.configSettings.throttling,
      lcpMs: Math.round(lcpMs),
      fcpMs: Math.round(lhr.audits['first-contentful-paint']!.numericValue!),
      performanceScore: Math.round((lhr.categories['performance']!.score ?? 0) * 100),
      initialJsGzipBytes: js.gzipBytes,
      initialJsFiles: js.files.length,
    };
    mkdirSync('perf-results', { recursive: true });
    writeFileSync('perf-results/lighthouse.json', JSON.stringify(report, null, 2));
    writeFileSync('perf-results/lighthouse-report.html', (result!.report as string[])[1]!);
    console.log(JSON.stringify(report));

    expect(lhr.configSettings.formFactor).toBe('mobile');
    expect(lcpMs, 'Largest Contentful Paint (ms)').toBeLessThanOrEqual(2_500);
    expect(js.gzipBytes, 'initial JavaScript, gzipped (bytes)').toBeLessThanOrEqual(500 * 1_000);
  } finally {
    await browser.close();
    server.close();
  }
});
