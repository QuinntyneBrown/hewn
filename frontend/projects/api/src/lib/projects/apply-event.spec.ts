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
});
