// Acceptance Test
// Traces to: L2-030, L2-031, L2-033, L2-047
// Description: Anyone who can see a project follows its stages live: step and latest line, a live log that holds when scrolled up, a selected stage's runs, log, artifacts and decisions, a virtualized long log and throttled announcements

import type { Page } from '@playwright/test';
import type { NewDirectionPage } from '../../pages/new-direction.page';
import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { startWorkers, type WorkerOptions } from '../../support/workers';

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

async function submit(newDirection: NewDirectionPage, prefix: string): Promise<string> {
  const name = uniqueName(prefix);
  await newDirection.open();
  await newDirection.fill({ name, idea });
  await newDirection.submit();
  return name;
}

test.describe('Monitor a direction', () => {
  test.describe.configure({ mode: 'serial', timeout: 240_000 });

  let stopWorkers: (() => Promise<void>) | null = null;

  async function workers(page: Page, stepMs: number, options: WorkerOptions): Promise<void> {
    await drainQueue(page);
    stopWorkers = startWorkers(1, stepMs, options);
  }

  test.afterEach(async () => {
    await stopWorkers?.();
    stopWorkers = null;
  });

  test('a running stage shows its step and latest log line, then turns Succeeded live as the next starts', async ({
    page,
    newDirection,
    project,
  }) => {
    await signIn(page, 'quinntynebrown');
    await workers(page, 1500, { executor: 'scripted', logLines: 10 });
    await submit(newDirection, 'Live stage');

    await expect(project.liveStep('Bootstrap')).toHaveText(/^(Prepare workspace|Run Bootstrap|Commit artifacts)$/, {
      timeout: 30_000,
    });
    await expect(project.liveLine('Bootstrap')).toHaveText(/^Bootstrap · line \d+ of 10$/, { timeout: 15_000 });
    await expect(project.stageStatus('Bootstrap')).toHaveText('Running');

    await expect(project.stageStatus('Bootstrap')).toHaveText('Succeeded', {
      timeout: 15_000,
    });
    await expect(project.stageStatus('Idea')).toHaveText('Running', {
      timeout: 10_000,
    });
    await expect(project.liveStep('Bootstrap')).toHaveCount(0);

    const sequences = (await project.events()).map((e) => (e as unknown as { sequence: number }).sequence);
    expect(sequences).toEqual(sequences.map((_, i) => i + 1));
    const types = new Set((await project.events()).map((e) => e.type));
    expect([...types]).toEqual(expect.arrayContaining(['StepStarted', 'LogLines', 'StageChanged']));
  });

  test('the live log follows new lines; scrolled up it holds and offers to jump to the latest', async ({
    page,
    newDirection,
    project,
  }) => {
    await signIn(page, 'quinntynebrown');
    await workers(page, 12_000, { executor: 'scripted', logLines: 240 });
    await submit(newDirection, 'Live log');

    // An idle worker polls every 15 s and the run's first step takes 12 s, so the lines can start nearly 30 s after
    // submitting; allow for that rather than for how fast they arrive.
    await expect.poll(() => project.logLines.count(), { timeout: 60_000 }).toBeGreaterThan(40);
    await expect.poll(async () => (await project.logPosition()).atEnd).toBe(true);

    await project.scrollLogTo(0);
    await expect(project.jumpToLatest).toBeVisible({ timeout: 10_000 });
    await expect(project.jumpToLatest).toHaveText(/\d+ new lines? — Jump to latest/);
    expect((await project.logPosition()).top).toBe(0);

    await project.jumpToLatest.click();
    await expect(project.jumpToLatest).toHaveCount(0);
    await expect.poll(async () => (await project.logPosition()).atEnd).toBe(true);
  });

  test('selecting a past stage shows its runs, log, artifacts and decisions', async ({
    page,
    newDirection,
    project,
  }) => {
    await signIn(page, 'quinntynebrown');
    await workers(page, 50, { executor: 'stages' });
    await submit(newDirection, 'Past stage');
    await expect(project.stageStatus('Idea')).toHaveText('Succeeded', {
      timeout: 60_000,
    });

    await project.selectStage('Idea');

    await expect(project.detailTitle).toHaveText(/1\s+Idea/);
    await expect(project.logLines.filter({ hasText: 'Question:' }).first()).toBeVisible();
    await project.tab('Runs').click();
    await expect(project.runRows).toHaveCount(1);
    await expect(project.runRows.first()).toContainText('Succeeded');
    await expect(project.runRows.first()).toContainText('e2e-worker-1');
    await project.tab('Artifacts').click();
    await expect(project.artifactPaths.filter({ hasText: 'docs/brief.md' })).toBeVisible();
    await project.tab('Decisions').click();
    await expect(project.decisionQuestions.first()).toBeVisible();

    // The tabs work from the keyboard, as the WAI-ARIA tabs pattern asks.
    await project.tab('Decisions').press('Home');
    await expect(project.tab('Log')).toBeFocused();
    await expect(project.tab('Log')).toHaveAttribute('aria-selected', 'true');
  });

  test('a log of more than 5,000 lines keeps no more than 500 line elements in the page', async ({
    page,
    newDirection,
    project,
  }) => {
    await signIn(page, 'quinntynebrown');
    await workers(page, 2000, { executor: 'scripted', logLines: 6000 });
    await submit(newDirection, 'Long log');
    await expect(project.stageStatus('Bootstrap')).toHaveText('Succeeded', {
      timeout: 90_000,
    });

    await project.selectStage('Bootstrap');

    await expect(project.logLines.last()).toContainText('Bootstrap · line 6000 of 6000', { timeout: 20_000 });
    expect(await project.logLines.count()).toBeLessThanOrEqual(500);
    await project.scrollLogTo(0);
    await expect(project.logLines.first()).toContainText('Bootstrap · line 1 of 6000');
    expect(await project.logLines.count()).toBeLessThanOrEqual(500);
  });

  test('stage changes are announced politely, at most once every 5 seconds', async ({
    page,
    newDirection,
    project,
  }) => {
    await signIn(page, 'quinntynebrown');
    await workers(page, 300, { executor: 'scripted' });
    await submit(newDirection, 'Announce');
    await project.pipeline.waitFor();
    await project.recordAnnouncements();

    await expect
      .poll(async () => (await project.announcements()).length, {
        timeout: 30_000,
      })
      .toBeGreaterThanOrEqual(3);

    await expect(project.announcer).toHaveAttribute('aria-live', 'polite');
    const times = (await project.announcements()).map((a) => a.at);
    for (let i = 1; i < times.length; i++) {
      expect(times[i]! - times[i - 1]!).toBeGreaterThanOrEqual(4_900);
    }
    expect((await project.announcements()).at(-1)!.text).toMatch(/^Stage \d+, [A-Za-z ]+, [A-Za-z]+$/);
  });
});
