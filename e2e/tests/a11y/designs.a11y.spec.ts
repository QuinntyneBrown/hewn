// Acceptance Test
// Traces to: L2-011, L2-047
// Description: The Designs tab has no axe-core violations with the gallery and preview, at XS and Dark, empty, and when the manifest can't be read

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { designedFiles, designedProject, serveDesigns } from '../../support/designs';
import { noDesigns } from '../../support/mock-designs';

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    // The previewed mocks are the project's own pages on another origin, checked by stage 2, not Mission Control.
    .exclude('iframe')
    .analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

let shared: string | undefined;
async function aDesignedProject(page: Page): Promise<string> {
  shared ??= await designedProject(page, uniqueName('Ledgerline'), designedFiles());
  return shared;
}

test.beforeEach(async ({ page }) => {
  await signIn(page, 'quinntynebrown');
});

test('the gallery and preview have no violations', async ({ page, designs }) => {
  await designs.open(await aDesignedProject(page));
  await expect(designs.previewHeading()).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test('XS and Dark have no violations', async ({ page, designs }) => {
  await designs.open(await aDesignedProject(page));
  await designs.width('XS').click();
  await designs.theme('Dark').click();
  await expect(designs.theme('Dark')).toHaveAttribute('aria-checked', 'true');
  expect(await violations(page)).toEqual([]);
});

test('empty has no violations', async ({ page, designs }) => {
  const id = await aDesignedProject(page);
  await serveDesigns(page, noDesigns);
  await designs.open(id);
  await expect(designs.empty).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test('the error has no violations', async ({ page, designs }) => {
  const id = await aDesignedProject(page);
  await serveDesigns(
    page,
    { status: 502, title: 'docs/mocks/manifest.json couldn’t be read at 5a1fe37', code: 'github_failed' },
    502,
  );
  await designs.open(id);
  await expect(designs.failure).toBeVisible();
  expect(await violations(page)).toEqual([]);
});
