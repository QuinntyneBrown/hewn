// Acceptance Test
// Traces to: L2-019
// Description: With the threshold set to 1 day in Settings, a real worker's stage 9 defers every design estimated above it, each with its reason naming the 1-day threshold, shown apart on the Backlog (AC1, AC4)

import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { drainQueue, xsrfToken } from '../../support/queue';
import { startWorkers } from '../../support/workers';

test.describe('Descope with the Owner’s threshold', () => {
  test.describe.configure({ timeout: 300_000 });

  let stopWorkers: (() => Promise<void>) | null = null;

  test.afterEach(async ({ page, settings }) => {
    await stopWorkers?.();
    stopWorkers = null;
    await signIn(page, 'quinntynebrown');
    await settings.resetDefaultBudget();
    await drainQueue(page);
  });

  test('stage 9 defers designs above a 1-day threshold set in Settings', async ({ page, settings, backlog }) => {
    await signIn(page, 'quinntynebrown');
    await drainQueue(page);
    await settings.open();
    await settings.setThreshold('1');
    await expect(settings.savedCallout).toContainText('a 1-day descope threshold');

    const submitted = await page.request.post('/api/projects', {
      data: {
        name: uniqueName('Kiln Booking'),
        idea: 'Studio time booking for shared ceramics kilns, with firing schedules.',
        stackPreference: null,
        repositoryUrl: null,
        budgetUsd: 300,
      },
      headers: { 'X-XSRF-TOKEN': await xsrfToken(page) },
    });
    expect(submitted.status()).toBe(201);
    const { projectId } = (await submitted.json()) as { projectId: string };
    await backlog.open(projectId);
    stopWorkers = startWorkers(1, 150);

    // Every design the agent estimated at 2 days is above the 1-day threshold, and none was split.
    await expect(backlog.deferredItem(0).reason).toHaveText(
      'Estimated at 2 days, above the 1-day threshold, and could not be split',
      { timeout: 120_000 },
    );
    expect(await backlog.deferred.count()).toBeGreaterThan(0);
    await expect(backlog.deferred.filter({ hasNotText: 'above the 1-day threshold' })).toHaveCount(0);
  });
});
