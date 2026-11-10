// Acceptance Test
// Traces to: L2-044
// Description: The Audit page matches pages/audit/default, loading, empty, no-results, error and forbidden: the header with its filters, the table of entries newest first, and each empty state (AC2)

import { expect, signIn, test } from '../../fixtures/test';
import { AuditPage } from '../../pages/audit.page';
import { mockAuditLog, mockAuditProjects } from '../../support/mock-audit';
import { compare, mockRegion, region } from '../../support/mocks';

const tolerance = 0.02;

test.use({ timezoneId: 'UTC' });

async function matches(audit: AuditPage, mock: string, page: import('@playwright/test').Page): Promise<void> {
  await page.mouse.move(0, 0);
  const header = compare(await region(audit.header), await mockRegion(page, mock, '.page-header'));
  expect(header.ratio, `the header differs from ${mock}`).toBeLessThan(tolerance);
  const content = compare(await region(audit.content), await mockRegion(page, mock, '.pad'));
  expect(content.ratio, `the content differs from ${mock}`).toBeLessThan(tolerance);
}

test.beforeEach(async ({ page }) => {
  await signIn(page, 'quinntynebrown');
});

test('default: the entries as the mock shows them', async ({ page }) => {
  const audit = new AuditPage(page);
  await audit.serve(mockAuditLog);
  await audit.open();
  await expect(audit.rows).toHaveCount(10);
  await matches(audit, 'pages/audit/default.html', page);
});

test('loading and empty as the mocks show them', async ({ page }) => {
  const audit = new AuditPage(page);
  await audit.hold();
  await audit.open();
  await expect(audit.loading).toBeVisible();
  await audit.serve({ ...mockAuditLog, entries: [] });
  await matches(audit, 'pages/audit/loading.html', page);

  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await audit.serve({ ...mockAuditLog, entries: [] });
  await audit.open();
  await expect(audit.emptyTitle).toHaveText('No entries yet');
  await matches(audit, 'pages/audit/empty.html', page);
});

test('no results and error as the mocks show them', async ({ page }) => {
  const audit = new AuditPage(page);
  await audit.serve({ ...mockAuditLog, entries: [] });
  await audit.open(`?project=${mockAuditProjects.ledgerline}&action=StopAll`);
  await expect(audit.emptyTitle).toHaveText('No entries match these filters');
  await matches(audit, 'pages/audit/no-results.html', page);

  await audit.fail(500);
  await audit.open();
  await expect(audit.failure).toBeVisible();
  await matches(audit, 'pages/audit/error.html', page);
});

test('forbidden as the mock shows it', async ({ page }) => {
  await signIn(page, 'ada');
  const audit = new AuditPage(page);
  await audit.open();
  await expect(audit.emptyTitle).toHaveText('You don’t have access');
  await matches(audit, 'pages/audit/forbidden.html', page);
});
