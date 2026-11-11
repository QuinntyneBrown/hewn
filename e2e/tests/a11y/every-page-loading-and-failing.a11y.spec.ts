// Acceptance Test
// Traces to: L2-047
// Description: Every page has no axe-core violations while it loads and when its data couldn't load, and the not-found page has none

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, signIn, test } from '../../fixtures/test';
import { PageStates } from '../../pages/page-states';
import { xsrfToken } from '../../support/queue';

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

/** A queued project to open pages of, made as New direction makes one. */
async function aProject(page: Page): Promise<string> {
  const response = await page.request.post('/api/projects', {
    data: {
      name: `A11y states ${Date.now().toString(36)}`,
      idea: 'Book firing slots for a shared pottery kiln.',
      stackPreference: null,
      repositoryUrl: null,
      budgetUsd: 50,
    },
    headers: { 'X-XSRF-TOKEN': await xsrfToken(page) },
  });
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { projectId: string }).projectId;
}

/** Each page and the GET it loads from. */
function pages(id: string): { path: string; api: string }[] {
  const p = `/projects/${id}`;
  const api = `/api/projects/${id}`;
  return [
    { path: '/projects', api: '/api/projects' },
    { path: p, api },
    { path: `${p}/backlog`, api: `${api}/backlog` },
    { path: `${p}/designs`, api: `${api}/designs` },
    { path: `${p}/design-system`, api: `${api}/design-system` },
    { path: `${p}/decisions`, api: `${api}/decisions` },
    { path: `${p}/artifacts`, api: `${api}/artifacts` },
    { path: `${p}/traceability`, api: `${api}/traceability` },
    { path: `${p}/increments/1`, api: `${api}/increments/1` },
    { path: '/workers', api: '/api/workers' },
    { path: '/audit', api: '/api/audit' },
    { path: '/settings', api: '/api/settings/direction-defaults' },
  ];
}

test.describe('Every page, accessibility', () => {
  test.describe.configure({ timeout: 120_000 });

  test('while loading', async ({ page }) => {
    const states = new PageStates(page);
    await signIn(page, 'quinntynebrown');
    const id = await aProject(page);
    const found: string[] = [];
    for (const { path, api } of pages(id)) {
      await states.hold(api);
      await page.goto(path);
      await expect(states.busy, `${path} shows that it is loading`).toBeVisible();
      for (const v of await violations(page)) found.push(`${path}: ${v}`);
    }
    expect(found).toEqual([]);
  });

  test('when the data could not load', async ({ page }) => {
    const states = new PageStates(page);
    await signIn(page, 'quinntynebrown');
    const id = await aProject(page);
    const found: string[] = [];
    for (const { path, api } of pages(id)) {
      await states.fail(api);
      await page.goto(path);
      await expect(states.failure, `${path} says it couldn't load`).toBeVisible();
      for (const v of await violations(page)) found.push(`${path}: ${v}`);
    }
    expect(found).toEqual([]);
  });

  test('not found', async ({ page }) => {
    const states = new PageStates(page);
    await signIn(page, 'quinntynebrown');
    await page.goto('/no-such-page');
    await expect(states.notFound).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });
});
