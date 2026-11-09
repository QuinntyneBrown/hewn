// Acceptance Test
// Traces to: L2-001, L2-005, L2-047
// Description: New direction and the project page have no axe-core violations in their default, feature, invalid, forbidden and queued states

import AxeBuilder from '@axe-core/playwright';
import { expect, signIn, test, uniqueName } from '../../fixtures/test';

const idea = 'A web app for small accounting teams to reconcile statements against receipts.';

async function violations(page: import('@playwright/test').Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

test('New direction, default', async ({ page, newDirection }) => {
  await signIn(page, 'quinntynebrown');
  await newDirection.open();
  expect(await violations(page)).toEqual([]);
});

test('New direction, invalid', async ({ page, newDirection }) => {
  await signIn(page, 'quinntynebrown');
  await newDirection.open();
  await newDirection.fill({ name: '', idea: 'short', repository: 'gitlab.com/x' });
  await newDirection.submit();
  await expect(newDirection.errorSummary).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test('New direction, forbidden', async ({ page, newDirection }) => {
  await signIn(page, 'ada');
  await newDirection.open();
  await expect(newDirection.forbidden).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test('Project page after submission', async ({ page, newDirection, project }) => {
  await signIn(page, 'quinntynebrown');
  await newDirection.open();
  const name = uniqueName('A11y');
  await newDirection.fill({ name, idea });
  await newDirection.submit();
  await expect(project.heading).toHaveText(name);
  expect(await violations(page)).toEqual([]);
});

test('New direction, feature for a product', async ({ page, newDirection }) => {
  await signIn(page, 'quinntynebrown');
  await newDirection.open();
  await newDirection.featureMode.click();
  await newDirection.feature.fill('short');
  await newDirection.submit();
  await expect(newDirection.errorFor('feature')).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test('Project page with a feature queued behind the product', async ({ page, newDirection, project }) => {
  await signIn(page, 'quinntynebrown');
  await newDirection.open();
  const name = uniqueName('A11y queue');
  await newDirection.fill({ name, idea });
  await newDirection.submit();
  await expect(project.heading).toHaveText(name);
  await newDirection.open();
  await newDirection.fillFeature({ product: name, feature: 'Add a CSV export of the reconciled period.' });
  await newDirection.submit();
  await expect(project.queuedCallout).toBeVisible();
  expect(await violations(page)).toEqual([]);
});
