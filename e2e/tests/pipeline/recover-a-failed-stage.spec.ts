// Acceptance Test
// Traces to: L2-006
// Description: A failing stage is retried automatically after each backoff, counting down on the project page; when the last retry fails the stage is Failed, the project Blocked, the failure callout gives the reason and the last log lines, and a danger toast offers Retry stage; Retry stage runs the stage again from its start and it succeeds; a Viewer sees no Retry stage and the API answers 403

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { ProjectPage } from '../../pages/project.page';
import { compare, mockRegion, region } from '../../support/mocks';
import { drainQueue, xsrfToken } from '../../support/queue';
import { startWorkers } from '../../support/workers';

const idea = 'A web app for small accounting teams to reconcile statements.';
const reason = 'Validation failed: L2-014 has no Given/When/Then the brief can support';

async function noAxeViolations(page: Page, what: string): Promise<void> {
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(
    axe.violations.map((v) => v.id),
    `${what} has no axe-core violations`,
  ).toEqual([]);
}

test.describe('Recover a failed stage', () => {
  test.describe.configure({ timeout: 240_000 });

  let stopWorkers: (() => Promise<void>) | null = null;

  test.afterEach(async () => {
    await stopWorkers?.();
    stopWorkers = null;
  });

  test('A failing stage is retried, then Blocked, and Retry stage runs it again from its start', async ({
    page,
    browser,
    newDirection,
    project,
  }) => {
    await signIn(page, 'quinntynebrown');
    await drainQueue(page);
    // Bootstrap fails its first four attempts (the run and its three retries), then passes. The e2e API waits
    // 2 s, 3 s and 4 s before the retries.
    stopWorkers = startWorkers(1, 500, { executor: 'scripted', logLines: 3, fail: { stage: 0, times: 4, reason } });
    await newDirection.open();
    await newDirection.fill({ name: uniqueName('Parcel'), idea });
    await newDirection.submit();

    // L2-006 AC1: each retry counts down in the stage's live line.
    await expect(project.liveStep('Bootstrap')).toHaveText(/^Retry 1 of 3 (in 0:0\d|starting)$/, { timeout: 60_000 });
    await expect(project.liveLine('Bootstrap')).toHaveText(reason);
    await expect(project.projectStatus).toHaveText('Running');

    // AC2: the third retry fails too, so the stage is Failed and the project Blocked.
    await expect(project.projectStatus).toHaveText('Blocked', { timeout: 60_000 });
    expect(await project.stageStatuses()).toEqual(['Failed', ...Array(10).fill('Pending')]);
    await expect(project.blockedCallout).toContainText('Stage failed after 3 retries');
    await expect(project.blockedCallout).toContainText(
      `${reason}. Retried after 2 s, 3 s and 4 s. Other projects keep running. The last 200 log lines are below.`,
    );
    await expect(project.blockedCallout).toHaveAttribute('role', 'alert');
    // The Log tab shows the last attempt's run; the Runs tab lists all four attempts.
    await expect(
      project.logLines.filter({ hasText: `Attempt 4 failed: ${reason}. Retries exhausted; the stage is Failed.` }),
    ).toHaveCount(1);
    await project.tab('Runs').click();
    await expect(project.runRows).toHaveCount(4);
    await expect(project.runRows.filter({ hasText: 'Failed' })).toHaveCount(4);
    await project.tab('Log').click();
    await expect(project.blockedToast).toContainText('Bootstrap failed after 3 retries. Other projects keep running.');
    await expect(project.blockedToast).toHaveAttribute('role', 'alert');
    await expect(project.toastAction(project.blockedToast, 'Open log')).toBeVisible();
    await expect(project.toastAction(project.blockedToast, 'Retry stage')).toBeVisible();
    const button = compare(
      await region(project.calloutRetryStage, { snap: true }),
      await mockRegion(page, 'pages/project-pipeline/blocked.html', '.callout__actions .btn', { snap: true }),
    );
    expect(button.ratio, 'the Retry stage button differs from the mock').toBeLessThan(0.05);
    await expect(project.cancelButton).toBeVisible();
    await noAxeViolations(page, 'the blocked page');

    // A Viewer sees why it is Blocked but gets no Retry stage, and the API refuses them.
    const viewerContext = await browser.newContext();
    const viewerPage = await viewerContext.newPage();
    await signIn(viewerPage, 'ada');
    const viewer = new ProjectPage(viewerPage);
    await viewerPage.goto(page.url());
    await expect(viewer.blockedCallout).toContainText('Stage failed after 3 retries');
    await expect(viewer.retryStageButton).toHaveCount(0);
    await expect(viewer.calloutRetryStage).toHaveCount(0);
    const projectId = project.projectIdFromUrl();
    const directionId = (
      (await (await viewerPage.request.get(`/api/projects/${projectId}`)).json()) as { directions: { id: string }[] }
    ).directions[0]!.id;
    const forbidden = await viewerPage.request.post(
      `/api/projects/${projectId}/directions/${directionId}/retry-stage`,
      { data: {}, headers: { 'X-XSRF-TOKEN': await xsrfToken(viewerPage) } },
    );
    expect(forbidden.status()).toBe(403);
    await viewerContext.close();

    // AC3: Retry stage runs Bootstrap again from its start, and this time it succeeds.
    await project.calloutRetryStage.click();
    await expect(project.projectStatus).toHaveText('Running');
    await expect(project.blockedCallout).toHaveCount(0);
    await expect(project.logLines.filter({ hasText: 'Retry stage requested by quinntynebrown' })).toHaveCount(1);
    await expect.poll(async () => (await project.stageStatuses())[0], { timeout: 60_000 }).toBe('Succeeded');
    const types = (await project.events()).map((e) => e.type);
    expect(types.filter((t) => t === 'RunRetryScheduled')).toHaveLength(3);
    expect(types.filter((t) => t === 'StageBlocked')).toHaveLength(1);
    expect(types.indexOf('StageRetried')).toBeGreaterThan(types.indexOf('StageBlocked'));
  });
});
