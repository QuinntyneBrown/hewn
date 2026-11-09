// Acceptance Test
// Traces to: L2-020, L2-019, L2-018
// Description: A project's Backlog shows the increments in order with status, estimate and pull request link, the merged and estimated totals, the deferred designs apart with their reasons, a blocked increment's callout, and the empty and error states

import type { Page } from '@playwright/test';
import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { serveBacklog } from '../../support/backlog';
import { emptyBacklog, mockBacklog } from '../../support/mock-backlog';
import { xsrfToken } from '../../support/queue';
import { cancelDirections } from '../../support/rate-limit';

/** A real project for the header; it is cancelled straight away so no worker picks it up. */
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

test.describe('Review the backlog', () => {
  test('increments come in order with status, estimate, pull request and the totals', async ({ page, backlog }) => {
    await signIn(page, 'quinntynebrown');
    const id = await aProject(page);
    await serveBacklog(page, mockBacklog());
    await signIn(page, 'ada');
    await backlog.open(id);

    await expect(backlog.tab('Backlog')).toHaveAttribute('aria-current', 'page');
    await expect(backlog.rows).toHaveCount(12);
    expect((await backlog.titles()).slice(0, 3)).toEqual([
      'Sign in with Microsoft',
      'Connect a bank feed',
      'Import a CSV statement',
    ]);
    expect(await backlog.statuses()).toEqual([...Array(6).fill('Merged'), 'In progress', ...Array(5).fill('Queued')]);
    const first = backlog.row(1);
    await expect(first.journey).toHaveText('Journey 1');
    await expect(first.requirements).toHaveText('L2-001, L2-002');
    await expect(first.estimate).toHaveText('1.5 d');
    await expect(first.pullRequest.getByRole('link', { name: '#14' })).toHaveAttribute(
      'href',
      'https://github.com/hewn-builds/ledgerline/pull/14',
    );
    await expect(backlog.row(7).pullRequest).toHaveText('soon');
    await expect(backlog.row(8).pullRequest.getByRole('link')).toHaveCount(0);
    await expect(backlog.totals).toHaveText('6 of 12 merged · 12.5 of 24 ideal days · 62% complete');

    await backlog.tab('Pipeline').click();
    await expect(page).toHaveURL(new RegExp(`/projects/${id}$`));
    await expect(backlog.tab('Pipeline')).toHaveAttribute('aria-current', 'page');
  });

  test('deferred designs are shown apart from the active backlog, with their reasons', async ({ page, backlog }) => {
    await signIn(page, 'quinntynebrown');
    const id = await aProject(page);
    await serveBacklog(page, mockBacklog());
    await backlog.open(id);

    await expect(backlog.deferred).toHaveCount(3);
    await expect(backlog.rows.filter({ hasText: 'Multi-currency reconciliation' })).toHaveCount(0);
    await expect(backlog.deferredItem(0).title).toHaveText('Multi-currency reconciliation');
    await expect(backlog.deferredItem(1).reason).toHaveText('Listed as nice-to-have in the brief.');
    await expect(backlog.deferredSection).toContainText('Deferred');
  });

  test('a blocked increment says why and what Hewn moved on to', async ({ page, backlog }) => {
    await signIn(page, 'quinntynebrown');
    const id = await aProject(page);
    await serveBacklog(page, mockBacklog({ blocked: true }));
    await backlog.open(id);

    await expect(backlog.row(7).status).toHaveText('Blocked');
    await expect(backlog.blockedCallout).toContainText('Increment 7 is blocked after 10 iterations');
    await expect(backlog.blockedCallout).toContainText(
      '1 acceptance test still fails (matches-across-midnight). Hewn moved on to increment 8, which doesn’t depend on it.',
    );
  });

  test('before stage 9 the backlog is empty and points to the pipeline', async ({ page, backlog }) => {
    await signIn(page, 'quinntynebrown');
    const id = await aProject(page);
    await backlog.open(id);

    await expect(backlog.emptyTitle).toHaveText('No backlog yet');
    await backlog.openPipeline.click();
    await expect(page).toHaveURL(new RegExp(`/projects/${id}$`));
  });

  test('when the backlog cannot load, Try again loads it', async ({ page, backlog }) => {
    await signIn(page, 'quinntynebrown');
    const id = await aProject(page);
    await serveBacklog(page, null, 502);
    await backlog.open(id);
    await expect(backlog.failure).toContainText('The Hewn API returned 502');

    await page.unrouteAll();
    await serveBacklog(page, emptyBacklog);
    await backlog.tryAgain.click();
    await expect(backlog.emptyTitle).toHaveText('No backlog yet');
  });
});
