import type { Locator, Page } from '@playwright/test';

/**
 * Any Mission Control page held in its loading state or answered with a failure, by holding or failing the GET it
 * loads from; and the not-found page. Owns every selector for those states.
 */
export class PageStates {
  /** The region that is loading (aria-busy), in the main content. */
  readonly busy: Locator;
  /** The failure a page shows when its data couldn't load. */
  readonly failure: Locator;
  readonly notFound: Locator;

  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    const main = page.getByRole('main');
    this.busy = main.locator('[aria-busy="true"]').first();
    this.failure = main.getByRole('alert').first();
    this.notFound = page.getByRole('heading', { level: 1, name: 'Page not found' });
  }

  /** Leaves requests of `path` (exactly, without a query) unanswered, so the page stays loading or busy. */
  async hold(path: string, method = 'GET'): Promise<void> {
    await this.page.unrouteAll({ behavior: 'ignoreErrors' });
    await this.page.route(
      (url) => url.pathname === path,
      (route) => (route.request().method() === method ? undefined : route.fallback()),
    );
  }

  /** Answers requests of `path` with a ProblemDetails failure of `status`. */
  async fail(path: string, status = 503, method = 'GET'): Promise<void> {
    await this.page.unrouteAll({ behavior: 'ignoreErrors' });
    await this.page.route(
      (url) => url.pathname === path,
      (route) =>
        route.request().method() === method
          ? route.fulfill({
              status,
              contentType: 'application/problem+json',
              body: JSON.stringify({ title: 'Service unavailable', status }),
            })
          : route.fallback(),
    );
  }

  /** Stops holding or failing anything. */
  async release(): Promise<void> {
    await this.page.unrouteAll({ behavior: 'ignoreErrors' });
  }
}
