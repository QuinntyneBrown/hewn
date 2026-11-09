import { describe, expect, it } from 'vitest';
import {
  canCancel,
  cancelFailure,
  cancelledBody,
  cancelledTitle,
  controlFailure,
  directionControl,
  notStopped,
  pausedTitle,
} from './direction-controls';

const running = { status: 'Running', pauseReason: null, pauseRequested: false } as const;

describe('directionControl', () => {
  it('offers Pause on a running direction', () => {
    expect(directionControl(running)).toBe('pause');
  });

  it('shows Pausing while the step in progress finishes', () => {
    expect(directionControl({ ...running, pauseRequested: true })).toBe('pausing');
  });

  it('offers Resume on a direction an Owner paused', () => {
    expect(
      directionControl({
        status: 'Paused',
        pauseReason: 'Paused by an Owner',
        pauseRequested: false,
      }),
    ).toBe('resume');
  });

  it('offers neither on a direction paused at its budget, which Raise and resume continues', () => {
    expect(
      directionControl({ status: 'Paused', pauseReason: 'Budget reached', pauseRequested: false }),
    ).toBeNull();
  });

  it('offers neither on a queued, complete or failed direction', () => {
    for (const status of ['Queued', 'Complete', 'Failed', 'Cancelled']) {
      expect(directionControl({ status, pauseReason: null, pauseRequested: false })).toBeNull();
    }
  });
});

describe('pausedTitle', () => {
  it('names who paused and when, as the mock does', () => {
    expect(pausedTitle('quinntynebrown', '2026-11-09T14:29:40Z', 'UTC')).toBe(
      'Paused by quinntynebrown at 14:29',
    );
  });

  it('falls back when the pause predates who and when', () => {
    expect(pausedTitle(null, null)).toBe('Paused');
  });
});

describe('controlFailure', () => {
  it('says what to do when the direction changed meanwhile', () => {
    expect(controlFailure('pause', 409)).toBe(
      'Pause wasn’t applied: the direction changed a moment ago. The page shows where it is now.',
    );
  });

  it('says nothing changed when the request failed', () => {
    expect(controlFailure('resume', 0)).toBe(
      'Resume didn’t reach Hewn (no response). The direction is unchanged; try again.',
    );
    expect(controlFailure('pause', 500)).toBe(
      'Pause didn’t reach Hewn (500). The direction is unchanged; try again.',
    );
  });
});

describe('cancel', () => {
  it('is offered on a queued, running or paused direction, never on a finished one', () => {
    expect(['Queued', 'Running', 'Paused'].map((status) => canCancel({ status }))).toEqual([
      true,
      true,
      true,
    ]);
    expect(['Complete', 'Cancelled'].map((status) => canCancel({ status }))).toEqual([
      false,
      false,
    ]);
  });

  it('titles the cancelled callout with who and when', () => {
    expect(cancelledTitle('quinntynebrown', '2026-11-08T17:01:36Z', 'UTC')).toBe(
      'Cancelled by quinntynebrown on 8 Nov at 17:01',
    );
  });

  it('says how fast the run stopped and which pull requests were labelled', () => {
    expect(cancelledBody(4, [9])).toBe(
      'The active run stopped within 4 seconds. Pull request #9 is open and labelled hewn:cancelled. Merged work is kept. Submit a new direction to continue.',
    );
    expect(cancelledBody(1, [9, 12])).toBe(
      'The active run stopped within 1 second. Pull requests #9 and #12 are open and labelled hewn:cancelled. Merged work is kept. Submit a new direction to continue.',
    );
    expect(cancelledBody(null, [])).toBe(
      'No run was in progress. Merged work is kept. Submit a new direction to continue.',
    );
  });

  it('names the worker that did not answer', () => {
    expect(notStopped('quinn-mbp.local')).toBe(
      'quinn-mbp.local stopped answering. The lease expires in 60 s and the run won’t resume; try again to cancel now.',
    );
    expect(notStopped(null)).toBe(
      'The worker stopped answering. The lease expires in 60 s and the run won’t resume; try again to cancel now.',
    );
  });

  it('explains a refused or failed Cancel', () => {
    expect(cancelFailure(409)).toBe(
      'The direction already finished, so there was nothing to cancel.',
    );
    expect(cancelFailure(0)).toBe(
      'Cancel didn’t reach Hewn (no response). Nothing changed; try again.',
    );
  });
});
