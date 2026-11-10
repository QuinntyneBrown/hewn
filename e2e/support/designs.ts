import type { Page } from '@playwright/test';
import { xsrfToken } from './queue';
import { cancelDirections } from './rate-limit';

export { designedFiles, mockPage, probeMock } from './designed-files';

/**
 * A real project on a repository holding these files in the fake GitHub, as a direction that passed stage 2 leaves
 * it. The direction is cancelled straight away so no worker picks it up.
 */
export async function designedProject(page: Page, name: string, files: Record<string, string>): Promise<string> {
  const repository = `designs-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
  const seeded = await page.request.put(`/api/fakes/github/hewn-builds/${repository}/files`, { data: files });
  if (!seeded.ok()) throw new Error(`Seeding hewn-builds/${repository} answered ${seeded.status()}`);
  const response = await page.request.post('/api/projects', {
    data: {
      name,
      idea: 'A web app for small accounting teams to reconcile statements.',
      stackPreference: null,
      repositoryUrl: `https://github.com/hewn-builds/${repository}`,
      budgetUsd: 300,
    },
    headers: { 'X-XSRF-TOKEN': await xsrfToken(page) },
  });
  if (response.status() !== 201) throw new Error(`Submitting answered ${response.status()}: ${await response.text()}`);
  const { projectId } = (await response.json()) as { projectId: string };
  await cancelDirections(page, [projectId]);
  return projectId;
}

/**
 * Answers GET /api/projects/{id}/designs with this body (or this problem) instead of the real designs, and every
 * preview URL with an empty, transparent page, so a thumbnail shows its frame as the mock draws it.
 */
export async function serveDesigns(page: Page, body: unknown, status = 200): Promise<void> {
  await page.route(
    (url) => /^\/api\/projects\/[^/]+\/designs$/.test(url.pathname),
    (route) => route.fulfill({ status, json: body, contentType: 'application/json' }),
  );
  await page.route(
    (url) => url.pathname.startsWith('/preview/stub/'),
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><html style="background: transparent"><body></body></html>',
      }),
  );
}
