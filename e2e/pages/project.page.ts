import type { Locator, Page } from '@playwright/test';

/** Project page (/projects/{id}). */
export class ProjectPage {
  readonly heading: Locator;
  readonly pipeline: Locator;
  readonly projectStatus: Locator;
  readonly repository: Locator;
  readonly completeCallout: Locator;
  readonly announcer: Locator;

  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { level: 1 });
    this.pipeline = page.getByRole('list', { name: 'Pipeline' });
    this.projectStatus = page.locator('.phead .status');
    this.repository = page.locator('.phead__repo');
    this.completeCallout = page.locator('.callout--ok', { hasText: 'Direction complete' });
    this.announcer = page.locator('[data-testid="pipeline-announcer"]');
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

  /** The current stage, marked aria-current="step". */
  currentStage(): Locator {
    return this.pipeline.locator('[aria-current="step"]');
  }

  /** Each stage's status label, in pipeline order. */
  async stageStatuses(): Promise<string[]> {
    return this.pipeline.locator('.stage .visually-hidden').allTextContents();
  }

  projectIdFromUrl(): string {
    const match = /\/projects\/([0-9a-f-]{36})/.exec(this.page.url());
    if (!match) {
      throw new Error(`Not on a project page: ${this.page.url()}`);
    }
    return match[1]!;
  }
}
