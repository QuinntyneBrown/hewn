// Acceptance Test
// Traces to: L2-043
// Description: An Owner who has submitted the most directions allowed in a minute is refused the next one: New direction shows "Too many directions in a minute" with when they can submit again, nothing is created, and everything typed is kept

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { xsrfToken } from '../../support/queue';

const idea = 'A web app for small accounting teams to reconcile statements.';

/** Cancels the directions these submissions left queued, so no later suite runs them. */
async function cancelAll(page: Page, projectIds: string[]): Promise<void> {
  const headers = { 'X-XSRF-TOKEN': await xsrfToken(page) };
  for (const id of projectIds) {
    const project = (await (await page.request.get(`/api/projects/${id}`)).json()) as { directions: { id: string }[] };
    await page.request.post(`/api/projects/${id}/directions/${project.directions[0]!.id}/cancel`, {
      data: {},
      headers,
    });
  }
}

test.describe('Rate limit on directions', () => {
  // Filling the minute takes up to 30 submissions, and the clean-up as many cancels.
  test.describe.configure({ timeout: 120_000 });

  const submitted: string[] = [];
  let ownerPage: Page | null = null;

  test.afterEach(async () => {
    if (ownerPage) await cancelAll(ownerPage, submitted);
    submitted.length = 0;
  });

  test('the submission over the limit is refused with when to try again, keeping what was typed', async ({
    page,
    newDirection,
  }) => {
    // grace, a second Owner, so no other test's submissions count against the limit.
    await signIn(page, 'grace');
    ownerPage = page;
    const headers = { 'X-XSRF-TOKEN': await xsrfToken(page) };
    // Fill the minute through the API, up to the stack's limit, which the refusal states.
    let limit = 0;
    for (;;) {
      const response = await page.request.post('/api/projects', {
        data: { name: uniqueName('Limit'), idea, stackPreference: null, repositoryUrl: null, budgetUsd: 50 },
        headers,
      });
      if (response.status() === 429) {
        const problem = (await response.json()) as { code: string; limit: number; retryAfterSeconds: number };
        expect(problem.code).toBe('rate_limited');
        expect(problem.retryAfterSeconds).toBeGreaterThan(0);
        limit = problem.limit;
        break;
      }
      expect(response.status()).toBe(201);
      submitted.push(((await response.json()) as { projectId: string }).projectId);
    }

    const name = uniqueName('One too many');
    await newDirection.open();
    await newDirection.fill({ name, idea });
    await newDirection.submit();

    await expect(newDirection.rateLimited).toContainText(
      new RegExp(
        `You’ve submitted ${limit} in the last minute\\. You can submit again in \\d{1,2} seconds?; nothing you typed is lost\\.`,
      ),
    );
    await expect(newDirection.name).toHaveValue(name);
    await expect(newDirection.idea).toHaveValue(idea);
    await expect(newDirection.heading).toHaveText('New direction');
    const projects = (await (await page.request.get('/api/projects')).json()) as { name: string }[];
    expect(projects.some((p) => p.name === name)).toBe(false);

    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(
      axe.violations.map((v) => v.id),
      'the rate-limited page has no axe-core violations',
    ).toEqual([]);
  });
});
