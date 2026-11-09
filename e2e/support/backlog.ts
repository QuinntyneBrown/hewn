import type { Page } from '@playwright/test';

/**
 * Answers GET /api/projects/{id}/backlog with this body (or this status) instead of the real backlog. The states
 * and visual tests use it: a real backlog needs stage 9 to have run, and the mocks need their own increments.
 * The project itself still comes from the real API.
 */
export async function serveBacklog(page: Page, body: unknown, status = 200): Promise<void> {
  await page.route(
    (url) => /^\/api\/projects\/[^/]+\/backlog$/.test(url.pathname),
    (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ status, json: status === 200 ? body : { title: 'Bad Gateway', status } })
        : route.fallback(),
  );
}
