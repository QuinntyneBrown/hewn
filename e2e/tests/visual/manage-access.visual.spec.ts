// Acceptance Test
// Traces to: L2-038
// Description: Who can sign in matches docs/mocks for an Owner and a Viewer, and Add a GitHub login matches its default, busy, invalid and failed mocks (AC5)

import type { Page } from '@playwright/test';
import { expect, signIn, test } from '../../fixtures/test';
import { compare, mockRegion, region } from '../../support/mocks';
import type { SettingsPage } from '../../pages/settings.page';

const tolerance = 0.02;
// The body: in the mocks the section follows Appearance (not built yet), which gives it a top border.
const section = 'section[aria-labelledby="s-access"] .settings-section__body';
const panel = '.dialog__panel';

function today(hours: number, minutes: number): string {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

/** The mocks' cast: quinntynebrown signed in at 08:02, ama-osei at 10:15, devon-park never. */
async function serveCast(settings: SettingsPage): Promise<void> {
  await settings.serveAllowList([
    { login: 'quinntynebrown', role: 'Owner', lastSignInAt: today(8, 2) },
    { login: 'ama-osei', role: 'Viewer', lastSignInAt: today(10, 15) },
    { login: 'devon-park', role: 'Viewer', lastSignInAt: null },
  ]);
}

async function matches(page: Page, actual: Buffer, mock: string, selector: string): Promise<number> {
  return compare(actual, await mockRegion(page, mock, selector)).ratio;
}

test.describe('Manage access, visual', () => {
  test.describe.configure({ mode: 'serial' });

  test('Owner: who can sign in as the mock shows it', async ({ page, settings }) => {
    await signIn(page, 'quinntynebrown');
    await serveCast(settings);
    await settings.open();
    await expect(settings.accessRows).toHaveCount(3);

    const ratio = await matches(page, await region(settings.accessBody), 'pages/settings/default.html', section);
    expect(ratio, 'the Owner’s list differs from the mock').toBeLessThan(tolerance);
  });

  test('Viewer: the list read-only as the mock shows it', async ({ page, settings }) => {
    await signIn(page, 'ada');
    await serveCast(settings);
    await settings.open();
    await expect(settings.accessRows).toHaveCount(3);

    const ratio = await matches(page, await region(settings.accessBody), 'pages/settings/viewer.html', section);
    expect(ratio, 'the Viewer’s list differs from the mock').toBeLessThan(tolerance);
  });

  test('add: default, busy, invalid and failed as the mocks show them', async ({ page, settings }) => {
    await signIn(page, 'quinntynebrown');
    await settings.ensureListed('nadia-k');
    await settings.open();
    await settings.fillAdd('nadia-k');
    await page.mouse.move(0, 0);

    let ratio = await matches(page, await region(settings.addPanel), 'dialogs/add-user/default.html', panel);
    expect(ratio, 'the dialog differs from the mock').toBeLessThan(tolerance);

    await settings.addConfirm.click();
    await expect(settings.addLoginError).toBeVisible();
    ratio = await matches(page, await region(settings.addPanel), 'dialogs/add-user/invalid.html', panel);
    expect(ratio, 'the invalid dialog differs from the mock').toBeLessThan(tolerance);

    await settings.addCancel.click();
    await settings.fillAdd('rate-limited');
    await settings.addConfirm.click();
    await expect(settings.addFailure).toBeVisible();
    await settings.addLoginInput.fill('nadia-k');
    await settings.addLoginInput.blur();
    await page.mouse.move(0, 0);
    ratio = await matches(page, await region(settings.addPanel), 'dialogs/add-user/failed.html', panel);
    expect(ratio, 'the failed dialog differs from the mock').toBeLessThan(tolerance);

    await settings.addCancel.click();
    await settings.holdAdd();
    await settings.fillAdd('nadia-k');
    await settings.addConfirm.click();
    await expect(settings.adding).toBeDisabled();
    await page.mouse.move(0, 0);
    ratio = await matches(page, await region(settings.addPanel), 'dialogs/add-user/busy.html', panel);
    expect(ratio, 'the busy dialog differs from the mock').toBeLessThan(tolerance);
  });
});
