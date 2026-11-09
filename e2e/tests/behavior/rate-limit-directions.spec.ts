// Acceptance Test
// Traces to: L2-043
// Description: An Owner who has submitted the most directions allowed in a minute is refused the next one: New direction shows "Too many directions in a minute" with when they can submit again and disables Start direction until then, nothing is created, and everything typed is kept

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { cancelDirections, fillTheMinute } from '../../support/rate-limit';

const idea = 'A web app for small accounting teams to reconcile statements.';

test.describe('Rate limit on directions', () => {
  // Filling the minute takes up to 30 submissions, and the clean-up as many cancels.
  test.describe.configure({ timeout: 120_000 });

  let cleanUp: { page: Page; projectIds: string[] } | null = null;

  test.afterEach(async () => {
    if (cleanUp) await cancelDirections(cleanUp.page, cleanUp.projectIds);
    cleanUp = null;
  });

  test('the submission over the limit is refused with when to try again, keeping what was typed', async ({
    page,
    newDirection,
  }) => {
    // grace, a second Owner, so no other test's submissions count against the limit.
    await signIn(page, 'grace');
    const { limit, projectIds } = await fillTheMinute(page, () => uniqueName('Limit'));
    cleanUp = { page, projectIds };

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
    // Start direction waits out the minute.
    await expect(newDirection.start).toBeDisabled();
    const projects = (await (await page.request.get('/api/projects')).json()) as { name: string }[];
    expect(projects.some((p) => p.name === name)).toBe(false);

    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(
      axe.violations.map((v) => v.id),
      'the rate-limited page has no axe-core violations',
    ).toEqual([]);
  });
});
