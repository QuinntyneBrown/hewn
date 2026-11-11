// Acceptance Test
// Traces to: L2-044
// Description: The Audit page with entries, no results, an error and as a Viewer (forbidden) has no axe-core violations, and the filters are labelled and reachable by keyboard

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, signIn, test } from '../../fixtures/test';
import { AuditPage } from '../../pages/audit.page';
import { mockAuditLog, mockAuditProjects } from '../../support/mock-audit';

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

test('Audit, accessibility: entries, no results, error and forbidden', async ({ page }) => {
  await signIn(page, 'quinntynebrown');
  const audit = new AuditPage(page);
  await audit.serve(mockAuditLog);
  await audit.open();
  await expect(audit.rows).toHaveCount(10);
  expect(await violations(page), 'entries').toEqual([]);

  await audit.projectFilter.focus();
  await page.keyboard.press('Tab');
  await expect(audit.actionFilter).toBeFocused();

  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await audit.serve({ ...mockAuditLog, entries: [] });
  await audit.open(`?project=${mockAuditProjects.ledgerline}&action=StopAll`);
  await expect(audit.clearFilters).toBeVisible();
  expect(await violations(page), 'no results').toEqual([]);

  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await audit.fail(500);
  await audit.open();
  await expect(audit.tryAgain).toBeVisible();
  expect(await violations(page), 'error').toEqual([]);

  await signIn(page, 'ada');
  await audit.open();
  await expect(audit.backToDashboard).toBeVisible();
  expect(await violations(page), 'forbidden').toEqual([]);
});
