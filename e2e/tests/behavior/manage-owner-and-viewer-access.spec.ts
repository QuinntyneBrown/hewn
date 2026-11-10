// Acceptance Test
// Traces to: L2-038, L2-039
// Description: An Owner adds a GitHub login as Viewer or Owner and removes one in Settings, and a Viewer sees the list read-only (L2-038 AC5); a removed login is signed out at once; a Viewer's state change gets 403 whatever the client sends (L2-039 AC1); a project the user can't see is not found (L2-039 AC2)

import { expect, signIn, test } from '../../fixtures/test';
import { SignInPage } from '../../pages/sign-in.page';

const unique = () => `nadia-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

test.describe('Manage Owner and Viewer access', () => {
  test('an Owner adds a Viewer, who then signs in to read-only pages', async ({ page, settings, signInPage }) => {
    const login = unique();
    await signIn(page, 'quinntynebrown');
    await settings.open();
    await expect(settings.accessRow('quinntynebrown').remove).toHaveCount(0);

    await settings.fillAdd(login.toUpperCase());
    await expect(settings.addViewer).toBeChecked();
    await settings.addConfirm.click();

    await expect(settings.addDialog).toHaveCount(0);
    await expect(settings.accessRow(login).role).toHaveText('Viewer');
    await expect(settings.accessRow(login).lastSignIn).toHaveText('Last sign-in: Never');

    await page.context().clearCookies();
    await signInPage.open();
    await signInPage.continueWithGitHub.click();
    await signInPage.authorizeOnGitHub(login);
    await expect(page.locator('.sidebar__foot')).toContainText(`${login}Viewer`);
    await settings.open();
    await expect(settings.addLogin).toHaveCount(0);
    await expect(settings.accessRows.getByRole('button')).toHaveCount(0);
    await expect(settings.readOnlyCallout).toBeVisible();
    await expect(settings.accessRow(login).lastSignIn).toContainText('Last sign-in: Today');
  });

  test('an Owner can add another Owner', async ({ page, settings }) => {
    const login = unique();
    await signIn(page, 'quinntynebrown');
    await settings.open();

    await settings.fillAdd(login, 'Owner');
    await settings.addConfirm.click();

    await expect(settings.accessRow(login).role).toHaveText('Owner');
  });

  test('a login already listed or unknown to GitHub is an inline error', async ({ page, settings }) => {
    await signIn(page, 'quinntynebrown');
    await settings.open();

    await settings.fillAdd('ADA');
    await settings.addConfirm.click();
    await expect(settings.addLoginError).toHaveText('@ada is already on the allow list.');
    await expect(settings.addLoginInput).toHaveAttribute('aria-invalid', 'true');

    await settings.addLoginInput.fill('missing-person');
    await settings.addConfirm.click();
    await expect(settings.addLoginError).toHaveText('No GitHub account is called @missing-person.');
    await settings.addCancel.click();
    await expect(settings.accessRow('missing-person').row).toHaveCount(0);
  });

  test('when GitHub cannot confirm the login, nothing is added and the dialog says why', async ({ page, settings }) => {
    await signIn(page, 'quinntynebrown');
    await settings.open();

    await settings.fillAdd('rate-limited');
    await settings.addConfirm.click();

    await expect(settings.addFailure).toContainText('@rate-limited wasn’t added');
    await expect(settings.addFailure).toContainText(
      'GitHub couldn’t confirm the login exists (rate limited). Try again in a minute.',
    );
    await settings.addCancel.click();
    await expect(settings.accessRow('rate-limited').row).toHaveCount(0);
  });

  test('removing a login signs it out at once', async ({ browser, page, settings }) => {
    const login = unique();
    await signIn(page, 'quinntynebrown');
    await settings.ensureListed(login);

    const theirs = await browser.newPage();
    const them = new SignInPage(theirs);
    await them.open();
    await them.continueWithGitHub.click();
    await them.authorizeOnGitHub(login);
    await expect(theirs.locator('.sidebar__foot')).toContainText(login);

    await settings.open();
    await settings.accessRow(login).remove.click();
    await expect(settings.accessRow(login).row).toHaveCount(0);

    expect(await them.apiAcceptsSession()).toBe(false);
    await theirs.close();
  });

  test('a Viewer’s state change gets 403 whatever the client sends', async ({ page, settings }) => {
    await signIn(page, 'ada');
    await settings.open();

    expect(await settings.tryToChange('POST', '/api/allow-list', { login: 'ada-friend', role: 'Owner' })).toBe(403);
    expect(await settings.tryToChange('DELETE', '/api/allow-list/quinntynebrown')).toBe(403);
    expect(await settings.tryToChange('PUT', '/api/settings/direction-defaults', { defaultBudgetUsd: 5000 })).toBe(403);
    expect(await settings.tryToChange('POST', '/api/workers/stop')).toBe(403);
    await expect(settings.accessRow('quinntynebrown').row).toBeVisible();
  });

  test('a project the user cannot see is not found', async ({ page, project }) => {
    await signIn(page, 'ada');
    const hidden = '0b5e1f9c-7d1a-4c55-9a6e-3f1f1b2b9c11';

    expect((await page.request.get(`/api/projects/${hidden}`)).status()).toBe(404);
    await page.goto(`/projects/${hidden}`);
    await expect(project.notFound).toBeVisible();
  });
});
