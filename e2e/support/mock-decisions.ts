import type { Page } from '@playwright/test';

const repo = 'https://github.com/hewn-builds/ledgerline';
/** A 40-character SHA starting with the mock's short one. */
const full = (sha: string) => sha.padEnd(40, '0');
const decision = (
  id: number,
  stage: number,
  stageName: string,
  recordedAt: string,
  sha: string,
  question: string,
  answer: string,
  rationale: string,
  adr: { path: string; title: string; url: string } | null = null,
) => ({
  id,
  stage,
  stageName,
  question,
  answer,
  rationale,
  // Local times, so the page shows the mock's own "9 Nov, 14:21".
  recordedAt,
  commit: full(sha),
  commitUrl: `${repo}/commit/${full(sha)}`,
  adr,
});

/** The decisions the Decisions mocks show (docs/mocks/pages/decisions/), newest first. */
export function mockDecisions(): { repository: string; decisions: ReturnType<typeof decision>[] } {
  return {
    repository: 'hewn-builds/ledgerline',
    decisions: [
      decision(
        5,
        10,
        'Increments',
        '2026-11-09T14:21:00',
        'a41c9e2',
        'Which time zone decides whether a card transaction falls on a statement date?',
        "The account's time zone, set during bank-feed connection.",
        'Statements are issued in the account holder’s local day; UTC split 3 test transactions across two days.',
      ),
      decision(
        4,
        10,
        'Increments',
        '2026-11-09T11:08:00',
        '7be0d13',
        'Should a split transaction keep the original receipt on every part?',
        'Yes, linked, not copied.',
        'Journey 3 has reviewers open the receipt from any part; copying would double storage and break deletion.',
      ),
      decision(
        3,
        9,
        'Estimates',
        '2026-11-08T16:40:00',
        '19f4a8c',
        'Multi-currency reconciliation is 7 days. Split or defer?',
        'Defer.',
        'No journey needs a second currency, and no split came in under the 3-day threshold.',
      ),
      decision(
        2,
        4,
        'Stack',
        '2026-11-08T09:12:00',
        'c03e57b',
        'The direction mentions “works offline on site visits”. Add a PWA layer?',
        'No. Keep the default .NET + Angular stack; offline is out of scope in the brief.',
        'The brief’s users reconcile at a desk; site visits only capture receipts, which the phone camera already queues.',
        { path: 'docs/adr/0001-stack.md', title: 'ADR 0001', url: `${repo}/blob/main/docs/adr/0001-stack.md` },
      ),
      decision(
        1,
        1,
        'Idea',
        '2026-11-07T17:55:00',
        'e8812fa',
        'Who approves a reconciled period: the preparer or a second person?',
        'A second person with the Reviewer role.',
        'The direction names “small accounting teams”; four-eyes review is standard practice the brief should assume.',
      ),
    ],
  };
}

export const noDecisions = { repository: 'hewn-builds/ledgerline', decisions: [] };

export const decisionsFailure = {
  status: 502,
  title: 'docs/decisions.md couldn’t be read from hewn-builds/ledgerline',
  code: 'github_failed',
};

/**
 * Answers GET /api/projects/{id}/decisions with these decisions, filtered by `?stage=` as the API filters them, or
 * with this problem. Returns the stage each request asked for, in order.
 */
export async function serveDecisions(
  page: Page,
  body: { repository: string; decisions: { stage: number }[] } | typeof decisionsFailure,
  status = 200,
): Promise<(string | null)[]> {
  const asked: (string | null)[] = [];
  await page.route(
    (url) => /^\/api\/projects\/[^/]+\/decisions$/.test(url.pathname),
    (route) => {
      const stage = new URL(route.request().url()).searchParams.get('stage');
      asked.push(stage);
      const json =
        status === 200 && 'decisions' in body && stage !== null
          ? { ...body, decisions: body.decisions.filter((d) => d.stage === Number(stage)) }
          : body;
      return route.fulfill({ status, json, contentType: 'application/json' });
    },
  );
  return asked;
}
