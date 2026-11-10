import type { Locator, Page } from '@playwright/test';

export type TraceColumn = 'Designs' | 'Journeys' | 'Acceptance tests' | 'Pull requests';

/** A project's Traceability tab (/projects/{id}/traceability?l2=): its L2s and one L2's trace. Owns every selector for it. */
export class TraceabilityPage {
  readonly tabs: Locator;
  readonly requirements: Locator;
  readonly search: Locator;
  readonly links: Locator;
  readonly noMatch: Locator;
  readonly trace: Locator;
  readonly id: Locator;
  readonly title: Locator;
  readonly l1: Locator;
  readonly noAcceptanceTest: Locator;
  readonly deferred: Locator;
  readonly columns: Locator;
  readonly empty: Locator;
  readonly failure: Locator;
  readonly tryAgain: Locator;
  readonly loading: Locator;

  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.tabs = page.getByRole('navigation', { name: 'Project sections' });
    this.requirements = page.getByRole('navigation', { name: 'Requirements' });
    this.search = this.requirements.getByRole('searchbox', { name: 'Find an L2' });
    this.links = this.requirements.locator('.req-link');
    this.noMatch = this.requirements.getByRole('status');
    this.trace = page.getByRole('region', { name: /^Trace for / });
    this.id = this.trace.locator('p.text-accent');
    this.title = this.trace.getByRole('heading', { level: 2 });
    this.l1 = this.trace.getByText(/^Traces to /);
    this.noAcceptanceTest = this.trace.locator('.pill--warn');
    this.deferred = this.trace.locator('p').filter({ hasText: /^Deferred\./ });
    this.columns = this.trace.locator('.trace');
    this.empty = page.locator('.empty').filter({ hasText: 'No requirements yet' });
    this.failure = page.getByRole('alert').filter({ hasText: 'Traceability couldn’t load' });
    this.tryAgain = this.failure.getByRole('button', { name: 'Try again' });
    this.loading = page.getByText('Loading requirements');
  }

  async open(projectId: string, l2?: string): Promise<void> {
    await this.page.goto(`/projects/${projectId}/traceability${l2 ? `?l2=${l2}` : ''}`);
    await this.tab('Traceability').waitFor();
  }

  tab(name: 'Pipeline' | 'Artifacts' | 'Traceability'): Locator {
    return this.tabs.getByRole('link', { name, exact: true });
  }

  link(id: string): Locator {
    return this.links.filter({ has: this.page.getByText(id, { exact: true }) });
  }

  /** The IDs listed, in order. */
  ids(): Promise<string[]> {
    return this.links.locator('.req-link__id').allInnerTexts();
  }

  column(name: TraceColumn): { count: Locator; items: Locator; empty: Locator } {
    const column = this.trace.locator('.trace__col').filter({ has: this.page.getByRole('heading', { name }) });
    return {
      count: column.locator('.trace__head span').nth(1),
      items: column.locator('.trace__items > li'),
      empty: column.locator('.trace__empty'),
    };
  }
}
