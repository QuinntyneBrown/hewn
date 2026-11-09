// Acceptance Test
// Traces to: L2-052, L2-053
// Description: Every model call a worker reports is costed against its direction; spend climbs live on the project, a warning toast arrives at 80% and the direction pauses with "Budget reached" at 100%

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { startWorkers } from '../../support/workers';

const idea = 'A web app for small accounting teams to reconcile statements.';

/** Runs whatever earlier suites left queued with fast real workers, so this spec's runs start at once. */
async function drainQueue(page: Page): Promise<void> {
  const stop = startWorkers(3, 50);
  try {
    await expect
      .poll(
        async () => {
          const projects = (await (await page.request.get('/api/projects')).json()) as { status: string }[];
          return projects.filter((p) => p.status === 'Running').length;
        },
        { timeout: 180_000, intervals: [1_000] },
      )
      .toBe(0);
  } finally {
    await stop();
  }
}

test.describe('Limit spending', () => {
  test.describe.configure({ timeout: 240_000 });

  let stopWorkers: (() => Promise<void>) | null = null;

  test.afterEach(async () => {
    await stopWorkers?.();
    stopWorkers = null;
  });

  test('spend climbs live, warns at 80% and pauses the direction at 100% after the current call', async ({
    page,
    newDirection,
    project,
  }) => {
    await signIn(page, 'quinntynebrown');
    await drainQueue(page);
    // Each scripted call is 100k input and 10k output tokens on Opus: $0.60. A $10 budget warns on call 14
    // ($8.40) and stops on call 17 ($10.20), during the second stage.
    stopWorkers = startWorkers(1, 1500, { executor: 'scripted', logLines: 10, modelCalls: 10, callTokens: 100_000 });
    const name = uniqueName('Budget');
    await newDirection.open();
    await newDirection.fill({ name, idea, budget: '10.00' });
    await newDirection.submit();

    await expect(project.spendMeter).toHaveAttribute('aria-valuetext', /^\$[1-7]\.\d0 of \$10\.00 budget$/, {
      timeout: 30_000,
    });
    await expect(project.spendMeter).not.toHaveClass(/meter--warn/);

    const warning = project.toasts.filter({ hasText: `${name} at 80% of budget` });
    await expect(warning).toBeVisible({ timeout: 30_000 });
    await expect(warning).toContainText('$8.40 of $10.00. It pauses at $10.00.');
    await expect(project.spendMeter).toHaveClass(/meter--warn/);

    await expect(project.budgetReachedCallout).toBeVisible({ timeout: 30_000 });
    await expect(project.budgetReachedCallout).toContainText(
      'Spend hit $10.20 of $10.00 after the current model call.',
    );
    await expect(project.projectStatus).toHaveText('Paused');
    await expect(project.spendLabel).toContainText('$10.20 of $10.00');
    await expect(project.stageStatus('Idea')).toHaveText('Paused');
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(
      axe.violations.map((v) => v.id),
      'the paused page has no axe-core violations',
    ).toEqual([]);

    const events = await project.events();
    const spend = events.filter((e) => e.type === 'SpendUpdated');
    expect(spend).toHaveLength(17);
    expect(spend[0]!.payload).toMatchObject({
      model: 'claude-opus-5-5',
      inputTokens: 100_000,
      outputTokens: 10_000,
      costUsd: 0.6,
    });
    expect(events.filter((e) => e.type === 'BudgetWarning')).toHaveLength(1);
    expect(
      events.find((e) => e.type === 'DirectionChanged' && e.payload['status'] === 'Paused')?.payload,
    ).toMatchObject({
      pauseReason: 'Budget reached',
    });

    // Nothing more runs: no further call is costed while the direction stays Paused.
    await page.waitForTimeout(5_000);
    expect((await project.events()).filter((e) => e.type === 'SpendUpdated')).toHaveLength(17);
  });
});
