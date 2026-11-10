// Acceptance Test
// Traces to: L2-035
// Description: The Traceability tab matches docs/mocks region by region, fed the mock's own requirements: the requirement list, a full trace, No acceptance test, Deferred, and the empty and error states (AC1, AC2)

import { expect, signIn, test } from '../../fixtures/test';
import { aCancelledProject } from '../../support/artifacts-project';
import {
  mockTraceability,
  noRequirements,
  serveTraceability,
  unparsableRequirements,
} from '../../support/mock-traceability';
import { compare, mockRegion, region } from '../../support/mocks';

const file = {};

test.beforeEach(async ({ page }) => {
  await signIn(page, 'quinntynebrown');
});

for (const [l2, mock] of [
  ['L2-018', 'default'],
  ['L2-020', 'no-test'],
  ['L2-031', 'deferred'],
] as const) {
  test(`${mock}: the trace matches the mock`, async ({ page, traceability }) => {
    const id = await aCancelledProject(page, file);
    await serveTraceability(page, mockTraceability());
    await traceability.open(id, l2);
    await expect(traceability.id).toHaveText(l2);

    const diff = compare(
      await region(traceability.trace, { snap: true }),
      await mockRegion(page, `pages/traceability/${mock}.html`, 'section[aria-label^="Trace for"]', { snap: true }),
    );
    expect(diff.ratio, `the trace differs from ${mock}.html`).toBeLessThan(0.02);
  });
}

test('the requirement list matches the mock', async ({ page, traceability }) => {
  const id = await aCancelledProject(page, file);
  await serveTraceability(page, mockTraceability());
  await traceability.open(id, 'L2-018');
  await expect(traceability.links).toHaveCount(6);

  const diff = compare(
    await region(traceability.requirements, { snap: true }),
    await mockRegion(page, 'pages/traceability/default.html', 'nav[aria-label="Requirements"]', { snap: true }),
  );
  expect(diff.ratio, 'the list differs from default.html').toBeLessThan(0.02);
});

test('empty: matches the mock', async ({ page, traceability }) => {
  const id = await aCancelledProject(page, file);
  await serveTraceability(page, noRequirements);
  await traceability.open(id);
  await expect(traceability.empty).toBeVisible();

  const diff = compare(
    await region(traceability.empty, { snap: true }),
    await mockRegion(page, 'pages/traceability/empty.html', '.section .empty', { snap: true }),
  );
  expect(diff.ratio, 'the empty state differs from empty.html').toBeLessThan(0.05);
});

test('error: matches the mock', async ({ page, traceability }) => {
  const id = await aCancelledProject(page, file);
  await serveTraceability(page, unparsableRequirements, 502);
  await traceability.open(id);
  await expect(traceability.failure).toBeVisible();

  const diff = compare(
    await region(traceability.failure, { snap: true }),
    await mockRegion(page, 'pages/traceability/error.html', '.empty--error', { snap: true }),
  );
  expect(diff.ratio, 'the error state differs from error.html').toBeLessThan(0.05);
});
