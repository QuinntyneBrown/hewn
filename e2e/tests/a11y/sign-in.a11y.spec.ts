// Acceptance Test
// Traces to: L2-038, L2-047
// Description: Sign-in has no axe-core violations in its default, denied, error, expired and signed-out states, and the sidebar's Sign out button has none

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, signIn, test } from '../../fixtures/test';

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

test.describe('Sign in, accessibility', () => {
  for (const query of ['', 'error=denied&login=devon-park', 'error=github', 'reason=expired', 'reason=signed-out']) {
    test(query || 'default', async ({ page, signInPage }) => {
      await signInPage.open(query);
      expect(await violations(page)).toEqual([]);
    });
  }

  test('the sidebar with Sign out', async ({ page, signInPage }) => {
    await signIn(page, 'ada');
    await page.goto('/workers');
    await expect(signInPage.signOut).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });
});
