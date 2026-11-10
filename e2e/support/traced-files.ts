// Import-free, so the video capture scripts can load it under plain Node.
/** A repository after stages 5 to 8 and a merged increment, as the Traceability mocks describe Ledgerline. */
export function tracedFiles(): Record<string, string> {
  const l2 = (id: string, title: string, l1: string, status = '') =>
    `## ${id}: ${title}\n${status}**Traces to:** ${l1}\n\n**Acceptance Criteria:**\n1. Given a user, when they act, then it works.\n`;
  return {
    'docs/specs/L1.md':
      '# L1 - High-Level Requirements\n\n## L1-006: Statement reconciliation\nReconcile statements.\n\n## L1-007: Period close\nClose periods.\n',
    'docs/specs/L2.md': [
      '# L2 - Detailed Requirements\n',
      l2('L2-013', 'Match a receipt by photo', 'L1-006'),
      l2('L2-018', 'Match card lines to transactions within a tolerance', 'L1-006'),
      l2('L2-020', 'Close a period after review', 'L1-007'),
      l2(
        'L2-031',
        'Reconcile in a second currency',
        'L1-006',
        '**Status:** Deferred (Estimated 7 days; could not be split below 3)\n',
      ),
    ].join('\n'),
    'docs/detailed-designs/reconciliation/reconcile-statement/README.md':
      '# Reconcile statement\n\n## Requirements\n- L2-018\n- L2-013\n',
    'docs/detailed-designs/reconciliation/close-period/README.md': '# Close period\n\n## Requirements\n- L2-020\n',
    'docs/journeys.md':
      '# User journeys\n\n## 3. Snap a receipt\n\n**Covers:** L2-013\n\n## 4. Close the month\n\n**Covers:** L2-018, L2-020\n',
    'e2e/tests/reconcile-card-statement.spec.ts':
      '// Acceptance Test\n// Traces to: L2-018\n// Description: Reconcile\n',
    'backend/tests/StatementMatcherTests.cs':
      '// Acceptance Test\n// Traces to: L2-013, L2-018\n// Description: Matching\n',
  };
}
