// Acceptance Test
// Traces to: L2-003
// Description: An Owner archives a project with no active direction; it leaves the default list, appears under the Archived filter and is restored from there. Archive is disabled with "Cancel the running direction first" while a direction is active, and the API's refusal says the same. Viewers see the Archived filter but no actions (AC1, AC2)

import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { aProjectNamed, archiveProject } from '../../support/archive';
import { cancelDirections } from '../../support/rate-limit';

test.describe('Archive and restore a project', () => {
  test.describe.configure({ mode: 'serial' });

  test('an Owner archives an idle project, finds it under Archived and restores it', async ({ page, projects }) => {
    await signIn(page, 'quinntynebrown');
    const name = uniqueName('Saltmarsh Survey');
    await aProjectNamed(page, name, { idle: true });
    await projects.open();
    const row = projects.row(name);
    await expect(row.status).toHaveText('Cancelled');

    await row.archive.click();

    await expect(projects.toast(`${name} archived`)).toContainText('It’s under Archived, where you can restore it.');
    await expect(row.root).toHaveCount(0);
    await projects.toast(`${name} archived`).getByRole('link', { name: 'Show archived' }).click();
    await expect(projects.tab('Archived')).toHaveAttribute('aria-current', 'page');
    await expect(page).toHaveURL(/status=archived/);
    await expect(row.status).toHaveText('Archived');
    await expect(row.archive).toHaveCount(0);

    await row.restore.click();

    await expect(projects.toast(`${name} restored`)).toContainText('It’s back in the projects list.');
    await expect(row.root).toHaveCount(0);
    await projects.tab('All').click();
    await expect(row.status).toHaveText('Cancelled');
    await expect(row.archive).toBeVisible();
  });

  test('a project with an active direction is not archived', async ({ page, projects }) => {
    await signIn(page, 'quinntynebrown');
    const name = uniqueName('Tidewater');
    const projectId = await aProjectNamed(page, name, { idle: false });
    try {
      await projects.open();
      const row = projects.row(name);

      await expect(row.archive).toHaveCount(0);
      await expect(row.archiveRefused).toHaveAttribute('title', 'Cancel the running direction first');
      await expect(row.archiveRefused).toHaveAccessibleName(`Archive ${name}: cancel the running direction first`);
      await row.archiveRefused.click({ force: true });
      await expect(projects.toasts).toHaveCount(0);
    } finally {
      await cancelDirections(page, [projectId]);
    }

    // The direction was active when the API was asked (it ended since the page loaded): the API's reason is shown.
    await projects.open();
    const row = projects.row(name);
    await projects.refuseArchive(409, 'Cancel the running direction first', 'active_direction');
    await row.archive.click();
    await expect(projects.toast(`${name} wasn’t archived`)).toContainText('Cancel the running direction first.');
    await expect(row.root).toBeVisible();
  });

  test('a Viewer sees the Archived filter and no actions', async ({ page, projects }) => {
    await signIn(page, 'quinntynebrown');
    const name = uniqueName('Saltmarsh Survey');
    const projectId = await aProjectNamed(page, name, { idle: true });
    await archiveProject(page, projectId);

    await signIn(page, 'ada');
    await projects.open('?status=archived');
    const row = projects.row(name);
    await expect(row.status).toHaveText('Archived');
    await expect(row.restore).toHaveCount(0);
    await projects.tab('All').click();
    await expect(row.root).toHaveCount(0);
  });
});
