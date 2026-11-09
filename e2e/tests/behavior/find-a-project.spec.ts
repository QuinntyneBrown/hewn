// Acceptance Test
// Traces to: L2-002
// Description: Projects lists each project's name, stage, status, percent complete, spend and last activity, newest first; a status filter narrows the list and survives a reload; with no projects an Owner is offered New product and a Viewer is not

import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { serveProjects } from '../../support/projects';
import { xsrfToken } from '../../support/queue';

const idea = 'A web app for small accounting teams to reconcile statements.';

test.describe('Find a project', () => {
  test('each project shows its stage, status, percent, spend and activity, newest activity first', async ({
    page,
    newDirection,
    projects,
  }) => {
    await signIn(page, 'quinntynebrown');
    const older = uniqueName('Ledgerline');
    const newer = uniqueName('Tidewater');
    for (const name of [older, newer]) {
      await newDirection.open();
      await newDirection.fill({ name, idea });
      await newDirection.submit();
      await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
    }

    await projects.open();

    await expect(projects.summary).toHaveText(/\d+ projects? · sorted by last activity/);
    await expect(projects.rowAt(0).title).toHaveText(newer);
    await expect(projects.rowAt(1).title).toHaveText(older);
    const row = projects.row(newer);
    await expect(row.idea).toHaveText(idea);
    await expect(row.stage).toHaveText('0 · Bootstrap');
    await expect(row.status).toHaveText('Running');
    await expect(row.percent).toHaveText('0%');
    await expect(row.spend).toHaveText('$0.00');
    await expect(row.activity).toHaveText(/^(Just now|\d+s ago)$/);

    await row.title.click();
    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}$/);
  });

  test('a status filter shows only that status and survives a reload', async ({ page, newDirection, projects }) => {
    await signIn(page, 'quinntynebrown');
    const cancelled = uniqueName('Harbor CRM');
    const running = uniqueName('Kiln Booking');
    const ids: string[] = [];
    for (const name of [cancelled, running]) {
      await newDirection.open();
      await newDirection.fill({ name, idea });
      await newDirection.submit();
      await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
      ids.push(page.url().split('/').at(-1)!);
    }
    const project = (await (await page.request.get(`/api/projects/${ids[0]}`)).json()) as {
      directions: { id: string }[];
    };
    const cancel = await page.request.post(`/api/projects/${ids[0]}/directions/${project.directions[0]!.id}/cancel`, {
      data: {},
      headers: { 'X-XSRF-TOKEN': await xsrfToken(page) },
    });
    expect(cancel.ok()).toBe(true);

    await projects.open();
    await projects.tab('Cancelled').click();

    await expect(page).toHaveURL(/\/projects\?status=cancelled$/);
    await expect(projects.tab('Cancelled')).toHaveAttribute('aria-current', 'page');
    await expect(projects.row(cancelled).status).toHaveText('Cancelled');
    await expect(projects.row(running).root).toHaveCount(0);
    expect(new Set(await projects.statuses())).toEqual(new Set(['Cancelled']));
    await expect(projects.tabCount('Cancelled')).toHaveText(String(await projects.rows.count()));

    await page.reload();

    await expect(projects.tab('Cancelled')).toHaveAttribute('aria-current', 'page');
    await expect(projects.row(cancelled).status).toHaveText('Cancelled');
    expect(new Set(await projects.statuses())).toEqual(new Set(['Cancelled']));

    await projects.tab('All').click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(projects.row(running).status).toHaveText('Running');
  });

  test('with no projects, an Owner is offered New product and a Viewer is not', async ({ page, projects }) => {
    await serveProjects(page, []);
    await signIn(page, 'quinntynebrown');
    await projects.open();

    await expect(projects.emptyTitle).toHaveText('No projects yet');
    await expect(projects.emptyNewProduct).toBeVisible();
    await expect(projects.filters).toHaveCount(0);

    await signIn(page, 'ada');
    await projects.open();

    await expect(projects.emptyTitle).toHaveText('No projects yet');
    await expect(projects.emptyText).toContainText('When an Owner gives Hewn a direction');
    await expect(projects.emptyNewProduct).toHaveCount(0);
    await expect(projects.headerNewProduct).toHaveCount(0);
  });
});
