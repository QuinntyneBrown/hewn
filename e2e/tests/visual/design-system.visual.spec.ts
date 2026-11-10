// Acceptance Test
// Traces to: L2-012
// Description: The Design system tab matches docs/mocks region by region, fed the mock's own design system: the token and component page list, the preview's title and controls, and the empty and error states (AC4)

import type { Page } from '@playwright/test';
import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { serveDesignSystem } from '../../support/designs';
import { mockDesignSystem, noDesignSystem } from '../../support/mock-design-system';
import { compare, mockRegion, region } from '../../support/mocks';
import { xsrfToken } from '../../support/queue';
import { cancelDirections } from '../../support/rate-limit';

const tolerance = 0.02;

/** A real project for the header, made once per file and cancelled straight away; the design system is stubbed. */
let shared: string | undefined;
async function aProject(page: Page): Promise<string> {
  if (shared) return shared;
  const response = await page.request.post('/api/projects', {
    data: {
      name: uniqueName('Ledgerline'),
      idea: 'A web app for small accounting teams to reconcile statements.',
      stackPreference: null,
      repositoryUrl: null,
      budgetUsd: 300,
    },
    headers: { 'X-XSRF-TOKEN': await xsrfToken(page) },
  });
  const { projectId } = (await response.json()) as { projectId: string };
  await cancelDirections(page, [projectId]);
  shared = projectId;
  return projectId;
}

test.beforeEach(async ({ page }) => {
  await signIn(page, 'quinntynebrown');
});

test('the page list matches the mock', async ({ page, designSystem }) => {
  const id = await aProject(page);
  await serveDesignSystem(page, mockDesignSystem());
  await designSystem.open(id);
  await expect(designSystem.caption).toHaveText('6 foundations · 7 components · docs/design-system/ at 8e2290a');

  const diff = compare(
    await region(designSystem.pages, { snap: true }),
    await mockRegion(page, 'pages/design-system/default.html', 'nav[aria-label="Design system pages"]', {
      snap: true,
    }),
  );
  expect(diff.ratio, 'the page list differs from default.html').toBeLessThan(tolerance);
});

test('the preview title and controls match the mock', async ({ page, designSystem }) => {
  const id = await aProject(page);
  await serveDesignSystem(page, mockDesignSystem());
  await designSystem.open(id);
  await expect(designSystem.previewTitle).toHaveText('Colour · 38 tokens, light and dark');

  const diff = compare(
    await region(designSystem.controls, { snap: true }),
    await mockRegion(page, 'pages/design-system/default.html', '#preview > .cluster', { snap: true }),
  );
  expect(diff.ratio, 'the controls differ from default.html').toBeLessThan(tolerance);
});

test('empty: matches the mock', async ({ page, designSystem }) => {
  const id = await aProject(page);
  await serveDesignSystem(page, noDesignSystem);
  await designSystem.open(id);
  await expect(designSystem.empty).toBeVisible();

  const diff = compare(
    await region(designSystem.empty, { snap: true }),
    await mockRegion(page, 'pages/design-system/empty.html', '.section .empty', { snap: true }),
  );
  expect(diff.ratio, 'the empty state differs from empty.html').toBeLessThan(0.05);
});

test('error: matches the mock', async ({ page, designSystem }) => {
  const id = await aProject(page);
  await serveDesignSystem(
    page,
    {
      status: 502,
      title: 'docs/design-system/ couldn’t be read at 8e2290a',
      code: 'github_failed',
    },
    502,
  );
  await designSystem.open(id);
  await expect(designSystem.failure).toBeVisible();

  const diff = compare(
    await region(designSystem.failure, { snap: true }),
    await mockRegion(page, 'pages/design-system/error.html', '.empty--error', {
      snap: true,
    }),
  );
  expect(diff.ratio, 'the error state differs from error.html').toBeLessThan(0.05);
});
