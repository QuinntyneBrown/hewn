// Acceptance Test
// Traces to: L2-047
// Description: With the keyboard alone, every page can be tabbed through with a visible focus indicator at each stop and no traps, and a direction can be submitted, followed, and cancelled; when the user prefers reduced motion nothing animates

import type { Page } from '@playwright/test';
import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { Keyboard } from '../../pages/keyboard';
import { Motion } from '../../pages/motion';
import { Navigation } from '../../pages/navigation';
import { PageStates } from '../../pages/page-states';
import { mockProjects } from '../../support/mock-projects';
import { serveProjects } from '../../support/projects';
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
    // The mock's seven projects: the shared database's hundreds of rows would add stops, not coverage.
    await serveProjects(page, mockProjects(new Date()));

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

  test('when the user prefers reduced motion, spinners, skeletons, dialogs and the drawer do not animate', async ({
    page,
    newDirection,
    project,
    projects,
  }) => {
    const motion = new Motion(page);
    const states = new PageStates(page);
    const nav = new Navigation(page);
    await signIn(page, 'quinntynebrown');
    const id = await aProject(page, newDirection, project);
    const moving: string[] = [];
    // Up to 1 ms is not motion: the CDK keeps a 1 ms backdrop fade under reduced motion so its transitionend fires.
    const look = async (what: string) => {
      for (const m of await motion.longerThan(1)) moving.push(`${what}: ${m}`);
    };

    for (const reduced of [false, true]) {
      await motion.prefer(reduced);
      moving.length = 0;
      // A running project's spinner and its waiting stage.
      await project.open(id);
      await look('the project');
      // A dialog opening.
      await project.cancelButton.click();
      await look('the cancel dialog');
      await project.keepRunning.click();
      // Skeletons while Projects loads, and its spinners.
      await states.hold('/api/projects');
      await page.goto('/projects');
      await expect(states.busy).toBeVisible();
      await look('Projects loading');
      await states.release();
      await projects.open();
      await expect(projects.rows.first()).toBeVisible();
      await look('Projects');
      // The drawer sliding in on a phone.
      await nav.width(375);
      await nav.menuButton.click();
      await look('the drawer');
      await page.keyboard.press('Escape');
      await nav.width(1280);
      if (!reduced) expect(moving.length, 'without the preference, things move').toBeGreaterThan(0);
    }
    expect(moving).toEqual([]);
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
