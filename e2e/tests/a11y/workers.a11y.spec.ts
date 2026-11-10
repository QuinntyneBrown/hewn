// Acceptance Test
// Traces to: L2-026
// Description: Workers has no axe-core violations while it loads, before any worker connects (Owner and Viewer), and when it couldn't load

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, signIn, test } from '../../fixtures/test';
import { WorkersPage } from '../../pages/workers.page';

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

test.describe('Workers, accessibility', () => {
  test('loading', async ({ page }) => {
    const workers = new WorkersPage(page);
    await signIn(page, 'quinntynebrown');
    await workers.answerWorkers('hold');
    await page.goto('/workers');
    await expect(workers.loading).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  test('empty, Owner and Viewer', async ({ page }) => {
    const workers = new WorkersPage(page);
    await signIn(page, 'quinntynebrown');
    await workers.serveWorkers([]);
    await workers.open();
    await expect(workers.empty).toBeVisible();
    expect(await violations(page), 'Owner').toEqual([]);

    await signIn(page, 'ada');
    await workers.open();
    await expect(workers.empty).toBeVisible();
    expect(await violations(page), 'Viewer').toEqual([]);
  });

  test('error', async ({ page }) => {
    const workers = new WorkersPage(page);
    await signIn(page, 'quinntynebrown');
    await workers.answerWorkers(503);
    await workers.open();
    await expect(workers.loadFailure).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });
});
