import type { FrameLocator, Locator, Page } from '@playwright/test';

/** A project's Design system tab (/projects/{id}/design-system): the page list, the sandboxed preview and its controls. Owns every selector for it. */
export class DesignSystemPage {
  readonly tabs: Locator;
  readonly pages: Locator;
  readonly caption: Locator;
  readonly groups: Locator;
  readonly preview: Locator;
  readonly previewTitle: Locator;
  readonly controls: Locator;
  readonly widths: Locator;
  readonly themes: Locator;
  readonly frame: Locator;
  readonly servedFrom: Locator;
  readonly empty: Locator;
  readonly openPipeline: Locator;
  readonly failure: Locator;
  readonly tryAgain: Locator;
  readonly loading: Locator;

  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.tabs = page.getByRole('navigation', { name: 'Project sections' });
    this.pages = page.getByRole('navigation', { name: 'Design system pages' });
    this.caption = this.pages.locator('.text-caption');
    this.groups = this.pages.locator(':scope > ul > li');
    this.preview = page.getByRole('region', { name: 'Preview' });
    this.previewTitle = this.preview.getByRole('heading', { level: 2 });
    this.controls = this.preview.locator('.cluster').first();
    this.widths = this.preview.getByRole('radiogroup', { name: 'Width' });
    this.themes = this.preview.getByRole('radiogroup', { name: 'Theme' });
    this.frame = page.getByTestId('preview-frame');
    this.servedFrom = this.preview.locator('p.text-caption');
    this.empty = page.locator('.section .empty');
    this.openPipeline = page.getByRole('link', { name: 'Open the pipeline' });
    this.failure = page.getByRole('alert').filter({ hasText: 'The design system couldn’t load' });
    this.tryAgain = this.failure.getByRole('button', { name: 'Try again' });
    this.loading = page.getByText('Loading the design system');
  }

  async open(projectId: string): Promise<void> {
    await this.page.goto(`/projects/${projectId}/design-system`);
    await this.tab('Design system').waitFor();
  }

  tab(name: 'Pipeline' | 'Backlog' | 'Designs' | 'Design system'): Locator {
    return this.tabs.getByRole('link', { name, exact: true });
  }

  /** The page titles under Foundations or Components, in order. */
  titles(group: 'Foundations' | 'Components'): Promise<string[]> {
    return this.group(group).locator('.state-link').allInnerTexts();
  }

  pageLink(title: string): Locator {
    return this.pages.getByRole('link', { name: title, exact: true });
  }

  width(size: 'XS' | 'S' | 'M' | 'L' | 'XL'): Locator {
    return this.widths.getByRole('radio', { name: size, exact: true });
  }

  theme(name: 'Light' | 'Dark'): Locator {
    return this.themes.getByRole('radio', { name });
  }

  private content(): FrameLocator {
    return this.page.frameLocator('[data-testid="preview-frame"]');
  }

  previewHeading(): Locator {
    return this.content().getByRole('heading', { level: 1 });
  }

  /** What the page inside the frame reports: the theme it was given and its viewport width. */
  seen(key: 'theme' | 'width'): Locator {
    return this.content().locator(`#seen [data-probe="${key}"]`);
  }

  /** The page's background colour, as the frame paints it. */
  background(): Promise<string> {
    return this.content()
      .locator('html')
      .evaluate((html) => getComputedStyle(html).backgroundColor);
  }

  private group(name: string): Locator {
    return this.groups.filter({
      has: this.page.getByText(name, { exact: true }),
    });
  }
}
