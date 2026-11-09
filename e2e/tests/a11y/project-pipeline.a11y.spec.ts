// Acceptance Test
// Traces to: L2-030, L2-047
// Description: The project pipeline has no axe-core violations while a stage runs and once the direction is complete

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { startWorkers } from '../../support/workers';

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

test.describe('Project pipeline', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });

  let stopWorkers: () => Promise<void>;

  test.beforeAll(() => {
    stopWorkers = startWorkers(3, 400);
  });

  test.afterAll(async () => {
    await stopWorkers();
  });

  test('running, then complete', async ({ page, newDirection, project }) => {
    await signIn(page, 'quinntynebrown');
    await newDirection.open();
    await newDirection.fill({ name: uniqueName('A11y pipeline'), idea: 'Booking firing slots for a shared pottery kiln.' });
    await newDirection.submit();

    await expect(project.currentStage()).toBeVisible({ timeout: 60_000 });
    expect(await violations(page)).toEqual([]);

    await expect(project.completeCallout).toBeVisible({ timeout: 90_000 });
    expect(await violations(page)).toEqual([]);
  });
});
