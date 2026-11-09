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
    };
  }
}
