import type { Locator, Page } from '@playwright/test';

export interface WorkerSummary {
  id: string;
  name: string;
  status: string;
  online: boolean;
  holding: boolean;
  workingOn: { projectId: string; projectName: string } | null;
}

/**
 * The Workers page (/workers) and the controls every page shares for them: the sidebar's Stop all workers and
 * Start workers, the stopped banner, and the Stop all workers dialog. Owns every selector for them.
 */
export class WorkersPage {
  readonly heading: Locator;
  readonly rows: Locator;
  readonly stopAllButton: Locator;
  readonly startWorkersButton: Locator;
  readonly stoppedBanner: Locator;
  readonly stopDialog: Locator;
  readonly stopDialogText: Locator;
  readonly stopDialogWorkers: Locator;
  readonly stopDialogFooter: Locator;
  readonly stopConfirm: Locator;
  readonly stopping: Locator;
  readonly stopTryAgain: Locator;
  readonly stopCancel: Locator;
  readonly stopFailure: Locator;
  readonly newTokenButton: Locator;
  readonly content: Locator;
  readonly loading: Locator;
  readonly empty: Locator;
  readonly emptyNewToken: Locator;
  readonly loadFailure: Locator;
  readonly tryAgain: Locator;
  readonly tokenDialog: Locator;
  readonly tokenPanel: Locator;
  readonly tokenName: Locator;
  readonly tokenNameError: Locator;
  readonly tokenExpiry: Locator;
  readonly createToken: Locator;
  readonly creatingToken: Locator;
  readonly tokenCancel: Locator;
  readonly tokenFailure: Locator;
  readonly tokenCreated: Locator;
  readonly createdToken: Locator;
  readonly copyToken: Locator;
  readonly startCommand: Locator;
  readonly tokenDone: Locator;
  readonly revokeDialog: Locator;
  readonly revokePanel: Locator;
  readonly revokeConfirm: Locator;
  readonly revokeTryAgain: Locator;
  readonly revokeFailure: Locator;

  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { level: 1, name: 'Workers' });
    this.rows = page.getByRole('list', { name: 'Workers' }).getByRole('listitem');
    this.stopAllButton = page.locator('.sidebar__foot').getByRole('button', { name: 'Stop all workers' });
    this.startWorkersButton = page.locator('.sidebar__foot').getByRole('button', { name: /Start(ing)? workers/ });
    this.stoppedBanner = page.locator('.strip[role="status"]', { hasText: 'All workers stopped' });
    this.stopDialog = page.getByRole('alertdialog', { name: 'Stop all workers?' });
    this.stopDialogText = this.stopDialog.locator('.dialog__text');
    this.stopDialogWorkers = this.stopDialog.getByRole('list', { name: 'Online workers' }).getByRole('listitem');
    this.stopDialogFooter = this.stopDialog.locator('.dialog__footer');
    this.stopConfirm = this.stopDialog.getByRole('button', { name: 'Stop all workers' });
    this.stopping = this.stopDialog.getByRole('button', { name: /Stopping \d+ workers?…/ });
    this.stopTryAgain = this.stopDialog.getByRole('button', { name: 'Try again' });
    this.stopCancel = this.stopDialog.getByRole('button', { name: 'Cancel' });
    this.stopFailure = this.stopDialog.getByRole('alert');
    this.newTokenButton = page.locator('.page-header').getByRole('button', { name: 'New worker token' });
    this.content = page.locator('main .pad').first();
    this.loading = page.locator('main [aria-busy="true"]', { hasText: 'Loading workers' });
    this.empty = page.locator('main .empty:not(.empty--error)');
    this.emptyNewToken = this.empty.getByRole('button', { name: 'New worker token' });
    this.loadFailure = page.getByRole('alert').filter({ hasText: 'Workers couldn’t load' });
    this.tryAgain = this.loadFailure.getByRole('button', { name: 'Try again' });
    this.tokenDialog = page.getByRole('dialog', { name: 'New worker token' });
    this.tokenPanel = this.tokenDialog.locator('.dialog__panel');
    this.tokenName = this.tokenDialog.getByLabel('Worker name');
    this.tokenNameError = this.tokenDialog.locator('.field__error');
    this.tokenExpiry = this.tokenDialog.getByLabel('Expires');
    this.createToken = this.tokenDialog.getByRole('button', { name: 'Create token' });
    this.creatingToken = this.tokenDialog.getByRole('button', { name: 'Creating token…' });
    this.tokenCancel = this.tokenDialog.getByRole('button', { name: 'Cancel' });
    this.tokenFailure = this.tokenDialog.getByRole('alert');
    this.tokenCreated = this.tokenDialog.getByRole('status');
    this.createdToken = this.tokenDialog.locator('.codebox code');
    this.copyToken = this.tokenDialog.getByRole('button', { name: /^(Copy token|Token copied)$/ });
    this.startCommand = this.tokenDialog.getByRole('region', { name: 'Docker command to start the worker' });
    this.tokenDone = this.tokenDialog.getByRole('button', { name: 'Done' });
    this.revokeDialog = page.getByRole('alertdialog', { name: /^Revoke .+\?$/ });
    this.revokePanel = this.revokeDialog.locator('.dialog__panel');
    this.revokeConfirm = this.revokeDialog.getByRole('button', { name: 'Revoke token' });
    this.revokeTryAgain = this.revokeDialog.getByRole('button', { name: 'Try again' });
    this.revokeFailure = this.revokeDialog.getByRole('alert');
  }

  async open(): Promise<void> {
    await this.page.goto('/workers');
    await this.heading.waitFor();
  }

  /** The rows whose status reads exactly this label (Leased, Idle or Offline). */
  withStatus(label: string): Locator {
    return this.rows.filter({ has: this.page.locator('.lg-only .status').getByText(label, { exact: true }) });
  }

  /** The row for a worker, by host name. */
  row(name: string): Locator {
    return this.rows.filter({ hasText: name });
  }

  /** Where a worker runs (Local or Cloud), its status, what it works on and when it was last heard from. */
  details(name: string): { location: Locator; status: Locator; workingOn: Locator; seen: Locator } {
    const row = this.row(name);
    return {
      location: row.locator('.cluster.text-muted'),
      status: row.locator('.lg-only .status'),
      workingOn: row.locator('.row__span'),
      seen: row.locator('.lg-row-end'),
    };
  }

  /** Where the worker runs, in the New worker token dialog. */
  tokenLocation(location: 'Local' | 'Cloud'): Locator {
    return this.tokenDialog.getByRole('radio', { name: new RegExp(`^${location}`) });
  }

  /** Fills New worker token without creating it. */
  async fillToken(name: string, location: 'Local' | 'Cloud' = 'Cloud', expiry = 'In 90 days'): Promise<void> {
    await this.newTokenButton.click();
    await this.tokenName.fill(name);
    await this.tokenLocation(location).check();
    await this.tokenExpiry.selectOption({ label: expiry });
  }

  /** Creates a token through the dialog and returns it, as shown once; the dialog stays open on it. */
  async newToken(name: string, location: 'Local' | 'Cloud' = 'Cloud', expiry = 'In 90 days'): Promise<string> {
    await this.fillToken(name, location, expiry);
    await this.createToken.click();
    await this.tokenCreated.waitFor();
    return (await this.createdToken.innerText()).trim();
  }

  /** A row's Revoke button. */
  revoke(name: string): Locator {
    return this.page.getByRole('button', { name: `Revoke ${name}`, exact: true });
  }

  /** Posts a token request as the signed-in user; returns the status and the raw body. */
  async postToken(body: object): Promise<{ status: number; text: string }> {
    const response = await this.page.request.post('/api/worker-tokens', {
      data: body,
      headers: { 'X-XSRF-TOKEN': await this.xsrf() },
    });
    return { status: response.status(), text: await response.text() };
  }

  /** Posts Revoke for a worker as the signed-in user; returns the HTTP status. */
  async postRevoke(workerId: string): Promise<number> {
    const response = await this.page.request.post(`/api/workers/${workerId}/revoke`, {
      data: {},
      headers: { 'X-XSRF-TOKEN': await this.xsrf() },
    });
    return response.status();
  }

  /** Every response body the API gave the page for /api/workers, to show no token is in any of them. */
  async rawWorkers(): Promise<string> {
    return (await this.page.request.get('/api/workers')).text();
  }

  /** Serves this list of workers to the page instead of the API's. */
  async serveWorkers(workers: object[]): Promise<void> {
    await this.page.route('**/api/workers', (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ json: { leasing: { stopped: false, changedBy: null, changedAt: null }, workers } })
        : route.fallback(),
    );
  }

  /** Answers the workers list like this: held (loading) or a status (failed). Unroute it to answer normally. */
  async answerWorkers(answer: 'hold' | number): Promise<void> {
    await this.page.route('**/api/workers', (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      if (answer === 'hold') return;
      return route.fulfill({ status: answer, json: { title: 'Unavailable', status: answer } });
    });
  }

  /** Answers the next token requests like this: held (busy), a status, or a created token. */
  async answerTokens(answer: 'hold' | number | object): Promise<void> {
    await this.page.route('**/api/worker-tokens', (route) => {
      if (answer === 'hold') return;
      return typeof answer === 'number'
        ? route.fulfill({ status: answer, json: { title: 'Failed', status: answer } })
        : route.fulfill({ status: 201, json: answer });
    });
  }

  /** Answers Revoke like this: held (busy) or a status. */
  async answerRevoke(answer: 'hold' | number): Promise<void> {
    await this.page.route('**/api/workers/*/revoke', (route) =>
      answer === 'hold' ? undefined : route.fulfill({ status: answer, json: { title: 'Failed', status: answer } }),
    );
  }

  /** Waits for an open dialog's entrance (panel and backdrop) to finish, so what it shows is what stays. */
  async dialogSettled(): Promise<void> {
    await this.page.evaluate(() =>
      Promise.all(
        [...document.querySelectorAll('.dialog, .dialog__panel, .cdk-overlay-backdrop')].flatMap((el) =>
          el.getAnimations().map((a) => a.finished),
        ),
      ),
    );
  }

  async stopDialogSettled(): Promise<void> {
    await this.stopDialog
      .locator('.dialog__panel')
      .evaluate((panel) => Promise.all(panel.getAnimations().map((a) => a.finished)));
  }

  /** The workers and the leasing switch, as the API serves them to Mission Control. */
  async workers(): Promise<{ leasing: { stopped: boolean }; workers: WorkerSummary[] }> {
    const response = await this.page.request.get('/api/workers');
    if (!response.ok()) throw new Error(`workers: ${response.status()}`);
    return (await response.json()) as { leasing: { stopped: boolean }; workers: WorkerSummary[] };
  }

  /** Posts Stop or Start as the signed-in user; returns the HTTP status. */
  async post(action: 'stop' | 'start'): Promise<number> {
    const response = await this.page.request.post(`/api/workers/${action}`, {
      data: {},
      headers: { 'X-XSRF-TOKEN': await this.xsrf() },
    });
    return response.status();
  }

  private async xsrf(): Promise<string> {
    await this.page.request.get('/api/me');
    const cookies = await this.page.context().cookies();
    return cookies.find((c) => c.name === 'XSRF-TOKEN')?.value ?? '';
  }
}
