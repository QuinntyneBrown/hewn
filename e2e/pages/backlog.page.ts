import type { Locator, Page } from '@playwright/test';

/** One increment's row in the active backlog, cell by cell. */
export interface IncrementRow {
  root: Locator;
  number: Locator;
  title: Locator;
  journey: Locator;
  requirements: Locator;
  estimate: Locator;
  status: Locator;
  pullRequest: Locator;
}

/** A project's Backlog tab (/projects/{id}/backlog): the increments, the deferred designs and the states. Owns every selector for it. */
export class BacklogPage {
  readonly tabs: Locator;
  readonly active: Locator;
  readonly list: Locator;
  readonly rows: Locator;
  readonly totals: Locator;
  readonly blockedCallout: Locator;
  readonly deferredSection: Locator;
  readonly deferred: Locator;
  readonly empty: Locator;
  readonly emptyTitle: Locator;
  readonly openPipeline: Locator;
  readonly failure: Locator;
  readonly tryAgain: Locator;
  readonly loading: Locator;

  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.tabs = page.getByRole('navigation', { name: 'Project sections' });
    this.active = page.locator('.section').filter({ has: page.getByRole('heading', { name: 'Active backlog' }) });
    this.list = page.locator('.rows--backlog');
    this.rows = page.getByRole('list', { name: 'Active backlog' }).getByRole('listitem');
    this.totals = page.getByTestId('backlog-totals');
    this.blockedCallout = page.locator('.callout--danger');
    this.deferredSection = page.getByRole('region', { name: 'Deferred' });
    this.deferred = page.getByRole('list', { name: 'Deferred' }).getByRole('listitem');
    this.empty = page.locator('.section .empty');
    this.emptyTitle = this.empty.locator('.empty__title');
    this.openPipeline = page.getByRole('link', { name: 'Open the pipeline' });
    this.failure = page.getByRole('alert').filter({ hasText: 'The backlog couldn’t load' });
    this.tryAgain = this.failure.getByRole('button', { name: 'Try again' });
    this.loading = page.getByText('Loading the backlog');
  }

  async open(projectId: string): Promise<void> {
    await this.page.goto(`/projects/${projectId}/backlog`);
    await this.tab('Backlog').waitFor();
  }

  /** A section tab in the project header: Pipeline or Backlog. */
  tab(name: 'Pipeline' | 'Backlog'): Locator {
    return this.tabs.getByRole('link', { name, exact: true });
  }

  /** The increment with this number. */
  row(number: number): IncrementRow {
    return this.cells(this.rows.nth(number - 1));
  }

  /** The row of the increment with this title. */
  rowTitled(title: string): IncrementRow {
    return this.cells(this.rows.filter({ hasText: title }));
  }

  /** Every increment's status, top to bottom. */
  async statuses(): Promise<string[]> {
    return (await this.rows.locator('.lg-only .status').allTextContents()).map((s) => s.trim());
  }

  /** Every increment's title, top to bottom. */
  async titles(): Promise<string[]> {
    return (await this.rows.locator('.truncate:not(.col2)').allTextContents()).map((s) => s.trim());
  }

  /** A deferred design's title and reason. */
  deferredItem(index: number): { title: Locator; reason: Locator } {
    const item = this.deferred.nth(index);
    return { title: item.locator('.cluster .text-sm'), reason: item.locator(':scope > .text-muted') };
  }

  private cells(root: Locator): IncrementRow {
    return {
      root,
      number: root.locator('.text-mono-xs.tabular'),
      title: root.locator('.truncate:not(.col2)'),
      journey: root.locator('.col2.text-muted'),
      requirements: root.locator('.col2.truncate'),
      estimate: root.locator('.lg-only.row__end'),
      status: root.locator('.lg-only .status'),
      pullRequest: root.locator('.col2.row__end'),
    };
  }
}
