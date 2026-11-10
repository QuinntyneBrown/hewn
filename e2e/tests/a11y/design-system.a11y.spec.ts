// Acceptance Test
// Traces to: L2-012, L2-047
// Description: The Design system tab has no axe-core violations with the page list and preview, at XS and Dark, empty, and when the design system can't be read

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { designedFiles, designedProject, extractedFiles, serveDesignSystem } from '../../support/designs';
import { noDesignSystem } from '../../support/mock-design-system';

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    // The previewed pages are the project's own, on another origin, checked by stage 3, not Mission Control.
    .exclude('iframe')
    .analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

let shared: string | undefined;
async function anExtractedProject(page: Page): Promise<string> {
  shared ??= await designedProject(page, uniqueName('Ledgerline'), {
    ...designedFiles(),
    ...extractedFiles(),
  });
  return shared;
}

test.beforeEach(async ({ page }) => {
  await signIn(page, 'quinntynebrown');
});

test('the page list and preview have no violations', async ({ page, designSystem }) => {
  await designSystem.open(await anExtractedProject(page));
  await expect(designSystem.previewHeading()).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test('XS and Dark have no violations', async ({ page, designSystem }) => {
  await designSystem.open(await anExtractedProject(page));
  await designSystem.width('XS').click();
  await designSystem.theme('Dark').click();
  await expect(designSystem.theme('Dark')).toHaveAttribute('aria-checked', 'true');
  expect(await violations(page)).toEqual([]);
});

test('empty has no violations', async ({ page, designSystem }) => {
  const id = await anExtractedProject(page);
  await serveDesignSystem(page, noDesignSystem);
  await designSystem.open(id);
  await expect(designSystem.empty).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test('the error has no violations', async ({ page, designSystem }) => {
  const id = await anExtractedProject(page);
  await serveDesignSystem(
    page,
    {
      status: 502,
      title: 'docs/design-system/ couldn’t be read at 8e2290a',
      code: 'github_failed',
    },
    502,
  );
  await designSystem.open(id);
  await expect(designSystem.failure).toBeVisible();
  expect(await violations(page)).toEqual([]);
});
