import type { Locator, Page } from '@playwright/test';

/** One row of the audit log as shown. */
export interface AuditRow {
  when: string;
  who: string;
  action: string;
  target: string;
  ip: string;
}

/** The Audit page (/audit, L2-044). Owns every selector for it. */
export class AuditPage {
  readonly heading: Locator;
  readonly description: Locator;
  readonly header: Locator;
  readonly projectFilter: Locator;
  readonly actionFilter: Locator;
  readonly table: Locator;
  readonly rows: Locator;
  readonly loading: Locator;
  readonly empty: Locator;
  readonly emptyTitle: Locator;
  readonly emptyText: Locator;
  readonly failure: Locator;
  readonly tryAgain: Locator;
  readonly clearFilters: Locator;
  readonly backToDashboard: Locator;
  readonly showOlder: Locator;
  readonly content: Locator;

  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    const main = page.locator('main');
    this.heading = main.getByRole('heading', { level: 1 });
    this.description = main.locator('.page-header__desc');
    this.header = main.locator('.page-header');
    this.projectFilter = main.getByRole('combobox', { name: 'Project' });
    this.actionFilter = main.getByRole('combobox', { name: 'Action' });
    this.table = main
      .locator('.table-wrap')
      .filter({ has: page.getByRole('table', { name: 'Audit log, newest first' }) });
    this.rows = this.table.locator('tbody tr');
    this.loading = main.locator('[aria-busy="true"]');
    this.empty = main.locator('.empty');
    this.emptyTitle = this.empty.locator('.empty__title');
    this.emptyText = this.empty.locator('.empty__text');
    this.failure = main.getByRole('alert');
    this.tryAgain = main.getByRole('button', { name: 'Try again' });
    this.clearFilters = main.getByRole('link', { name: 'Clear filters' });
    this.backToDashboard = main.getByRole('link', { name: 'Back to dashboard' });
    this.showOlder = main.getByRole('button', { name: 'Show older entries' });
    this.content = main.locator('.pad');
  }

  async open(query = ''): Promise<void> {
    await this.page.goto(`/audit${query}`);
  }

  /** Every row shown, top to bottom. */
  async entries(): Promise<AuditRow[]> {
    await this.rows.first().waitFor();
    return this.rows.evaluateAll((rows) =>
      rows.map((r) => {
        const cells = [...r.querySelectorAll('td')].map((c) => c);
        return {
          when: cells[0].textContent!.trim(),
          who: cells[1].textContent!.trim(),
          action: cells[2].querySelector('span')!.textContent!.trim(),
          target: cells[3].textContent!.trim(),
          ip: cells[4].textContent!.trim(),
        };
      }),
    );
  }

  /** The action label in a row, to check how it reads. */
  actionIn(row: number): Locator {
    return this.rows.nth(row).locator('td').nth(2).locator('span').first();
  }

  /** Answers the audit log with this body, as the API would. */
  async serve(log: unknown): Promise<void> {
    await this.page.route(
      (url) => url.pathname === '/api/audit',
      (route) => route.fulfill({ json: log }),
    );
  }

  /** Answers the audit log with this status. */
  async fail(status: number): Promise<void> {
    await this.page.route(
      (url) => url.pathname === '/api/audit',
      (route) => route.fulfill({ status, json: { status, title: 'Internal Server Error' } }),
      { times: 1 },
    );
  }

  /** Keeps the audit log request waiting, so the loading state stays on screen. */
  async hold(): Promise<void> {
    await this.page.route(
      (url) => url.pathname === '/api/audit',
      () => undefined,
    );
  }
}
