// Acceptance Test
// Traces to: L2-021, L2-022, L2-024, L2-047
// Description: The increment page has no axe-core violations while implementing, with the pull request and its checks, merged, blocked, and when GitHub can't be read

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { serveIncrement } from '../../support/increment';
import { mockIncrement } from '../../support/mock-increment';
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

test.describe('Increment, accessibility', () => {
  for (const [name, body, status] of [
    ['implementing', mockIncrement('implementing'), 200],
    ['pull request with checks', mockIncrement('default'), 200],
    ['merged', mockIncrement('merged'), 200],
    ['blocked', mockIncrement('blocked'), 200],
    ['error', { title: 'GitHub rate limit', status: 502, code: 'github_failed' }, 502],
  ] as const) {
    test(name, async ({ page, increment }) => {
      await signIn(page, 'quinntynebrown');
      const id = await aProject(page);
      await serveIncrement(page, body, status);
      await increment.open(id, 7);
      await expect(status === 502 ? increment.failure : increment.timeline).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });
  }
});
