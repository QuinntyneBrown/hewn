import type { Page } from '@playwright/test';

const none = { designs: [], journeys: [], tests: [], pullRequests: [] };
const design = (title: string) => ({ title, path: `docs/detailed-designs/reconciliation/${title}/README.md` });

/** The requirements and traces the Traceability mocks show (docs/mocks/pages/traceability/). */
export function mockTraceability(): unknown {
  const reconciliation = { id: 'L1-006', title: 'Statement reconciliation' };
  return {
    repository: 'hewn-builds/ledgerline',
    commit: 'f61a2d8',
    requirements: [
      {
        id: 'L2-013',
        title: 'Match a receipt by photo',
        l1: reconciliation,
        deferred: null,
        noAcceptanceTest: false,
        ...none,
        tests: ['e2e/receipt.spec.ts'],
      },
      {
        id: 'L2-018',
        title: 'Match card lines to transactions within a tolerance',
        l1: reconciliation,
        deferred: null,
        noAcceptanceTest: false,
        designs: [design('Reconcile statement · Default'), design('Reconcile statement · Review')],
        journeys: [{ number: 4, title: 'Close the month' }],
        tests: ['e2e/reconcile-card-statement.spec.ts', 'backend/tests/StatementMatcherTests.cs'],
        pullRequests: [
          {
            number: 28,
            title: 'Reconcile a card statement',
            url: 'https://github.com/hewn-builds/ledgerline/pull/28',
            merged: true,
          },
        ],
      },
      {
        id: 'L2-019',
        title: 'Use the account’s time zone for posting dates',
        l1: reconciliation,
        deferred: null,
        noAcceptanceTest: false,
        ...none,
        tests: ['e2e/time-zone.spec.ts'],
      },
      {
        id: 'L2-020',
        title: 'Close a period after review',
        l1: { id: 'L1-007', title: 'Period close' },
        deferred: null,
        noAcceptanceTest: true,
        ...none,
        designs: [design('Close period · Default'), design('Close period · Awaiting review')],
        journeys: [{ number: 4, title: 'Close the month' }],
      },
      {
        id: 'L2-027',
        title: 'Invite a reviewer by email',
        l1: { id: 'L1-002', title: 'Accounts' },
        deferred: null,
        noAcceptanceTest: false,
        ...none,
        tests: ['e2e/invite.spec.ts'],
      },
      {
        id: 'L2-031',
        title: 'Reconcile in a second currency',
        l1: reconciliation,
        deferred: 'Estimated 7 days; could not be split below 3',
        noAcceptanceTest: false,
        ...none,
      },
    ],
  };
}

export const noRequirements = { repository: 'hewn-builds/ledgerline', commit: '5a1fe37', requirements: [] };

export const unparsableRequirements = {
  status: 502,
  title: 'docs/specs/L2.md couldn’t be parsed at f61a2d8 (unexpected heading on line 412)',
  code: 'github_failed',
};

/** Answers GET /api/projects/{id}/traceability with this body (or this problem) instead of the real trace. */
export async function serveTraceability(page: Page, body: unknown, status = 200): Promise<void> {
  await page.route(
    (url) => /^\/api\/projects\/[^/]+\/traceability$/.test(url.pathname),
    (route) => route.fulfill({ status, json: body, contentType: 'application/json' }),
  );
}
