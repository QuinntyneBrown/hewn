// Acceptance Test
// Traces to: L2-048, L2-047
// Description: Every page, in Light and in Dark, whether the theme comes from the OS or a saved choice, has no
// axe-core violations, so text contrast is at least 4.5:1 in both themes

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { Navigation } from '../../pages/navigation';
import { mockProjects } from '../../support/mock-projects';
import { serveProjects } from '../../support/projects';

const idea = 'A web app for small accounting teams to reconcile bank and card statements against receipts.';

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

test.describe('Both themes, accessibility', () => {
  test.describe.configure({ mode: 'serial' });
  let id = '';

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await signIn(page, 'quinntynebrown');
    const { NewDirectionPage } = await import('../../pages/new-direction.page');
    const { ProjectPage } = await import('../../pages/project.page');
    const newDirection = new NewDirectionPage(page);
    await newDirection.open();
    await newDirection.fill({ name: uniqueName('Ledgerline'), idea });
    await newDirection.submit();
    const project = new ProjectPage(page);
    await expect(project.stage('Bootstrap')).toBeVisible();
    id = project.projectIdFromUrl();
    await page.close();
  });

  const pages = () => {
    const p = `/projects/${id}`;
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
  };

  for (const scheme of ['light', 'dark'] as const) {
    test(`every page in ${scheme}, following the OS`, async ({ page, theme }) => {
      test.setTimeout(120_000);
      await theme.osPrefers(scheme);
      await signIn(page, 'quinntynebrown');
      await serveProjects(page, mockProjects(new Date()));
      const nav = new Navigation(page);
      const found: string[] = [];
      for (const path of pages()) {
        await nav.visit(path);
        await page.waitForLoadState('networkidle');
        expect(await theme.shown(), path).toBe(scheme);
        found.push(...(await violations(page)).map((v) => `${path.replace(id, '…')} ${v}`));
      }
      expect(found).toEqual([]);
    });
  }

  test('a saved choice against the OS: Dark under a light OS, Light under a dark one, for a Viewer', async ({
    page,
    settings,
    theme,
  }) => {
    await signIn(page, 'ada');
    for (const [os, choice] of [
      ['light', 'Dark'],
      ['dark', 'Light'],
    ] as const) {
      await theme.osPrefers(os);
      await settings.open();
      await settings.themeChoice(choice).check();
      expect(await theme.shown()).toBe(choice.toLowerCase());
      await theme.settle();
      expect(await violations(page), `Settings, ${choice} under a ${os} OS`).toEqual([]);
      await new Navigation(page).visit('/projects');
      await page.waitForLoadState('networkidle');
      expect(await violations(page), `Projects, ${choice} under a ${os} OS`).toEqual([]);
    }
  });
});
