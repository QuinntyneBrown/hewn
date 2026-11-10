// Acceptance Test
// Traces to: L2-011
// Description: The Designs tab matches docs/mocks region by region, fed the mock's own designs: the gallery of screens and states with thumbnails and Magic Patterns links, the width and theme controls at L and Light and at XS and Dark, and the empty and error states

import type { Page } from '@playwright/test';
import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { serveDesigns } from '../../support/designs';
import { mockDesigns, noDesigns } from '../../support/mock-designs';
import { compare, mockRegion, region } from '../../support/mocks';
import { xsrfToken } from '../../support/queue';
import { cancelDirections } from '../../support/rate-limit';

const tolerance = 0.02;

/** A real project for the header, made once per file and cancelled straight away; the designs are stubbed. */
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

test('the gallery matches the mock', async ({ page, designs }) => {
  const id = await aProject(page);
  await serveDesigns(page, mockDesigns());
  await designs.open(id);
  await designs.state('Reconcile statement', 'Review').click();
  await expect(designs.thumbnails).toHaveCount(17);

  const diff = compare(
    await region(designs.gallery, { snap: true }),
    await mockRegion(page, 'pages/designs/default.html', 'nav[aria-label="Screens and states"]', { snap: true }),
  );
  expect(diff.ratio, 'the gallery differs from default.html').toBeLessThan(tolerance);
});

for (const [state, size, theme] of [
  ['default', 'L', 'Light'],
  ['xs-dark', 'XS', 'Dark'],
] as const) {
  test(`${state}: the preview controls match the mock`, async ({ page, designs }) => {
    const id = await aProject(page);
    await serveDesigns(page, mockDesigns());
    await designs.open(id);
    await designs.state('Reconcile statement', 'Review').click();
    await designs.width(size).click();
    await designs.theme(theme).click();
    await expect(designs.theme(theme)).toHaveAttribute('aria-checked', 'true');

    const diff = compare(
      await region(designs.controls, { snap: true }),
      await mockRegion(page, `pages/designs/${state}.html`, '#preview > .cluster', { snap: true }),
    );
    expect(diff.ratio, `the controls differ from ${state}.html`).toBeLessThan(tolerance);
  });
}

test('empty: matches the mock', async ({ page, designs }) => {
  const id = await aProject(page);
  await serveDesigns(page, noDesigns);
  // The empty state names the project; the mock's is Ledgerline, without the suffix that keeps test names unique.
  await page.route(`**/api/projects/${id}`, async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...(await response.json()), name: 'Ledgerline' } });
  });
  await designs.open(id);
  await expect(designs.empty).toBeVisible();

  const diff = compare(
    await region(designs.empty, { snap: true }),
    await mockRegion(page, 'pages/designs/empty.html', '.section .empty', { snap: true }),
  );
  expect(diff.ratio, 'the empty state differs from empty.html').toBeLessThan(0.05);
});

test('error: matches the mock', async ({ page, designs }) => {
  const id = await aProject(page);
  await serveDesigns(
    page,
    { status: 502, title: 'docs/mocks/manifest.json couldn’t be read at 5a1fe37', code: 'github_failed' },
    502,
  );
  await designs.open(id);
  await expect(designs.failure).toBeVisible();

  const diff = compare(
    await region(designs.failure, { snap: true }),
    await mockRegion(page, 'pages/designs/error.html', '.empty--error', { snap: true }),
  );
  expect(diff.ratio, 'the error state differs from error.html').toBeLessThan(0.05);
});
