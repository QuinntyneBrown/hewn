// Acceptance Test
// Traces to: L2-053, L2-047
// Description: Settings has no axe-core violations in its default, invalid, saved and Viewer states

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, signIn, test } from '../../fixtures/test';

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

test.describe('Settings, accessibility', () => {
  test.describe.configure({ mode: 'serial' });

  test.afterEach(async ({ page, settings }) => {
    await signIn(page, 'quinntynebrown');
    await settings.resetDefaultBudget();
  });

  test('default', async ({ page, settings }) => {
    await signIn(page, 'quinntynebrown');
    await settings.open();
    expect(await violations(page)).toEqual([]);
  });

  test('invalid', async ({ page, settings }) => {
    await signIn(page, 'quinntynebrown');
    await settings.open();
    await settings.setDefaultBudget('5');
    await expect(settings.errorSummary).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  test('saved', async ({ page, settings }) => {
    await signIn(page, 'quinntynebrown');
    await settings.open();
    await settings.setDefaultBudget('300');
    await expect(settings.savedCallout).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  test('viewer', async ({ page, settings }) => {
    await signIn(page, 'ada');
    await settings.open();
    await expect(settings.readOnlyCallout).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });
});
