// Acceptance Test
// Traces to: L2-019
// Description: The Settings descope threshold field matches docs/mocks in its default, invalid and Viewer states

import { expect, signIn, test } from '../../fixtures/test';
import { compare, mockRegion, region } from '../../support/mocks';

const tolerance = 0.02;
const field = 'form.settings-section .field:has(#threshold)';

test.describe('Descope threshold, visual', () => {
  test.describe.configure({ mode: 'serial' });

  test('default: the threshold field as the mock shows it', async ({ page, settings }) => {
    await signIn(page, 'quinntynebrown');
    await settings.open();
    await expect(settings.threshold).toHaveValue('3');

    const diff = compare(
      await region(settings.thresholdField),
      await mockRegion(page, 'pages/settings/default.html', field),
    );
    expect(diff.ratio, 'the field differs from the mock').toBeLessThan(tolerance);
  });

  test('invalid: a threshold of 0.5 days shows its error as the mock does', async ({ page, settings }) => {
    await signIn(page, 'quinntynebrown');
    await settings.open();
    await settings.setThreshold('0.5');
    await expect(settings.thresholdError).toBeVisible();
    await settings.threshold.blur();

    const diff = compare(
      await region(settings.thresholdField),
      await mockRegion(page, 'pages/settings/invalid.html', field),
    );
    expect(diff.ratio, 'the invalid field differs from the mock').toBeLessThan(tolerance);
  });

  test('viewer: the threshold is read-only as the mock shows it', async ({ page, settings }) => {
    await signIn(page, 'ada');
    await settings.open();
    await expect(settings.threshold).toHaveValue('3');

    const diff = compare(
      await region(settings.thresholdField),
      await mockRegion(page, 'pages/settings/viewer.html', field),
    );
    expect(diff.ratio, 'the read-only field differs from the mock').toBeLessThan(tolerance);
  });
});
