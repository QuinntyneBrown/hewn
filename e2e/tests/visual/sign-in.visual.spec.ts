// Acceptance Test
// Traces to: L2-038
// Description: The sign-in page matches docs/mocks in its default, loading, denied, error, expired and signed-out states

import { expect, test } from '../../fixtures/test';
import { compare, mockRegion, region } from '../../support/mocks';

const tolerance = 0.02;
const center = '.auth__center';

const states: [string, string][] = [
  ['default', ''],
  ['denied', 'error=denied&login=devon-park'],
  ['error', 'error=github'],
  ['expired', 'reason=expired'],
  ['signed-out', 'reason=signed-out'],
];

test.describe('Sign in, visual', () => {
  test.describe.configure({ mode: 'serial' });

  for (const [state, query] of states) {
    test(`${state}: as the mock shows it`, async ({ page, signInPage }) => {
      await signInPage.open(query);

      const diff = compare(
        await region(signInPage.center),
        await mockRegion(page, `pages/sign-in/${state}.html`, center),
      );
      expect(diff.ratio, `the ${state} sign-in differs from the mock`).toBeLessThan(tolerance);
    });
  }

  test('loading: waiting for GitHub as the mock shows it', async ({ page, signInPage }) => {
    await signInPage.open();
    await signInPage.holdGitHub();
    await signInPage.continueWithGitHub.click();
    await expect(signInPage.waitingForGitHub).toBeDisabled();

    const diff = compare(await region(signInPage.center), await mockRegion(page, 'pages/sign-in/loading.html', center));
    expect(diff.ratio, 'the waiting sign-in differs from the mock').toBeLessThan(tolerance);
  });
});
