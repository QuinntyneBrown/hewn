// Acceptance Test
// Traces to: L2-041
// Description: An Owner creates a worker token with a name, location and expiry; it is shown once, can be copied, appears in no API response afterwards, and a worker started with it appears under the token's name (AC1, AC3). Revoking a connected worker that holds a lease disconnects it within 10 seconds, and its run resumes on another worker (AC2). A name outside the rules is an inline error, and a Viewer can neither create nor revoke (AC1, AC4)

import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { WorkersPage } from '../../pages/workers.page';
import { startWorkers } from '../../support/workers';

/** A worker name unique on the shared e2e stack: lowercase letters, digits and hyphens. */
const unique = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

test.describe('Manage worker tokens', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });

  const stops: (() => Promise<void>)[] = [];

  test.afterEach(async () => {
    await Promise.all(stops.splice(0).map((stop) => stop()));
  });

  test('an Owner creates a token, shown once and copied, and a worker started with it appears under its name', async ({
    page,
  }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    const workers = new WorkersPage(page);
    await signIn(page, 'quinntynebrown');
    await workers.open();
    const name = unique('token-cloud');

    const token = await workers.newToken(name, 'Cloud', 'In 30 days');
    await expect(workers.tokenCreated).toContainText(`Token created for ${name}`);
    await expect(workers.tokenCreated).toContainText('Hewn stores only a hash and can’t show it again.');
    expect(token).toMatch(/^hwt_[A-Za-z0-9_-]{40,}$/);
    await expect(workers.startCommand).toContainText(`HEWN_WORKER_TOKEN=${token}`);

    await workers.copyToken.click();
    await expect(workers.copyToken).toHaveAccessibleName('Token copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(token);

    // Escape doesn't lose a token shown once; Done closes it.
    await page.keyboard.press('Escape');
    await expect(workers.tokenDialog).toBeVisible();
    await workers.tokenDone.click();
    await expect(workers.tokenDialog).toBeHidden();

    // The worker calls itself something else and says it runs locally; the token's name and location win.
    stops.push(startWorkers(1, 150, { executor: 'scripted', namePrefix: unique('ignored'), token }));
    await expect(workers.row(name)).toBeVisible({ timeout: 10_000 });
    await expect(workers.details(name).location).toContainText('Cloud');
    expect(await workers.rawWorkers(), 'no API response carries the token').not.toContain(token);
  });

  test('revoking a leased worker disconnects it within 10 seconds and its run resumes on another worker', async ({
    page,
    newDirection,
    project,
  }) => {
    const workers = new WorkersPage(page);
    await signIn(page, 'quinntynebrown');
    await workers.open();
    const name = unique('token-local');
    const token = await workers.newToken(name, 'Local');
    await workers.tokenDone.click();

    let exitCode: number | null | undefined;
    stops.push(startWorkers(1, 4_000, { executor: 'scripted', token, onExit: (code) => (exitCode = code) }));
    await expect(workers.details(name).status).toHaveText('Idle', { timeout: 10_000 });

    const direction = uniqueName('Revoked');
    await newDirection.open();
    await newDirection.fill({ name: direction, idea: 'A tool library ledger for a village hall.' });
    await newDirection.submit();
    await project.heading.waitFor();
    await expect(project.currentStage()).toBeVisible({ timeout: 10_000 });
    await workers.open();
    await expect(workers.details(name).workingOn).toHaveText(direction, { timeout: 15_000 });

    // A second worker, ready to pick the run up once the lease is released.
    const standby = unique('standby');
    stops.push(startWorkers(1, 4_000, { executor: 'scripted', namePrefix: standby }));
    await expect(workers.details(`${standby}-1`).status).toHaveText('Idle', { timeout: 10_000 });

    await workers.revoke(name).click();
    await expect(workers.revokeDialog).toContainText(`Revoke ${name}?`);
    const revoked = Date.now();
    await workers.revokeConfirm.click();
    await expect(workers.revokeDialog).toBeHidden();
    await expect(workers.row(name)).toHaveCount(0, { timeout: 10_000 });
    await expect.poll(() => exitCode, { timeout: 10_000 - (Date.now() - revoked) }).toBe(3);

    await expect(workers.details(`${standby}-1`).workingOn).toHaveText(direction, { timeout: 30_000 });
  });

  test('a name outside the rules is an inline error and nothing is created', async ({ page }) => {
    const workers = new WorkersPage(page);
    await signIn(page, 'quinntynebrown');
    await workers.open();

    await workers.fillToken('Build Box!');
    await workers.createToken.click();
    await expect(workers.tokenNameError).toHaveText('Worker name must be 3–40 lowercase letters, digits or hyphens.');
    await expect(workers.tokenName).toHaveAttribute('aria-invalid', 'true');
    await expect(workers.tokenCreated).toHaveCount(0);
    await workers.tokenCancel.click();
    await expect(workers.tokenDialog).toBeHidden();
  });

  test('a Viewer sees no token or Revoke controls, and the API refuses both', async ({ page }) => {
    const workers = new WorkersPage(page);
    const name = unique('viewer-sees');
    stops.push(startWorkers(1, 150, { executor: 'scripted', namePrefix: name }));
    await signIn(page, 'ada');
    await workers.open();
    await expect(workers.row(`${name}-1`)).toBeVisible({ timeout: 10_000 });

    await expect(workers.newTokenButton).toHaveCount(0);
    await expect(workers.revoke(`${name}-1`)).toHaveCount(0);
    const created = await workers.postToken({ name: unique('nope'), location: 'Local', expiresInDays: 30 });
    expect(created.status).toBe(403);
    expect(created.text).not.toContain('hwt_');
    const id = (await workers.workers()).workers.find((w) => w.name === `${name}-1`)!.id;
    expect(await workers.postRevoke(id)).toBe(403);
  });
});
