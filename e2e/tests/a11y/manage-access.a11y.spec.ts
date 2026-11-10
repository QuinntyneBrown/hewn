// Acceptance Test
// Traces to: L2-038, L2-047
// Description: Who can sign in and Add a GitHub login have no axe-core violations for an Owner and a Viewer, or in the dialog's invalid and failed states

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, signIn, test } from '../../fixtures/test';

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

test.describe('Manage access, accessibility', () => {
  test('Owner', async ({ page, settings }) => {
    await signIn(page, 'quinntynebrown');
    await settings.open();
    await expect(settings.accessRows.first()).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  test('Viewer', async ({ page, settings }) => {
    await signIn(page, 'ada');
    await settings.open();
    await expect(settings.accessRows.first()).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  test('add dialog', async ({ page, settings }) => {
    await signIn(page, 'quinntynebrown');
    await settings.open();
    await settings.fillAdd('nadia-k');
    expect(await violations(page)).toEqual([]);
  });

  test('add dialog, invalid', async ({ page, settings }) => {
    await signIn(page, 'quinntynebrown');
    await settings.open();
    await settings.fillAdd('ada');
    await settings.addConfirm.click();
    await expect(settings.addLoginError).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  test('add dialog, failed', async ({ page, settings }) => {
    await signIn(page, 'quinntynebrown');
    await settings.open();
    await settings.fillAdd('rate-limited');
    await settings.addConfirm.click();
    await expect(settings.addFailure).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });
});
