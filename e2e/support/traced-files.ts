import type { Page } from '@playwright/test';
import { xsrfToken } from './queue';
import { cancelDirections } from './rate-limit';

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

/** Seeds a fake repository with these files and pull requests, and a cancelled project on it. */
export async function tracedProject(
  page: Page,
  name: string,
  files: Record<string, string>,
  pulls: { title: string; merged: boolean }[] = [],
): Promise<string> {
  const repository = `traced-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
  const seeded = await page.request.put(`/api/fakes/github/hewn-builds/${repository}/files`, { data: files });
  if (!seeded.ok()) throw new Error(`Seeding hewn-builds/${repository} answered ${seeded.status()}`);
  for (const pull of pulls) {
    const opened = await page.request.post(`/api/fakes/github/hewn-builds/${repository}/pulls`, { data: pull });
    if (!opened.ok()) throw new Error(`Opening a pull request answered ${opened.status()}`);
  }
  const response = await page.request.post('/api/projects', {
    data: {
      name,
      idea: 'A web app for small accounting teams to reconcile statements.',
      stackPreference: null,
      repositoryUrl: `https://github.com/hewn-builds/${repository}`,
      budgetUsd: 300,
    },
    headers: { 'X-XSRF-TOKEN': await xsrfToken(page) },
  });
  if (response.status() !== 201) throw new Error(`Submitting answered ${response.status()}: ${await response.text()}`);
  const { projectId } = (await response.json()) as { projectId: string };
  await cancelDirections(page, [projectId]);
  return projectId;
}
