// Acceptance Test
// Traces to: L2-032
// Description: The connection strip matches docs/mocks while connecting and once the connection is lost, with Retry now (AC1)

import { expect, signIn, test } from '../../fixtures/test';
import { compare, mockRegion, region } from '../../support/mocks';
import { LiveConnection } from '../../pages/live-connection';
import { WorkersPage } from '../../pages/workers.page';

const tolerance = 0.02;
const strip = '.strip';

test.describe('Connection banner, visual', () => {
  test('connecting, as the info mock shows it', async ({ page }) => {
    const live = new LiveConnection(page);
    await live.intercept({ negotiateDelayMs: 5_000 });
    await signIn(page, 'quinntynebrown');
    await new WorkersPage(page).open();
    await expect(live.banner).toBeVisible();
    await page.mouse.move(0, 0);
    const ratio = compare(
      await region(live.banner),
      await mockRegion(page, 'notifications/connection-banner/info.html', strip),
    ).ratio;
    expect(ratio, 'info').toBeLessThan(tolerance);
  });

  test('connection lost, as the danger mock shows it', async ({ page }) => {
    const live = new LiveConnection(page);
    await live.intercept();
    await page.clock.install();
    await signIn(page, 'quinntynebrown');
    await new WorkersPage(page).open();
    await expect(live.state).toHaveText('Live');
    await live.drop();
    // Each attempt fails before the clock moves on to the next.
    for (const [ms, next] of [
      [2_000, /in (9|10) s/],
      [10_000, /in (29|30) s/],
    ] as const) {
      await expect(live.banner).toBeVisible();
      await page.clock.runFor(ms);
      await expect(live.banner).toHaveText(next);
    }
    await page.clock.runFor(30_000);
    await expect(live.retryNow).toBeVisible();
    await page.mouse.move(0, 0);
    const ratio = compare(
      await region(live.banner),
      await mockRegion(page, 'notifications/connection-banner/danger.html', strip),
    ).ratio;
    expect(ratio, 'danger').toBeLessThan(tolerance);
  });
});
