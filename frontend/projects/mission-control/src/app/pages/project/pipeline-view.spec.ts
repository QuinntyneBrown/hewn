import { describe, expect, it } from 'vitest';
import type { StageStatus } from '@hewn/api';
import {
  formatDuration,
  headerStatus,
  directionTitle,
  featureOutcome,
  logWindow,
  mergeLines,
  selectedStage,
  spendView,
  budgetWarningToast,
  stageNotice,
} from './pipeline-view';

describe('formatDuration', () => {
  it('shows a dash for a stage that has not started', () => {
    expect(formatDuration(null, null, 0)).toBe('—');
  });

  it('formats like the mocks: m:ss under an hour, h:mm:ss above', () => {
    const start = '2026-11-08T10:00:00Z';
    expect(formatDuration(start, '2026-11-08T10:00:41Z', 0)).toBe('0:41');
    expect(formatDuration(start, '2026-11-08T10:48:30Z', 0)).toBe('48:30');
    expect(formatDuration(start, '2026-11-08T13:12:48Z', 0)).toBe('3:12:48');
  });

  it('counts a running stage up to now', () => {
    expect(formatDuration('2026-11-08T10:00:00Z', null, Date.parse('2026-11-08T10:01:05Z'))).toBe(
      '1:05',
    );
  });
});

describe('headerStatus', () => {
  it('follows the direction: Running while queued or running, Complete when done', () => {
    expect(headerStatus('Running', 'Queued')).toBe('Running');
    expect(headerStatus('Running', 'Running')).toBe('Running');
    expect(headerStatus('Idle', 'Complete')).toBe('Complete');
    expect(headerStatus('Paused', 'Paused')).toBe('Paused');
    expect(headerStatus('Cancelled', 'Cancelled')).toBe('Cancelled');
  });

  it('shows Blocked whenever the project is blocked', () => {
    expect(headerStatus('Blocked', 'Running')).toBe('Blocked');
  });

  it('falls back to the project status without a direction', () => {
    expect(headerStatus('Idle', null)).toBe('Idle');
  });
});

describe('directionTitle', () => {
  it('takes the first clause of the first sentence', () => {
    expect(directionTitle('Add a CSV export of the shift report, one row per shift. More.')).toBe(
      'Add a CSV export of the shift report',
    );
    expect(directionTitle('Export a reconciled period as PDF.')).toBe(
      'Export a reconciled period as PDF',
    );
  });
});

describe('featureOutcome', () => {
  it('names the skipped design stages and the recorded reason when the UI does not change', () => {
    expect(featureOutcome('Northwind Ops', false, 'The feature adds no screen or state')).toBe(
      'Bootstrap, stack and scaffold were skipped. Designs and design system were skipped too: The feature adds no screen or state. Northwind Ops is Idle until the next direction.',
    );
  });

  it('mentions only the always-skipped stages when the UI changes', () => {
    expect(featureOutcome('Northwind Ops', true, 'It adds a page.')).toBe(
      'Bootstrap, stack and scaffold were skipped. Northwind Ops is Idle until the next direction.',
    );
  });
});

describe('selectedStage', () => {
  const stages = (statuses: string[]) =>
    statuses.map(
      (status, number) => ({ number, status }) as { number: number; status: StageStatus },
    );

  it('uses the stage the user asked for when it exists', () => {
    expect(selectedStage(stages(['Succeeded', 'Running', 'Pending']), '0')).toBe(0);
  });

  it('otherwise follows the running stage', () => {
    expect(selectedStage(stages(['Succeeded', 'Running', 'Pending']), undefined)).toBe(1);
    expect(selectedStage(stages(['Succeeded', 'Running', 'Pending']), '42')).toBe(1);
  });

  it('falls back to the first pending stage, then the last stage', () => {
    expect(selectedStage(stages(['Succeeded', 'Pending', 'Pending']), undefined)).toBe(1);
    expect(selectedStage(stages(['Succeeded', 'Skipped', 'Succeeded']), undefined)).toBe(2);
  });
});

describe('logWindow', () => {
  it('renders every line of a log of 500 lines or fewer', () => {
    expect(logWindow(480, 0, 400, 20)).toEqual({ start: 0, end: 480 });
  });

  it('renders no more than 500 lines of a long log, around what is in view', () => {
    const w = logWindow(6000, 60_000, 460, 20);
    expect(w.end - w.start).toBeLessThanOrEqual(500);
    expect(w.start).toBeLessThanOrEqual(3000);
    expect(w.end).toBeGreaterThanOrEqual(3000 + 460 / 20);
  });

  it('ends the window at the newest line while following, whatever the row height', () => {
    expect(logWindow(6000, 0, 460, 20, true).end).toBe(6000);
  });

  it('keeps the window inside the log at its end', () => {
    const w = logWindow(6000, 6000 * 20 - 460, 460, 20);
    expect(w.end).toBe(6000);
    expect(w.end - w.start).toBeLessThanOrEqual(500);
  });
});

describe('stageNotice', () => {
  it('says a queued direction is waiting for a worker at its first stage', () => {
    expect(stageNotice({ number: 0, name: 'Bootstrap', status: 'Pending' }, 0)).toEqual({
      title: 'Waiting for a worker',
      text: 'The direction is queued. Stage 0 starts as soon as a worker leases it, usually within 2 seconds. Nothing to do here.',
    });
  });

  it('says a later pending stage starts after the one before it', () => {
    expect(stageNotice({ number: 5, name: 'Requirements', status: 'Pending' }, 1)?.text).toBe(
      'Stage 5 starts when stage 4 succeeds. Nothing to do here.',
    );
  });

  it('says a skipped stage does not run, and nothing for a stage with runs', () => {
    expect(stageNotice({ number: 4, name: 'Stack', status: 'Skipped' }, 1)?.title).toBe('Skipped');
    expect(stageNotice({ number: 1, name: 'Idea', status: 'Succeeded' }, 1)).toBeNull();
  });
});

describe('mergeLines', () => {
  const lines = (...numbers: number[]) =>
    numbers.map((line) => ({
      line,
      at: '2026-11-09T10:00:00Z',
      level: 'info',
      text: `line ${line}`,
    }));

  it('appends lines that come after the last one', () => {
    expect(mergeLines(lines(1, 2), lines(3, 4)).map((l) => l.line)).toEqual([1, 2, 3, 4]);
  });

  it('keeps each line once and in order when a page arrives after newer live lines', () => {
    expect(mergeLines(lines(5, 6), lines(1, 2, 3, 4, 5)).map((l) => l.line)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
  });

  it('returns the same array when nothing is new', () => {
    const existing = lines(1, 2);
    expect(mergeLines(existing, lines(2))).toBe(existing);
  });
});

describe('spendView', () => {
  it('shows spend of budget like the mock, with the bar at the share spent', () => {
    expect(spendView(184.2, 400, false, null)).toEqual({
      spent: '$184.20',
      budget: '$400.00',
      percent: 46,
      warn: false,
      text: '$184.20 of $400.00 budget',
    });
  });

  it('turns to warning once warned, and stays within 100% when spend passes the budget', () => {
    expect(spendView(320, 400, true, null)).toMatchObject({ percent: 80, warn: true });
    expect(spendView(412.5, 400, true, 'Budget reached')).toMatchObject({
      percent: 100,
      warn: true,
    });
  });

  it('formats thousands like the mocks', () => {
    expect(spendView(1234.5, 10000, false, null).budget).toBe('$10,000.00');
  });
});

describe('budgetWarningToast', () => {
  it('reads like the live toast mock', () => {
    expect(budgetWarningToast('Kiln Booking', 200, 250)).toEqual({
      tone: 'warn',
      title: 'Kiln Booking at 80% of budget',
      text: '$200.00 of $250.00. It pauses at $250.00.',
    });
  });
});
