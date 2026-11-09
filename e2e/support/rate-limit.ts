import { expect, type Page } from '@playwright/test';
import { xsrfToken } from './queue';

const idea = 'A web app for small accounting teams to reconcile statements.';

/**
 * Submits product directions through the API until the signed-in Owner is refused with 429 (L2-043 AC4), and
 * returns the limit the refusal states and the projects created on the way.
 */
export async function fillTheMinute(
  page: Page,
  name: (i: number) => string,
): Promise<{ limit: number; projectIds: string[] }> {
  const headers = { 'X-XSRF-TOKEN': await xsrfToken(page) };
  const projectIds: string[] = [];
  for (;;) {
    const response = await page.request.post('/api/projects', {
      data: { name: name(projectIds.length), idea, stackPreference: null, repositoryUrl: null, budgetUsd: 50 },
      headers,
    });
    if (response.status() === 429) {
      const problem = (await response.json()) as { code: string; limit: number; retryAfterSeconds: number };
      expect(problem.code).toBe('rate_limited');
      expect(problem.retryAfterSeconds).toBeGreaterThan(0);
      return { limit: problem.limit, projectIds };
    }
    expect(response.status()).toBe(201);
    projectIds.push(((await response.json()) as { projectId: string }).projectId);
  }
}

/** Cancels the first direction of each project, so no later suite runs what filling the minute queued. */
export async function cancelDirections(page: Page, projectIds: string[]): Promise<void> {
  const headers = { 'X-XSRF-TOKEN': await xsrfToken(page) };
  for (const id of projectIds) {
    const project = (await (await page.request.get(`/api/projects/${id}`)).json()) as { directions: { id: string }[] };
    await page.request.post(`/api/projects/${id}/directions/${project.directions[0]!.id}/cancel`, {
      data: {},
      headers,
    });
  }
}
