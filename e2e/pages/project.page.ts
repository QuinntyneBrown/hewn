import type { Locator, Page } from '@playwright/test';

/** Project page (/projects/{id}). */
export class ProjectPage {
  readonly notFound: Locator;
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
  /** The header's spend of budget (L2-052 AC2) and the pause at 100% (L2-053 AC3). */
  readonly spendMeter: Locator;
  readonly spendLabel: Locator;
  readonly budgetReachedCallout: Locator;
  /** Pause and Resume in the header (L2-029 AC1, AC2), Owners only, and the callout of a paused direction. */
  readonly pauseButton: Locator;
  readonly pausingButton: Locator;
  readonly resumeButton: Locator;
  readonly pausedCallout: Locator;
  /** Cancel (L2-029 AC3): the header control, its confirmation dialog and the cancelled callout. */
  readonly cancelButton: Locator;
  readonly cancelDialog: Locator;
  readonly cancelConfirm: Locator;
  readonly cancelling: Locator;
  readonly cancelTryAgain: Locator;
  readonly keepRunning: Locator;
  readonly cancelFailure: Locator;
  readonly cancelledCallout: Locator;
  readonly cancelDialogFooter: Locator;
  readonly headerMeta: Locator;
  /** Raise and resume (L2-053 AC3): the callout's controls and the dialog they open. */
  readonly calloutNewBudget: Locator;
  readonly raiseBudget: Locator;
  readonly raiseDialog: Locator;
  readonly dialogBudget: Locator;
  readonly dialogBudgetError: Locator;
  readonly dialogConfirm: Locator;
  readonly dialogCancel: Locator;
  readonly dialogFailure: Locator;
  readonly dialogPanel: Locator;
  readonly dialogFooter: Locator;
  /** Live toasts, such as the 80% budget warning (L2-053 AC2). */
  readonly toasts: Locator;
  /** A stage blocked after its retries (L2-006 AC2), and Retry stage (AC3). */
  readonly blockedCallout: Locator;
  readonly calloutRetryStage: Locator;
  readonly retryStageButton: Locator;
  readonly blockedToast: Locator;
  /** Any dialog asking the user for something; a run never needs one (L2-028). */
  readonly dialogs: Locator;

  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.notFound = page.getByRole('heading', { level: 1, name: 'Project not found' });
    this.heading = page.getByRole('heading', { level: 1 });
    this.pipeline = page.getByRole('list', { name: 'Pipeline' });
    this.projectStatus = page.locator('.phead .status');
    this.repository = page.locator('.phead__repo');
    this.completeCallout = page.locator('.callout--ok', { hasText: 'Direction complete' });
    this.featureCompleteCallout = page.locator('.callout', { hasText: 'Feature direction complete' });
    this.queuedCallout = page.locator('.callout', { hasText: /direction(s)? queued/ });
    this.directionMeta = page.locator('.phead__meta > span').first();
    this.announcer = page.locator('[data-testid="status-announcer"]');
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
    this.spendMeter = page.getByRole('meter', { name: 'Spend' });
    this.spendLabel = page.locator('.phead__spend .phead__label');
    this.budgetReachedCallout = page.locator('.callout', { hasText: 'Paused · Budget reached' });
    this.toasts = page.locator('.toast-region .toast');
    const header = page.locator('.phead');
    this.pauseButton = header.getByRole('button', { name: 'Pause', exact: true });
    this.pausingButton = header.getByRole('button', { name: 'Pausing…' });
    this.resumeButton = header.getByRole('button', { name: 'Resume', exact: true });
    this.pausedCallout = page.locator('.callout', { hasText: 'Nothing new starts until Resume' });
    this.cancelButton = header.getByRole('button', { name: 'Cancel', exact: true });
    this.cancelDialog = page.getByRole('alertdialog', { name: /^Cancel .+’s direction\?$/ });
    this.cancelConfirm = this.cancelDialog.getByRole('button', { name: 'Cancel direction' });
    this.cancelling = this.cancelDialog.getByRole('button', { name: 'Cancelling…' });
    this.cancelTryAgain = this.cancelDialog.getByRole('button', { name: 'Try again' });
    this.keepRunning = this.cancelDialog.getByRole('button', { name: 'Keep running' });
    this.cancelFailure = this.cancelDialog.getByRole('alert');
    this.cancelDialogFooter = this.cancelDialog.locator('.dialog__footer');
    this.blockedCallout = page.locator('.callout', { hasText: /Stage failed after \d+ retr/ });
    this.calloutRetryStage = this.blockedCallout.getByRole('button', { name: 'Retry stage' });
    this.retryStageButton = header.getByRole('button', { name: 'Retry stage' });
    this.blockedToast = this.toasts.filter({ hasText: ' is blocked' });
    this.cancelledCallout = page.locator('.callout', { hasText: 'Submit a new direction to continue.' });
    this.headerMeta = header.locator('.phead__meta');
    this.calloutNewBudget = this.budgetReachedCallout.getByLabel('New budget');
    this.raiseBudget = this.budgetReachedCallout.getByRole('button', { name: 'Raise budget and resume' });
    this.raiseDialog = page.getByRole('dialog', { name: /^Raise .+’s budget$/ });
    this.dialogPanel = this.raiseDialog.locator('.dialog__panel');
    this.dialogFooter = this.raiseDialog.locator('.dialog__footer');
    this.dialogBudget = this.raiseDialog.getByLabel('New budget');
    this.dialogBudgetError = this.raiseDialog.locator('#new-budget-err');
    this.dialogConfirm = this.raiseDialog.getByRole('button', { name: /Raise and resume|Saving…/ });
    this.dialogCancel = this.raiseDialog.getByRole('button', { name: 'Cancel' });
    this.dialogFailure = this.raiseDialog.getByRole('alert').filter({ hasText: 'The budget wasn’t changed' });
  }

  /** Resolves once the cancel dialog's entrance animation has finished, so its colours are final. */
  async cancelDialogSettled(): Promise<void> {
    await this.cancelDialog
      .locator('.dialog__panel')
      .evaluate((panel) => Promise.all(panel.getAnimations().map((a) => a.finished)));
  }

  /** The pull requests the fake GitHub holds for the project's repository (e2e stack only). */
  async pullRequests(
    repository: string,
  ): Promise<{ number: number; open: boolean; merged: boolean; labels: string[] }[]> {
    const response = await this.page.request.get(`/api/fakes/github/${repository}/pulls`);
    if (!response.ok()) throw new Error(`pulls: ${response.status()}`);
    return (await response.json()) as { number: number; open: boolean; merged: boolean; labels: string[] }[];
  }

  /** The project's repository as the fake GitHub holds it: private or not, its topics and required checks (e2e stack only). */
  async gitHubRepository(
    repository: string,
  ): Promise<{ owner: string; name: string; private: boolean; topics: string[]; requiredChecks: string[] }> {
    const response = await this.page.request.get(`/api/fakes/github/${repository}`);
    if (!response.ok()) throw new Error(`repository: ${response.status()}`);
    return (await response.json()) as {
      owner: string;
      name: string;
      private: boolean;
      topics: string[];
      requiredChecks: string[];
    };
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

  /** Rests the pointer on the dialog's title and focus in its field, so its buttons show at rest as the mocks do. */
  async restInDialog(): Promise<void> {
    await this.raiseDialog.getByRole('heading').hover();
    await this.dialogBudget.focus();
  }

  /** A button or link under a toast, such as the blocked toast's Open log and Retry stage. */
  toastAction(toast: Locator, name: string): Locator {
    return toast.getByRole('link', { name }).or(toast.getByRole('button', { name }));
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
