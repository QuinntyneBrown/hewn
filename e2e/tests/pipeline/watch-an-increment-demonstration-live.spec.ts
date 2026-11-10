// Acceptance Test
// Traces to: L2-023
// Description: After a real worker records an increment's captioned walkthrough and merges it, the increment page plays that video and its captions, served by the API from the commit that recorded them (AC2)

import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { drainQueue, xsrfToken } from '../../support/queue';
import { startWorkers } from '../../support/workers';

test.describe('Watch an increment demonstration, live', () => {
  test.describe.configure({ timeout: 300_000 });

  let stopWorkers: (() => Promise<void>) | null = null;

  test.afterEach(async () => {
    await stopWorkers?.();
    stopWorkers = null;
  });

  test('the recorded walkthrough plays on the merged increment', async ({ page, increment }) => {
    await signIn(page, 'quinntynebrown');
    await drainQueue(page);
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

    stopWorkers = startWorkers(1, 150);
    // The whole direction, so no run is left leased to a stopped worker.
    await expect
      .poll(
        async () => {
          const project = (await (await page.request.get(`/api/projects/${projectId}`)).json()) as {
            directions: { status: string }[];
          };
          return project.directions[0]!.status;
        },
        { timeout: 240_000, intervals: [1_000] },
      )
      .toBe('Complete');

    await increment.open(projectId, 1);
    await expect(increment.videoFooter).toContainText(/^Captioned walkthrough · 1080p · 0:0[1-9]/);
    await expect(increment.videoFooter).toContainText(/docs\/videos\/[a-z0-9-]+\/$/);
    await increment.play.click();
    await expect(increment.caption).not.toBeEmpty();
    await expect.poll(() => increment.currentTime()).toBeGreaterThan(0.5);
  });
});
