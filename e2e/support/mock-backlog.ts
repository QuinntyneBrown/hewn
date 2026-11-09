/** The Backlog mock's own backlog (docs/mocks/pages/backlog/default.html), as GET /api/projects/{id}/backlog returns it. */
const increments: [number, string, number, string[], number, string, number | null][] = [
  [1, 'Sign in with Microsoft', 1, ['L2-001', 'L2-002'], 1.5, 'Merged', 14],
  [2, 'Connect a bank feed', 2, ['L2-006', 'L2-007'], 2.5, 'Merged', 17],
  [3, 'Import a CSV statement', 2, ['L2-008'], 2, 'Merged', 19],
  [4, 'Review unmatched transactions', 3, ['L2-011', 'L2-012'], 3, 'Merged', 22],
  [5, 'Match a receipt by photo', 3, ['L2-013', 'L2-014'], 2.5, 'Merged', 25],
  [6, 'Split a transaction', 3, ['L2-015'], 1, 'Merged', 27],
  [7, 'Reconcile a card statement', 4, ['L2-018', 'L2-019'], 2.5, 'InProgress', null],
  [8, 'Close a period', 4, ['L2-020', 'L2-021'], 2, 'Queued', null],
  [9, 'Lock a closed period', 4, ['L2-022'], 1, 'Queued', null],
  [10, 'Export to the general ledger', 5, ['L2-024', 'L2-025'], 3, 'Queued', null],
  [11, 'Invite a reviewer', 6, ['L2-027'], 1.5, 'Queued', null],
  [12, 'Audit trail per period', 6, ['L2-029'], 2, 'Queued', null],
];

export interface MockBacklogOptions {
  /** Increment 7 is Blocked after 10 iterations, as blocked-increment.html shows it. */
  blocked?: boolean;
}

export function mockBacklog({ blocked = false }: MockBacklogOptions = {}) {
  return {
    directionId: '00000000-0000-4000-8000-000000000001',
    increments: increments.map(([number, title, journey, l2Ids, estimateDays, status, pr]) => ({
      number,
      title,
      journey,
      l2Ids,
      estimateDays,
      dependsOn: number === 9 ? [8] : [],
      status: blocked && number === 7 ? 'Blocked' : status,
      iterations: blocked && number === 7 ? 10 : 0,
      failingTests: blocked && number === 7 ? ['matches-across-midnight'] : [],
      pullRequestNumber: pr,
      pullRequestUrl: pr === null ? null : `https://github.com/hewn-builds/ledgerline/pull/${pr}`,
    })),
    deferred: [
      {
        title: 'Multi-currency reconciliation',
        l2Ids: ['L2-031', 'L2-032'],
        estimateDays: 7,
        reason: 'Estimated 7 days; could not be split below 3. Single-currency covers every journey.',
      },
      {
        title: 'Slack digest of unmatched items',
        l2Ids: ['L2-034'],
        estimateDays: 1.5,
        reason: 'Listed as nice-to-have in the brief.',
      },
      {
        title: 'Receipt OCR confidence tuning',
        l2Ids: ['L2-035'],
        estimateDays: 2,
        reason: 'Off the main path of every journey.',
      },
    ],
    merged: 6,
    total: 12,
    mergedDays: 12.5,
    totalDays: 24,
    percentComplete: 62,
  };
}

export const emptyBacklog = {
  directionId: null,
  increments: [],
  deferred: [],
  merged: 0,
  total: 0,
  mergedDays: 0,
  totalDays: 0,
  percentComplete: 0,
};
