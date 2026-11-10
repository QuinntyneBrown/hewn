import { IncrementCheck, IncrementDetail } from '@hewn/api';
import { checkLine, duration, incrementTimeline, pullRequestMeta } from './increment-view';

const time = (iso: string | null) => (iso ? iso.slice(11, 16) : '');

function detail(fields: Partial<IncrementDetail> = {}): IncrementDetail {
  return {
    directionId: 'd1',
    number: 7,
    title: 'Reconcile a card statement',
    journey: 4,
    l2Ids: ['L2-018', 'L2-019'],
    estimateDays: 2.5,
    branch: 'feature/reconcile-a-card-statement',
    status: 'InProgress',
    startedAt: '2026-11-09T14:01:00Z',
    testCount: 4,
    redFailing: 4,
    redPassing: 0,
    testsPassedEarly: false,
    testsCommittedAt: '2026-11-09T14:03:00Z',
    iterations: 3,
    maxIterations: 10,
    greenAfter: null,
    greenAt: null,
    video: null,
    videoNote: null,
    videoAt: null,
    failingTests: [],
    movedOnTo: null,
    pullRequestOpenedAt: null,
    finishedAt: null,
    pullRequest: null,
    checks: [],
    ...fields,
  };
}

const steps = (d: IncrementDetail) =>
  incrementTimeline(d, time).map((s) => [s.title, s.status, s.time, s.detail]);

const check = (fields: Partial<IncrementCheck>): IncrementCheck => ({
  name: 'backend',
  status: 'completed',
  conclusion: 'success',
  startedAt: null,
  completedAt: null,
  durationSeconds: null,
  ...fields,
});

describe('incrementTimeline', () => {
  it('records red, then shows the iteration under way (L2-021 AC3, L2-022)', () => {
    expect(steps(detail())).toEqual([
      [
        'Failing tests committed',
        'Succeeded',
        '14:03',
        '4 acceptance tests · traces to L2-018, L2-019',
      ],
      ['Red recorded', 'Failed', '14:03', '4 failing, 0 passing'],
      [
        'Implementing · iteration 3 of 10',
        'Running',
        'now',
        'Backend, frontend, increment tests and full e2e pass in the worker',
      ],
      ['Video', 'Pending', '', 'Records when every test is green'],
      ['Pull request', 'Pending', '', 'Opens after the video step'],
      ['Squash-merge', 'Pending', '', 'Automatic when checks pass'],
    ]);
  });

  it('flags tests that passed before implementation', () => {
    const [committed, early] = steps(
      detail({ redFailing: 0, redPassing: 4, testsPassedEarly: true }),
    );
    expect(committed![0]).toBe('Acceptance tests committed');
    expect(early).toEqual([
      'Tests passed before implementation',
      'Skipped',
      '14:03',
      '4 of 4 passed on the test commit; flagged in the PR Notes',
    ]);
  });

  it('follows green, the video and the pull request to the squash-merge (L2-024, L2-025)', () => {
    const merged = detail({
      status: 'Merged',
      greenAfter: 3,
      greenAt: '2026-11-09T14:31:00Z',
      video: 'Recorded',
      videoNote: 'docs/videos/reconcile-a-card-statement/',
      videoAt: '2026-11-09T14:36:00Z',
      pullRequestOpenedAt: '2026-11-09T14:37:00Z',
      finishedAt: '2026-11-09T14:44:00Z',
      pullRequest: {
        number: 28,
        url: 'https://github.com/hewn-builds/ledgerline/pull/28',
        title: 'Reconcile a card statement (journey 4, L2-018, L2-019)',
        state: 'merged',
        additions: 612,
        deletions: 48,
        changedFiles: 14,
        sections: [],
        attribution: null,
      },
      checks: [check({})],
    });

    expect(steps(merged).slice(2)).toEqual([
      [
        'Green after 3 iterations',
        'Succeeded',
        '14:31',
        'Backend, frontend, increment tests and full e2e pass in the worker',
      ],
      ['Video', 'Succeeded', '14:36', 'docs/videos/reconcile-a-card-statement/'],
      ['Pull request #28', 'Succeeded', '14:37', 'All required checks passed'],
      ['Squash-merge', 'Merged', '14:44', 'Branch deleted'],
    ]);
  });

  it('shows the pull request waiting on checks, or a failed check as a failed iteration (L2-025 AC3)', () => {
    const open = detail({
      greenAfter: 1,
      greenAt: '2026-11-09T14:31:00Z',
      video: 'Failed',
      videoNote: 'The recording timed out',
      videoAt: '2026-11-09T14:36:00Z',
      pullRequestOpenedAt: '2026-11-09T14:37:00Z',
      pullRequest: { ...merged().pullRequest!, state: 'open' },
      checks: [check({ status: 'in_progress', conclusion: null })],
    });
    expect(steps(open).slice(3, 5)).toEqual([
      [
        'Video failed',
        'Failed',
        '14:36',
        'The recording timed out · noted in the PR, never blocks it',
      ],
      ['Pull request #28', 'Running', '14:37', 'Waiting on required checks'],
    ]);

    const failing = { ...open, checks: [check({ name: 'e2e', conclusion: 'failure' })] };
    expect(steps(failing)[4]).toEqual([
      'Pull request #28',
      'Failed',
      '14:37',
      'e2e failed · counted as a failed iteration',
    ]);
  });

  it('blocks after the cap with the failing tests and what Hewn moved on to (L2-022 AC2)', () => {
    const blocked = detail({
      status: 'Blocked',
      iterations: 10,
      failingTests: ['matches-across-midnight'],
      movedOnTo: 8,
      finishedAt: '2026-11-09T15:48:00Z',
    });
    expect(steps(blocked).slice(2)).toEqual([
      [
        'Blocked after 10 iterations',
        'Blocked',
        '15:48',
        '1 of 4 failing: matches-across-midnight. Moved on to increment 8.',
      ],
      ['Video', 'Pending', '', 'Waits for green'],
      ['Pull request', 'Pending', '', 'Not opened'],
      ['Squash-merge', 'Pending', '', 'Not reached'],
    ]);
    expect(steps({ ...blocked, movedOnTo: null })[2]![3]).toBe(
      '1 of 4 failing: matches-across-midnight. Every increment left depends on it.',
    );
  });

  it('waits for the test commit before anything is recorded', () => {
    const fresh = detail({
      testCount: null,
      redFailing: null,
      redPassing: null,
      testsCommittedAt: null,
      iterations: 0,
    });
    expect(steps(fresh).slice(0, 3)).toEqual([
      [
        'Writing acceptance tests',
        'Running',
        'now',
        'Only test files, each traced to L2-018, L2-019',
      ],
      ['Red', 'Pending', '', 'The new tests must fail before any implementation'],
      ['Implement until green', 'Pending', '', 'Up to 10 implement-and-test iterations'],
    ]);
  });
});

describe('the pull request rail', () => {
  it('describes each required check with its status, never by colour alone', () => {
    expect(checkLine(check({ durationSeconds: 108 }))).toEqual({
      status: 'Succeeded',
      detail: 'passed · 1m 48s',
    });
    expect(checkLine(check({ conclusion: 'failure', durationSeconds: 52 }))).toEqual({
      status: 'Failed',
      detail: 'failed · 52s',
    });
    expect(checkLine(check({ status: 'in_progress', conclusion: null }))).toEqual({
      status: 'Running',
      detail: 'running',
    });
    expect(checkLine(check({ status: 'queued', conclusion: null }))).toEqual({
      status: 'Pending',
      detail: 'queued',
    });
    expect(checkLine(check({ conclusion: 'skipped' }))).toEqual({
      status: 'Skipped',
      detail: 'skipped',
    });
  });

  it('summarises the pull request as GitHub does', () => {
    const pr = merged().pullRequest!;
    expect(pullRequestMeta(pr)).toBe('#28 · squash-merged · +612 −48 · 14 files');
    expect(pullRequestMeta({ ...pr, state: 'open', changedFiles: 1 })).toBe(
      '#28 · open · +612 −48 · 1 file',
    );
    expect(duration(108)).toBe('1m 48s');
    expect(duration(45)).toBe('45s');
    expect(duration(120)).toBe('2m');
  });
});

function merged(): IncrementDetail {
  return detail({
    status: 'Merged',
    pullRequest: {
      number: 28,
      url: 'https://github.com/hewn-builds/ledgerline/pull/28',
      title: 'Reconcile a card statement (journey 4, L2-018, L2-019)',
      state: 'merged',
      additions: 612,
      deletions: 48,
      changedFiles: 14,
      sections: [],
      attribution: null,
    },
  });
}
