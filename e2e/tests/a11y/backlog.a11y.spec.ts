// Acceptance Test
// Traces to: L2-020, L2-019, L2-047
// Description: Backlog has no axe-core violations with increments and deferred designs, with a blocked increment, empty, and when it cannot load

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { serveBacklog } from '../../support/backlog';
import { emptyBacklog, mockBacklog } from '../../support/mock-backlog';
import { xsrfToken } from '../../support/queue';
import { cancelDirections } from '../../support/rate-limit';

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

async function aProject(page: Page): Promise<string> {
  const response = await page.request.post('/api/projects', {
    data: {
      name: uniqueName('Ledgerline'),
      idea: 'Reconcile statements.',
      stackPreference: null,
      repositoryUrl: null,
      budgetUsd: 300,
    },
    headers: { 'X-XSRF-TOKEN': await xsrfToken(page) },
  });
  const { projectId } = (await response.json()) as { projectId: string };
  await cancelDirections(page, [projectId]);
  return projectId;
}

test.describe('Backlog, accessibility', () => {
  for (const [name, body, status] of [
    ['default', mockBacklog(), 200],
    ['blocked increment', mockBacklog({ blocked: true }), 200],
    ['empty', emptyBacklog, 200],
    ['error', null, 502],
  ] as const) {
    test(name, async ({ page, backlog }) => {
      await signIn(page, 'quinntynebrown');
      const id = await aProject(page);
      await serveBacklog(page, body, status);
      await backlog.open(id);
      await expect(
        status === 502 ? backlog.failure : body === emptyBacklog ? backlog.emptyTitle : backlog.rows.first(),
      ).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });
  }
});
