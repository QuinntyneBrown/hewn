// Acceptance Test
// Traces to: L2-041
// Description: New worker token matches its default, busy, invalid, success and failed mocks, and Revoke matches the revoke-worker default, busy and failed mocks (AC1, AC2)

import type { Page } from '@playwright/test';
import { expect, signIn, test } from '../../fixtures/test';
import { compare, mockRegion, region } from '../../support/mocks';
import { WorkersPage } from '../../pages/workers.page';

const tolerance = 0.02;
const panel = '.dialog__panel';

async function matches(page: Page, workers: WorkersPage, dialog: 'token' | 'revoke', mock: string): Promise<number> {
  await page.mouse.move(0, 0);
  const actual = await region(dialog === 'token' ? workers.tokenPanel : workers.revokePanel);
  return compare(actual, await mockRegion(page, mock, panel)).ratio;
}

/** The mocks' worker, build-box-02, idle on this machine. */
const buildBox = {
  id: 'wk_build_box_02',
  name: 'build-box-02',
  host: 'build-box-02',
  location: 'Local',
  version: '0.9.2',
  status: 'Idle',
  online: true,
  lastSeenAt: new Date().toISOString(),
  registeredAt: new Date().toISOString(),
  workingOn: null,
  holding: false,
};

test.describe('Worker tokens, visual', () => {
  test.describe.configure({ mode: 'serial' });

  test('New worker token: default and busy as the mocks show them', async ({ page }) => {
    const workers = new WorkersPage(page);
    await signIn(page, 'quinntynebrown');
    await workers.open();
    await workers.fillToken('hewn-cloud-eus-03');
    await workers.tokenName.blur();
    expect(await matches(page, workers, 'token', 'dialogs/worker-token/default.html'), 'default').toBeLessThan(
      tolerance,
    );

    await workers.answerTokens('hold');
    await workers.createToken.click();
    await expect(workers.creatingToken).toBeVisible();
    expect(await matches(page, workers, 'token', 'dialogs/worker-token/busy.html'), 'busy').toBeLessThan(tolerance);
  });

  test('New worker token: invalid and failed as the mocks show them', async ({ page }) => {
    const workers = new WorkersPage(page);
    await signIn(page, 'quinntynebrown');
    await workers.open();
    await workers.fillToken('Cloud 03!');
    await workers.createToken.click();
    await expect(workers.tokenNameError).toBeVisible();
    await workers.tokenName.blur();
    expect(await matches(page, workers, 'token', 'dialogs/worker-token/invalid.html'), 'invalid').toBeLessThan(
      tolerance,
    );

    await workers.answerTokens(503);
    await workers.tokenName.fill('hewn-cloud-eus-03');
    await workers.createToken.click();
    await expect(workers.tokenFailure).toBeVisible();
    await workers.tokenName.blur();
    expect(await matches(page, workers, 'token', 'dialogs/worker-token/failed.html'), 'failed').toBeLessThan(tolerance);
  });

  test('New worker token: the token shown once as the success mock shows it', async ({ page }) => {
    const workers = new WorkersPage(page);
    await signIn(page, 'quinntynebrown');
    await workers.open();
    await workers.answerTokens({
      id: 'wtk_mock',
      name: 'hewn-cloud-eus-03',
      location: 'Cloud',
      expiresAt: new Date(Date.now() + 90 * 86_400_000).toISOString(),
      token: 'hwt_live_8Qm2vR7xKc4pZ1nLw9sTj3dYf6aB0eHg',
    });
    await workers.newToken('hewn-cloud-eus-03');
    expect(await matches(page, workers, 'token', 'dialogs/worker-token/success.html'), 'success').toBeLessThan(
      tolerance,
    );
  });

  test('Revoke: default, busy and failed as the mocks show them', async ({ page }) => {
    const workers = new WorkersPage(page);
    await signIn(page, 'quinntynebrown');
    await workers.serveWorkers([buildBox]);
    await workers.open();
    await workers.revoke('build-box-02').click();
    await expect(workers.revokeDialog).toBeVisible();
    expect(await matches(page, workers, 'revoke', 'dialogs/revoke-worker/default.html'), 'default').toBeLessThan(
      tolerance,
    );

    await workers.answerRevoke(500);
    await workers.revokeConfirm.click();
    await expect(workers.revokeFailure).toBeVisible();
    expect(await matches(page, workers, 'revoke', 'dialogs/revoke-worker/failed.html'), 'failed').toBeLessThan(
      tolerance,
    );

    await page.unroute('**/api/workers/*/revoke');
    await workers.answerRevoke('hold');
    await workers.revokeTryAgain.click();
    await expect(workers.revokeDialog.getByRole('button', { name: 'Revoking…' })).toBeVisible();
    // The busy mock has no failure callout; the live dialog clears it as Try again starts.
    expect(await matches(page, workers, 'revoke', 'dialogs/revoke-worker/busy.html'), 'busy').toBeLessThan(tolerance);
  });
});
