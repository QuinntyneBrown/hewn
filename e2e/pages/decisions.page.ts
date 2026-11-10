import type { Locator, Page } from '@playwright/test';

/** A project's Decisions tab (/projects/{id}/decisions?stage=). Owns every selector for it. */
export class DecisionsPage {
  readonly tabs: Locator;
  readonly section: Locator;
  readonly stage: Locator;
  readonly list: Locator;
  readonly decisions: Locator;
  readonly empty: Locator;
  readonly noResults: Locator;
  readonly showAllStages: Locator;
  readonly failure: Locator;
  readonly tryAgain: Locator;
  readonly loading: Locator;

  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.tabs = page.getByRole('navigation', { name: 'Project sections' });
    this.section = page
      .locator('.narrow')
      .filter({ has: page.getByRole('heading', { name: 'Decisions', exact: true }) });
    this.stage = page.getByRole('combobox', { name: 'Stage' });
    this.list = this.section.locator('ol');
    this.decisions = this.list.locator('li.decision');
    this.empty = page.locator('.empty').filter({ hasText: 'No decisions yet' });
    this.noResults = page.locator('.empty').filter({ hasText: /^No decisions in / });
    this.showAllStages = this.noResults.getByRole('link', { name: 'Show all stages' });
    this.failure = page.getByRole('alert').filter({ hasText: 'Decisions couldn’t load' });
    this.tryAgain = this.failure.getByRole('button', { name: 'Try again' });
    this.loading = page.getByText('Loading decisions');
  }

  async open(projectId: string, stage?: number): Promise<void> {
    await this.page.goto(`/projects/${projectId}/decisions${stage === undefined ? '' : `?stage=${stage}`}`);
    await this.tab('Decisions').waitFor();
  }

  tab(name: 'Pipeline' | 'Decisions' | 'Artifacts'): Locator {
    return this.tabs.getByRole('link', { name, exact: true });
  }

  async filterBy(stage: string): Promise<void> {
    await this.stage.selectOption({ label: stage });
  }

  /** The questions listed, in order. */
  questions(): Promise<string[]> {
    return this.decisions.locator('.decision__q').allInnerTexts();
  }

  decision(question: string | RegExp): {
    item: Locator;
    when: Locator;
    stage: Locator;
    answer: Locator;
    rationale: Locator;
    commit: Locator;
    adr: Locator;
  } {
    const item = this.decisions.filter({ has: this.page.locator('.decision__q', { hasText: question }) });
    return {
      item,
      when: item.locator('.decision__when .text-muted'),
      stage: item.locator('.decision__when .text-subtle'),
      answer: item.locator('.decision__a'),
      rationale: item.locator('.decision__why'),
      commit: item.getByRole('link', { name: /^Open commit / }),
      adr: item.getByRole('link', { name: /ADR \d{4}/ }),
    };
  }
}
