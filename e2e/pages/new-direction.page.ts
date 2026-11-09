import { Locator, Page } from '@playwright/test';

export interface DirectionInput {
  name: string;
  idea: string;
  stack?: string;
  repository?: string;
  budget?: string;
}

/** New direction (/projects/new). Owns every selector for the page. */
export class NewDirectionPage {
  readonly heading: Locator;
  readonly form: Locator;
  readonly plan: Locator;
  readonly name: Locator;
  readonly idea: Locator;
  readonly ideaHint: Locator;
  readonly stack: Locator;
  readonly repository: Locator;
  readonly budget: Locator;
  readonly start: Locator;
  readonly errorSummary: Locator;
  readonly failure: Locator;
  readonly forbidden: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.form = page.locator('form.form-col');
    this.plan = page.locator('aside.rail');
    this.name = page.getByLabel('Name', { exact: true });
    this.idea = page.getByLabel('Idea');
    this.ideaHint = page.locator('#idea-hint');
    this.stack = page.getByLabel(/^Stack/);
    this.repository = page.getByLabel(/^Existing repository/);
    this.budget = page.getByLabel('Budget');
    this.start = page.getByRole('button', { name: /Start direction|Queuing direction/ });
    this.errorSummary = page.locator('.form-summary');
    this.failure = page.getByRole('alert').filter({ hasText: 'couldn’t queue' });
    this.forbidden = page.getByRole('heading', { name: 'You don’t have permission' });
  }

  async open(): Promise<void> {
    await this.page.goto('/projects/new');
    await this.heading.waitFor();
  }

  async fill(input: DirectionInput): Promise<void> {
    await this.name.fill(input.name);
    await this.idea.fill(input.idea);
    await this.stack.fill(input.stack ?? '');
    await this.repository.fill(input.repository ?? '');
    if (input.budget !== undefined) {
      await this.budget.fill(input.budget);
    }
  }

  async submit(): Promise<void> {
    await this.start.click();
  }

  /** The inline error under a field, by its label. */
  errorFor(field: 'name' | 'idea' | 'repo' | 'budget'): Locator {
    return this.page.locator(`#${field}-err`);
  }

  summaryLink(text: string): Locator {
    return this.errorSummary.getByRole('link', { name: text });
  }
}
