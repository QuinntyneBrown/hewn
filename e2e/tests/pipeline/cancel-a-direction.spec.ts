// Acceptance Test
// Traces to: L2-029, L2-004
// Description: An Owner cancels a running direction from a confirmation dialog: the active run stops within 10 seconds, the direction is Cancelled, its open pull request stays open labelled hewn:cancelled, and the next queued direction starts; a worker that stops answering is reported; a Viewer sees no control and the API answers 403

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { ProjectPage } from '../../pages/project.page';
import { compare, mockRegion, region } from '../../support/mocks';
import { drainQueue, xsrfToken } from '../../support/queue';
import { startWorkers } from '../../support/workers';

const idea = 'A web app for small accounting teams to reconcile statements.';

async function noAxeViolations(page: Page, what: string): Promise<void> {
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(
    axe.violations.map((v) => v.id),
    `${what} has no axe-core violations`,
  ).toEqual([]);
}

test.describe('Cancel a direction', () => {
  test.describe.configure({ timeout: 240_000 });

  let stopWorkers: (() => Promise<void>) | null = null;

  test.afterEach(async () => {
    await stopWorkers?.();
    stopWorkers = null;
  });

  test('Cancel stops the run within 10 seconds and labels the open pull request hewn:cancelled', async ({
    page,
    newDirection,
    project,
  }) => {
    await signIn(page, 'quinntynebrown');
    await drainQueue(page);
    // Scripted stages of three 1.5-second steps; Scaffold opens a pull request at the start of its main step.
    stopWorkers = startWorkers(1, 1_500, { executor: 'scripted', logLines: 3, pullRequestStage: 6 });
    await newDirection.open();
    await newDirection.fill({ name: uniqueName('Cancel'), idea });
    await newDirection.submit();
    await expect(project.logLines.filter({ hasText: 'Scaffold · line 1 of 3' })).toHaveCount(1, { timeout: 120_000 });
    const repository = (await project.repository.innerText()).trim();
    expect((await project.pullRequests(repository)).map((p) => p.open)).toEqual([true]);

    const cancel = compare(
      await region(project.cancelButton, { snap: true }),
      await mockRegion(page, 'pages/project-pipeline/default.html', '.phead .cluster .btn--ghost', { snap: true }),
    );
    expect(cancel.ratio, 'the Cancel button differs from the mock').toBeLessThan(0.05);

    // Keep running closes the dialog and changes nothing.
    await project.cancelButton.click();
    await expect(project.cancelDialog).toBeVisible();
    await expect(project.keepRunning).toBeFocused();
    await project.cancelDialogSettled();
    await noAxeViolations(page, 'the cancel dialog');
    const footer = compare(
      await region(project.cancelDialogFooter),
      await mockRegion(page, 'dialogs/cancel-direction/default.html', '.dialog__footer'),
    );
    expect(footer.ratio, 'the dialog buttons differ from the mock').toBeLessThan(0.05);
    await project.keepRunning.click();
    await expect(project.cancelDialog).toHaveCount(0);
    await expect(project.projectStatus).toHaveText('Running');

    await project.cancelButton.click();
    const pressed = Date.now();
    await project.cancelConfirm.click();
    await expect(project.cancelDialog).toHaveCount(0, { timeout: 10_000 });
    expect(Date.now() - pressed, 'the run stopped within 10 seconds').toBeLessThan(10_000);

    await expect(project.projectStatus).toHaveText('Cancelled');
    await expect(project.stageStatus('Scaffold')).toHaveText('Cancelled');
    await expect(project.cancelledCallout).toContainText(/Cancelled by quinntynebrown on \d{1,2} \w{3} at \d\d:\d\d/);
    await expect(project.cancelledCallout).toContainText(/The active run stopped within \d{1,2} seconds?\./);
    await expect(project.cancelledCallout).toContainText('Pull request #1 is open and labelled hewn:cancelled.');
    await expect(project.headerMeta).toContainText(/Product direction · cancelled \d{1,2} \w{3}/);
    await expect(project.cancelButton).toHaveCount(0);
    await expect(project.pauseButton).toHaveCount(0);
    for (const line of [
      'Cancel requested by quinntynebrown',
      'gh pr edit 1 --add-label hewn:cancelled',
      // Step 2 or 3 of Scaffold, depending on how long the dialog stayed open.
      /Run stopped at step [23]$/,
    ]) {
      await expect(project.logLines.filter({ hasText: line })).toHaveCount(1);
    }
    expect(await project.pullRequests(repository)).toEqual([
      expect.objectContaining({ number: 1, open: true, merged: false, labels: ['hewn:cancelled'] }),
    ]);
    await noAxeViolations(page, 'the cancelled page');

    // The worker stopped: nothing more of the run arrives, and the next stage never starts.
    const after = (await project.events()).length;
    await page.waitForTimeout(5_000);
    const late = (await project.events()).slice(after).map((e) => e.type);
    expect(late, 'nothing ran after the cancel').toEqual([]);
  });

  test('The next queued direction starts once the active one is cancelled, and a Viewer gets no control', async ({
    page,
    browser,
    newDirection,
    project,
  }) => {
    await signIn(page, 'quinntynebrown');
    await drainQueue(page);
    stopWorkers = startWorkers(1, 4_000, { executor: 'scripted', logLines: 3 });
    await newDirection.open();
    await newDirection.fill({ name: uniqueName('Queue'), idea });
    await newDirection.submit();
    await expect(project.liveStep('Bootstrap')).toHaveText('Run Bootstrap', { timeout: 60_000 });
    const projectId = new URL(page.url()).pathname.split('/').at(-1)!;
    const queued = await page.request.post(`/api/projects/${projectId}/directions`, {
      data: { idea: 'Add CSV export to the reconciliation report.', budgetUsd: 50 },
      headers: { 'X-XSRF-TOKEN': await xsrfToken(page) },
    });
    expect(queued.status()).toBe(201);

    // A Viewer sees the direction but no control, and the API refuses them.
    const viewerContext = await browser.newContext();
    const viewerPage = await viewerContext.newPage();
    await signIn(viewerPage, 'ada');
    const viewer = new ProjectPage(viewerPage);
    await viewerPage.goto(page.url());
    await expect(viewer.projectStatus).toHaveText('Running');
    await expect(viewer.cancelButton).toHaveCount(0);
    const directions = (
      (await (await viewerPage.request.get(`/api/projects/${projectId}`)).json()) as {
        directions: { id: string; kind: string }[];
      }
    ).directions;
    const product = directions.find((d) => d.kind === 'Product')!.id;
    const forbidden = await viewerPage.request.post(`/api/projects/${projectId}/directions/${product}/cancel`, {
      data: {},
      headers: { 'X-XSRF-TOKEN': await xsrfToken(viewerPage) },
    });
    expect(forbidden.status()).toBe(403);
    await viewerContext.close();

    await project.cancelButton.click();
    await project.cancelConfirm.click();
    await expect(project.cancelDialog).toHaveCount(0, { timeout: 10_000 });

    // First in, first out: the feature direction waiting behind it starts (L2-004 AC4).
    await expect(project.headerMeta).toContainText('Feature direction · Add CSV export', { timeout: 30_000 });
    await expect(project.projectStatus).toHaveText('Running');
    await expect(project.liveStep('Idea')).toHaveText('Run Idea', { timeout: 30_000 });
    const types = (await project.events()).map((e) => `${e.type}:${String(e.payload['status'] ?? '')}`);
    expect(types.indexOf('DirectionCancelled:')).toBeGreaterThan(-1);
    expect(types.lastIndexOf('DirectionChanged:Cancelled')).toBeLessThan(types.lastIndexOf('DirectionChanged:Running'));
  });

  test('A worker that stops answering is named, and the direction is Cancelled anyway', async ({
    page,
    newDirection,
    project,
  }) => {
    await signIn(page, 'quinntynebrown');
    await drainQueue(page);
    stopWorkers = startWorkers(1, 4_000, { executor: 'scripted', logLines: 3 });
    await newDirection.open();
    await newDirection.fill({ name: uniqueName('Silent'), idea });
    await newDirection.submit();
    await expect(project.liveStep('Bootstrap')).toHaveText('Run Bootstrap', { timeout: 60_000 });
    // The worker process ends without a word, still holding the lease.
    await stopWorkers();
    stopWorkers = null;

    await project.cancelButton.click();
    await project.cancelConfirm.click();
    await expect(project.cancelling).toBeVisible();
    await expect(project.cancelFailure).toContainText('Cancel didn’t reach the worker', { timeout: 15_000 });
    await expect(project.cancelFailure).toContainText(
      'e2e-worker-1 stopped answering. The lease expires in 60 s and the run won’t resume; try again to cancel now.',
    );
    await expect(project.cancelTryAgain).toBeVisible();
    await noAxeViolations(page, 'the failed cancel dialog');

    await project.keepRunning.click();
    await expect(project.projectStatus).toHaveText('Cancelled');
    await expect(project.cancelledCallout).toBeVisible();
  });
});
