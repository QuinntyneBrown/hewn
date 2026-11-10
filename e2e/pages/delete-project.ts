import type { Locator, Page } from '@playwright/test';

/** The Delete project dialog (L2-003 AC3), opened from a row's Delete on the Projects page. */
export class DeleteProjectDialog {
  readonly panel: Locator;
  readonly title: Locator;
  readonly text: Locator;
  readonly name: Locator;
  readonly hint: Locator;
  readonly error: Locator;
  readonly failure: Locator;
  readonly cancel: Locator;
  /** Delete project, or Try again after a failure. */
  readonly confirm: Locator;
  readonly deleting: Locator;

  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    const dialog = page.getByRole('alertdialog');
    this.panel = dialog.locator('.dialog__panel');
    this.title = dialog.locator('.dialog__title');
    this.text = dialog.locator('.dialog__text');
    this.name = dialog.getByRole('textbox');
    this.hint = dialog.locator('.field__hint');
    this.error = dialog.locator('.field__error');
    this.failure = dialog.getByRole('alert');
    this.cancel = dialog.getByRole('button', { name: 'Cancel' });
    this.confirm = dialog.getByRole('button', { name: /^(Delete project|Try again)$/ });
    this.deleting = dialog.getByRole('button', { name: 'Deleting…' });
  }

  /** Waits until the dialog's entrance animation has finished. */
  async settled(): Promise<void> {
    await this.panel.waitFor();
    await this.panel.evaluate((el) =>
      Promise.all(
        (el.closest('.cdk-overlay-container') ?? el)
          .getAnimations({ subtree: true })
          .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
          .map((a) => a.finished),
      ),
    );
  }

  /** Keeps the next delete request waiting, so the busy state stays on screen. */
  async holdDelete(): Promise<void> {
    await this.page.route(
      (url) => /^\/api\/projects\/[^/]+$/.test(url.pathname),
      (route) => (route.request().method() === 'DELETE' ? undefined : route.fallback()),
    );
  }

  /** Answers the next delete request with this problem. */
  async failDelete(status: number, title: string, code: string): Promise<void> {
    await this.page.route(
      (url) => /^\/api\/projects\/[^/]+$/.test(url.pathname),
      (route) =>
        route.request().method() === 'DELETE'
          ? route.fulfill({ status, json: { status, title, code }, contentType: 'application/problem+json' })
          : route.fallback(),
      { times: 1 },
    );
  }
}
