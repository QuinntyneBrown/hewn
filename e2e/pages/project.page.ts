import { Locator, Page } from '@playwright/test';

/** Project page (/projects/{id}). */
export class ProjectPage {
  readonly heading: Locator;
  readonly pipeline: Locator;
  readonly projectStatus: Locator;
  readonly repository: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.pipeline = page.getByRole('list', { name: 'Pipeline' });
    this.projectStatus = page.locator('.phead .status');
    this.repository = page.locator('.phead__repo');
  }

  async open(projectId: string): Promise<void> {
    await this.page.goto(`/projects/${projectId}`);
    await this.heading.waitFor();
  }

  stages(): Locator {
    return this.pipeline.getByRole('listitem');
  }

  /** A stage row; its accessible text holds the number, name and status label. */
  stage(name: string): Locator {
    return this.stages().filter({ has: this.page.locator('.stage__name', { hasText: new RegExp(`^${name}$`) }) });
  }

  projectIdFromUrl(): string {
    const match = /\/projects\/([0-9a-f-]{36})/.exec(this.page.url());
    if (!match) {
      throw new Error(`Not on a project page: ${this.page.url()}`);
    }
    return match[1]!;
  }
}
