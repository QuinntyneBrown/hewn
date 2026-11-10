import type { Page } from '@playwright/test';
import { xsrfToken } from './queue';
import { cancelDirections } from './rate-limit';

/** Seeds a fake repository with these files and pull requests, and a cancelled project on it. */
export async function tracedProject(
  page: Page,
  name: string,
  files: Record<string, string>,
  pulls: { title: string; merged: boolean }[] = [],
): Promise<string> {
  const repository = `traced-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
  const seeded = await page.request.put(`/api/fakes/github/hewn-builds/${repository}/files`, { data: files });
  if (!seeded.ok()) throw new Error(`Seeding hewn-builds/${repository} answered ${seeded.status()}`);
  for (const pull of pulls) {
    const opened = await page.request.post(`/api/fakes/github/hewn-builds/${repository}/pulls`, { data: pull });
    if (!opened.ok()) throw new Error(`Opening a pull request answered ${opened.status()}`);
  }
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
