import type { Page } from '@playwright/test';
import { xsrfToken } from './queue';
import { cancelDirections } from './rate-limit';

/** A real project on its own fake repository, with its direction cancelled so it can be deleted. */
export async function aProjectWithRepository(page: Page, name: string, repository: string): Promise<string> {
  const seeded = await page.request.put(`/api/fakes/github/hewn-builds/${repository}/files`, {
    data: { 'README.md': `# ${name}\n` },
  });
  if (!seeded.ok()) throw new Error(`Seeding hewn-builds/${repository} answered ${seeded.status()}`);
  const response = await page.request.post('/api/projects', {
    data: {
      name,
      idea: 'A CRM for small harbour chandleries.',
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

/** The repository's README on its default branch as the fake GitHub holds it, or null when it's gone. */
export async function repositoryReadme(page: Page, repository: string): Promise<string | null> {
  const response = await page.request.get(`/api/fakes/github/hewn-builds/${repository}/contents/README.md`);
  return response.ok() ? await response.text() : null;
}

/** The project's page as the API answers it: 200 while Hewn holds it, 404 once deleted. */
export async function projectStatus(page: Page, projectId: string): Promise<number> {
  return (await page.request.get(`/api/projects/${projectId}`)).status();
}
