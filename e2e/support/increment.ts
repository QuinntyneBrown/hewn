import type { Page } from '@playwright/test';

/**
 * Answers GET /api/projects/{id}/increments/{n} with this body (or this problem) instead of the real increment.
 * The states and visual tests use it: a real increment needs stage 10, and the mocks need their own increment.
 * The project itself still comes from the real API.
 */
export async function serveIncrement(page: Page, body: unknown, status = 200): Promise<void> {
  await page.route(
    (url) => /^\/api\/projects\/[^/]+\/increments\/\d+$/.test(url.pathname),
    (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ status, json: body, contentType: 'application/json' })
        : route.fallback(),
  );
}
