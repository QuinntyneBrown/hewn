import type { Locator, Page } from '@playwright/test';

/** One artifact row: its path, version, time and GitHub link. */
export interface ArtifactRow {
  path: Locator;
  sha: Locator;
  when: Locator;
  open: Locator;
}

/** A project's Artifacts tab (/projects/{id}/artifacts): each stage's artifacts, newest stage first. Owns every selector for it. */
export class ArtifactsPage {
  readonly tabs: Locator;
  readonly content: Locator;
  readonly description: Locator;
  readonly stages: Locator;
  readonly empty: Locator;
  readonly failure: Locator;
  readonly tryAgain: Locator;
  readonly loading: Locator;

  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.tabs = page.getByRole('navigation', { name: 'Project sections' });
    this.content = page
      .locator('.pad.section')
      .filter({ has: page.getByRole('heading', { name: 'Artifacts', level: 2 }) });
    this.description = this.content.locator('.section__desc');
    this.stages = this.content.locator('section[aria-labelledby]');
    this.empty = this.content.locator('.empty').filter({ hasText: 'No artifacts yet' });
    this.failure = page.getByRole('alert').filter({ hasText: 'Artifacts couldn’t load' });
    this.tryAgain = this.failure.getByRole('button', { name: 'Try again' });
    this.loading = page.getByText('Loading artifacts');
  }

  async open(projectId: string): Promise<void> {
    await this.page.goto(`/projects/${projectId}/artifacts`);
    await this.tab('Artifacts').waitFor();
  }

  tab(name: 'Pipeline' | 'Backlog' | 'Designs' | 'Design system' | 'Artifacts'): Locator {
    return this.tabs.getByRole('link', { name, exact: true });
  }

  /** The stage headings in order, such as "10 Increments". */
  async stageTitles(): Promise<string[]> {
    return (await this.stages.locator('.group-title').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
  }

  stage(name: string): Locator {
    return this.stages.filter({ has: this.page.getByRole('heading', { name: new RegExp(`\\b${name}$`) }) });
  }

  paths(stage: string): Promise<string[]> {
    return this.stage(stage).locator('.file__path').allInnerTexts();
  }

  row(stage: string, path: string): ArtifactRow {
    const row = this.stage(stage)
      .locator('.file')
      .filter({ has: this.page.getByText(path, { exact: true }) });
    return {
      path: row.locator('.file__path'),
      sha: row.locator('.file__sha'),
      when: row.locator('.file__when'),
      open: row.getByRole('link'),
    };
  }
}
