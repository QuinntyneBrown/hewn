// Acceptance Test
// Traces to: L2-041
// Description: Workers with its Owner controls, New worker token in its form, invalid and success states, and Revoke have no axe-core violations

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, signIn, test } from '../../fixtures/test';
import { WorkersPage } from '../../pages/workers.page';
import { startWorkers } from '../../support/workers';

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

const unique = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

test.describe('Worker tokens', () => {
  test.describe.configure({ mode: 'serial', timeout: 60_000 });

  test('Workers, New worker token and Revoke', async ({ page }) => {
    const workers = new WorkersPage(page);
    const host = unique('a11y-host');
    const stop = startWorkers(1, 150, { executor: 'scripted', namePrefix: host });
    try {
      await signIn(page, 'quinntynebrown');
      await workers.open();
      await expect(workers.row(`${host}-1`)).toBeVisible({ timeout: 10_000 });
      expect(await violations(page), 'Workers').toEqual([]);

      await workers.fillToken('Cloud 03!');
      await workers.dialogSettled();
      expect(await violations(page), 'New worker token').toEqual([]);
      await workers.createToken.click();
      await expect(workers.tokenNameError).toBeVisible();
      expect(await violations(page), 'invalid').toEqual([]);

      await workers.tokenName.fill(unique('a11y-token'));
      await workers.createToken.click();
      await expect(workers.tokenCreated).toBeVisible();
      await workers.dialogSettled();
      expect(await violations(page), 'token shown once').toEqual([]);
      await workers.tokenDone.click();

      await workers.revoke(`${host}-1`).click();
      await expect(workers.revokeDialog).toBeVisible();
      await workers.dialogSettled();
      expect(await violations(page), 'Revoke').toEqual([]);
    } finally {
      await stop();
    }
  });
});
