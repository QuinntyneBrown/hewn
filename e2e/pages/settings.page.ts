import type { Locator, Page } from '@playwright/test';

/** One login in "Who can sign in". */
export interface AccessRow {
  row: Locator;
  role: Locator;
  lastSignIn: Locator;
  remove: Locator;
}

/**
 * Settings (/settings): Appearance, Who can sign in, its Add a GitHub login dialog, and Direction defaults (the default budget and
 * the descope threshold). Owns every selector.
 */
export class SettingsPage {
  readonly heading: Locator;
  /** Appearance: the Theme radio group, which saves on this device as soon as it changes (L2-048). */
  readonly appearance: Locator;
  readonly theme: Locator;
  readonly defaults: Locator;
  readonly defaultBudget: Locator;
  readonly defaultBudgetField: Locator;
  readonly defaultBudgetError: Locator;
  readonly threshold: Locator;
  readonly thresholdField: Locator;
  readonly thresholdError: Locator;
  readonly save: Locator;
  readonly errorSummary: Locator;
  readonly savedCallout: Locator;
  readonly readOnlyCallout: Locator;
  readonly access: Locator;
  readonly accessBody: Locator;
  /** The first section's skeleton while the saved defaults load. */
  readonly loadingSection: Locator;
  readonly accessRows: Locator;
  readonly addLogin: Locator;
  readonly addDialog: Locator;
  readonly addPanel: Locator;
  readonly addLoginField: Locator;
  readonly addLoginInput: Locator;
  readonly addLoginError: Locator;
  readonly addViewer: Locator;
  readonly addOwner: Locator;
  readonly addConfirm: Locator;
  readonly adding: Locator;
  readonly addCancel: Locator;
  readonly addFailure: Locator;

  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { level: 1 });
    this.appearance = page.getByRole('region', { name: 'Appearance' });
    this.theme = this.appearance.getByRole('group', { name: 'Theme' });
    this.defaults = page.getByRole('form', { name: 'Direction defaults' });
    this.defaultBudget = page.getByLabel('Default budget per direction');
    this.defaultBudgetField = this.defaults.locator('.field').first();
    this.defaultBudgetError = page.locator('#default-budget-err');
    this.threshold = page.getByLabel('Descope threshold');
    this.thresholdField = this.defaults.locator('.field').nth(1);
    this.thresholdError = page.locator('#threshold-err');
    this.save = page.getByRole('button', { name: /Save defaults|Saving…/ });
    this.errorSummary = page.locator('.form-summary');
    this.savedCallout = page.locator('.callout--ok', { hasText: 'Defaults saved' });
    this.readOnlyCallout = page.locator('.callout', { hasText: 'Read-only for Viewers' });
    this.access = page.getByRole('region', { name: 'Who can sign in' });
    this.accessBody = this.access.locator('.settings-section__body');
    this.loadingSection = page.locator('[aria-busy="true"] > .settings-section').first();
    this.accessRows = this.access.getByRole('list', { name: 'Who can sign in' }).getByRole('listitem');
    this.addLogin = this.access.getByRole('button', { name: 'Add a GitHub login' });
    this.addDialog = page.getByRole('dialog', { name: 'Add a GitHub login' });
    this.addPanel = this.addDialog.locator('.dialog__panel');
    this.addLoginField = this.addDialog.locator('.field').first();
    this.addLoginInput = this.addDialog.getByLabel('GitHub login');
    this.addLoginError = this.addDialog.locator('#login-err');
    this.addViewer = this.addDialog.getByRole('radio', { name: /^Viewer/ });
    this.addOwner = this.addDialog.getByRole('radio', { name: /^Owner/ });
    this.addConfirm = this.addDialog.getByRole('button', { name: 'Add to allow list' });
    this.adding = this.addDialog.getByRole('button', { name: 'Adding…' });
    this.addCancel = this.addDialog.getByRole('button', { name: 'Cancel' });
    this.addFailure = this.addDialog.getByRole('alert');
  }

  /** The Light, Dark or System radio in Appearance. */
  themeChoice(name: 'Light' | 'Dark' | 'System'): Locator {
    return this.theme.getByRole('radio', { name: new RegExp(`^${name}`) });
  }

  /** The row for `login` in Who can sign in. */
  accessRow(login: string): AccessRow {
    const row = this.accessRows.filter({ has: this.page.locator('.mono', { hasText: new RegExp(`^${login}$`) }) });
    return {
      row,
      role: row.locator('.text-sm'),
      lastSignIn: row.locator('.text-subtle'),
      remove: row.getByRole('button', { name: `Remove ${login}` }),
    };
  }

  /** Opens Add a GitHub login and fills it in, without confirming. Resolves once its entrance has finished. */
  async fillAdd(login: string, role: 'Viewer' | 'Owner' = 'Viewer'): Promise<void> {
    await this.addLogin.click();
    await this.addPanel.evaluate((panel) => Promise.all(panel.getAnimations().map((a) => a.finished)));
    await this.addLoginInput.fill(login);
    await (role === 'Owner' ? this.addOwner : this.addViewer).check();
  }

  /** Adds a login through the API, as another Owner would; already listed is fine. */
  async ensureListed(login: string, role: 'Viewer' | 'Owner' = 'Viewer'): Promise<void> {
    const response = await this.page.request.post('/api/allow-list', {
      data: { login, role },
      headers: { 'X-XSRF-TOKEN': await this.xsrf() },
    });
    if (!response.ok() && response.status() !== 400) throw new Error(`add ${login}: ${response.status()}`);
  }

  /** Answers the allow list with these entries instead of the API's, for comparing with the mock's cast. */
  async serveAllowList(entries: { login: string; role: string; lastSignInAt: string | null }[]): Promise<void> {
    await this.page.route('**/api/allow-list', (route) =>
      route.request().method() === 'GET' ? route.fulfill({ json: entries }) : route.fallback(),
    );
  }

  /** Holds the next add, so the dialog stays busy. */
  async holdAdd(): Promise<void> {
    await this.page.route('**/api/allow-list', (route) =>
      route.request().method() === 'POST' ? undefined : route.fallback(),
    );
  }

  /** A state change sent as the signed-in user would, with its anti-forgery token; returns the status. */
  async tryToChange(method: 'POST' | 'PUT' | 'DELETE', url: string, data: object = {}): Promise<number> {
    const response = await this.page.request.fetch(url, {
      method,
      data,
      headers: { 'X-XSRF-TOKEN': await this.xsrf() },
    });
    return response.status();
  }

  async open(): Promise<void> {
    await this.page.goto('/settings');
    await this.heading.waitFor();
  }

  async setDefaultBudget(value: string): Promise<void> {
    await this.defaultBudget.fill(value);
    await this.save.click();
  }

  async setThreshold(days: string): Promise<void> {
    await this.threshold.fill(days);
    await this.save.click();
  }

  /** Puts the shared defaults back through the API, so other suites see the configured $300 and 3 days. */
  async resetDefaultBudget(budget = 300, descopeThresholdDays = 3): Promise<void> {
    const response = await this.page.request.put('/api/settings/direction-defaults', {
      data: { defaultBudgetUsd: budget, descopeThresholdDays },
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
