/**
 * Increment 7 of docs/mocks/pages/increment/, "Reconcile a card statement", as GET /api/projects/{id}/increments/7
 * would return it in each of the mock's states. Times carry no zone, so they show as the mock's clock times.
 */
export type IncrementMockState = 'default' | 'implementing' | 'merged' | 'blocked' | 'green-first';

const pullRequest = (state: 'open' | 'merged') => ({
  number: 28,
  url: 'https://github.com/hewn-builds/ledgerline/pull/28',
  title: 'Reconcile a card statement (journey 4, L2-018, L2-019)',
  state,
  additions: 612,
  deletions: 48,
  changedFiles: 14,
  sections: [
    {
      heading: 'What',
      text: 'Match card transactions to statement lines with a ±$0.50 tolerance and account-time-zone dates.',
    },
    { heading: 'Design and decisions', text: 'Posting dates use the account’s time zone (decision a41c9e2).' },
    { heading: 'API', text: 'POST /api/statements/{id}/match-suggestions returns suggested receipt matches.' },
    { heading: 'Tests', text: '`npx playwright test` 152 passed, 4 of them new acceptance tests.' },
    { heading: 'Deferred', text: 'Multi-currency (L2-031, L2-032).' },
    { heading: 'Notes', text: 'Red recorded before implementation.' },
  ],
  attribution: 'Built by Hewn · direction 7 Nov · run-0412',
});

const check = (name: string, status: string, conclusion: string | null, durationSeconds: number | null = null) => ({
  name,
  status,
  conclusion,
  startedAt: null,
  completedAt: null,
  durationSeconds,
});

export function mockIncrement(state: IncrementMockState = 'default') {
  const base = {
    directionId: '00000000-0000-0000-0000-000000000007',
    number: 7,
    title: 'Reconcile a card statement',
    journey: 4,
    l2Ids: ['L2-018', 'L2-019'],
    estimateDays: 2.5,
    branch: 'feature/reconcile-card-statement',
    status: 'InProgress',
    startedAt: '2026-11-07T14:01:00',
    testCount: 4,
    redFailing: 4,
    redPassing: 0,
    testsPassedEarly: false,
    testsCommittedAt: '2026-11-07T14:03:00',
    iterations: 3,
    maxIterations: 10,
    greenAfter: 3,
    greenAt: '2026-11-07T14:31:00',
    video: 'Recorded',
    videoNote: '2:14, captioned',
    videoAt: '2026-11-07T14:36:00',
    failingTests: [] as string[],
    movedOnTo: null as number | null,
    pullRequestOpenedAt: '2026-11-07T14:37:00',
    finishedAt: null as string | null,
    pullRequest: pullRequest('open') as ReturnType<typeof pullRequest> | null,
    checks: [
      check('backend', 'completed', 'success', 108),
      check('e2e', 'in_progress', null),
      check('frontend', 'completed', 'success', 52),
    ],
  };
  switch (state) {
    case 'default':
      return base;
    case 'green-first':
      return { ...base, redFailing: 0, redPassing: 4, testsPassedEarly: true };
    case 'implementing':
      return {
        ...base,
        greenAfter: null,
        greenAt: null,
        video: null,
        videoNote: null,
        videoAt: null,
        pullRequestOpenedAt: null,
        pullRequest: null,
        checks: [],
      };
    case 'blocked':
      return {
        ...base,
        status: 'Blocked',
        iterations: 10,
        greenAfter: null,
        greenAt: null,
        video: null,
        videoNote: null,
        videoAt: null,
        failingTests: ['matches-across-midnight'],
        movedOnTo: 8,
        finishedAt: '2026-11-07T15:48:00',
        pullRequestOpenedAt: null,
        pullRequest: null,
        checks: [],
      };
    case 'merged':
      return {
        ...base,
        status: 'Merged',
        finishedAt: '2026-11-07T14:44:00',
        pullRequest: pullRequest('merged'),
        checks: [
          check('backend', 'completed', 'success', 108),
          check('e2e', 'completed', 'success', 250),
          check('frontend', 'completed', 'success', 52),
        ],
      };
  }
}
