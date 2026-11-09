// Acceptance Test
// Traces to: L2-002, L2-047
// Description: Projects has no axe-core violations with rows, filtered, empty for an Owner and a Viewer, and when the API fails

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, signIn, test } from '../../fixtures/test';
import { mockProjects } from '../../support/mock-projects';
import { serveProjects } from '../../support/projects';

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

test.describe('Projects, accessibility', () => {
  test('rows, then filtered by status', async ({ page, projects }) => {
    await serveProjects(page, mockProjects(new Date()));
    await signIn(page, 'quinntynebrown');
    await projects.open();
    await expect(projects.rows).toHaveCount(7);
    expect(await violations(page)).toEqual([]);

    await projects.tab('Blocked').click();
    await expect(projects.rows).toHaveCount(1);
    expect(await violations(page)).toEqual([]);
  });

  for (const login of ['quinntynebrown', 'ada'] as const) {
    test(`empty, as ${login}`, async ({ page, projects }) => {
      await serveProjects(page, []);
      await signIn(page, login);
      await projects.open();
      await expect(projects.emptyTitle).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });
  }

  test('the API fails', async ({ page, projects }) => {
    await page.route(
      (url) => url.pathname === '/api/projects',
      (route) => route.fulfill({ status: 503, json: { title: 'Service Unavailable' } }),
    );
    await signIn(page, 'quinntynebrown');
    await projects.open();
    await expect(projects.failure).toContainText('The Hewn API returned 503');
    expect(await violations(page)).toEqual([]);
  });
});
