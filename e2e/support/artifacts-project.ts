import type { Page } from '@playwright/test';
import { uniqueName } from '../fixtures/test';
import { xsrfToken } from './queue';
import { cancelDirections } from './rate-limit';

/** A real project for the header, made once per file and cancelled straight away; its artifacts are stubbed. */
const made = new WeakMap<object, string>();
export async function aCancelledProject(page: Page, key: object): Promise<string> {
  const existing = made.get(key);
  if (existing) return existing;
  const response = await page.request.post('/api/projects', {
    data: {
      name: uniqueName('Ledgerline'),
      idea: 'A web app for small accounting teams to reconcile statements.',
      stackPreference: null,
      repositoryUrl: null,
      budgetUsd: 300,
    },
    headers: { 'X-XSRF-TOKEN': await xsrfToken(page) },
  });
  const { projectId } = (await response.json()) as { projectId: string };
  await cancelDirections(page, [projectId]);
  made.set(key, projectId);
  return projectId;
}

export const artifactsFailure = {
  status: 502,
  title: 'GitHub returned 502 while listing commits',
  code: 'github_failed',
};
