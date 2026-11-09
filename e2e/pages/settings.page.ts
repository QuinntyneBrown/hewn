import type { Locator, Page } from '@playwright/test';

/** Settings (/settings): the Direction defaults section. Owns every selector for the page. */
export class SettingsPage {
  readonly heading: Locator;
  readonly defaults: Locator;
  readonly defaultBudget: Locator;
  readonly defaultBudgetField: Locator;
  readonly defaultBudgetError: Locator;
  readonly save: Locator;
  readonly errorSummary: Locator;
  readonly savedCallout: Locator;
  readonly readOnlyCallout: Locator;

  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { level: 1 });
    this.defaults = page.getByRole('form', { name: 'Direction defaults' });
    this.defaultBudget = page.getByLabel('Default budget per direction');
    this.defaultBudgetField = this.defaults.locator('.field').first();
    this.defaultBudgetError = page.locator('#default-budget-err');
    this.save = page.getByRole('button', { name: /Save defaults|Saving…/ });
    this.errorSummary = page.locator('.form-summary');
    this.savedCallout = page.locator('.callout--ok', { hasText: 'Defaults saved' });
    this.readOnlyCallout = page.locator('.callout', { hasText: 'Read-only for Viewers' });
  }

  async open(): Promise<void> {
    await this.page.goto('/settings');
    await this.heading.waitFor();
  }

  async setDefaultBudget(value: string): Promise<void> {
    await this.defaultBudget.fill(value);
    await this.save.click();
  }

  /** Puts the shared default back through the API, so other suites see the configured $300. */
  async resetDefaultBudget(budget = 300): Promise<void> {
    const response = await this.page.request.put('/api/settings/direction-defaults', {
      data: { defaultBudgetUsd: budget },
      headers: { 'X-XSRF-TOKEN': await this.xsrf() },
    });
    if (!response.ok()) throw new Error(`reset default budget: ${response.status()}`);
  }

  private async xsrf(): Promise<string> {
    await this.page.request.get('/api/me');
    const cookies = await this.page.context().cookies();
    return cookies.find((c) => c.name === 'XSRF-TOKEN')?.value ?? '';
  }
}
