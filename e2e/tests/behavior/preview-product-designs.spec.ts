// Acceptance Test
// Traces to: L2-011
// Description: Designs lists every exported screen and state with a thumbnail and an Open in Magic Patterns link; a state opens from the separate preview origin in a sandboxed frame that can't read Mission Control's cookies, storage or page; XS to XL and Light or Dark resize and re-theme it; and the empty and error states

import type { Page } from '@playwright/test';
import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { designedFiles, designedProject } from '../../support/designs';

let shared: string | undefined;
/** One project per file on a repository holding the designs, so the suite stays under the submission limit. */
async function aDesignedProject(page: Page): Promise<string> {
  shared ??= await designedProject(page, uniqueName('Ledgerline'), designedFiles());
  return shared;
}

test.describe('Preview product designs', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'quinntynebrown');
  });

  test('the gallery lists each screen and state with a thumbnail and an Open in Magic Patterns link', async ({
    page,
    designs,
  }) => {
    const id = await aDesignedProject(page);
    await signIn(page, 'ada');
    await designs.open(id);

    await expect(designs.tab('Designs')).toHaveAttribute('aria-current', 'page');
    await expect(designs.caption).toHaveText('2 screens · 5 states · exported to docs/mocks/');
    expect(await designs.screenTitles()).toEqual(['Statements', 'Reconcile statement']);
    expect(await designs.stateLabels('Reconcile statement')).toEqual(['Default', 'Review', 'Upload error']);
    await expect(designs.thumbnails).toHaveCount(5);
    await expect(designs.magicPatternsLink('Reconcile statement', 'Review')).toHaveAttribute(
      'href',
      'https://www.magicpatterns.com/c/reconcile-statement',
    );

    // The first state shows until another is chosen.
    await expect(designs.previewTitle).toHaveText('Statements · Default');
    await expect(designs.previewHeading()).toHaveText('Statements');
    await designs.state('Reconcile statement', 'Upload error').click();
    await expect(designs.state('Reconcile statement', 'Upload error')).toHaveAttribute('aria-current', 'true');
    await expect(designs.previewTitle).toHaveText('Reconcile statement · Upload error');
    await expect(designs.previewHeading()).toHaveText('The statement couldn’t upload');
    await expect(designs.openInMagicPatterns).toHaveAttribute(
      'href',
      'https://www.magicpatterns.com/c/reconcile-statement',
    );
  });

  test('a mock runs on the preview origin in a sandbox that cannot read Mission Control’s cookies, storage or page', async ({
    page,
    designs,
  }) => {
    const id = await aDesignedProject(page);
    await designs.open(id);
    await page.evaluate(() => localStorage.setItem('hewn-probe', 'Mission Control storage'));
    expect(await page.evaluate(() => document.cookie), 'Mission Control has a cookie scripts can read').toContain(
      'XSRF-TOKEN',
    );

    await designs.state('Reconcile statement', 'Review').click();

    await expect(designs.frame).toHaveAttribute('src', /review\.html\?theme=light$/);
    await expect(designs.frame).toHaveAttribute('sandbox', 'allow-scripts');
    const src = new URL((await designs.frame.getAttribute('src'))!);
    expect(src.origin).toBe('http://127.0.0.1:5300');
    expect(src.origin).not.toBe(new URL(page.url()).origin);
    expect(src.pathname).toMatch(/^\/preview\/[^/]+\/docs\/mocks\/reconcile-statement\/review\.html$/);
    await expect(designs.servedFrom).toContainText('Served from 127.0.0.1:5300 in a sandboxed frame');

    const probe = await designs.probe();
    expect(probe.origin).toBe('null');
    expect(probe.cookie).toBe('blocked: SecurityError');
    expect(probe.storage).toBe('blocked: SecurityError');
    expect(probe.parent).toBe('blocked: SecurityError');
  });

  test('XS to XL resize the frame to 375, 576, 768, 992 and 1200 px, and Light and Dark switch its theme', async ({
    page,
    designs,
  }) => {
    const id = await aDesignedProject(page);
    await designs.open(id);
    await designs.state('Reconcile statement', 'Review').click();
    await expect(designs.width('L')).toHaveAttribute('aria-checked', 'true');
    await expect(designs.probeReading('width')).toHaveText('992');
    await expect(designs.probeReading('theme')).toHaveText('light');

    for (const [size, px] of [
      ['XS', 375],
      ['S', 576],
      ['M', 768],
      ['L', 992],
      ['XL', 1200],
    ] as const) {
      await designs.width(size).click();
      await expect(designs.width(size)).toHaveAttribute('aria-checked', 'true');
      await expect(designs.probeReading('width')).toHaveText(String(px));
      await expect(designs.servedFrom).toContainText(`${px} px`);
    }

    await designs.theme('Dark').click();
    await expect(designs.theme('Dark')).toHaveAttribute('aria-checked', 'true');
    await expect(designs.probeReading('theme')).toHaveText('dark');
    await expect(designs.frame).toHaveAttribute(
      'title',
      'Exported mock: Reconcile statement, Review state, 1200 px, dark',
    );

    // The arrow keys move within each control, as in a radio group.
    await designs.width('XL').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(designs.width('L')).toHaveAttribute('aria-checked', 'true');
    await expect(designs.width('L')).toBeFocused();
    await expect(designs.probeReading('width')).toHaveText('992');
  });

  test('a project before stage 2 says it has no designs yet', async ({ page, designs }) => {
    const name = uniqueName('Kiln Booking');
    const id = await designedProject(page, name, { 'README.md': '# Kiln Booking\n' });
    await designs.open(id);

    await expect(designs.empty).toContainText('No designs yet');
    await expect(designs.empty).toContainText(`${name} hasn’t reached it yet.`);
    await designs.openPipeline.click();
    await expect(designs.tab('Pipeline')).toHaveAttribute('aria-current', 'page');
  });

  test('an unreadable manifest says which commit it couldn’t read, and Try again shows the designs once it is fixed', async ({
    page,
    designs,
  }) => {
    const id = await designedProject(page, uniqueName('Parcel Post'), { 'docs/mocks/manifest.json': '{ "screens": [' });
    const project = (await (await page.request.get(`/api/projects/${id}`)).json()) as { repository: string };
    await designs.open(id);

    await expect(designs.failure).toContainText(/docs\/mocks\/manifest\.json couldn’t be read at [0-9a-f]{7}\./);
    await expect(designs.failure).toContainText('The exported mocks are still in the repository.');

    await page.request.put(`/api/fakes/github/${project.repository}/files`, { data: designedFiles() });
    await designs.tryAgain.click();
    await expect(designs.caption).toHaveText('2 screens · 5 states · exported to docs/mocks/');
  });
});
