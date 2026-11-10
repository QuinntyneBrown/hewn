// Acceptance Test
// Traces to: L2-054
// Description: The Decisions tab matches docs/mocks region by region, fed the mock's own decisions: the heading and stage filter, the list newest first, one stage, no results, empty and the error (AC3)

import { expect, signIn, test } from '../../fixtures/test';
import { aCancelledProject } from '../../support/artifacts-project';
import { decisionsFailure, mockDecisions, noDecisions, serveDecisions } from '../../support/mock-decisions';
import { compare, mockRegion, region } from '../../support/mocks';

const file = {};

test.beforeEach(async ({ page }) => {
  await signIn(page, 'quinntynebrown');
});

for (const [stage, mock] of [
  [undefined, 'default'],
  [4, 'filtered'],
] as const) {
  test(`${mock}: the list matches the mock`, async ({ page, decisions }) => {
    const id = await aCancelledProject(page, file);
    await serveDecisions(page, mockDecisions());
    await decisions.open(id, stage);
    await expect(decisions.decisions).toHaveCount(stage === undefined ? 5 : 1);

    const diff = compare(
      await region(decisions.list, { snap: true }),
      await mockRegion(page, `pages/decisions/${mock}.html`, '.narrow ol', { snap: true }),
    );
    expect(diff.ratio, `the list differs from ${mock}.html`).toBeLessThan(0.02);
  });
}

test('the heading and stage filter match the mock', async ({ page, decisions }) => {
  const id = await aCancelledProject(page, file);
  await serveDecisions(page, mockDecisions());
  await decisions.open(id);
  await expect(decisions.decisions).toHaveCount(5);

  const diff = compare(
    await region(decisions.section.locator('> .cluster'), { snap: true }),
    await mockRegion(page, 'pages/decisions/default.html', '.narrow > .cluster', { snap: true }),
  );
  expect(diff.ratio, 'the heading differs from default.html').toBeLessThan(0.02);
});

test('no-results: matches the mock', async ({ page, decisions }) => {
  const id = await aCancelledProject(page, file);
  await serveDecisions(page, mockDecisions());
  await decisions.open(id, 3);
  await expect(decisions.noResults).toBeVisible();

  const diff = compare(
    await region(decisions.noResults, { snap: true }),
    await mockRegion(page, 'pages/decisions/no-results.html', '.empty--tight', { snap: true }),
  );
  expect(diff.ratio, 'the no-results state differs from no-results.html').toBeLessThan(0.05);
});

test('empty: matches the mock', async ({ page, decisions }) => {
  const id = await aCancelledProject(page, file);
  await serveDecisions(page, noDecisions);
  await decisions.open(id);
  await expect(decisions.empty).toBeVisible();

  const diff = compare(
    await region(decisions.empty, { snap: true }),
    await mockRegion(page, 'pages/decisions/empty.html', '.section .empty', { snap: true }),
  );
  expect(diff.ratio, 'the empty state differs from empty.html').toBeLessThan(0.05);
});

test('error: matches the mock', async ({ page, decisions }) => {
  const id = await aCancelledProject(page, file);
  await serveDecisions(page, decisionsFailure, 502);
  await decisions.open(id);
  await expect(decisions.failure).toBeVisible();

  const diff = compare(
    await region(decisions.failure, { snap: true }),
    await mockRegion(page, 'pages/decisions/error.html', '.empty--error', { snap: true }),
  );
  expect(diff.ratio, 'the error state differs from error.html').toBeLessThan(0.05);
});
