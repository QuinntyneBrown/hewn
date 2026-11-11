// Acceptance Test
// Traces to: L2-046, L2-047
// Description: At phone width, pages with the menu closed and the open menu drawer have no axe-core violations, and the drawer is a labelled modal dialog

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, signIn, test } from '../../fixtures/test';
import { Navigation } from '../../pages/navigation';

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

test('Mobile navigation, accessibility: pages at 375 px and the open drawer', async ({ page }) => {
  const nav = new Navigation(page);
  await signIn(page, 'quinntynebrown');
  await nav.width(375);
  for (const path of ['/dashboard', '/projects', '/workers', '/settings']) {
    await nav.visit(path);
    expect(await violations(page), path).toEqual([]);
  }

  await nav.openMenu();
  await expect(nav.drawer).toHaveAttribute('aria-modal', 'true');
  await expect(nav.closeMenu).toBeFocused();
  expect(await violations(page), 'the open drawer').toEqual([]);
});
