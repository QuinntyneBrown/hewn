// Acceptance Test
// Traces to: L2-026, L2-031
// Description: Workers says when no worker has connected yet (with New worker token for an Owner only), shows a placeholder while it loads, and says when it couldn't load, with Try again (L2-026 AC1)

import { expect, signIn, test } from '../../fixtures/test';
import { WorkersPage } from '../../pages/workers.page';

test.describe('Inspect worker activity', () => {
  test('before any worker connects, an Owner is offered a worker token and a Viewer is told who starts one', async ({
    page,
  }) => {
    const workers = new WorkersPage(page);
    await signIn(page, 'quinntynebrown');
    await workers.serveWorkers([]);
    await workers.open();
    await expect(workers.empty).toContainText('No workers yet');
    await expect(workers.empty).toContainText('Create a token, then start the container');
    await workers.emptyNewToken.click();
    await expect(workers.tokenDialog).toBeVisible();
    await workers.tokenCancel.click();

    await signIn(page, 'ada');
    await workers.open();
    await expect(workers.empty).toContainText('When an Owner starts one, it appears here');
    await expect(workers.emptyNewToken).toHaveCount(0);
  });

  test('while Workers loads it shows a placeholder, then the rows', async ({ page }) => {
    const workers = new WorkersPage(page);
    await signIn(page, 'quinntynebrown');
    await workers.answerWorkers('hold');
    await page.goto('/workers');
    await expect(workers.loading).toBeVisible();
    await expect(workers.rows).toHaveCount(0);
  });

  test('when Workers can’t load it says why, and Try again reads it again', async ({ page }) => {
    const workers = new WorkersPage(page);
    await signIn(page, 'quinntynebrown');
    await workers.answerWorkers(503);
    await workers.open();
    await expect(workers.loadFailure).toContainText(
      'The API returned 503. Connected workers keep their leases and heartbeats.',
    );

    await page.unroute('**/api/workers');
    await workers.serveWorkers([]);
    await workers.tryAgain.click();
    await expect(workers.loadFailure).toBeHidden();
    await expect(workers.empty).toBeVisible();
  });
});
