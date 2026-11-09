// Acceptance Test
// Traces to: L2-029, L2-050
// Description: An Owner pauses a running direction: the step in progress finishes first, the direction becomes Paused and nothing new starts; Resume continues from the next step and no completed step runs again; a Viewer sees no control and the API answers 403

import AxeBuilder from '@axe-core/playwright';
import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { ProjectPage } from '../../pages/project.page';
import { compare, mockRegion, region } from '../../support/mocks';
import { drainQueue, xsrfToken } from '../../support/queue';
import { startWorkers } from '../../support/workers';

const idea = 'A web app for small accounting teams to reconcile statements.';

test.describe('Pause and resume a direction', () => {
  test.describe.configure({ timeout: 240_000 });

  let stopWorkers: (() => Promise<void>) | null = null;

  test.afterEach(async () => {
    await stopWorkers?.();
    stopWorkers = null;
  });

  test('Pause lets the step in progress finish, then Resume carries on from the next step without repeating one', async ({
    page,
    browser,
    newDirection,
    project,
  }) => {
    await signIn(page, 'quinntynebrown');
    await drainQueue(page);
    // Each scripted stage has three steps of 4 seconds: Prepare workspace, Run <stage>, Commit artifacts.
    stopWorkers = startWorkers(1, 4_000, { executor: 'scripted', logLines: 4 });
    await newDirection.open();
    await newDirection.fill({ name: uniqueName('Pause'), idea });
    await newDirection.submit();
    await expect(project.liveStep('Bootstrap')).toHaveText('Run Bootstrap', { timeout: 60_000 });

    const pause = compare(
      await region(project.pauseButton, { snap: true }),
      await mockRegion(page, 'pages/project-pipeline/default.html', '.phead .cluster .btn:not(.btn--ghost)', {
        snap: true,
      }),
    );
    expect(pause.ratio, 'the Pause button differs from the mock').toBeLessThan(0.05);

    // Pause mid-step: the direction keeps running until the step in progress finishes.
    await project.pauseButton.click();
    await expect(project.pausingButton).toBeVisible();
    await expect(project.projectStatus).toHaveText('Running');
    await expect(project.logLines.filter({ hasText: 'Pause requested by quinntynebrown' })).toHaveCount(1);

    await expect(project.pausedCallout).toBeVisible({ timeout: 30_000 });
    await expect(project.pausedCallout).toContainText(/Paused by quinntynebrown at \d\d:\d\d/);
    await expect(project.projectStatus).toHaveText('Paused');
    await expect(project.stageStatus('Bootstrap')).toHaveText('Paused');
    await expect(project.logLines.filter({ hasText: 'Step 2 finished · checkpoint · direction Paused' })).toHaveCount(
      1,
    );
    await expect(project.resumeButton).toBeVisible();
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(
      axe.violations.map((v) => v.id),
      'the paused page has no axe-core violations',
    ).toEqual([]);

    // Nothing new starts while Paused, even with a worker free and polling.
    const pausedAt = (await project.events()).length;
    await page.waitForTimeout(17_000);
    const whilePaused = (await project.events()).slice(pausedAt).map((e) => e.type);
    expect(whilePaused, 'nothing ran while the direction was Paused').toEqual([]);

    // A Viewer sees the pause, but no control, and the API refuses them.
    const viewerContext = await browser.newContext();
    const viewerPage = await viewerContext.newPage();
    await signIn(viewerPage, 'ada');
    const viewer = new ProjectPage(viewerPage);
    await viewerPage.goto(page.url());
    await expect(viewer.pausedCallout).toBeVisible();
    await expect(viewer.resumeButton).toHaveCount(0);
    const projectId = new URL(page.url()).pathname.split('/').at(-1)!;
    const direction = (
      (await (await viewerPage.request.get(`/api/projects/${projectId}`)).json()) as {
        directions: { id: string }[];
      }
    ).directions[0]!.id;
    const forbidden = await viewerPage.request.post(`/api/projects/${projectId}/directions/${direction}/resume`, {
      data: {},
      headers: { 'X-XSRF-TOKEN': await xsrfToken(viewerPage) },
    });
    expect(forbidden.status()).toBe(403);
    await viewerContext.close();

    // Resume: the same run carries on with step 3; steps 1 and 2 do not run again.
    await project.resumeButton.click();
    await expect(project.pausedCallout).toHaveCount(0);
    await expect(project.projectStatus).toHaveText('Running');
    await expect(project.logLines.filter({ hasText: 'Resumed by quinntynebrown' })).toHaveCount(1);
    await expect(project.stageStatus('Bootstrap')).toHaveText('Succeeded', { timeout: 60_000 });

    const bootstrapSteps = (await project.events())
      .filter((e) => e.type === 'StepStarted' && e.payload['stage'] === 0)
      .map((e) => e.payload['name']);
    expect(bootstrapSteps, 'each Bootstrap step ran once, in order').toEqual([
      'Prepare workspace',
      'Run Bootstrap',
      'Commit artifacts',
    ]);
  });
});
