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
  /** The selected stage's detail panel and its parts (L2-030 AC3). */
  readonly detail: Locator;
  readonly detailTitle: Locator;
  readonly log: Locator;
  readonly logLines: Locator;
  readonly jumpToLatest: Locator;
  readonly runRows: Locator;
  readonly artifactPaths: Locator;
  readonly decisionQuestions: Locator;
  readonly notice: Locator;
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
    this.detail = page.locator('section[aria-label^="Stage "][aria-label$=" detail"]');
    this.detailTitle = this.detail.locator('.stage-title h2');
    this.log = page.getByRole('log', { name: 'Run log' });
    this.logLines = this.log.locator('.log__line');
    this.jumpToLatest = page.getByRole('button', { name: /new lines? — Jump to latest/ });
    this.runRows = this.detail.getByRole('table').locator('tbody tr');
    this.artifactPaths = this.detail.locator('.file__path');
    this.decisionQuestions = this.detail.locator('.decision__q');
    this.notice = this.detail.locator('.empty');
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

  /** The stage running now, if any. */
  currentStage(): Locator {
    return this.pipeline.locator('.stage[data-status="Running"]');
  }

  /** The stage whose detail is shown, marked aria-current="step" as in the mocks. */
  selectedStage(): Locator {
    return this.pipeline.locator('[aria-current="step"]');
  }

  /** Selects a stage, showing its detail. */
  async selectStage(name: string): Promise<void> {
    await this.stage(name).getByRole('link').click();
    await this.detailTitle.filter({ hasText: name }).waitFor();
  }

  /** A stage's status label (icon plus text; the text is what assistive tech reads). */
  stageStatus(name: string): Locator {
    return this.stage(name).locator('.stage__row + .visually-hidden');
  }

  /** The running stage's live step and latest log line (L2-030 AC2). */
  liveStep(name: string): Locator {
    return this.stage(name).locator('.stage__live-step');
  }

  liveLine(name: string): Locator {
    return this.stage(name).locator('.stage__live-line');
  }

  tab(name: 'Log' | 'Runs' | 'Artifacts' | 'Decisions'): Locator {
    return this.page.getByRole('tab', { name });
  }

  /** Where the log is scrolled: distance from the top, and whether the newest line is in view. */
  async logPosition(): Promise<{ top: number; atEnd: boolean }> {
    return this.log.evaluate((box) => ({
      top: box.scrollTop,
      atEnd: box.scrollTop + box.clientHeight >= box.scrollHeight - 4,
    }));
  }

  async scrollLogTo(top: number): Promise<void> {
    await this.log.evaluate((box, y) => {
      box.scrollTop = y;
      box.dispatchEvent(new Event('scroll'));
    }, top);
  }

  /** Starts recording what the polite live region announces, with the time of each. */
  async recordAnnouncements(): Promise<void> {
    await this.announcer.evaluate((region) => {
      const log: { at: number; text: string }[] = [];
      (window as unknown as { __announcements: typeof log }).__announcements = log;
      new MutationObserver(() => log.push({ at: performance.now(), text: region.textContent?.trim() ?? '' })).observe(
        region,
        { childList: true, characterData: true, subtree: true },
      );
    });
  }

  async announcements(): Promise<{ at: number; text: string }[]> {
    return this.page.evaluate(
      () => (window as unknown as { __announcements: { at: number; text: string }[] }).__announcements ?? [],
    );
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
