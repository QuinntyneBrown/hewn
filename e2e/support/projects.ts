import type { Page } from '@playwright/test';

/**
 * Answers GET /api/projects with these rows instead of the shared e2e database's. Only the list and its states
 * use it: the shared database always holds other suites' projects, so it cannot show an empty list, and the
 * visual tests need the mock's own rows. Everything else on the page still talks to the real API.
 */
export async function serveProjects(page: Page, rows: unknown[]): Promise<void> {
  await page.route(
    (url) => url.pathname === '/api/projects',
    (route) => (route.request().method() === 'GET' ? route.fulfill({ json: rows }) : route.fallback()),
  );
}
