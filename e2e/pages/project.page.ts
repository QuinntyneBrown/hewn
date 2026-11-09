import type { Locator, Page } from '@playwright/test';

/** Project page (/projects/{id}). */
export class ProjectPage {
  readonly heading: Locator;
  readonly pipeline: Locator;
  readonly projectStatus: Locator;
  readonly repository: Locator;
  readonly completeCallout: Locator;
  readonly featureCompleteCallout: Locator;
  readonly queuedCallout: Locator;
  readonly directionMeta: Locator;
  readonly announcer: Locator;
  /** Any dialog asking the user for something; a run never needs one (L2-028). */
  readonly dialogs: Locator;

  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { level: 1 });
    this.pipeline = page.getByRole('list', { name: 'Pipeline' });
    this.projectStatus = page.locator('.phead .status');
    this.repository = page.locator('.phead__repo');
    this.completeCallout = page.locator('.callout--ok', { hasText: 'Direction complete' });
    this.featureCompleteCallout = page.locator('.callout', { hasText: 'Feature direction complete' });
    this.queuedCallout = page.locator('.callout', { hasText: /direction(s)? queued/ });
    this.directionMeta = page.locator('.phead__meta > span').first();
    this.announcer = page.locator('[data-testid="pipeline-announcer"]');
    this.dialogs = page.locator('[role="dialog"], [role="alertdialog"]');
  }

  /** The project's event stream from the start, as the API serves it to Mission Control. */
  async events(): Promise<{ type: string; payload: Record<string, unknown> }[]> {
    const response = await this.page.request.get(`/api/projects/${this.projectIdFromUrl()}/events?after=0`);
    if (!response.ok()) throw new Error(`events: ${response.status()}`);
    return (await response.json()) as { type: string; payload: Record<string, unknown> }[];
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

  /** Stage names struck through as skipped. */
  async skippedStageNames(): Promise<string[]> {
    return this.pipeline.locator('.stage__name--skip').allTextContents();
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
