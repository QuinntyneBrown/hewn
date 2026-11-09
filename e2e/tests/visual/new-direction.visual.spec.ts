// Acceptance Test
// Traces to: L2-001, L2-005, L2-043
// Description: New direction matches docs/mocks region by region (form and stage plan) in the default, feature, repo-no-access and rate-limited states

import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { compare, mockRegion, region } from '../../support/mocks';
import { cancelDirections, fillTheMinute } from '../../support/rate-limit';

const mockIdea =
  'A web app for small accounting teams (2–10 people) to reconcile bank and card statements against receipts. Connect a bank feed or import a CSV, match each transaction to a receipt photo, split transactions across categories, and close a month once a second person reviews it. Export the closed period to the general ledger.';

const tolerance = 0.02;

test.beforeEach(async ({ page }) => {
  await signIn(page, 'quinntynebrown');
});

test('default: the form and "What runs next" match the mock', async ({ page, newDirection }) => {
  await newDirection.open();
  await newDirection.fill({ name: 'Ledgerline', idea: mockIdea, budget: '400.00' });
  await page.locator('h1').click();

  for (const selector of ['form.form-col', 'aside.rail']) {
    const diff = compare(
      await region(page.locator(selector)),
      await mockRegion(page, 'pages/new-direction/default.html', selector),
    );
    expect(diff.ratio, `${selector} differs from the mock`).toBeLessThan(tolerance);
  }
});

test('repo-no-access: the form with the repository error matches the mock', async ({ page, newDirection }) => {
  await newDirection.open();
  await newDirection.fill({
    name: 'Ledgerline',
    idea: mockIdea,
    repository: 'https://github.com/northwind/handover',
    budget: '400.00',
  });
  await newDirection.submit();
  await expect(newDirection.errorFor('repo')).toBeVisible();
  await page.locator('h1').click();

  const diff = compare(
    await region(newDirection.form),
    await mockRegion(page, 'pages/new-direction/repo-no-access.html', 'form.form-col'),
  );
  expect(diff.ratio).toBeLessThan(tolerance);
});

test('feature: "What runs next" strikes through the skipped stages as the mock does', async ({
  page,
  newDirection,
}) => {
  await newDirection.open();
  await newDirection.featureMode.click();
  await page.locator('h1').click();

  const diff = compare(
    await region(newDirection.plan),
    await mockRegion(page, 'pages/new-direction/feature.html', 'aside.rail'),
  );
  expect(diff.ratio, 'aside.rail differs from the mock').toBeLessThan(tolerance);
});

test('rate-limited: the warning above the kept form matches the mock', async ({ page, newDirection }) => {
  test.setTimeout(120_000);
  // grace, a second Owner, so filling the minute leaves quinntynebrown's alone.
  await signIn(page, 'grace');
  const { projectIds } = await fillTheMinute(page, (i) => uniqueName(`Visual limit ${i}`));
  try {
    await newDirection.open();
    await newDirection.fill({ name: 'Ledgerline', idea: mockIdea, budget: '400.00' });
    await newDirection.submit();
    await expect(newDirection.rateLimited).toBeVisible();
    await page.locator('h1').click();

    // The count and the seconds differ from the mock's 10 and 42 by a few glyphs, well inside the tolerance.
    const diff = compare(
      await region(newDirection.form),
      await mockRegion(page, 'pages/new-direction/rate-limited.html', 'form.form-col'),
    );
    expect(diff.ratio, 'form.form-col differs from the mock').toBeLessThan(tolerance);
  } finally {
    await cancelDirections(page, projectIds);
  }
});
