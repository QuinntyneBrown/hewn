import type { Page } from '@playwright/test';
import { xsrfToken } from './queue';
import { cancelDirections } from './rate-limit';

/** A real project with its direction queued, so it has an active direction; `idle` cancels the direction first. */
export async function aProjectNamed(page: Page, name: string, { idle }: { idle: boolean }): Promise<string> {
  const response = await page.request.post('/api/projects', {
    data: {
      name,
      idea: 'Bird-count logging for estuary volunteers.',
      stackPreference: null,
      repositoryUrl: null,
      budgetUsd: 300,
    },
    headers: { 'X-XSRF-TOKEN': await xsrfToken(page) },
  });
  if (response.status() !== 201) throw new Error(`Submitting answered ${response.status()}: ${await response.text()}`);
  const { projectId } = (await response.json()) as { projectId: string };
  if (idle) await cancelDirections(page, [projectId]);
  return projectId;
}

/** Archives a project through the API, as an Owner. */
export async function archiveProject(page: Page, projectId: string): Promise<void> {
  const response = await page.request.post(`/api/projects/${projectId}/archive`, {
    data: {},
    headers: { 'X-XSRF-TOKEN': await xsrfToken(page) },
  });
  if (response.status() !== 204) throw new Error(`Archiving answered ${response.status()}`);
}
