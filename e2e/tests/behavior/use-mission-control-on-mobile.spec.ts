// Acceptance Test
// Traces to: L2-046
// Description: Below 992 px navigation is a menu drawer and above it a fixed sidebar; the pipeline is a vertical list on phones, a scrollable stepper above the stage detail at 576 and 768 px and beside it from 992 px; no page scrolls sideways from 320 to 2560 px, and touch targets are 44 px below 992 px

import type { Page } from '@playwright/test';
import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import type { NewDirectionPage } from '../../pages/new-direction.page';
import { Navigation } from '../../pages/navigation';
import type { ProjectPage } from '../../pages/project.page';

const idea = 'A web app for small accounting teams to reconcile bank and card statements against receipts.';
const widths = [320, 375, 576, 768, 992, 1200, 2560];

/** A new project's id, from its page. */
async function aProject(page: Page, newDirection: NewDirectionPage, project: ProjectPage): Promise<string> {
  await newDirection.open();
  await newDirection.fill({ name: uniqueName('Ledgerline'), idea });
  await newDirection.submit();
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}$/);
  await expect(project.heading).toBeVisible();
  return new URL(page.url()).pathname.split('/').at(-1)!;
}

/** Every page of Mission Control for one project. */
function pages(projectId: string): string[] {
  const p = `/projects/${projectId}`;
  return [
    '/dashboard',
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

test.describe('Use Mission Control on mobile', () => {
  test('below 992 px the menu opens a drawer that traps focus, closes on Escape and on navigating', async ({
    page,
  }) => {
    const nav = new Navigation(page);
    await signIn(page, 'quinntynebrown');
    await nav.width(375);
    await page.goto('/dashboard');

    await expect(nav.sidebar).toBeHidden();
    await expect(nav.menuButton).toBeVisible();
    await nav.menuButton.click();
    await expect(nav.drawer).toBeVisible();
    await expect(nav.closeMenu).toBeFocused();
    await expect(nav.drawerLink('Dashboard')).toHaveAttribute('aria-current', 'page');
    // Focus stays in the drawer.
    for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
    expect(await nav.drawer.evaluate((d) => d.contains(document.activeElement))).toBe(true);

    await page.keyboard.press('Escape');
    await expect(nav.drawer).toHaveCount(0);
    await expect(nav.menuButton).toBeFocused();

    await nav.menuButton.click();
    await nav.drawerLink('Projects').click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(nav.drawer).toHaveCount(0);
    await expect(nav.heading).toHaveText('Projects');

    await nav.menuButton.click();
    await nav.closeMenu.click();
    await expect(nav.drawer).toHaveCount(0);

    // A tap beside the drawer, on the backdrop, closes it too.
    await nav.menuButton.click();
    await expect(nav.drawer).toBeVisible();
    await page.mouse.click(360, 450);
    await expect(nav.drawer).toHaveCount(0);
  });

  test('from 992 px navigation is a fixed sidebar with no menu button', async ({ page }) => {
    const nav = new Navigation(page);
    await signIn(page, 'quinntynebrown');
    for (const width of [992, 1200, 2560]) {
      await nav.width(width);
      await page.goto('/dashboard');
      await expect(nav.sidebar).toBeVisible();
      await expect(nav.menuButton).toBeHidden();
      await page.mouse.wheel(0, 2000);
      const box = (await nav.sidebar.boundingBox())!;
      expect(box.y, `the sidebar stays at the top at ${width} px`).toBe(0);
    }
  });

  test('a drawer left open closes when the window widens to the sidebar', async ({ page }) => {
    const nav = new Navigation(page);
    await signIn(page, 'quinntynebrown');
    await nav.width(768);
    await page.goto('/projects');
    await nav.menuButton.click();
    await expect(nav.drawer).toBeVisible();
    await nav.width(1200);
    await expect(nav.drawer).toHaveCount(0);
    await expect(nav.sidebar).toBeVisible();
  });

  test('the pipeline is a list on phones, a stepper above the detail at 576 and 768 px, and beside it from 992 px', async ({
    page,
    newDirection,
    project,
  }) => {
    const nav = new Navigation(page);
    await signIn(page, 'quinntynebrown');
    const id = await aProject(page, newDirection, project);

    for (const width of [320, 375, 576, 768, 992, 1200]) {
      await nav.width(width);
      await project.open(id);
      const first = (await project.stage('Bootstrap').boundingBox())!;
      const second = (await project.stage('Idea').boundingBox())!;
      const list = (await project.pipeline.boundingBox())!;
      const detail = (await project.detail.boundingBox())!;
      if (width < 576) {
        expect(second.y, `stages stack at ${width} px`).toBeGreaterThan(first.y);
        expect(second.x).toBe(first.x);
        expect(detail.y, `the detail follows the list at ${width} px`).toBeGreaterThanOrEqual(list.y + list.height);
      } else if (width < 992) {
        expect(second.y, `stages sit in a row at ${width} px`).toBe(first.y);
        expect(second.x).toBeGreaterThan(first.x);
        expect(await project.pipeline.evaluate((l) => l.scrollWidth > l.clientWidth)).toBe(true);
        expect(detail.y, `the stepper is above the detail at ${width} px`).toBeGreaterThanOrEqual(list.y + list.height);
      } else {
        expect(second.y, `stages stack at ${width} px`).toBeGreaterThan(first.y);
        expect(detail.x, `the detail is beside the list at ${width} px`).toBeGreaterThanOrEqual(list.x + list.width);
      }
    }
  });

  test('no page scrolls sideways at any width from 320 to 2560 px', async ({ page, newDirection, project }) => {
    test.setTimeout(180_000);
    const nav = new Navigation(page);
    await signIn(page, 'quinntynebrown');
    const id = await aProject(page, newDirection, project);

    const overflowing: string[] = [];
    for (const width of widths) {
      await nav.width(width);
      for (const path of pages(id)) {
        await nav.visit(path);
        const scroll = await nav.horizontalScroll();
        if (scroll > 0) overflowing.push(`${path} at ${width} px scrolls ${scroll} px`);
      }
    }
    await page.context().clearCookies();
    for (const width of widths) {
      await nav.width(width);
      await nav.visit('/sign-in');
      const scroll = await nav.horizontalScroll();
      if (scroll > 0) overflowing.push(`/sign-in at ${width} px scrolls ${scroll} px`);
    }
    console.log(
      `Width sweep: ${(pages(id).length + 1) * widths.length} pages and widths, ${overflowing.length} scroll`,
    );
    expect(overflowing).toEqual([]);
  });

  test('touch targets are 44 by 44 px below 992 px, and at least 24 px from there up', async ({
    page,
    newDirection,
    project,
  }) => {
    test.setTimeout(180_000);
    const nav = new Navigation(page);
    await signIn(page, 'quinntynebrown');
    const id = await aProject(page, newDirection, project);

    const small: string[] = [];
    for (const [width, min] of [
      [375, 44],
      [768, 44],
      [1280, 24],
    ] as const) {
      await nav.width(width);
      for (const path of pages(id)) {
        await nav.visit(path);
        for (const target of await nav.smallTargets(min)) small.push(`${path} at ${width} px: ${target}`);
      }
      await nav.width(width);
      if (width < 992) {
        await nav.visit('/dashboard');
        await nav.menuButton.click();
        for (const target of await nav.smallTargets(min)) small.push(`menu at ${width} px: ${target}`);
      }
    }
    expect(small).toEqual([]);
  });
});
