// Acceptance Test
// Traces to: L2-020, L2-019
// Description: Backlog matches docs/mocks region by region: the active backlog, the deferred list, the blocked callout and the empty and error states, fed the mock's own backlog

import type { Page } from '@playwright/test';
import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { serveBacklog } from '../../support/backlog';
import { emptyBacklog, mockBacklog } from '../../support/mock-backlog';
import { compare, mockRegion, region } from '../../support/mocks';
import { xsrfToken } from '../../support/queue';
import { cancelDirections } from '../../support/rate-limit';

const tolerance = 0.02;

async function aProject(page: Page): Promise<string> {
  const response = await page.request.post('/api/projects', {
    data: {
      name: uniqueName('Ledgerline'),
      idea: 'Reconcile statements.',
      stackPreference: null,
      repositoryUrl: null,
      budgetUsd: 300,
    },
    headers: { 'X-XSRF-TOKEN': await xsrfToken(page) },
  });
  const { projectId } = (await response.json()) as { projectId: string };
  await cancelDirections(page, [projectId]);
  return projectId;
}

test.beforeEach(async ({ page }) => {
  await signIn(page, 'quinntynebrown');
});

test('default: the active backlog and the deferred list match the mock', async ({ page, backlog }) => {
  const id = await aProject(page);
  await serveBacklog(page, mockBacklog());
  await backlog.open(id);
  await expect(backlog.rows).toHaveCount(12);

  const rows = compare(
    await region(backlog.list, { snap: true }),
    await mockRegion(page, 'pages/backlog/default.html', '.rows--backlog', { snap: true }),
  );
  expect(rows.ratio, '.rows--backlog differs from the mock').toBeLessThan(tolerance);
  const deferred = compare(
    await region(backlog.deferredSection, { snap: true }),
    await mockRegion(page, 'pages/backlog/default.html', 'section[aria-labelledby="deferred-title"]', { snap: true }),
  );
  expect(deferred.ratio, 'the deferred section differs from the mock').toBeLessThan(tolerance);
});

test('blocked-increment: the callout and the blocked row match the mock', async ({ page, backlog }) => {
  const id = await aProject(page);
  await serveBacklog(page, mockBacklog({ blocked: true }));
  await backlog.open(id);
  await expect(backlog.blockedCallout).toBeVisible();

  const callout = compare(
    await region(backlog.blockedCallout, { snap: true }),
    await mockRegion(page, 'pages/backlog/blocked-increment.html', '.callout--danger', { snap: true }),
  );
  expect(callout.ratio, '.callout--danger differs from the mock').toBeLessThan(tolerance);
  const rows = compare(
    await region(backlog.list, { snap: true }),
    await mockRegion(page, 'pages/backlog/blocked-increment.html', '.rows--backlog', { snap: true }),
  );
  expect(rows.ratio, '.rows--backlog differs from the mock').toBeLessThan(tolerance);
});

test('empty: no backlog yet matches the mock', async ({ page, backlog }) => {
  const id = await aProject(page);
  await serveBacklog(page, emptyBacklog);
  await backlog.open(id);
  await expect(backlog.emptyTitle).toBeVisible();

  const diff = compare(
    await region(backlog.empty),
    await mockRegion(page, 'pages/backlog/empty.html', '.section .empty'),
  );
  expect(diff.ratio, '.empty differs from the mock').toBeLessThan(tolerance);
});
