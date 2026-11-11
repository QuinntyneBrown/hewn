// Acceptance Test
// Traces to: L2-047
// Description: Settings shows its section skeletons while the saved defaults load, as docs/mocks/pages/settings/loading.html does

import { expect, signIn, test } from '../../fixtures/test';
import { PageStates } from '../../pages/page-states';
import { compare, mockRegion, region } from '../../support/mocks';

const tolerance = 0.02;

test.describe('Page states, visual', () => {
  test('Settings while loading: a section skeleton as the mock shows it', async ({ page, settings }) => {
    const states = new PageStates(page);
    await signIn(page, 'quinntynebrown');
    await states.hold('/api/settings/direction-defaults');
    await settings.open();
    await expect(settings.loadingSection).toBeVisible();

    const actual = await region(settings.loadingSection);
    const mock = await mockRegion(page, 'pages/settings/loading.html', '[aria-busy="true"] > .settings-section');
    expect(compare(actual, mock).ratio, 'the skeleton differs from the mock').toBeLessThan(tolerance);
  });
});
