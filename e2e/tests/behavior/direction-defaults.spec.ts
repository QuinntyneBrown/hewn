// Acceptance Test
// Traces to: L2-053
// Description: An Owner sets the default budget every new direction starts with in Settings; an out-of-range value is refused with a linked error; Viewers see it read-only

import { expect, signIn, test } from '../../fixtures/test';

test.describe('Direction defaults', () => {
  test.describe.configure({ mode: 'serial' });

  test.afterEach(async ({ page, settings }) => {
    await signIn(page, 'quinntynebrown');
    await settings.resetDefaultBudget();
  });

  test('an Owner saves a new default and the next direction starts with it', async ({
    page,
    settings,
    newDirection,
  }) => {
    await signIn(page, 'quinntynebrown');
    await settings.open();
    await expect(settings.defaultBudget).toHaveValue('300.00');

    await settings.setDefaultBudget('350');

    await expect(settings.savedCallout).toContainText(
      'New directions start with a $350.00 budget and a 3-day descope threshold.',
    );
    await expect(settings.defaultBudget).toHaveValue('350.00');
    await newDirection.open();
    await expect(newDirection.budget).toHaveValue('350.00');
  });

  test('a default outside $10 to $10,000 is refused with a linked error and nothing is saved', async ({
    page,
    settings,
  }) => {
    await signIn(page, 'quinntynebrown');
    await settings.open();

    await settings.setDefaultBudget('5');

    await expect(settings.errorSummary).toContainText('Default budget is out of range');
    await expect(settings.defaultBudgetError).toHaveText(/Default budget must be between \$10\.00 and \$10,000\.00\./);
    await expect(settings.defaultBudget).toHaveAttribute('aria-invalid', 'true');
    await settings.errorSummary.getByRole('link', { name: 'Default budget is out of range' }).click();
    await expect(settings.defaultBudget).toBeFocused();
    await settings.open();
    await expect(settings.defaultBudget).toHaveValue('300.00');
  });

  test('a Viewer sees the defaults read-only, with no way to save', async ({ page, settings }) => {
    await signIn(page, 'ada');
    await settings.open();

    await expect(settings.readOnlyCallout).toBeVisible();
    await expect(settings.defaultBudget).toHaveAttribute('readonly', '');
    await expect(settings.save).toHaveCount(0);
  });
});
