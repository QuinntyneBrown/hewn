// Acceptance Test
// Traces to: L2-034, L2-047
// Description: The Artifacts tab has no axe-core violations with each stage's artifacts, in Dark, empty, and when the artifacts can't load

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, signIn, test } from '../../fixtures/test';
import { aCancelledProject, artifactsFailure } from '../../support/artifacts-project';
import { mockArtifacts, noArtifacts, serveArtifacts } from '../../support/mock-artifacts';

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

test('the artifact lists have no violations', async ({ page, artifacts }) => {
  const id = await aCancelledProject(page, file);
  await serveArtifacts(page, mockArtifacts());
  await artifacts.open(id);
  await expect(artifacts.stages).toHaveCount(10);
  expect(await violations(page)).toEqual([]);
});

test('Dark has no violations', async ({ page, artifacts }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  const id = await aCancelledProject(page, file);
  await serveArtifacts(page, mockArtifacts());
  await artifacts.open(id);
  await expect(artifacts.stages).toHaveCount(10);
  expect(await violations(page)).toEqual([]);
});

test('empty has no violations', async ({ page, artifacts }) => {
  const id = await aCancelledProject(page, file);
  await serveArtifacts(page, noArtifacts);
  await artifacts.open(id);
  await expect(artifacts.empty).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test('the error has no violations', async ({ page, artifacts }) => {
  const id = await aCancelledProject(page, file);
  await serveArtifacts(page, artifactsFailure, 502);
  await artifacts.open(id);
  await expect(artifacts.failure).toBeVisible();
  expect(await violations(page)).toEqual([]);
});
