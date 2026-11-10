// Acceptance Test
// Traces to: L2-032
// Description: Mission Control has no axe-core violations while it reconnects, once the connection is lost, and when it has caught up

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, signIn, test } from '../../fixtures/test';
import { LiveConnection } from '../../pages/live-connection';
import { WorkersPage } from '../../pages/workers.page';

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

test('Connection banner, accessibility: reconnecting, lost and reconnected', async ({ page }) => {
  const live = new LiveConnection(page);
  await live.intercept();
  await page.clock.install();
  await signIn(page, 'quinntynebrown');
  await new WorkersPage(page).open();
  await expect(live.state).toHaveText('Live');

  await live.drop();
  await expect(live.banner).toContainText('Reconnecting…');
  expect(await violations(page), 'reconnecting').toEqual([]);

  await page.clock.runFor(2_000);
  await expect(live.banner).toHaveText(/in (9|10) s/);
  await page.clock.runFor(10_000);
  await expect(live.banner).toHaveText(/in (29|30) s/);
  await page.clock.runFor(30_000);
  await expect(live.retryNow).toBeVisible();
  expect(await violations(page), 'lost').toEqual([]);

  live.restore();
  await live.retryNow.click();
  await expect(live.banner).toContainText('Reconnected.');
  expect(await violations(page), 'reconnected').toEqual([]);
});
