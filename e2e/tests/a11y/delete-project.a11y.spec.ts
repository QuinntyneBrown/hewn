// Acceptance Test
// Traces to: L2-003
// Description: The Projects page with an Owner's Delete controls (enabled and disabled), and the Delete project dialog in its default, invalid and failed states, have no axe-core violations; Escape closes the dialog and focus returns to Delete

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, signIn, test } from '../../fixtures/test';
import { DeleteProjectDialog } from '../../pages/delete-project';
import { mockProjects } from '../../support/mock-projects';
import { serveProjects } from '../../support/projects';

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

test('Delete a project, accessibility: the actions and the dialog', async ({ page, projects }) => {
  await serveProjects(page, mockProjects(new Date()));
  await signIn(page, 'quinntynebrown');
  await projects.open();
  await expect(projects.row('Ledgerline').deleteRefused).toBeVisible();
  expect(await violations(page), 'default').toEqual([]);

  const dialog = new DeleteProjectDialog(page);
  const del = projects.row('Harbor CRM').delete;
  await del.click();
  await expect(dialog.name).toBeFocused();
  await dialog.settled();
  await expect(dialog.name).toHaveAccessibleDescription(
    'The GitHub repository is kept; only Hewn’s record is deleted.',
  );
  expect(await violations(page), 'dialog').toEqual([]);

  await dialog.name.fill('Harbor');
  await dialog.name.blur();
  await expect(dialog.name).toHaveAccessibleDescription('Type Harbor CRM exactly to delete it.');
  expect(await violations(page), 'invalid').toEqual([]);

  await dialog.name.fill('Harbor CRM');
  await dialog.failDelete(503, 'Service Unavailable', 'unavailable');
  await dialog.confirm.click();
  await expect(dialog.failure).toBeVisible();
  expect(await violations(page), 'failed').toEqual([]);

  await page.keyboard.press('Escape');
  await expect(dialog.panel).toHaveCount(0);
  await expect(del).toBeFocused();
});
