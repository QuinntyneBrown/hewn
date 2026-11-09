import { expect, type Page } from '@playwright/test';
import { startWorkers } from './workers';

/** Runs whatever earlier suites left queued with fast real workers, so a spec's own runs start at once. */
export async function drainQueue(page: Page): Promise<void> {
  const stop = startWorkers(3, 50);
  try {
    await expect
      .poll(
        async () => {
          const projects = (await (await page.request.get('/api/projects')).json()) as { status: string }[];
          return projects.filter((p) => p.status === 'Running').length;
        },
        { timeout: 180_000, intervals: [1_000] },
      )
      .toBe(0);
  } finally {
    await stop();
  }
}

/** The XSRF token Mission Control would send, for posting to the API directly as the signed-in user. */
export async function xsrfToken(page: Page): Promise<string> {
  await page.request.get('/api/me');
  return (await page.context().cookies()).find((c) => c.name === 'XSRF-TOKEN')?.value ?? '';
}
