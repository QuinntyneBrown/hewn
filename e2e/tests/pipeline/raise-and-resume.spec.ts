// Acceptance Test
// Traces to: L2-053, L2-029
// Description: On a direction Paused with "Budget reached", an Owner raises the budget above the spend and the direction resumes from its next step with spend continuing live; a budget at or below the spend is refused inline; a Viewer sees no control and the API answers 403

import AxeBuilder from '@axe-core/playwright';
import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { ProjectPage } from '../../pages/project.page';
import { compare, mockRegion, region } from '../../support/mocks';
import { drainQueue, xsrfToken } from '../../support/queue';
import { startWorkers } from '../../support/workers';

const idea = 'A web app for small accounting teams to reconcile statements.';

test.describe('Raise budget and resume', () => {
  test.describe.configure({ timeout: 240_000 });

  let stopWorkers: (() => Promise<void>) | null = null;

  test.afterEach(async () => {
    await stopWorkers?.();
    stopWorkers = null;
  });

  test('an Owner raises a reached budget and the direction resumes from its next step, with spend going on live', async ({
    page,
    browser,
    newDirection,
    project,
  }) => {
    await signIn(page, 'quinntynebrown');
    await drainQueue(page);
    // Each scripted call is $0.60: a $10 budget stops on call 17, in Idea's main step.
    stopWorkers = startWorkers(1, 1500, { executor: 'scripted', logLines: 10, modelCalls: 10, callTokens: 100_000 });
    const name = uniqueName('Raise');
    await newDirection.open();
    await newDirection.fill({ name, idea, budget: '10.00' });
    await newDirection.submit();
    await expect(project.budgetReachedCallout).toBeVisible({ timeout: 60_000 });
    await expect(project.calloutNewBudget).toHaveValue('110.00');
    const projectUrl = page.url();

    // A Viewer sees the pause, but no control, and the API refuses them.
    const viewerContext = await browser.newContext();
    const viewerPage = await viewerContext.newPage();
    await signIn(viewerPage, 'ada');
    const viewer = new ProjectPage(viewerPage);
    await viewerPage.goto(projectUrl);
    await expect(viewer.budgetReachedCallout).toBeVisible();
    await expect(viewer.raiseBudget).toHaveCount(0);
    const projectId = new URL(projectUrl).pathname.split('/').at(-1)!;
    const directionId = (
      (await (await viewerPage.request.get(`/api/projects/${projectId}`)).json()) as {
        directions: { id: string }[];
      }
    ).directions[0]!.id;
    const forbidden = await viewerPage.request.post(
      `/api/projects/${projectId}/directions/${directionId}/raise-and-resume`,
      { data: { budgetUsd: 50, currentBudgetUsd: 10 }, headers: { 'X-XSRF-TOKEN': await xsrfToken(viewerPage) } },
    );
    expect(forbidden.status()).toBe(403);
    await viewerContext.close();

    // A budget at or below the spend is refused inline, and nothing changes.
    await project.calloutNewBudget.fill('10.00');
    await project.raiseBudget.click();
    await expect(project.raiseDialog).toBeVisible();
    await expect(project.dialogBudget).toBeFocused();
    await project.dialogConfirm.click();
    await expect(project.dialogBudgetError).toHaveText(/New budget must be more than the \$10\.20 already spent\./);
    await expect(project.dialogBudget).toHaveAttribute('aria-invalid', 'true');
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(
      axe.violations.map((v) => v.id),
      'the dialog has no axe-core violations',
    ).toEqual([]);
    // The mock shows the buttons at rest; the one just pressed still has focus and the pointer.
    await project.restInDialog();
    const footer = compare(
      await region(project.dialogFooter),
      await mockRegion(page, 'dialogs/raise-budget/default.html', '.dialog__footer'),
    );
    // A 400x41 region: the primary button's anti-aliased edge alone is 2% of it at a different sub-pixel position.
    expect(footer.ratio, 'the dialog footer differs from the mock').toBeLessThan(0.03);
    await project.dialogCancel.click();
    await expect(project.raiseDialog).toHaveCount(0);
    await expect(project.projectStatus).toHaveText('Paused');
    const before = (await project.events()).length;

    // Raise to $20: the direction resumes, carries on from the step after its checkpoint, and spend climbs again.
    await project.raiseBudget.click();
    await project.dialogBudget.fill('20.00');
    await project.dialogConfirm.click();
    await expect(project.raiseDialog).toHaveCount(0);
    await expect(project.budgetReachedCallout).toHaveCount(0);
    await expect(project.projectStatus).toHaveText('Running');
    await expect(project.spendLabel).toContainText('of $20.00');
    await expect(project.stageStatus('Idea')).toHaveText('Succeeded', { timeout: 60_000 });
    await expect
      .poll(async () => Number((await project.spendMeter.getAttribute('aria-valuenow')) ?? 0), { timeout: 30_000 })
      .toBeGreaterThan(10.2);

    const after = (await project.events()).slice(before);
    expect(after[0]).toMatchObject({ type: 'BudgetRaised', payload: { budgetUsd: 20, spendUsd: 10.2 } });
    const firstStep = after.find((e) => e.type === 'StepStarted' && e.payload['stage'] === 1);
    expect(firstStep?.payload['name'], 'Idea carries on after its checkpoint, not from its first step').toBe(
      'Run Idea',
    );
  });
});
