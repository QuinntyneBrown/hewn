// Acceptance Test
// Traces to: L2-048
// Description: Settings' Appearance section, with System chosen, matches docs/mocks in the light and the dark theme

import { expect, signIn, test } from '../../fixtures/test';
import { compare, mockRegion, region } from '../../support/mocks';

const tolerance = 0.02;
const appearance = 'section[aria-labelledby="s-appearance"]';

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`Theme, visual, ${colorScheme}`, () => {
    // The whole context prefers the scheme, so the mock opened beside the app is drawn in it too.
    test.use({ colorScheme });

    test(`Appearance as the mock shows it in ${colorScheme}`, async ({ page, settings, theme }) => {
      await signIn(page, 'quinntynebrown');
      await settings.open();
      await expect(settings.themeChoice('System')).toBeChecked();
      expect(await theme.shown()).toBe(colorScheme);

      const diff = compare(
        await region(settings.appearance),
        await mockRegion(page, 'pages/settings/default.html', appearance),
      );
      expect(diff.ratio, `Appearance differs from the mock in ${colorScheme}`).toBeLessThan(tolerance);
    });
  });
}
