// Acceptance Test
// Traces to: L2-046
// Description: On a phone the top bar with its menu button, and the menu drawer's navigation, match the dashboard and navigation drawer mocks

import { expect, signIn, test } from '../../fixtures/test';
import { Navigation } from '../../pages/navigation';
import { compare, mockRegion, region } from '../../support/mocks';

const tolerance = 0.02;

test.describe('Mobile navigation, visual', () => {
  test('the top bar as the dashboard mock shows it at 375 px', async ({ page }) => {
    const nav = new Navigation(page);
    await signIn(page, 'quinntynebrown');
    await nav.width(375);
    await nav.visit('/dashboard');

    const diff = compare(await region(nav.topbar), await mockRegion(page, 'pages/dashboard/default.html', '.topbar'));
    expect(diff.ratio, 'the top bar differs from the mock').toBeLessThan(tolerance);
  });

  test('the drawer navigation as the navigation drawer mock shows it', async ({ page }) => {
    const nav = new Navigation(page);
    await signIn(page, 'quinntynebrown');
    await nav.width(375);
    await nav.visit('/dashboard');
    await nav.openMenu();
    await expect(nav.drawerLink('Dashboard')).toHaveAttribute('aria-current', 'page');
    await page.mouse.move(370, 890);

    const diff = compare(
      await region(nav.drawerNav),
      await mockRegion(page, 'dialogs/mobile-nav/default.html', '.drawer .sidebar__nav'),
    );
    expect(diff.ratio, 'the drawer navigation differs from the mock').toBeLessThan(tolerance);
  });
});
