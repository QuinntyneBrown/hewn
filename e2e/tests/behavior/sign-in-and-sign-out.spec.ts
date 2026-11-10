// Acceptance Test
// Traces to: L2-038
// Description: A signed-out visit to a page goes to sign-in and, after GitHub, back to that page (AC1, AC4); a login not on the allow list is refused with "This account doesn't have access" and no session (AC2); cancelling on GitHub returns to sign-in; signing out ends the session for good, and a session that ends while the app is open sends the user to sign-in saying so (AC3)

import { expect, signIn, test } from '../../fixtures/test';

test.describe('Sign in and sign out', () => {
  test('a signed-out visit signs in through GitHub and comes back to the page', async ({ page, signInPage }) => {
    await page.goto('/workers');
    await expect(page).toHaveURL(/\/sign-in\?returnUrl=%2Fworkers$/);
    await expect(signInPage.allowListNote).toBeVisible();

    await signInPage.continueWithGitHub.click();
    await expect(page).toHaveURL(/\/api\/fakes\/github\/login\/oauth\/authorize\?/);
    await signInPage.authorizeOnGitHub('ada');

    await expect(page).toHaveURL(/\/workers$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Workers' })).toBeVisible();
    await expect(page.locator('.sidebar__foot')).toContainText('ada');
    expect(await signInPage.apiAcceptsSession()).toBe(true);
  });

  test('a login not on the allow list is refused and gets no session', async ({ page, signInPage }) => {
    await signInPage.open();
    await signInPage.continueWithGitHub.click();
    await signInPage.authorizeOnGitHub('devon-park');

    await expect(page).toHaveURL(/\/sign-in\?error=denied&login=devon-park$/);
    await expect(signInPage.alert).toContainText('This account doesn’t have access');
    await expect(signInPage.alert).toContainText(
      '@devon-park isn’t on this Hewn’s allow list. Ask the Owner to add your GitHub login.',
    );
    expect(await signInPage.apiAcceptsSession()).toBe(false);
  });

  test('cancelling on GitHub returns to sign-in without a session', async ({ page, signInPage }) => {
    await signInPage.open();
    await signInPage.continueWithGitHub.click();
    await signInPage.gitHubCancel.click();

    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(signInPage.alert).toHaveCount(0);
    await expect(signInPage.continueWithGitHub).toBeVisible();
    expect(await signInPage.apiAcceptsSession()).toBe(false);
  });

  test('GitHub failing says so and offers to try again', async ({ signInPage }) => {
    await signInPage.open('error=github');

    await expect(signInPage.alert).toContainText('GitHub didn’t answer');
    await expect(signInPage.alert).toContainText('Sign-in timed out after 30 seconds.');
    await expect(signInPage.tryAgainWithGitHub).toHaveAttribute('href', '/api/auth/github?returnUrl=%2F');
  });

  test('signing out ends the session, even for a page opened afterwards', async ({ page, signInPage }) => {
    await signIn(page, 'quinntynebrown');
    await page.goto('/workers');

    await signInPage.signOut.click();

    await expect(page).toHaveURL(/\/sign-in\?reason=signed-out$/);
    await expect(signInPage.status).toContainText('You’re signed out');
    await expect(signInPage.status).toContainText('Agents keep running on your workers. Sign in again to watch them.');
    expect(await signInPage.apiAcceptsSession()).toBe(false);
    await page.goto('/projects');
    await expect(page).toHaveURL(/\/sign-in\?returnUrl=%2Fprojects$/);
  });

  test('a session that ends while the app is open goes to sign-in saying so', async ({ page, signInPage }) => {
    await signIn(page, 'quinntynebrown');
    await page.goto('/workers');
    await expect(page.getByRole('heading', { level: 1, name: 'Workers' })).toBeVisible();

    await page.context().clearCookies();
    await page.getByRole('link', { name: 'Projects' }).first().click();

    await expect(page).toHaveURL(/\/sign-in\?reason=expired&returnUrl=%2Fprojects$/);
    await expect(signInPage.status).toContainText('Your session ended after 8 hours.');
  });
});
