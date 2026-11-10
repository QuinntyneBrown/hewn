// Acceptance Test
// Traces to: L2-012
// Description: Design system lists the token and component pages stage 3 wrote, and opens each in the same sandboxed preview as Designs, served from the separate preview origin, at XS to XL and Light or Dark; with the empty and error states (AC4)

import type { Page } from '@playwright/test';
import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { designedFiles, designedProject, extractedFiles } from '../../support/designs';

let shared: string | undefined;
/** One project per file on a repository holding the designs and the design system, as stage 3 leaves it. */
async function anExtractedProject(page: Page): Promise<string> {
  shared ??= await designedProject(page, uniqueName('Ledgerline'), {
    ...designedFiles(),
    ...extractedFiles(),
  });
  return shared;
}

test.describe('Browse the design system', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'quinntynebrown');
  });

  test('the token pages and component pages are listed, and each opens in the preview', async ({
    page,
    designSystem,
  }) => {
    const id = await anExtractedProject(page);
    await signIn(page, 'ada');
    await designSystem.open(id);

    await expect(designSystem.tab('Design system')).toHaveAttribute('aria-current', 'page');
    await expect(designSystem.caption).toHaveText(
      /^6 foundations · 2 components · docs\/design-system\/ at [0-9a-f]{7}$/,
    );
    expect(await designSystem.titles('Foundations')).toEqual([
      'Colour',
      'Typography',
      'Spacing',
      'Radius',
      'Elevation',
      'Motion',
    ]);
    expect(await designSystem.titles('Components')).toEqual(['Button', 'Status badge']);

    // The first token page shows until another is chosen.
    await expect(designSystem.previewTitle).toHaveText('Colour · 3 tokens, light and dark');
    await expect(designSystem.previewHeading()).toHaveText('Colour');
    await designSystem.pageLink('Spacing').click();
    await expect(designSystem.previewTitle).toHaveText('Spacing · 2 tokens');
    await designSystem.pageLink('Status badge').click();
    await expect(designSystem.pageLink('Status badge')).toHaveAttribute('aria-current', 'true');
    await expect(designSystem.previewTitle).toHaveText('Status badge');
    await expect(designSystem.previewHeading()).toHaveText('Status badge');
  });

  test('pages are served from the preview origin in the same sandboxed frame as Designs, in light and dark', async ({
    page,
    designSystem,
  }) => {
    const id = await anExtractedProject(page);
    await designSystem.open(id);

    await expect(designSystem.frame).toHaveAttribute('sandbox', 'allow-scripts');
    const src = new URL((await designSystem.frame.getAttribute('src'))!);
    expect(src.origin).toBe('http://127.0.0.1:5300');
    expect(src.origin).not.toBe(new URL(page.url()).origin);
    expect(src.pathname).toMatch(/^\/preview\/[^/]+\/docs\/design-system\/foundations\/colour\.html$/);
    await expect(designSystem.servedFrom).toContainText(
      'Served from 127.0.0.1:5300 in the same sandboxed frame as Designs · 992 px · docs/design-system/foundations/colour.html',
    );

    // Tokens, light then dark.
    await expect(designSystem.seen('theme')).toHaveText('light');
    expect(await designSystem.background()).toBe('rgb(255, 255, 255)');
    await designSystem.theme('Dark').click();
    await expect(designSystem.frame).toHaveAttribute('src', /colour\.html\?theme=dark$/);
    await expect(designSystem.seen('theme')).toHaveText('dark');
    expect(await designSystem.background()).toBe('rgb(20, 24, 29)');

    // A component page keeps the theme, and the width.
    await designSystem.width('XS').click();
    await designSystem.pageLink('Button').click();
    await expect(designSystem.previewHeading()).toHaveText('Button');
    await expect(designSystem.seen('theme')).toHaveText('dark');
    await expect(designSystem.seen('width')).toHaveText('375');
    await designSystem.theme('Light').click();
    await expect(designSystem.seen('theme')).toHaveText('light');
    expect(await designSystem.background()).toBe('rgb(255, 255, 255)');
  });

  test('a project before stage 3 has no design system yet, and Open the pipeline goes to it', async ({
    page,
    designSystem,
  }) => {
    const id = await designedProject(page, uniqueName('Kiln Booking'), designedFiles());
    await designSystem.open(id);

    await expect(designSystem.empty).toContainText('No design system yet');
    await expect(designSystem.empty).toContainText('It appears here once that stage succeeds.');
    await designSystem.openPipeline.click();
    await expect(page).toHaveURL(new RegExp(`/projects/${id}$`));
  });

  test('unreadable tokens name the commit, and Try again reads the design system once they are fixed', async ({
    page,
    designSystem,
  }) => {
    const files = extractedFiles();
    const broken = await designedProject(page, uniqueName('Ledgerline'), {
      ...files,
      'docs/design-system/tokens.json': '{ not json',
    });
    await designSystem.open(broken);

    await expect(designSystem.failure).toContainText(
      /docs\/design-system\/ couldn’t be read at [0-9a-f]{7}\. The files are still in the repository\./,
    );
    const project = (await (await page.request.get(`/api/projects/${broken}`)).json()) as { repository: string };
    const fixed = await page.request.put(`/api/fakes/github/${project.repository}/files`, {
      data: {
        'docs/design-system/tokens.json': files['docs/design-system/tokens.json'],
      },
    });
    expect(fixed.ok()).toBe(true);

    await designSystem.tryAgain.click();
    await expect(designSystem.previewTitle).toHaveText('Colour · 3 tokens, light and dark');
  });
});
