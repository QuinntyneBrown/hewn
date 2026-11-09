// Acceptance Test
// Traces to: L2-021, L2-022, L2-024, L2-025
// Description: An increment's page follows it to merge: red recorded or green first, the iteration under way, Blocked with its failing tests and the increment Hewn moved on to, the pull request with its required checks and body, the squash-merge, and the error state when GitHub can't be read

import type { Page } from '@playwright/test';
import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { serveBacklog } from '../../support/backlog';
import { serveIncrement } from '../../support/increment';
import { mockBacklog } from '../../support/mock-backlog';
import { mockIncrement } from '../../support/mock-increment';
import { xsrfToken } from '../../support/queue';
import { cancelDirections } from '../../support/rate-limit';

/** A real project for the breadcrumb; it is cancelled straight away so no worker picks it up. */
async function aProject(page: Page): Promise<string> {
  const response = await page.request.post('/api/projects', {
    data: {
      name: uniqueName('Ledgerline'),
      idea: 'A web app for small accounting teams to reconcile statements.',
      stackPreference: null,
      repositoryUrl: null,
      budgetUsd: 300,
    },
    headers: { 'X-XSRF-TOKEN': await xsrfToken(page) },
  });
  expect(response.status()).toBe(201);
  const { projectId } = (await response.json()) as { projectId: string };
  await cancelDirections(page, [projectId]);
  return projectId;
}

test.describe('Follow an increment to merge', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'quinntynebrown');
  });

  test('red is recorded and the iteration under way shows against the cap', async ({ page, increment }) => {
    const id = await aProject(page);
    await serveIncrement(page, mockIncrement('implementing'));
    await signIn(page, 'ada');
    await increment.open(id, 7);

    await expect(increment.heading).toHaveText('Reconcile a card statement');
    await expect(increment.status).toHaveText('In progress');
    await expect(increment.meta).toContainText('Journey 4');
    await expect(increment.meta).toContainText('L2-018, L2-019');
    await expect(increment.meta).toContainText('feature/reconcile-card-statement');
    await expect(increment.breadcrumb.getByRole('link', { name: 'Backlog' })).toHaveAttribute(
      'href',
      `/projects/${id}/backlog`,
    );
    expect(await increment.stepTitles()).toEqual([
      'Failing tests committed',
      'Red recorded',
      'Implementing · iteration 3 of 10',
      'Video',
      'Pull request',
      'Squash-merge',
    ]);
    await expect(increment.step('Failing tests committed').detail).toHaveText(
      '4 acceptance tests · traces to L2-018, L2-019',
    );
    await expect(increment.step('Red recorded').title).toContainText('(Failed)');
    await expect(increment.step('Red recorded').detail).toHaveText('4 failing, 0 passing');
    await expect(increment.step('Implementing').time).toHaveText('now');
    await expect(increment.railNote).toHaveText('Opens after the video step.');
  });

  test('tests that passed before implementation are flagged', async ({ page, increment }) => {
    const id = await aProject(page);
    await serveIncrement(page, mockIncrement('green-first'));
    await increment.open(id, 7);

    await expect(increment.step('Tests passed before implementation').detail).toHaveText(
      '4 of 4 passed on the test commit; flagged in the PR Notes',
    );
    await expect(increment.step('Tests passed before implementation').title).toContainText('(Skipped)');
  });

  test('the pull request shows its link, required checks and body (L2-024)', async ({ page, increment }) => {
    const id = await aProject(page);
    await serveIncrement(page, mockIncrement('default'));
    await increment.open(id, 7);

    await expect(increment.pullRequest).toHaveAttribute('href', 'https://github.com/hewn-builds/ledgerline/pull/28');
    await expect(increment.pullRequest).toContainText('Reconcile a card statement (journey 4, L2-018, L2-019)');
    await expect(increment.pullRequest).toContainText('#28 · open · +612 −48 · 14 files');
    await expect(increment.checks).toHaveCount(3);
    await expect(increment.check('backend').root).toContainText('Succeeded:');
    await expect(increment.check('backend').detail).toHaveText('passed · 1m 48s');
    await expect(increment.check('e2e').root).toContainText('Running:');
    await expect(increment.check('e2e').detail).toHaveText('running');
    await expect(increment.step('Pull request #28').detail).toHaveText('Waiting on required checks');
    await expect(increment.step('Squash-merge').detail).toHaveText('Automatic when checks pass');
    await expect(increment.section('What')).toContainText('±$0.50 tolerance');
    await expect(increment.section('Notes')).toHaveText('Red recorded before implementation.');
    await expect(increment.section('Attribution')).toHaveText('Built by Hewn · direction 7 Nov · run-0412');
  });

  test('a merged increment shows every check passed and the squash-merge (L2-025)', async ({ page, increment }) => {
    const id = await aProject(page);
    await serveIncrement(page, mockIncrement('merged'));
    await increment.open(id, 7);

    await expect(increment.status).toHaveText('Merged');
    await expect(increment.pullRequest).toContainText('#28 · squash-merged');
    await expect(increment.step('Pull request #28').detail).toHaveText('All required checks passed');
    await expect(increment.step('Squash-merge').title).toContainText('(Merged)');
    await expect(increment.step('Squash-merge').detail).toHaveText('Branch deleted');
    await expect(increment.step('Squash-merge').time).toHaveText('14:44');
  });

  test('a blocked increment lists its failing tests and what Hewn moved on to (L2-022 AC2)', async ({
    page,
    increment,
  }) => {
    const id = await aProject(page);
    await serveIncrement(page, mockIncrement('blocked'));
    await increment.open(id, 7);

    await expect(increment.status).toHaveText('Blocked');
    await expect(increment.step('Blocked after 10 iterations').detail).toHaveText(
      '1 of 4 failing: matches-across-midnight. Moved on to increment 8.',
    );
    await expect(increment.railNote).toHaveText('Not opened while the increment is blocked.');
    await expect(increment.failingTests).toHaveText('matches-across-midnight');
    await expect(increment.step('Pull request').detail).toHaveText('Not opened');
  });

  test('when GitHub cannot be read the page says so, and Try again loads it', async ({ page, increment }) => {
    const id = await aProject(page);
    await serveIncrement(
      page,
      { title: 'GitHub rate limit, resets in 2 min', status: 502, code: 'github_failed' },
      502,
    );
    await increment.open(id, 7);

    await expect(increment.failure).toContainText(
      'The pull request couldn’t be fetched from GitHub: GitHub rate limit, resets in 2 min. Hewn keeps polling its checks every 60 s.',
    );
    await expect(increment.backToBacklog).toHaveAttribute('href', `/projects/${id}/backlog`);

    await page.unrouteAll({ behavior: 'wait' });
    await serveIncrement(page, mockIncrement('default'));
    await increment.tryAgain.click();
    await expect(increment.heading).toHaveText('Reconcile a card statement');
  });

  test('an increment on the Backlog opens its page', async ({ page, backlog, increment }) => {
    const id = await aProject(page);
    await serveBacklog(page, mockBacklog());
    await serveIncrement(page, mockIncrement('default'));
    await backlog.open(id);

    await backlog.row(7).title.click();

    await expect(page).toHaveURL(`/projects/${id}/increments/7`);
    await expect(increment.heading).toHaveText('Reconcile a card statement');
  });
});
