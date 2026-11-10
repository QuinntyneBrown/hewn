import { test as base, expect, Page } from '@playwright/test';
import { NewDirectionPage } from '../pages/new-direction.page';
import { ProjectPage } from '../pages/project.page';
import { BacklogPage } from '../pages/backlog.page';
import { IncrementPage } from '../pages/increment.page';
import { DesignsPage } from '../pages/designs.page';
import { DesignSystemPage } from '../pages/design-system.page';
import { ArtifactsPage } from '../pages/artifacts.page';
import { ProjectsPage } from '../pages/projects.page';
import { SettingsPage } from '../pages/settings.page';

/** Owners quinntynebrown and grace (grace only for the rate-limit test), and the Viewer ada (eng/Start-E2eApi.ps1). */
export type Login = 'quinntynebrown' | 'ada' | 'grace';

/** Signs the browser context in through the dev sign-in endpoint (the e2e API enables it). */
export async function signIn(page: Page, login: Login): Promise<void> {
  const response = await page.request.post('/api/auth/dev/sign-in', { data: { login } });
  expect(response.status(), `sign in as ${login}`).toBe(204);
}

/** A name no other test has used, so runs against the shared e2e database never collide. */
export function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
}

interface Pages {
  newDirection: NewDirectionPage;
  project: ProjectPage;
  projects: ProjectsPage;
  backlog: BacklogPage;
  increment: IncrementPage;
  designs: DesignsPage;
  designSystem: DesignSystemPage;
  artifacts: ArtifactsPage;
  settings: SettingsPage;
}

export const test = base.extend<Pages>({
  newDirection: async ({ page }, use) => use(new NewDirectionPage(page)),
  project: async ({ page }, use) => use(new ProjectPage(page)),
  projects: async ({ page }, use) => use(new ProjectsPage(page)),
  backlog: async ({ page }, use) => use(new BacklogPage(page)),
  increment: async ({ page }, use) => use(new IncrementPage(page)),
  designs: async ({ page }, use) => use(new DesignsPage(page)),
  designSystem: async ({ page }, use) => use(new DesignSystemPage(page)),
  artifacts: async ({ page }, use) => use(new ArtifactsPage(page)),
  settings: async ({ page }, use) => use(new SettingsPage(page)),
});

export { expect };
