// Acceptance Test
// Traces to: L2-047
// Description: With the keyboard alone, every page can be tabbed through with a visible focus indicator at each stop and no traps, and a direction can be submitted, followed, and cancelled

import type { Page } from '@playwright/test';
import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { Keyboard } from '../../pages/keyboard';
import { Navigation } from '../../pages/navigation';
import type { NewDirectionPage } from '../../pages/new-direction.page';
import type { ProjectPage } from '../../pages/project.page';

const idea = 'A web app for small accounting teams to reconcile bank and card statements against receipts.';

async function aProject(page: Page, newDirection: NewDirectionPage, project: ProjectPage): Promise<string> {
  await newDirection.open();
  await newDirection.fill({ name: uniqueName('Ledgerline'), idea });
  await newDirection.submit();
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}$/);
  await expect(project.stage('Bootstrap')).toBeVisible();
  return project.projectIdFromUrl();
}

function pages(projectId: string): string[] {
  const p = `/projects/${projectId}`;
  return [
    '/projects',
    '/projects/new',
    p,
    `${p}/backlog`,
    `${p}/designs`,
    `${p}/design-system`,
    `${p}/decisions`,
    `${p}/artifacts`,
    `${p}/traceability`,
    '/workers',
    '/audit',
    '/settings',
  ];
}

test.describe('Use keyboard and assistive technology', () => {
  test('every page can be tabbed through, each stop showing focus, and focus comes back round', async ({
    page,
    newDirection,
    project,
  }) => {
    test.setTimeout(240_000);
    const keyboard = new Keyboard(page);
    await signIn(page, 'quinntynebrown');
    const id = await aProject(page, newDirection, project);

    const problems: string[] = [];
    let stops = 0;
    const check = async (path: string) => {
      const walk = await keyboard.walk();
      stops += walk.stops.length;
      if (!walk.wrapped)
        problems.push(`${path}: focus never came back round (a trap) after ${walk.stops.length} stops`);
      for (const stop of walk.stops) {
        if (!stop.visible) problems.push(`${path}: ${stop.name} has focus but can't be seen`);
        else if (!stop.ring) problems.push(`${path}: ${stop.name} shows no focus indicator`);
      }
    };
    for (const path of pages(id)) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await check(path);
    }
    await page.context().clearCookies();
    await page.goto('/sign-in');
    await check('/sign-in');
    console.log(`Keyboard sweep: ${pages(id).length + 1} pages, ${stops} stops, ${problems.length} problems`);
    expect(problems).toEqual([]);
  });

  test('a direction is submitted, followed and cancelled with the keyboard alone', async ({
    page,
    newDirection,
    project,
  }) => {
    const keyboard = new Keyboard(page);
    const nav = new Navigation(page);
    await signIn(page, 'quinntynebrown');
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    await keyboard.tabTo(nav.sidebarLink('New direction'));
    await keyboard.press('Enter');
    await expect(page).toHaveURL(/\/projects\/new$/);
    await keyboard.tabTo(newDirection.name);
    await keyboard.type(uniqueName('Ledgerline'));
    await keyboard.tabTo(newDirection.idea);
    await keyboard.type(idea);
    await keyboard.tabTo(newDirection.start);
    await keyboard.press('Enter');
    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}$/);

    // A stage, then a tab of its detail.
    await keyboard.tabTo(project.stage('Idea').getByRole('link'));
    await keyboard.press('Enter');
    await expect(project.selectedStage()).toContainText('Idea');
    await keyboard.tabTo(project.tab('Log'));
    await keyboard.press('ArrowRight');
    await expect(project.tab('Runs')).toBeFocused();
    await expect(project.tab('Runs')).toHaveAttribute('aria-selected', 'true');

    // Cancel: Escape closes the dialog and gives focus back; Enter on Cancel direction cancels.
    await keyboard.tabTo(project.cancelButton);
    await keyboard.press('Enter');
    await expect(project.cancelDialog).toBeVisible();
    expect(await project.cancelDialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    await keyboard.press('Escape');
    await expect(project.cancelDialog).toHaveCount(0);
    await expect(project.cancelButton).toBeFocused();
    await keyboard.press('Enter');
    await keyboard.tabTo(project.cancelConfirm);
    await keyboard.press('Enter');
    await expect(project.cancelledCallout).toBeVisible({ timeout: 30_000 });
  });

  test('sign in with the keyboard alone', async ({ page, signInPage }) => {
    const keyboard = new Keyboard(page);
    await signInPage.open();
    await keyboard.tabTo(signInPage.continueWithGitHub);
    await keyboard.press('Enter');
    await keyboard.tabTo(signInPage.gitHubLogin);
    await keyboard.type('quinntynebrown');
    await keyboard.tabTo(signInPage.gitHubAuthorize);
    await keyboard.press('Enter');
    await expect(page).not.toHaveURL(/sign-in|github/);
    await expect(signInPage.signOut).toBeVisible();
  });
});
