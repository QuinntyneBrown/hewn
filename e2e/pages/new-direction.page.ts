import type { Locator, Page } from '@playwright/test';

export interface FeatureInput {
  /** The product's name as the Product list shows it. */
  product: string;
  feature: string;
  budget?: string;
}

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
  readonly productMode: Locator;
  readonly featureMode: Locator;
  readonly product: Locator;
  readonly productHint: Locator;
  readonly feature: Locator;
  readonly featureHint: Locator;
  readonly planNote: Locator;

  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
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
    this.productMode = page.getByRole('radio', { name: 'New product' });
    this.featureMode = page.getByRole('radio', { name: 'Feature for a product' });
    this.product = page.getByLabel('Product', { exact: true });
    this.productHint = page.locator('#product-hint');
    this.feature = page.getByLabel('Feature', { exact: true });
    this.featureHint = page.locator('#feature-hint');
    this.planNote = this.plan.locator('p');
  }

  /** A stage in the "What runs next" rail; skipped stages are struck through. */
  planStage(name: string): Locator {
    return this.plan.locator('li').filter({ hasText: new RegExp(`^${name}`) });
  }

  /** Stage names the rail strikes through as skipped. */
  async skippedInPlan(): Promise<string[]> {
    return this.plan.locator('li .skip').allTextContents();
  }

  /** The option for a product in the Product list. */
  productOption(name: string): Locator {
    return this.product.locator('option', { hasText: name });
  }

  async fillFeature(input: FeatureInput): Promise<void> {
    await this.featureMode.click();
    const option = this.productOption(input.product);
    await option.waitFor({ state: 'attached' });
    await this.product.selectOption({ label: (await option.textContent())!.trim() });
    await this.feature.fill(input.feature);
    if (input.budget !== undefined) {
      await this.budget.fill(input.budget);
    }
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
  errorFor(field: 'name' | 'idea' | 'repo' | 'budget' | 'feature'): Locator {
    return this.page.locator(`#${field}-err`);
  }

  summaryLink(text: string): Locator {
    return this.errorSummary.getByRole('link', { name: text });
  }
}
