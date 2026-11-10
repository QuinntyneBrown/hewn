// Acceptance Test
// Traces to: L2-035, L2-047
// Description: The Traceability tab has no axe-core violations with a full trace, No acceptance test, Deferred, no search results, in Dark, empty, and when L2.md can't be parsed

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, signIn, test } from '../../fixtures/test';
import { aCancelledProject } from '../../support/artifacts-project';
import {
  mockTraceability,
  noRequirements,
  serveTraceability,
  unparsableRequirements,
} from '../../support/mock-traceability';

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

for (const l2 of ['L2-018', 'L2-020', 'L2-031']) {
  test(`the trace of ${l2} has no violations`, async ({ page, traceability }) => {
    const id = await aCancelledProject(page, file);
    await serveTraceability(page, mockTraceability());
    await traceability.open(id, l2);
    await expect(traceability.id).toHaveText(l2);
    expect(await violations(page)).toEqual([]);
  });
}

test('no search results and Dark have no violations', async ({ page, traceability }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  const id = await aCancelledProject(page, file);
  await serveTraceability(page, mockTraceability());
  await traceability.open(id);
  await traceability.search.fill('L2-099');
  await expect(traceability.noMatch).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test('empty has no violations', async ({ page, traceability }) => {
  const id = await aCancelledProject(page, file);
  await serveTraceability(page, noRequirements);
  await traceability.open(id);
  await expect(traceability.empty).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test('the error has no violations', async ({ page, traceability }) => {
  const id = await aCancelledProject(page, file);
  await serveTraceability(page, unparsableRequirements, 502);
  await traceability.open(id);
  await expect(traceability.failure).toBeVisible();
  expect(await violations(page)).toEqual([]);
});
