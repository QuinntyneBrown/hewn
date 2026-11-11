// Acceptance Test
// Traces to: L2-047
// Description: Projects and a project as a Viewer, Projects with no results, an empty audit log, and New direction while it queues and when it couldn't have no axe-core violations

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { AuditPage } from '../../pages/audit.page';
import { PageStates } from '../../pages/page-states';
import { mockProjects } from '../../support/mock-projects';
import { serveProjects } from '../../support/projects';

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

const idea = 'Book firing slots for a shared pottery kiln.';

test.describe('Viewer, empty and busy states, accessibility', () => {
  test('Projects and a project as a Viewer', async ({ page, newDirection, project, projects }) => {
    await signIn(page, 'quinntynebrown');
    await newDirection.open();
    await newDirection.fill({ name: uniqueName('Kiln'), idea });
    await newDirection.submit();
    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}$/);
    const id = project.projectIdFromUrl();

    await signIn(page, 'ada');
    await projects.open();
    await expect(projects.rows.first()).toBeVisible();
    expect(await violations(page), 'Projects').toEqual([]);
    await project.open(id);
    await expect(project.stage('Bootstrap')).toBeVisible();
    expect(await violations(page), 'the project').toEqual([]);
  });

  test('Projects with no results for a filter', async ({ page, projects }) => {
    await signIn(page, 'quinntynebrown');
    const running = (mockProjects(new Date()) as { status: string }[]).filter((p) => p.status === 'Running');
    await serveProjects(page, running);
    await projects.open('?status=paused');
    await expect(projects.empty).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  test('an empty audit log', async ({ page }) => {
    const audit = new AuditPage(page);
    await signIn(page, 'quinntynebrown');
    await audit.serve({ entries: [], projects: [], next: null });
    await audit.open();
    await expect(audit.empty).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  test('New direction while it queues, and when it could not', async ({ page, newDirection }) => {
    const states = new PageStates(page);
    await signIn(page, 'quinntynebrown');
    await newDirection.open();
    await newDirection.fill({ name: uniqueName('Kiln'), idea });
    await states.hold('/api/projects', 'POST');
    await newDirection.submit();
    await expect(newDirection.submitting).toBeVisible();
    expect(await violations(page), 'queuing').toEqual([]);

    await newDirection.open();
    await newDirection.fill({ name: uniqueName('Kiln'), idea });
    await states.fail('/api/projects', 503, 'POST');
    await newDirection.submit();
    await expect(newDirection.failure).toBeVisible();
    expect(await violations(page), 'failed').toEqual([]);
  });
});
