// Acceptance Test
// Traces to: L2-029
// Description: An Owner stops all workers from a confirmation dialog while two projects run: every worker halts its active run within 10 seconds and nothing more is leased; a stopped banner shows on every page until the Owner presses Start workers, and each halted run then resumes from its checkpoint; a worker that stops answering is named; a Viewer sees the banner but no control, and the API answers 403

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { ProjectPage } from '../../pages/project.page';
import { WorkersPage } from '../../pages/workers.page';
import { compare, mockRegion, region } from '../../support/mocks';
import { drainQueue } from '../../support/queue';
import { startWorkers } from '../../support/workers';

const idea = 'A web app for small accounting teams to reconcile statements.';

async function noAxeViolations(page: Page, what: string): Promise<void> {
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(
    axe.violations.map((v) => v.id),
    `${what} has no axe-core violations`,
  ).toEqual([]);
}

test.describe('Stop and restart all workers', () => {
  test.describe.configure({ timeout: 300_000 });

  let stopWorkers: (() => Promise<void>) | null = null;
  let owner: WorkersPage | null = null;

  test.afterEach(async () => {
    // Leasing is global: always switch it back on, so no other test finds the workers stopped.
    if (owner) expect(await owner.post('start')).toBe(200);
    owner = null;
    await stopWorkers?.();
    stopWorkers = null;
  });

  test('Stop all workers halts both running projects within 10 seconds, and Start workers resumes them from their checkpoints', async ({
    page,
    newDirection,
    project,
  }) => {
    await signIn(page, 'quinntynebrown');
    const workers = new WorkersPage(page);
    owner = workers;
    await drainQueue(page);
    stopWorkers = startWorkers(2, 1_500, { executor: 'scripted', logLines: 3 });
    const projects: string[] = [];
    for (const name of ['Ledger', 'Tide']) {
      await newDirection.open();
      await newDirection.fill({ name: uniqueName(name), idea });
      await newDirection.submit();
      await expect(project.liveStep('Bootstrap')).toHaveText('Run Bootstrap', { timeout: 60_000 });
      projects.push(new URL(page.url()).pathname.split('/').at(-1)!);
    }

    await expect
      .poll(async () => (await workers.workers()).workers.filter((w) => w.status === 'Busy').length, {
        timeout: 30_000,
      })
      .toBe(2);
    await workers.open();
    await expect(workers.withStatus('Leased')).toHaveCount(2);
    const button = compare(
      await region(workers.stopAllButton),
      await mockRegion(page, 'notifications/system-banner/warning.html', '.sidebar__foot .btn--danger'),
    );
    expect(button.ratio, 'Stop all workers differs from the mock').toBeLessThan(0.05);

    // Cancel closes the dialog and changes nothing.
    await workers.stopAllButton.click();
    await expect(workers.stopDialog).toBeVisible();
    await expect(workers.stopCancel).toBeFocused();
    await expect(workers.stopDialogText).toContainText('halt their active runs within 10 seconds and stop leasing.');
    await expect(workers.stopDialogText).toContainText('keep their last checkpoints and resume from them');
    await workers.stopDialogSettled();
    await noAxeViolations(page, 'the stop workers dialog');
    const footer = compare(
      await region(workers.stopDialogFooter),
      await mockRegion(page, 'dialogs/stop-workers/default.html', '.dialog__footer'),
    );
    expect(footer.ratio, 'the dialog buttons differ from the mock').toBeLessThan(0.05);
    await workers.stopCancel.click();
    await expect(workers.stopDialog).toHaveCount(0);
    expect((await workers.workers()).leasing.stopped).toBe(false);

    await workers.stopAllButton.click();
    const pressed = Date.now();
    await workers.stopConfirm.click();
    await expect(workers.stopDialog).toHaveCount(0, { timeout: 10_000 });
    expect(Date.now() - pressed, 'every worker halted within 10 seconds').toBeLessThan(10_000);

    await expect(workers.stoppedBanner).toHaveText(
      /All workers stopped by quinntynebrown at \d\d:\d\d\. Nothing new will be leased until you start them again\./,
    );
    await expect(workers.startWorkersButton).toBeVisible();
    await expect(workers.stopAllButton).toHaveCount(0);
    await expect(workers.rows.filter({ hasText: 'Holding at checkpoint' })).toHaveCount(2);
    const start = compare(
      await region(workers.startWorkersButton),
      await mockRegion(page, 'pages/workers/stopped.html', '.sidebar__foot .btn'),
    );
    expect(start.ratio, 'Start workers differs from the mock').toBeLessThan(0.05);
    await noAxeViolations(page, 'the Workers page with workers stopped');

    // Both runs halted where they were, and nothing more is leased.
    const halted = new Map<string, number>();
    for (const id of projects) {
      await project.open(id);
      await expect(workers.stoppedBanner).toBeVisible();
      await expect(
        project.logLines.filter({ hasText: /Halted: all workers stopped by quinntynebrown; resumes from step \d$/ }),
      ).toHaveCount(1);
      await expect(project.logLines.filter({ hasText: /Run halted at step \d$/ })).toHaveCount(1);
      const line = await project.logLines.filter({ hasText: 'resumes from step' }).innerText();
      halted.set(id, Number(/resumes from step (\d+)/.exec(line)![1]));
    }
    await page.waitForTimeout(5_000);
    expect((await workers.workers()).workers.filter((w) => w.status === 'Busy')).toEqual([]);

    // Start workers: leasing comes back on and each halted run carries on after its checkpoint.
    await workers.startWorkersButton.click();
    await expect(workers.stoppedBanner).toHaveCount(0);
    await expect(workers.stopAllButton).toBeVisible();
    for (const id of projects) {
      await project.open(id);
      await expect(project.logLines.filter({ hasText: 'Queued again: workers started by quinntynebrown' })).toHaveCount(
        1,
        {
          timeout: 30_000,
        },
      );
      await expect
        .poll(
          async () => {
            const events = await project.events();
            const requeued = events.findIndex(
              (e) =>
                e.type === 'LogLines' &&
                JSON.stringify(e.payload).includes('Queued again: workers started by quinntynebrown'),
            );
            return events.slice(requeued).find((e) => e.type === 'StepStarted')?.payload['step'];
          },
          { timeout: 30_000 },
        )
        .toBe(halted.get(id));
    }
  });

  test('A worker that stops answering is named; a Viewer sees the banner but no control and gets 403', async ({
    page,
    browser,
    newDirection,
    project,
  }) => {
    await signIn(page, 'quinntynebrown');
    const workers = new WorkersPage(page);
    owner = workers;
    await drainQueue(page);
    stopWorkers = startWorkers(1, 4_000, { executor: 'scripted', logLines: 3 });
    await newDirection.open();
    await newDirection.fill({ name: uniqueName('Silent'), idea });
    await newDirection.submit();
    await expect(project.liveStep('Bootstrap')).toHaveText('Run Bootstrap', { timeout: 60_000 });
    // The worker process ends without a word, still holding the lease.
    await stopWorkers();
    stopWorkers = null;

    await workers.stopAllButton.click();
    await workers.stopConfirm.click();
    await expect(workers.stopping).toBeVisible();
    await expect(workers.stopFailure).toContainText('1 worker didn’t confirm', { timeout: 15_000 });
    await expect(workers.stopFailure).toContainText(
      // Workers registered by earlier tests may still count as online, so "The others stopped." can appear.
      /e2e-worker-1 didn’t acknowledge within 10 s\.( The others stopped\.)? Leasing is off, so it can’t pick up new work; try again to stop it\./,
    );
    await expect(workers.stopTryAgain).toBeVisible();
    await noAxeViolations(page, 'the failed stop workers dialog');
    await workers.stopCancel.click();
    await expect(workers.stoppedBanner).toBeVisible();

    // A Viewer sees the banner on every page, but neither control, and the API refuses them.
    const viewerContext = await browser.newContext();
    const viewerPage = await viewerContext.newPage();
    await signIn(viewerPage, 'ada');
    const viewer = new WorkersPage(viewerPage);
    await viewer.open();
    await expect(viewer.stoppedBanner).toBeVisible();
    await expect(viewer.startWorkersButton).toHaveCount(0);
    await expect(viewer.stopAllButton).toHaveCount(0);
    expect(await viewer.post('start')).toBe(403);
    expect(await viewer.post('stop')).toBe(403);
    await new ProjectPage(viewerPage).open(new URL(page.url()).pathname.split('/').at(-1)!);
    await expect(viewer.stoppedBanner).toBeVisible();
    await viewerContext.close();
  });
});
