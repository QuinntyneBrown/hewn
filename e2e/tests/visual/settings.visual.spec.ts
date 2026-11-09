// Acceptance Test
// Traces to: L2-053
// Description: The Settings default budget field matches docs/mocks in its default, invalid and Viewer states

import { expect, signIn, test } from '../../fixtures/test';
import { compare, mockRegion, region } from '../../support/mocks';

const tolerance = 0.02;
const field = 'form.settings-section .field';

test.describe('Settings, visual', () => {
  test.describe.configure({ mode: 'serial' });

  test('default: the default budget field as the mock shows it', async ({ page, settings }) => {
    await signIn(page, 'quinntynebrown');
    await settings.open();
    await expect(settings.defaultBudget).toHaveValue('300.00');

    const diff = compare(
      await region(settings.defaultBudgetField),
      await mockRegion(page, 'pages/settings/default.html', field),
    );
    expect(diff.ratio, 'the field differs from the mock').toBeLessThan(tolerance);
  });

  test('invalid: an out-of-range default shows its error as the mock does', async ({ page, settings }) => {
    await signIn(page, 'quinntynebrown');
    await settings.open();
    await settings.setDefaultBudget('5.00');
    await expect(settings.defaultBudgetError).toBeVisible();
    await settings.defaultBudget.blur();

    const diff = compare(
      await region(settings.defaultBudgetField),
      await mockRegion(page, 'pages/settings/invalid.html', field),
    );
    expect(diff.ratio, 'the invalid field differs from the mock').toBeLessThan(tolerance);
  });

  test('viewer: the field is read-only as the mock shows it', async ({ page, settings }) => {
    await signIn(page, 'ada');
    await settings.open();
    await expect(settings.defaultBudget).toHaveValue('300.00');

    const diff = compare(
      await region(settings.defaultBudgetField),
      await mockRegion(page, 'pages/settings/viewer.html', field),
    );
    expect(diff.ratio, 'the read-only field differs from the mock').toBeLessThan(tolerance);
  });
});
