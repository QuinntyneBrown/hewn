// Acceptance Test
// Traces to: L2-020, L2-019, L2-025
// Description: With a project's Backlog open while a real worker runs it, the backlog appears after stage 9 with the brief's nice-to-have deferred and its reason, and each increment goes from In progress to Merged with its pull request, the merged count moving with it, without a reload

import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { drainQueue, xsrfToken } from '../../support/queue';
import { startWorkers } from '../../support/workers';

const idea = 'Studio time booking for shared ceramics kilns, with firing schedules. Nice to have: review history.';

test.describe('Review the backlog, live', () => {
  test.describe.configure({ timeout: 300_000 });

  let stopWorkers: (() => Promise<void>) | null = null;

  test.afterEach(async () => {
    await stopWorkers?.();
    stopWorkers = null;
  });

  test('increments move from In progress to Merged in place as the worker builds them', async ({ page, backlog }) => {
    await signIn(page, 'quinntynebrown');
    await drainQueue(page);
    const submitted = await page.request.post('/api/projects', {
      data: { name: uniqueName('Kiln Booking'), idea, stackPreference: null, repositoryUrl: null, budgetUsd: 300 },
      headers: { 'X-XSRF-TOKEN': await xsrfToken(page) },
    });
    expect(submitted.status()).toBe(201);
    const { projectId } = (await submitted.json()) as { projectId: string };

    await backlog.open(projectId);
    await expect(backlog.emptyTitle).toHaveText('No backlog yet');
    // Marks this page load; a reload would clear it.
    await page.evaluate(() => ((window as unknown as { loadMark: number }).loadMark = 1));

    // Each stage 10 session takes 1.5 seconds, so every increment stays In progress long enough to watch.
    stopWorkers = startWorkers(1, 150, { incrementMs: 1_500 });

    // Stage 9: the backlog arrives, with the brief's nice-to-have deferred apart, with its reason (L2-019 AC4).
    await expect(backlog.deferredItem(0).title).toHaveText('Review history', { timeout: 120_000 });
    await expect(backlog.deferredItem(0).reason).toHaveText('Listed as nice-to-have in the brief: Review history');
    await expect(backlog.rows.filter({ hasText: 'Review history' })).toHaveCount(0);
    const total = await backlog.rows.count();
    expect(total).toBeGreaterThan(0);
    await expect(backlog.totals).toContainText(`0 of ${total} merged`);

    // Stage 10: the first increment is built, then merged through its pull request (L2-020 AC2, L2-025 AC4).
    const first = backlog.row(1);
    await expect(first.status).toHaveText('In progress', { timeout: 60_000 });
    await expect(first.status).toHaveText('Merged', { timeout: 60_000 });
    await expect(first.pullRequest.getByRole('link', { name: /^#\d+$/ })).toBeVisible();
    await expect(backlog.totals).toContainText(new RegExp(`[1-9]\\d* of ${total} merged`));

    // The direction finishes with every increment merged; nothing is left running for the next suite.
    await expect(backlog.totals).toContainText(`${total} of ${total} merged`, { timeout: 120_000 });
    await expect(backlog.totals).toContainText('100% complete', { timeout: 30_000 });
    expect(await backlog.statuses()).toEqual(Array(total).fill('Merged'));
    expect(await page.evaluate(() => (window as unknown as { loadMark?: number }).loadMark)).toBe(1);
  });
});
