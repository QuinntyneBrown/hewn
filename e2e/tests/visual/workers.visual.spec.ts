// Acceptance Test
// Traces to: L2-026
// Description: Workers matches docs/mocks for an Owner and a Viewer, and its loading, empty and error states match theirs (AC1)

import type { Page } from '@playwright/test';
import { expect, signIn, test } from '../../fixtures/test';
import { compare, mockRegion, region } from '../../support/mocks';
import { WorkersPage } from '../../pages/workers.page';

const tolerance = 0.02;
const content = 'main .pad';

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const s = 1_000;
const m = 60 * s;

/** The mocks' cast: two leased, one idle and one offline worker. */
const cast = [
  worker('wk_7f3a', 'quinn-mbp.local', 'Local', '0.9.2', 'Busy', 3 * s, (2 * 60 + 14) * m, 'Ledgerline'),
  worker('wk_c21e', 'hewn-cloud-eus-01', 'Cloud', '0.9.2', 'Busy', 6 * s, 38 * m, 'Tidewater'),
  worker('wk_90bd', 'hewn-cloud-eus-02', 'Cloud', '0.9.2', 'Idle', 8 * s, (5 * 60 + 2) * m, null),
  worker('wk_4e18', 'build-box-02', 'Local', '0.9.1', 'Offline', 4 * m, 26 * 60 * m, null),
];

function worker(
  id: string,
  name: string,
  location: string,
  version: string,
  status: string,
  seen: number,
  connected: number,
  project: string | null,
) {
  return {
    id,
    name,
    host: name,
    location,
    version,
    status,
    online: status !== 'Offline',
    lastSeenAt: ago(seen),
    registeredAt: ago(connected),
    workingOn: project
      ? { projectId: `prj_${project.toLowerCase()}`, projectName: project, stage: 10, stageName: 'Implement' }
      : null,
    holding: false,
  };
}

async function matches(page: Page, workers: WorkersPage, mock: string): Promise<number> {
  await page.mouse.move(0, 0);
  return compare(await region(workers.content), await mockRegion(page, mock, content)).ratio;
}

test.describe('Workers, visual', () => {
  test.describe.configure({ mode: 'serial' });

  test('Owner: every column as the mock shows it', async ({ page }) => {
    const workers = new WorkersPage(page);
    await signIn(page, 'quinntynebrown');
    await workers.serveWorkers(cast);
    await workers.open();
    await expect(workers.rows).toHaveCount(4);
    expect(await matches(page, workers, 'pages/workers/default.html'), 'Owner').toBeLessThan(tolerance);
  });

  test('Viewer: the same rows without Revoke, as the mock shows them', async ({ page }) => {
    const workers = new WorkersPage(page);
    await signIn(page, 'ada');
    await workers.serveWorkers(cast);
    await workers.open();
    await expect(workers.rows).toHaveCount(4);
    expect(await matches(page, workers, 'pages/workers/viewer.html'), 'Viewer').toBeLessThan(tolerance);
  });

  test('loading, empty and error as the mocks show them', async ({ page }) => {
    const workers = new WorkersPage(page);
    await signIn(page, 'quinntynebrown');
    await workers.answerWorkers('hold');
    await page.goto('/workers');
    await expect(workers.loading).toBeVisible();
    expect(await matches(page, workers, 'pages/workers/loading.html'), 'loading').toBeLessThan(tolerance);

    await page.unroute('**/api/workers');
    await workers.serveWorkers([]);
    await workers.open();
    await expect(workers.empty).toBeVisible();
    expect(await matches(page, workers, 'pages/workers/empty.html'), 'empty').toBeLessThan(tolerance);

    await page.unroute('**/api/workers');
    await workers.answerWorkers(503);
    await workers.open();
    await expect(workers.loadFailure).toBeVisible();
    expect(await matches(page, workers, 'pages/workers/error.html'), 'error').toBeLessThan(tolerance);
  });
});
