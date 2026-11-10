import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

/** Serves the increment video and its captions from e2e/fixtures/walkthrough.mp4 and .vtt, with byte ranges. */
export async function serveVideo(page: Page): Promise<void> {
  const fixtures = join(import.meta.dirname, '..', 'fixtures');
  const mp4 = readFileSync(join(fixtures, 'walkthrough.mp4'));
  const vtt = readFileSync(join(fixtures, 'walkthrough.vtt'));
  await page.route(
    (url) => /^\/api\/projects\/[^/]+\/increments\/\d+\/video(\/captions)?$/.test(url.pathname),
    (route) => {
      if (route.request().url().endsWith('/captions')) {
        return route.fulfill({ status: 200, body: vtt, contentType: 'text/vtt' });
      }
      const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers()['range'] ?? '');
      if (!range)
        return route.fulfill({
          status: 200,
          body: mp4,
          contentType: 'video/mp4',
          headers: { 'accept-ranges': 'bytes' },
        });
      const start = Number(range[1]);
      const end = range[2] ? Number(range[2]) : mp4.length - 1;
      return route.fulfill({
        status: 206,
        body: mp4.subarray(start, end + 1),
        contentType: 'video/mp4',
        headers: { 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${mp4.length}` },
      });
    },
  );
}
