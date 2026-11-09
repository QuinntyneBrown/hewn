import { describe, expect, it } from 'vitest';
import { canCancel } from './direction-controls';
import {
  blockedBody,
  blockedTitle,
  blockedToast,
  canRetryStage,
  retryCountdown,
  retryFailure,
  waitText,
} from './retry-stage';

const retry = {
  stage: 0,
  attempt: 2,
  maxAttempts: 4,
  notBefore: '2026-11-09T10:00:30Z',
  reason: 'Skills source unreachable',
};

describe('retryCountdown', () => {
  it('counts down to the next automatic retry (L2-006 AC1)', () => {
    expect(retryCountdown(retry, Date.parse('2026-11-09T10:00:06Z'))).toBe('Retry 1 of 3 in 0:24');
    expect(
      retryCountdown(
        { ...retry, attempt: 4, notBefore: '2026-11-09T10:10:00Z' },
        Date.parse('2026-11-09T10:00:00Z'),
      ),
    ).toBe('Retry 3 of 3 in 10:00');
  });

  it('says the retry is starting once its backoff has passed', () => {
    expect(retryCountdown(retry, Date.parse('2026-11-09T10:00:31Z'))).toBe('Retry 1 of 3 starting');
  });
});

describe('the Blocked callout', () => {
  it('reads as the mock does, with the backoff Hewn used', () => {
    expect(blockedTitle([30, 120, 600])).toBe('Stage failed after 3 retries');
    expect(
      blockedBody(
        'Validation failed: L2-014 has no Given/When/Then the brief can support',
        [30, 120, 600],
      ),
    ).toBe(
      'Validation failed: L2-014 has no Given/When/Then the brief can support. Retried after 30 s, 2 min and 10 min. Other projects keep running. The last 200 log lines are below.',
    );
  });

  it('does not double a full stop the reason already has', () => {
    expect(blockedBody('Disk full.', [2])).toBe(
      'Disk full. Retried after 2 s. Other projects keep running. The last 200 log lines are below.',
    );
  });

  it('writes waits as seconds, then minutes', () => {
    expect([30, 90, 120, 600].map(waitText)).toEqual(['30 s', '1 min 30 s', '2 min', '10 min']);
  });
});

describe('Retry stage', () => {
  it('is offered on a Blocked direction, which can also be cancelled', () => {
    expect(canRetryStage({ status: 'Blocked' })).toBe(true);
    expect(
      ['Running', 'Paused', 'Complete', 'Cancelled'].some((status) => canRetryStage({ status })),
    ).toBe(false);
    expect(canCancel({ status: 'Blocked' })).toBe(true);
  });

  it('explains a refused or failed retry', () => {
    expect(retryFailure(409)).toBe(
      'Retry stage wasn’t applied: the direction is no longer Blocked. The page shows where it is now.',
    );
    expect(retryFailure(0)).toBe(
      'Retry stage didn’t reach Hewn (no response). The direction is still Blocked; try again.',
    );
  });
});

describe('blockedToast', () => {
  it('names the project and stage, as the danger toast mock does (L2-006 AC2)', () => {
    expect(blockedToast('Parcel Post', 'Requirements', 3)).toEqual({
      tone: 'danger',
      title: 'Parcel Post is blocked',
      text: 'Requirements failed after 3 retries. Other projects keep running.',
    });
  });
});
