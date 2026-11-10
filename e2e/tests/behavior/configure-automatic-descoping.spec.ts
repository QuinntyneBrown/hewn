// Acceptance Test
// Traces to: L2-019
// Description: An Owner sets the descope threshold in ideal days in Settings (3 until saved); a value that isn't a whole number from 1 to 20 is refused with a linked error; Viewers see it read-only (AC1)

import { expect, signIn, test } from '../../fixtures/test';

test.describe('Configure automatic descoping', () => {
  test.describe.configure({ mode: 'serial' });

  test.afterEach(async ({ page, settings }) => {
    await signIn(page, 'quinntynebrown');
    await settings.resetDefaultBudget();
  });

  test('an Owner saves a new threshold and it is kept', async ({ page, settings }) => {
    await signIn(page, 'quinntynebrown');
    await settings.open();
    await expect(settings.threshold).toHaveValue('3');

    await settings.setThreshold('5');

    await expect(settings.savedCallout).toContainText(
      'New directions start with a $300.00 budget and a 5-day descope threshold. Directions already running keep theirs.',
    );
    await settings.open();
    await expect(settings.threshold).toHaveValue('5');
  });

  for (const days of ['0.5', '21', '']) {
    test(`"${days}" is refused with a linked error and nothing is saved`, async ({ page, settings }) => {
      await signIn(page, 'quinntynebrown');
      await settings.open();

      await settings.setThreshold(days);

      await expect(settings.errorSummary).toContainText('Descope threshold must be 1 to 20 days');
      await expect(settings.thresholdError).toHaveText(
        /Descope threshold must be a whole number of days from 1 to 20\./,
      );
      await expect(settings.threshold).toHaveAttribute('aria-invalid', 'true');
      await settings.errorSummary.getByRole('link', { name: 'Descope threshold must be 1 to 20 days' }).click();
      await expect(settings.threshold).toBeFocused();
      await settings.open();
      await expect(settings.threshold).toHaveValue('3');
    });
  }

  test('a Viewer sees the threshold read-only and cannot change it', async ({ page, settings }) => {
    await signIn(page, 'ada');
    await settings.open();

    await expect(settings.threshold).toHaveValue('3');
    await expect(settings.threshold).toHaveAttribute('readonly', '');
    await expect(settings.save).toHaveCount(0);
    expect(
      await settings.tryToChange('PUT', '/api/settings/direction-defaults', {
        defaultBudgetUsd: 300,
        descopeThresholdDays: 5,
      }),
    ).toBe(403);
  });
});
