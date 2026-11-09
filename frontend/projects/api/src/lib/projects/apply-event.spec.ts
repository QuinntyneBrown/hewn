import { describe, expect, it } from 'vitest';
import { ProjectEvent } from '../live/project-event';
import { applyEvent } from './apply-event';
import { Project } from './models';

const project = (): Project => ({
  id: 'p',
  name: 'Ledgerline',
  idea: 'x',
  stackPreference: null,
  repository: null,
  status: 'Running',
  createdAt: '2026-11-08T00:00:00Z',
  lastSequence: 1,
  spendUsd: 0,
  directions: [
    {
      id: 'd',
      kind: 'Product',
      status: 'Queued',
      idea: 'x',
      budgetUsd: 300,
      submittedBy: 'q',
      submittedAt: '2026-11-08T00:00:00Z',
      completedAt: null,
      spendUsd: 0,
      budgetWarned: false,
      pauseReason: null,
      pauseRequested: false,
      pausedBy: null,
      pausedAt: null,
      cancelledBy: null,
      cancelledAt: null,
      stoppedWithinSeconds: null,
      awaitingStop: false,
      labelledPullRequests: [],
      stages: [0, 1].map((number) => ({
        number,
        name: `S${number}`,
        status: 'Pending' as const,
        startedAt: null,
        endedAt: null,
      })),
    },
  ],
});

const event = (sequence: number, type: string, payload: Record<string, unknown>): ProjectEvent => ({
  projectId: 'p',
  sequence,
  type,
  payload,
  occurredAt: '2026-11-08T00:00:01Z',
});

describe('applyEvent', () => {
  it('updates a stage from StageChanged and advances lastSequence', () => {
    const next = applyEvent(
      project(),
      event(2, 'StageChanged', {
        directionId: 'd',
        stage: 0,
        status: 'Running',
        startedAt: 'T0',
        endedAt: null,
      }),
    );

    expect(next.directions[0]!.stages[0]).toMatchObject({ status: 'Running', startedAt: 'T0' });
    expect(next.lastSequence).toBe(2);
  });

  it('updates the direction and the project', () => {
    let next = applyEvent(
      project(),
      event(2, 'DirectionChanged', { directionId: 'd', status: 'Complete', completedAt: 'T9' }),
    );
    next = applyEvent(next, event(3, 'ProjectChanged', { status: 'Idle' }));

    expect(next.directions[0]).toMatchObject({ status: 'Complete', completedAt: 'T9' });
    expect(next.status).toBe('Idle');
  });

  it('records the repository stage 0 created', () => {
    const next = applyEvent(
      project(),
      event(2, 'ProjectChanged', { status: 'Running', repository: 'hewn-builds/ledgerline' }),
    );

    expect(next.repository).toBe('hewn-builds/ledgerline');
  });

  it('ignores an event it has already applied', () => {
    const before = { ...project(), lastSequence: 5 };

    expect(applyEvent(before, event(5, 'ProjectChanged', { status: 'Idle' }))).toBe(before);
  });

  it('adds a direction queued after the snapshot, once', () => {
    const queued = {
      ...project().directions[0]!,
      id: 'f',
      kind: 'Feature' as const,
      idea: 'CSV export',
    };
    const once = applyEvent(
      project(),
      event(2, 'DirectionQueued', { directionId: 'f', direction: queued }),
    );
    const twice = applyEvent(
      once,
      event(3, 'DirectionQueued', { directionId: 'f', direction: queued }),
    );

    expect(twice.directions.map((d) => d.id)).toEqual(['d', 'f']);
    expect(twice.directions[1]!.kind).toBe('Feature');
  });

  it('records the UI change decision a feature direction reports', () => {
    const next = applyEvent(
      project(),
      event(2, 'DirectionScoped', {
        directionId: 'd',
        hasUiChange: false,
        uiDecision: 'No screen changes.',
      }),
    );

    expect(next.directions[0]).toMatchObject({
      hasUiChange: false,
      uiDecision: 'No screen changes.',
    });
  });

  it('shows the step a running stage started and its latest log line', () => {
    let next = applyEvent(
      project(),
      event(2, 'StepStarted', {
        directionId: 'd',
        stage: 1,
        runId: 'r1',
        step: 2,
        name: 'Write documents',
      }),
    );
    next = applyEvent(
      next,
      event(3, 'LogLines', {
        directionId: 'd',
        stage: 1,
        runId: 'r1',
        lines: [
          { line: 1, at: '2026-11-09T10:00:00Z', level: 'info', text: 'Checked out' },
          { line: 2, at: '2026-11-09T10:00:01Z', level: 'info', text: 'Wrote docs/brief.md' },
        ],
      }),
    );

    const stage = next.directions[0]!.stages[1]!;
    expect(stage.step).toBe('Write documents');
    expect(stage.latestLine).toBe('Wrote docs/brief.md');
    expect(stage.runId).toBe('r1');
    expect(next.directions[0]!.stages[0]!.step).toBeUndefined();
  });

  it('clears the live step and line when the stage changes status', () => {
    const running = applyEvent(
      project(),
      event(2, 'StepStarted', {
        directionId: 'd',
        stage: 0,
        runId: 'r0',
        step: 1,
        name: 'Check out',
      }),
    );

    const done = applyEvent(
      running,
      event(3, 'StageChanged', {
        directionId: 'd',
        stage: 0,
        status: 'Succeeded',
        startedAt: null,
        endedAt: null,
      }),
    );

    expect(done.directions[0]!.stages[0]!.step).toBeNull();
    expect(done.directions[0]!.stages[0]!.latestLine).toBeNull();
  });

  it('shows spend to date on the direction and project from SpendUpdated (L2-052 AC2)', () => {
    const next = applyEvent(
      project(),
      event(2, 'SpendUpdated', {
        directionId: 'd',
        directionSpendUsd: 184.2,
        projectSpendUsd: 190.5,
        budgetUsd: 300,
      }),
    );

    expect(next.spendUsd).toBe(190.5);
    expect(next.directions[0]).toMatchObject({ spendUsd: 184.2, budgetUsd: 300 });
  });

  it('marks the budget warned from BudgetWarning (L2-053 AC2)', () => {
    const next = applyEvent(
      project(),
      event(2, 'BudgetWarning', { directionId: 'd', spendUsd: 240, budgetUsd: 300 }),
    );

    expect(next.directions[0]).toMatchObject({ budgetWarned: true, spendUsd: 240 });
  });

  it('keeps why a direction paused from DirectionChanged (L2-053 AC3)', () => {
    const next = applyEvent(
      project(),
      event(2, 'DirectionChanged', {
        directionId: 'd',
        status: 'Paused',
        completedAt: null,
        pauseReason: 'Budget reached',
      }),
    );

    expect(next.directions[0]).toMatchObject({ status: 'Paused', pauseReason: 'Budget reached' });
  });

  it('takes the new budget and re-arms the 80% warning from BudgetRaised (L2-053 AC3)', () => {
    const warned = {
      ...project(),
      directions: [{ ...project().directions[0]!, budgetWarned: true }],
    };

    const next = applyEvent(
      warned,
      event(2, 'BudgetRaised', { directionId: 'd', budgetUsd: 350, spendUsd: 250 }),
    );

    expect(next.directions[0]).toMatchObject({
      budgetUsd: 350,
      spendUsd: 250,
      budgetWarned: false,
    });
  });

  it('shows Pausing from PauseRequested while the step in progress finishes (L2-029 AC1)', () => {
    const next = applyEvent(
      project(),
      event(2, 'PauseRequested', { directionId: 'd', requestedBy: 'quinntynebrown' }),
    );

    expect(next.directions[0]!.pauseRequested).toBe(true);
  });

  it('takes who paused and when from DirectionChanged, and clears them on Resume (L2-029 AC1, AC2)', () => {
    const paused = applyEvent(
      project(),
      event(2, 'DirectionChanged', {
        directionId: 'd',
        status: 'Paused',
        completedAt: null,
        pauseReason: 'Paused by an Owner',
        pauseRequested: false,
        pausedBy: 'quinntynebrown',
        pausedAt: '2026-11-09T14:29:40Z',
      }),
    );
    expect(paused.directions[0]).toMatchObject({
      status: 'Paused',
      pauseRequested: false,
      pausedBy: 'quinntynebrown',
      pausedAt: '2026-11-09T14:29:40Z',
    });

    const resumed = applyEvent(
      paused,
      event(3, 'DirectionChanged', {
        directionId: 'd',
        status: 'Running',
        completedAt: null,
        pauseReason: null,
      }),
    );
    expect(resumed.directions[0]).toMatchObject({
      status: 'Running',
      pausedBy: null,
      pausedAt: null,
    });
  });

  it('records who cancelled, how fast the run stopped and the labelled pull requests (L2-029 AC3)', () => {
    const cancelled = applyEvent(
      project(),
      event(2, 'DirectionChanged', {
        directionId: 'd',
        status: 'Cancelled',
        completedAt: null,
        pauseReason: null,
        cancelledBy: 'quinntynebrown',
        cancelledAt: '2026-11-08T17:01:36Z',
        stoppedWithinSeconds: 4,
        awaitingStop: false,
        labelledPullRequests: [9],
      }),
    );
    expect(cancelled.directions[0]).toMatchObject({
      status: 'Cancelled',
      cancelledBy: 'quinntynebrown',
      cancelledAt: '2026-11-08T17:01:36Z',
      stoppedWithinSeconds: 4,
      awaitingStop: false,
      labelledPullRequests: [9],
    });
  });
});
