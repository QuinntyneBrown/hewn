// Acceptance Test
// Traces to: L2-003
// Description: The Projects page with an Owner's Archive controls (enabled and disabled), the Archived filter with Restore, and the toasts after archiving and a refusal have no axe-core violations

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { mockProjects } from '../../support/mock-projects';
import { serveProjects } from '../../support/projects';

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

test('Archive and restore, accessibility: the actions, the Archived filter and the toasts', async ({
  page,
  projects,
}) => {
  const now = new Date();
  const archived = { ...(mockProjects(now)[6] as object), name: uniqueName('Saltmarsh Survey'), archived: true };
  await serveProjects(page, [...mockProjects(now), archived]);
  await signIn(page, 'quinntynebrown');
  await projects.open();
  await expect(projects.row('Ledgerline').archiveRefused).toBeVisible();
  expect(await violations(page), 'default').toEqual([]);

  await projects.refuseArchive(409, 'Cancel the running direction first', 'active_direction');
  await projects.row('Field Notes').archive.click();
  await projects.toastSettled('Field Notes wasn’t archived');
  expect(await violations(page), 'refused').toEqual([]);

  await projects.open('?status=archived');
  await expect(projects.rows).toHaveCount(1);
  expect(await violations(page), 'archived').toEqual([]);
});
