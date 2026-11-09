// Acceptance Test
// Traces to: L2-002, L2-031
// Description: With Projects open, a new project's row appears and its stage, percent and status change in place as a real worker runs it, each within 1 second of the change being stored, without a reload

import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { drainQueue, xsrfToken } from '../../support/queue';
import { startWorkers } from '../../support/workers';

const idea = 'A web app for small accounting teams to reconcile statements.';

test.describe('Find a project, live', () => {
  test.describe.configure({ timeout: 240_000 });

  let stopWorkers: (() => Promise<void>) | null = null;

  test.afterEach(async () => {
    await stopWorkers?.();
    stopWorkers = null;
  });

  test('a row appears and updates in place as its direction runs', async ({ page, projects }) => {
    await signIn(page, 'quinntynebrown');
    await drainQueue(page);
    await projects.open();
    // Marks this page load; a reload would clear it.
    await page.evaluate(() => ((window as unknown as { loadMark: number }).loadMark = 1));

    const name = uniqueName('Ledgerline');
    const submitted = await page.request.post('/api/projects', {
      data: { name, idea, stackPreference: null, repositoryUrl: null, budgetUsd: 300 },
      headers: { 'X-XSRF-TOKEN': await xsrfToken(page) },
    });
    expect(submitted.status()).toBe(201);
    const { projectId } = (await submitted.json()) as { projectId: string };
    const row = projects.row(name);
    await expect(row.stage).toHaveText('0 · Bootstrap', { timeout: 1_000 });
    await expect(projects.rowAt(0).title).toHaveText(name);

    // Scripted stages of three 1-second steps, so each stage shows for about 3 seconds.
    stopWorkers = startWorkers(1, 1_000, { executor: 'scripted', logLines: 1 });
    await expect(row.stage).toHaveText('3 · Design system', { timeout: 60_000 });
    await expect(row.percent).toHaveText('27%');

    // Once the API reports the direction finished, the row says Idle at 100% within a second.
    await expect
      .poll(
        async () =>
          ((await (await page.request.get(`/api/projects/${projectId}`)).json()) as { status: string }).status,
        { timeout: 120_000 },
      )
      .toBe('Idle');
    await expect(row.status).toHaveText('Idle', { timeout: 1_000 });
    await expect(row.percent).toHaveText('100%', { timeout: 1_000 });
    await expect(row.stage).toHaveText('10 · Increments');

    expect(await page.evaluate(() => (window as unknown as { loadMark?: number }).loadMark)).toBe(1);
  });
});
