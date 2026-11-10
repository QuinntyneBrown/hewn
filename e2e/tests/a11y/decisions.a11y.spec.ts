// Acceptance Test
// Traces to: L2-054, L2-047
// Description: The Decisions tab has no axe-core violations with every decision, one stage, in Dark, with no results, empty and when the decisions can't load

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, signIn, test } from '../../fixtures/test';
import { aCancelledProject } from '../../support/artifacts-project';
import { decisionsFailure, mockDecisions, noDecisions, serveDecisions } from '../../support/mock-decisions';

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

const file = {};

test.beforeEach(async ({ page }) => {
  await signIn(page, 'quinntynebrown');
});

test('every decision has no violations', async ({ page, decisions }) => {
  const id = await aCancelledProject(page, file);
  await serveDecisions(page, mockDecisions());
  await decisions.open(id);
  await expect(decisions.decisions).toHaveCount(5);
  expect(await violations(page)).toEqual([]);
});

test('one stage in Dark has no violations', async ({ page, decisions }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  const id = await aCancelledProject(page, file);
  await serveDecisions(page, mockDecisions());
  await decisions.open(id, 4);
  await expect(decisions.decisions).toHaveCount(1);
  expect(await violations(page)).toEqual([]);
});

test('no results has no violations', async ({ page, decisions }) => {
  const id = await aCancelledProject(page, file);
  await serveDecisions(page, mockDecisions());
  await decisions.open(id, 3);
  await expect(decisions.noResults).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test('empty has no violations', async ({ page, decisions }) => {
  const id = await aCancelledProject(page, file);
  await serveDecisions(page, noDecisions);
  await decisions.open(id);
  await expect(decisions.empty).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test('the error has no violations', async ({ page, decisions }) => {
  const id = await aCancelledProject(page, file);
  await serveDecisions(page, decisionsFailure, 502);
  await decisions.open(id);
  await expect(decisions.failure).toBeVisible();
  expect(await violations(page)).toEqual([]);
});
