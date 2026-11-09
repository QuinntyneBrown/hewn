// Acceptance Test
// Traces to: L2-021, L2-022, L2-024, L2-025
// Description: The increment page matches docs/mocks region by region: the timeline in each of the mock's states, and the pull request card while open and once squash-merged, fed the mock's own increment

import type { Page } from '@playwright/test';
import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { serveIncrement } from '../../support/increment';
import { type IncrementMockState, mockIncrement } from '../../support/mock-increment';
import { compare, mockRegion, region } from '../../support/mocks';
import { xsrfToken } from '../../support/queue';
import { cancelDirections } from '../../support/rate-limit';

const tolerance = 0.02;

async function aProject(page: Page): Promise<string> {
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
  return projectId;
}

test.beforeEach(async ({ page }) => {
  await signIn(page, 'quinntynebrown');
});

for (const state of ['default', 'implementing', 'blocked', 'green-first'] as IncrementMockState[]) {
  test(`${state}: the timeline matches the mock`, async ({ page, increment }) => {
    const id = await aProject(page);
    await serveIncrement(page, mockIncrement(state));
    await increment.open(id, 7);
    await expect(increment.steps).toHaveCount(6);

    const diff = compare(
      await region(increment.timeline, { snap: true }),
      await mockRegion(page, `pages/increment/${state}.html`, '.timeline', { snap: true }),
    );
    expect(diff.ratio, `.timeline differs from ${state}.html`).toBeLessThan(tolerance);
  });
}

for (const state of ['default', 'merged'] as IncrementMockState[]) {
  test(`${state}: the pull request card matches the mock`, async ({ page, increment }) => {
    const id = await aProject(page);
    await serveIncrement(page, mockIncrement(state));
    await increment.open(id, 7);
    await expect(increment.pullRequest).toBeVisible();

    const diff = compare(
      await region(increment.pullRequest, { snap: true }),
      await mockRegion(page, `pages/increment/${state}.html`, '.rail .card--link', { snap: true }),
    );
    expect(diff.ratio, `.card--link differs from ${state}.html`).toBeLessThan(tolerance);
  });
}
