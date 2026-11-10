// Acceptance Test
// Traces to: L2-003
// Description: An Owner chooses Delete, types the project name exactly and confirms; the project leaves the list, Hewn no longer holds it, and its GitHub repository is still there, as the dialog says it will be. A name that differs keeps Delete project disabled and says so, Cancel deletes nothing, Delete is disabled with "Cancel the running direction first" while a direction is active, and the API's refusal is shown in the dialog (AC2, AC3)

import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { DeleteProjectDialog } from '../../pages/delete-project';
import { aProjectNamed } from '../../support/archive';
import { aProjectWithRepository, projectStatus, repositoryReadme } from '../../support/delete';
import { cancelDirections } from '../../support/rate-limit';

test.describe('Delete a project', () => {
  test.describe.configure({ mode: 'serial' });

  test('typing the name exactly deletes the project and keeps its repository', async ({ page, projects }) => {
    await signIn(page, 'quinntynebrown');
    const name = uniqueName('Harbor CRM');
    const repository = `harbor-crm-${Date.now()}`;
    const projectId = await aProjectWithRepository(page, name, repository);
    await projects.open();
    const row = projects.row(name);
    const dialog = new DeleteProjectDialog(page);

    await row.delete.click();

    await expect(dialog.title).toHaveText(`Delete ${name}?`);
    await expect(dialog.text).toHaveText(
      'Its directions, runs, decisions, events and spend history are deleted from Hewn. This can’t be undone.',
    );
    await expect(dialog.hint).toHaveText('The GitHub repository is kept; only Hewn’s record is deleted.');
    await expect(dialog.confirm).toBeDisabled();
    await expect(dialog.name).toBeFocused();

    await dialog.name.fill('Harbor');
    await dialog.name.blur();
    await expect(dialog.error).toHaveText(`Type ${name} exactly to delete it.`);
    await expect(dialog.name).toHaveAttribute('aria-invalid', 'true');
    await expect(dialog.confirm).toBeDisabled();

    await dialog.name.fill(name);
    await expect(dialog.error).toHaveCount(0);
    await dialog.confirm.click();

    await expect(projects.toast(`${name} deleted`)).toContainText('Its GitHub repository is kept.');
    await expect(dialog.panel).toHaveCount(0);
    await expect(row.root).toHaveCount(0);
    await expect.poll(() => projectStatus(page, projectId)).toBe(404);
    expect(await repositoryReadme(page, repository)).toBe(`# ${name}\n`);
    await projects.open();
    await expect(projects.rows.first()).toBeVisible();
    await expect(row.root).toHaveCount(0);
  });

  test('Cancel deletes nothing, and a failure says nothing was removed', async ({ page, projects }) => {
    await signIn(page, 'quinntynebrown');
    const name = uniqueName('Harbor CRM');
    const projectId = await aProjectWithRepository(page, name, `harbor-crm-${Date.now()}`);
    await projects.open();
    const row = projects.row(name);
    const dialog = new DeleteProjectDialog(page);

    await row.delete.click();
    await dialog.name.fill(name);
    await dialog.cancel.click();
    await expect(dialog.panel).toHaveCount(0);
    await expect(row.root).toBeVisible();

    await row.delete.click();
    await dialog.name.fill(name);
    await dialog.failDelete(503, 'Service Unavailable', 'unavailable');
    await dialog.confirm.click();

    await expect(dialog.failure).toContainText(`${name} wasn’t deleted`);
    await expect(dialog.failure).toContainText('The API returned 503. Nothing was removed; try again.');
    await expect(dialog.confirm).toHaveText('Try again');
    await dialog.confirm.click();
    await expect(row.root).toHaveCount(0);
    await expect.poll(() => projectStatus(page, projectId)).toBe(404);
  });

  test('a project with an active direction is not deleted', async ({ page, projects }) => {
    await signIn(page, 'quinntynebrown');
    const name = uniqueName('Tidewater');
    const projectId = await aProjectNamed(page, name, { idle: false });
    try {
      await projects.open();
      const row = projects.row(name);

      await expect(row.delete).toHaveCount(0);
      await expect(row.deleteRefused).toHaveAttribute('title', 'Cancel the running direction first');
      await expect(row.deleteRefused).toHaveAccessibleName(`Delete ${name}: cancel the running direction first`);
      await row.deleteRefused.click({ force: true });
      await expect(new DeleteProjectDialog(page).panel).toHaveCount(0);
    } finally {
      await cancelDirections(page, [projectId]);
    }

    // A direction started after the page loaded: the API's reason is shown in the dialog, and nothing is removed.
    await projects.open();
    const row = projects.row(name);
    const dialog = new DeleteProjectDialog(page);
    await row.delete.click();
    await dialog.name.fill(name);
    await dialog.failDelete(409, 'Cancel the running direction first', 'active_direction');
    await dialog.confirm.click();
    await expect(dialog.failure).toContainText('Cancel the running direction first. Nothing was removed.');
    expect(await projectStatus(page, projectId)).toBe(200);
  });

  test('a Viewer sees no Delete', async ({ page, projects }) => {
    await signIn(page, 'quinntynebrown');
    const name = uniqueName('Field Notes');
    await aProjectNamed(page, name, { idle: true });

    await signIn(page, 'ada');
    await projects.open();
    const row = projects.row(name);
    await expect(row.status).toHaveText('Cancelled');
    await expect(row.delete).toHaveCount(0);
    await expect(row.deleteRefused).toHaveCount(0);
  });
});
