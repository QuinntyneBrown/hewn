import type { Locator, Page } from '@playwright/test';

/** One project's row on the Projects page, cell by cell. */
export interface ProjectRow {
  root: Locator;
  title: Locator;
  idea: Locator;
  stage: Locator;
  note: Locator;
  status: Locator;
  percent: Locator;
  spend: Locator;
  activity: Locator;
  /** Archive, for an Owner, on a project with no active direction (L2-003 AC1). */
  archive: Locator;
  /** The disabled Archive on a project with an active direction (L2-003 AC2). */
  archiveRefused: Locator;
  /** Restore, for an Owner, on an archived project (L2-003 AC1). */
  restore: Locator;
}

/** The Projects page (/projects): the filter tabs, the rows and the empty, loading and error states. Owns every selector for it. */
export class ProjectsPage {
  readonly heading: Locator;
  readonly summary: Locator;
  readonly headerNewProduct: Locator;
  readonly filters: Locator;
  readonly list: Locator;
  readonly rows: Locator;
  readonly empty: Locator;
  readonly emptyTitle: Locator;
  readonly emptyText: Locator;
  readonly emptyNewProduct: Locator;
  readonly showAll: Locator;
  readonly failure: Locator;
  readonly tryAgain: Locator;
  /** Live toasts, such as "Saltmarsh Survey archived". */
  readonly toasts: Locator;

  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { level: 1, name: 'Projects' });
    this.summary = page.locator('.page-header__desc');
    this.headerNewProduct = page.locator('.page-header').getByRole('link', { name: 'New product' });
    this.filters = page.getByRole('navigation', { name: 'Filter by status' });
    this.list = page.locator('.rows');
    this.rows = page.getByRole('list', { name: 'Projects' }).getByRole('listitem');
    this.empty = page.locator('.empty');
    this.emptyTitle = this.empty.locator('.empty__title');
    this.emptyText = this.empty.locator('.empty__text');
    this.emptyNewProduct = this.empty.getByRole('link', { name: 'New product' });
    this.showAll = this.empty.getByRole('link', { name: 'Show all projects' });
    this.failure = page.getByRole('alert').filter({ hasText: 'Projects couldn’t load' });
    this.tryAgain = this.failure.getByRole('button', { name: 'Try again' });
    this.toasts = page.locator('.toast-region .toast');
  }

  /** The toast with this title. */
  toast(title: string): Locator {
    return this.toasts.filter({ has: this.page.locator('.toast__title', { hasText: title }) });
  }

  /** Waits until the toast with this title is in and its entrance animation has finished. */
  async toastSettled(title: string): Promise<void> {
    const toast = this.toast(title);
    await toast.waitFor();
    await toast.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  }

  /** Answers the next archive request with this problem, as the API does when a direction started meanwhile. */
  async refuseArchive(status: number, title: string, code: string): Promise<void> {
    await this.page.route(
      (url) => /^\/api\/projects\/[^/]+\/archive$/.test(url.pathname),
      (route) => route.fulfill({ status, json: { status, title, code }, contentType: 'application/problem+json' }),
      { times: 1 },
    );
  }

  async open(query = ''): Promise<void> {
    await this.page.goto(`/projects${query}`);
    await this.heading.waitFor();
  }

  /** The filter tab for a status, or All. */
  tab(name: string): Locator {
    return this.filters.getByRole('link', { name: new RegExp(`^${name}( \\d+)?$`) });
  }

  /** The count beside a status tab. */
  tabCount(name: string): Locator {
    return this.tab(name).locator('.count');
  }

  /** The row of the project with this name. */
  row(name: string): ProjectRow {
    return this.cells(this.rows.filter({ has: this.page.getByRole('link', { name, exact: true }) }));
  }

  /** The row at this position, newest activity first. */
  rowAt(index: number): ProjectRow {
    return this.cells(this.rows.nth(index));
  }

  /** The status every visible row shows, top to bottom. */
  async statuses(): Promise<string[]> {
    return (await this.rows.locator('.lg-only .status').allTextContents()).map((s) => s.trim());
  }

  private cells(root: Locator): ProjectRow {
    return {
      root,
      title: root.locator('.row__title'),
      idea: root.locator('.row__sub'),
      stage: root.locator('.row__span > span').first(),
      note: root.locator('.row__note'),
      status: root.locator('.lg-only .status'),
      percent: root.locator('.pct'),
      spend: root.locator('.row__end.tabular'),
      activity: root.locator('.row__end.text-subtle'),
      archive: root.locator('.row__actions').getByRole('button', { name: /^Archive [^:]*$/ }),
      archiveRefused: root.locator('.row__actions [aria-disabled="true"]'),
      restore: root.locator('.row__actions').getByRole('button', { name: /^Restore / }),
    };
  }
}
