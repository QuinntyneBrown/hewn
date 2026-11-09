// Acceptance Test
// Traces to: L2-021, L2-022, L2-024, L2-025, L2-037
// Description: With an increment's page open while a real worker builds it, red is recorded, the iteration turns green, the pull request appears with its required checks turning green live, and the increment squash-merges, all without a reload; a signed check_run webhook updates a check on the page, and an unsigned one gets 401

import { createHmac } from 'node:crypto';
import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { drainQueue, xsrfToken } from '../../support/queue';
import { startWorkers } from '../../support/workers';

/** The webhook secret the e2e API is started with (eng/Start-E2eApi.ps1). */
const WEBHOOK_SECRET = 'e2e-webhook-secret-not-a-secret';

const idea = 'Studio time booking for shared ceramics kilns, with firing schedules and costs.';

test.describe('Follow an increment to merge, live', () => {
  test.describe.configure({ timeout: 300_000 });

  let stopWorkers: (() => Promise<void>) | null = null;

  test.afterEach(async ({ page }) => {
    await stopWorkers?.();
    stopWorkers = null;
    // The fake CI is shared: put it back to finishing checks at once.
    await page.request.put('/api/fakes/github/check-seconds', { data: { seconds: 0 } });
  });

  test('checks turn green live and the increment squash-merges without a reload', async ({
    page,
    backlog,
    increment,
  }) => {
    await signIn(page, 'quinntynebrown');
    await drainQueue(page);
    // Each of the three required checks takes 2 seconds in the fake CI, so they can be watched turning green.
    expect((await page.request.put('/api/fakes/github/check-seconds', { data: { seconds: 2 } })).status()).toBe(204);
    const submitted = await page.request.post('/api/projects', {
      data: { name: uniqueName('Kiln Booking'), idea, stackPreference: null, repositoryUrl: null, budgetUsd: 300 },
      headers: { 'X-XSRF-TOKEN': await xsrfToken(page) },
    });
    expect(submitted.status()).toBe(201);
    const { projectId } = (await submitted.json()) as { projectId: string };

    // Each stage 10 session takes a second, so every step can be seen.
    stopWorkers = startWorkers(1, 150, { incrementMs: 1_000 });
    await backlog.open(projectId);
    await expect(backlog.row(1).status).toHaveText('In progress', { timeout: 120_000 });
    await backlog.row(1).title.click();
    await expect(increment.heading).toHaveText('Sign in');
    // Marks this page load; a reload would clear it.
    await page.evaluate(() => ((window as unknown as { loadMark: number }).loadMark = 1));

    // L2-021 AC3, L2-022: red recorded, then green.
    await expect(increment.step('Red recorded').detail).toHaveText(/^\d+ failing, 0 passing$/, { timeout: 30_000 });
    await expect(increment.step('Green after 1 iteration').title).toBeVisible({ timeout: 30_000 });

    // L2-024 AC3, L2-037 AC1: the pull request and its required checks, as they change.
    await expect(increment.pullRequest).toBeVisible({ timeout: 30_000 });
    await expect(increment.pullRequest).toContainText(/#\d+ · open/);
    await expect(increment.checks.filter({ hasText: 'Running:' }).first()).toBeVisible({ timeout: 30_000 });
    for (const name of ['backend', 'frontend', 'e2e']) {
      await expect(increment.check(name).root).toContainText('Succeeded:', { timeout: 30_000 });
    }

    // L2-025 AC1: the squash-merge, with no approval.
    await expect(increment.status).toHaveText('Merged', { timeout: 30_000 });
    await expect(increment.step('Squash-merge').detail).toHaveText('Branch deleted');
    await expect(increment.pullRequest).toContainText('squash-merged');

    // L2-037: a signed check_run webhook reaches the page; an unsigned one is refused.
    const project = (await (await page.request.get(`/api/projects/${projectId}`)).json()) as { repository: string };
    const number = Number((await increment.pullRequest.textContent())!.match(/#(\d+)/)![1]);
    const body = JSON.stringify({
      action: 'completed',
      check_run: {
        name: 'deploy preview',
        status: 'completed',
        conclusion: 'success',
        started_at: '2026-11-09T14:37:05Z',
        completed_at: '2026-11-09T14:37:47Z',
        pull_requests: [{ number }],
      },
      repository: { full_name: project.repository },
    });
    const headers = { 'Content-Type': 'application/json', 'X-GitHub-Event': 'check_run', 'X-GitHub-Delivery': 'e2e-1' };
    const unsigned = await page.request.post('/api/github/webhook', { data: body, headers });
    expect(unsigned.status()).toBe(401);
    const signature = `sha256=${createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex')}`;
    const signed = await page.request.post('/api/github/webhook', {
      data: body,
      headers: { ...headers, 'X-Hub-Signature-256': signature },
    });
    expect(signed.status()).toBe(202);
    await expect(increment.check('deploy preview').detail).toHaveText('passed · 42s');

    expect(await page.evaluate(() => (window as unknown as { loadMark?: number }).loadMark)).toBe(1);

    // The direction finishes; nothing is left running for the next suite.
    await expect
      .poll(
        async () =>
          ((await (await page.request.get(`/api/projects/${projectId}/backlog`)).json()) as { percentComplete: number })
            .percentComplete,
        { timeout: 120_000 },
      )
      .toBe(100);
  });
});
