import type { Locator, Page } from '@playwright/test';

/** The project header's skills update link and the Update skills dialog it opens (L2-008). Owns every selector. */
export class SkillsUpdate {
  readonly link: Locator;
  readonly dialog: Locator;
  readonly panel: Locator;
  readonly heading: Locator;
  readonly since: Locator;
  readonly commits: Locator;
  readonly update: Locator;
  readonly updating: Locator;
  readonly tryAgain: Locator;
  readonly notNow: Locator;
  readonly failure: Locator;
  readonly openedToast: Locator;

  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.link = page.locator('.phead__meta').getByRole('button', { name: /^Skills update available/ });
    this.dialog = page.getByRole('dialog', { name: /skills\?$/ });
    this.panel = this.dialog.locator('.dialog__panel');
    this.heading = this.dialog.getByRole('heading');
    this.since = this.dialog.locator('.field__label');
    this.commits = this.dialog.getByRole('list', { name: 'Greenlit commits' }).getByRole('listitem');
    this.update = this.dialog.getByRole('button', { name: 'Update skills' });
    this.updating = this.dialog.getByRole('button', { name: 'Updating skills…' });
    this.tryAgain = this.dialog.getByRole('button', { name: 'Try again' });
    this.notNow = this.dialog.getByRole('button', { name: 'Not now' });
    this.failure = this.dialog.getByRole('alert');
    this.openedToast = page.locator('.toast', { hasText: 'Skills update opened' });
  }

  /** Opens the dialog from the header link; resolves once its entrance has finished. */
  async open(): Promise<void> {
    await this.link.click();
    await this.panel.evaluate((panel) => Promise.all(panel.getAnimations().map((a) => a.finished)));
  }

  /** Answers GET skills-update with this body instead of the API's, for comparing with the mock's commits. */
  async serve(body: unknown): Promise<void> {
    await this.page.route(
      (url) => /^\/api\/projects\/[^/]+\/skills-update$/.test(url.pathname),
      (route) => (route.request().method() === 'GET' ? route.fulfill({ json: body }) : route.fallback()),
    );
  }

  /** Holds the next Update skills request, so the dialog stays busy. */
  async holdUpdate(): Promise<void> {
    await this.page.route(
      (url) => /^\/api\/projects\/[^/]+\/skills-update$/.test(url.pathname),
      (route) => (route.request().method() === 'POST' ? undefined : route.fallback()),
    );
  }

  /** Answers the next Update skills request with this problem. */
  async failUpdate(status: number, title: string, code: string): Promise<void> {
    await this.page.route(
      (url) => /^\/api\/projects\/[^/]+\/skills-update$/.test(url.pathname),
      (route) =>
        route.request().method() === 'POST'
          ? route.fulfill({ status, json: { status, title, code }, contentType: 'application/problem+json' })
          : route.fallback(),
      { times: 1 },
    );
  }
}
