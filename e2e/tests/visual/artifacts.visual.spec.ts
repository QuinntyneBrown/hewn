// Acceptance Test
// Traces to: L2-034
// Description: The Artifacts tab matches docs/mocks region by region, fed the mock's own artifacts: a stage's artifact list, and the empty and error states (AC2)

import { expect, signIn, test } from '../../fixtures/test';
import { aCancelledProject, artifactsFailure } from '../../support/artifacts-project';
import { mockArtifacts, noArtifacts, serveArtifacts } from '../../support/mock-artifacts';
import { compare, mockRegion, region } from '../../support/mocks';

const file = {};

test.beforeEach(async ({ page }) => {
  await signIn(page, 'quinntynebrown');
});

test('a stage’s artifact list matches the mock', async ({ page, artifacts }) => {
  const id = await aCancelledProject(page, file);
  await serveArtifacts(page, mockArtifacts());
  await artifacts.open(id);
  await expect(artifacts.row('Estimates', 'docs/estimates/README.md').sha).toHaveText('19f4a8c');

  const diff = compare(
    await region(artifacts.stage('Estimates'), { snap: true }),
    await mockRegion(page, 'pages/artifacts/default.html', 'section[aria-labelledby="st-9"]', { snap: true }),
  );
  expect(diff.ratio, 'the Estimates list differs from default.html').toBeLessThan(0.02);
});

test('empty: matches the mock', async ({ page, artifacts }) => {
  const id = await aCancelledProject(page, file);
  await serveArtifacts(page, noArtifacts);
  await artifacts.open(id);
  await expect(artifacts.empty).toBeVisible();

  const diff = compare(
    await region(artifacts.empty, { snap: true }),
    await mockRegion(page, 'pages/artifacts/empty.html', '.section .empty', { snap: true }),
  );
  expect(diff.ratio, 'the empty state differs from empty.html').toBeLessThan(0.05);
});

test('error: matches the mock', async ({ page, artifacts }) => {
  const id = await aCancelledProject(page, file);
  await serveArtifacts(page, artifactsFailure, 502);
  await artifacts.open(id);
  await expect(artifacts.failure).toBeVisible();

  const diff = compare(
    await region(artifacts.failure, { snap: true }),
    await mockRegion(page, 'pages/artifacts/error.html', '.empty--error', { snap: true }),
  );
  expect(diff.ratio, 'the error state differs from error.html').toBeLessThan(0.05);
});
