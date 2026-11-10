import type { Locator, Page } from '@playwright/test';

export interface WorkerSummary {
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
