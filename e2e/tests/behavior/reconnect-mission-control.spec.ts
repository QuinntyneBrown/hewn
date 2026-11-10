// Acceptance Test
// Traces to: L2-032
// Description: When the live connection drops, Mission Control says Reconnecting with the next attempt after 0, 2, 10 and 30 seconds, then that the connection is lost with Retry now; once back it says what it caught up and the banner goes (AC1, AC3)

import { expect, signIn, test } from '../../fixtures/test';
import { LiveConnection } from '../../pages/live-connection';
import { WorkersPage } from '../../pages/workers.page';

test.describe('Reconnect Mission Control', () => {
  test('the banner follows the retry schedule, Retry now reconnects, and it goes once caught up', async ({ page }) => {
    const live = new LiveConnection(page);
    await live.intercept();
    await page.clock.install();
    await signIn(page, 'quinntynebrown');
    await new WorkersPage(page).open();
    await expect(live.state).toHaveText('Live');
    await expect(live.banner).toBeHidden();

    await live.drop();
    // The first attempt is at once; it fails, and the next is 2 s later.
    await expect(live.banner).toHaveText(/^Reconnecting… next attempt in [12] s\./);
    await expect(live.state).toHaveText('Reconnecting…');
    const tried = live.attempts.length;
    await page.clock.runFor(2_000);
    await expect(live.banner).toHaveText(/^Reconnecting… next attempt in (9|10) s\./);
    await page.clock.runFor(10_000);
    await expect(live.banner).toHaveText(/^Reconnecting… next attempt in (29|30) s\./);
    expect(live.attempts.length, 'one attempt after 2 s and one after 10 s more').toBe(tried + 2);
    await page.clock.runFor(30_000);
    await expect(live.banner).toHaveText(
      'Connection lost. Retrying every 30 s; agents keep working and nothing is lost.Retry now',
    );
    await expect(live.state).toHaveText('Offline');
    await expect(page.getByRole('alert').filter({ hasText: 'Connection lost' })).toBeVisible();

    // Still down: Retry now tries at once and fails; then the network comes back and Retry now reconnects.
    const before = live.attempts.length;
    await live.retryNow.click();
    await expect.poll(() => live.attempts.length).toBe(before + 1);
    await expect(live.state).toHaveText('Offline');
    live.restore();
    await live.retryNow.click();
    await expect(live.banner).toHaveText('Reconnected. Nothing was missed.');
    await expect(live.state).toHaveText('Live');
    await page.clock.runFor(5_000);
    await expect(live.banner).toBeHidden();
  });

  test('a slow first connection says it is connecting until live updates start', async ({ page }) => {
    const live = new LiveConnection(page);
    await live.intercept({ negotiateDelayMs: 3_000 });
    await signIn(page, 'quinntynebrown');
    await new WorkersPage(page).open();

    await expect(live.banner).toHaveText('Connecting to Mission Control… live updates start in a moment.');
    await expect(live.state).toHaveText('Connecting…');
    await expect(live.state).toHaveText('Live', { timeout: 10_000 });
    await expect(live.banner).toBeHidden();
  });
});
