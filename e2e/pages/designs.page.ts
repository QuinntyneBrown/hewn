import type { FrameLocator, Locator, Page } from '@playwright/test';

/** What the isolation probe mock (support/designs.ts) found from inside the preview frame. */
export interface ProbeReport {
  origin: string;
  cookie: string;
  storage: string;
  parent: string;
  width: string;
  theme: string;
}

/** A project's Designs tab (/projects/{id}/designs): the gallery, the sandboxed preview and its controls. Owns every selector for it. */
export class DesignsPage {
  readonly tabs: Locator;
  readonly gallery: Locator;
  readonly caption: Locator;
  readonly screens: Locator;
  readonly thumbnails: Locator;
  readonly preview: Locator;
  readonly previewTitle: Locator;
  readonly controls: Locator;
  readonly widths: Locator;
  readonly themes: Locator;
  readonly openInMagicPatterns: Locator;
  readonly frame: Locator;
  readonly frameBox: Locator;
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
    this.gallery = page.getByRole('navigation', { name: 'Screens and states' });
    this.caption = this.gallery.locator('.text-caption');
    this.screens = this.gallery.locator(':scope > ul > li');
    this.thumbnails = this.gallery.locator('.state-thumb iframe');
    this.preview = page.getByRole('region', { name: 'Preview' });
    this.previewTitle = this.preview.getByRole('heading', { level: 2 });
    this.controls = this.preview.locator('.cluster').first();
    this.widths = this.preview.getByRole('radiogroup', { name: 'Width' });
    this.themes = this.preview.getByRole('radiogroup', { name: 'Theme' });
    this.openInMagicPatterns = this.preview.getByRole('link', { name: 'Open in Magic Patterns' });
    this.frame = page.getByTestId('preview-frame');
    this.frameBox = this.preview.locator('.preview__frame');
    this.servedFrom = this.preview.locator('p.text-caption');
    this.empty = page.locator('.section .empty');
    this.openPipeline = page.getByRole('link', { name: 'Open the pipeline' });
    this.failure = page.getByRole('alert').filter({ hasText: 'Designs couldn’t load' });
    this.tryAgain = this.failure.getByRole('button', { name: 'Try again' });
    this.loading = page.getByText('Loading designs');
  }

  async open(projectId: string): Promise<void> {
    await this.page.goto(`/projects/${projectId}/designs`);
    await this.tab('Designs').waitFor();
  }

  tab(name: 'Pipeline' | 'Backlog' | 'Designs'): Locator {
    return this.tabs.getByRole('link', { name, exact: true });
  }

  screenTitles(): Promise<string[]> {
    return this.screens.locator(':scope > div').allInnerTexts();
  }

  stateLabels(screen: string): Promise<string[]> {
    return this.screen(screen).locator('.state-link').allInnerTexts();
  }

  state(screen: string, state: string): Locator {
    return this.screen(screen).getByRole('link', { name: state, exact: true });
  }

  magicPatternsLink(screen: string, state: string): Locator {
    return this.gallery.getByRole('link', { name: `Open ${screen} · ${state} in Magic Patterns` });
  }

  width(size: 'XS' | 'S' | 'M' | 'L' | 'XL'): Locator {
    return this.widths.getByRole('radio', { name: size, exact: true });
  }

  theme(name: 'Light' | 'Dark'): Locator {
    return this.themes.getByRole('radio', { name });
  }

  /** Inside the preview frame, read through the browser's own frame access, as a person would see it. */
  private content(): FrameLocator {
    return this.page.frameLocator('[data-testid="preview-frame"]');
  }

  previewHeading(): Locator {
    return this.content().getByRole('heading', { level: 1 });
  }

  /** The isolation probe's findings, once it has written them. */
  async probe(): Promise<ProbeReport> {
    const report = this.content().locator('#probe');
    await report.waitFor();
    const read = (key: keyof ProbeReport) => report.locator(`[data-probe="${key}"]`).innerText();
    return {
      origin: await read('origin'),
      cookie: await read('cookie'),
      storage: await read('storage'),
      parent: await read('parent'),
      width: await read('width'),
      theme: await read('theme'),
    };
  }

  /** The probe's reading of its own viewport width and theme, once it has settled on the given width. */
  probeReading(key: 'width' | 'theme'): Locator {
    return this.content().locator(`#probe [data-probe="${key}"]`);
  }

  private screen(title: string): Locator {
    return this.screens.filter({ has: this.page.getByText(title, { exact: true }) });
  }
}
