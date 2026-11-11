// Acceptance Test
// Traces to: L2-003
// Description: The Delete project dialog matches dialogs/delete-project/default, invalid, busy and failed, and an Owner's Delete controls match pages/projects/default.html, enabled on an idle project and disabled on a running one (AC2, AC3)

import type { Page } from '@playwright/test';
import { expect, signIn, test } from '../../fixtures/test';
import { DeleteProjectDialog } from '../../pages/delete-project';
import type { ProjectsPage } from '../../pages/projects.page';
import { mockProjects } from '../../support/mock-projects';
import { compare, mockRegion, region } from '../../support/mocks';
import { serveProjects } from '../../support/projects';

const tolerance = 0.02;
const now = new Date('2026-11-09T12:00:00Z');

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(now);
  await serveProjects(page, mockProjects(now));
  await signIn(page, 'quinntynebrown');
});

async function openFor(page: Page, projects: ProjectsPage): Promise<DeleteProjectDialog> {
  await projects.open();
  await projects.row('Harbor CRM').delete.click();
  const dialog = new DeleteProjectDialog(page);
  await expect(dialog.title).toHaveText('Delete Harbor CRM?');
  return dialog;
}

async function matches(page: Page, dialog: DeleteProjectDialog, mock: string): Promise<number> {
  await page.mouse.move(0, 0);
  return compare(await region(dialog.panel), await mockRegion(page, mock, '.dialog__panel')).ratio;
}

test('default and invalid as the mocks show them', async ({ page, projects }) => {
  const dialog = await openFor(page, projects);
  await dialog.name.blur();
  expect(await matches(page, dialog, 'dialogs/delete-project/default.html'), 'default').toBeLessThan(tolerance);

  await dialog.name.fill('Harbor');
  await dialog.name.blur();
  await expect(dialog.error).toBeVisible();
  expect(await matches(page, dialog, 'dialogs/delete-project/invalid.html'), 'invalid').toBeLessThan(tolerance);
});

test('confirm and busy as the mocks show them', async ({ page, projects }) => {
  const dialog = await openFor(page, projects);
  await dialog.name.fill('Harbor CRM');
  await dialog.name.blur();
  await expect(dialog.confirm).toBeEnabled();
  expect(await matches(page, dialog, 'dialogs/delete-project/confirm.html'), 'confirm').toBeLessThan(tolerance);

  await dialog.holdDelete();
  await dialog.confirm.click();
  await expect(dialog.deleting).toBeVisible();
  expect(await matches(page, dialog, 'dialogs/delete-project/busy.html'), 'busy').toBeLessThan(tolerance);
});

test('failed as the mock shows it', async ({ page, projects }) => {
  const dialog = await openFor(page, projects);
  await dialog.name.fill('Harbor CRM');
  await dialog.failDelete(503, 'Service Unavailable', 'unavailable');
  await dialog.confirm.click();
  await expect(dialog.failure).toBeVisible();
  expect(await matches(page, dialog, 'dialogs/delete-project/failed.html'), 'failed').toBeLessThan(tolerance);
});

test('Delete, enabled and disabled, matches the projects mock', async ({ page, projects }) => {
  await projects.open();
  await expect(projects.rows).toHaveCount(7);
  await page.mouse.move(0, 0);

  const enabled = compare(
    await region(projects.row('Field Notes').delete, { snap: true }),
    await mockRegion(page, 'pages/projects/default.html', '[aria-label="Delete Field Notes"]', { snap: true }),
  );
  expect(enabled.ratio, 'Delete differs from default.html').toBeLessThan(tolerance);
  const disabled = compare(
    await region(projects.row('Ledgerline').deleteRefused, { snap: true }),
    await mockRegion(page, 'pages/projects/default.html', '[aria-label^="Delete Ledgerline"]', { snap: true }),
  );
  expect(disabled.ratio, 'the disabled Delete differs from default.html').toBeLessThan(tolerance);
  const rows = compare(await region(projects.list), await mockRegion(page, 'pages/projects/default.html', '.rows'));
  expect(rows.ratio, '.rows differs from default.html').toBeLessThan(tolerance);
});
