// Acceptance Test
// Traces to: L2-026, L2-050
// Description: A worker killed mid-run loses its lease after 60 seconds without a heartbeat, and another worker resumes the run after its last checkpoint; the Owner follows both in the run log (L2-026 AC3, L2-050 AC3)

import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { NewDirectionPage } from '../../pages/new-direction.page';
import { ProjectPage } from '../../pages/project.page';
import { WorkersPage } from '../../pages/workers.page';
import { cancelDirections } from '../../support/rate-limit';
import { startWorkers } from '../../support/workers';

const unique = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

test.describe('Continue after a worker crash', () => {
  test.describe.configure({ timeout: 180_000 });

  test('a killed worker’s run resumes on another worker after its last checkpoint', async ({ page }) => {
    await signIn(page, 'quinntynebrown');
    const crashed = `${unique('crashed')}-1`;
    const standby = `${unique('standby')}-1`;
    const stopCrashed = startWorkers(1, 8_000, { executor: 'scripted', namePrefix: crashed.slice(0, -2) });
    let stopStandby = async () => {};
    let projectId = '';
    try {
      const workers = new WorkersPage(page);
      await workers.open();
      await expect(workers.details(crashed).status).toHaveText('Idle', { timeout: 10_000 });

      const submit = new NewDirectionPage(page);
      await submit.open();
      await submit.fill({ name: uniqueName('Crash'), idea: 'A seed swap register for a community garden.' });
      await submit.submit();
      const project = new ProjectPage(page);
      await expect(project.currentStage()).toBeVisible({ timeout: 15_000 });
      projectId = new URL(page.url()).pathname.split('/')[2]!;

      // The standby connects while the run is leased, so it can only take over.
      stopStandby = startWorkers(1, 500, { executor: 'scripted', namePrefix: standby.slice(0, -2) });
      // Each scripted step takes 8 s: after 12 s step 1 is checkpointed and step 2 is under way.
      await page.waitForTimeout(12_000);
      await stopCrashed('SIGKILL');

      const expired = project.logLines.filter({
        hasText: `Lease expired: no heartbeat from ${crashed} for 60 seconds; queued again after step 1`,
      });
      await expect(expired).toBeVisible({ timeout: 90_000 });
      await expect(project.logLines.filter({ hasText: `Resumed by ${standby} after step 1` })).toBeVisible({
        timeout: 15_000,
      });
      await expect(project.currentStage()).toBeVisible();
    } finally {
      if (projectId) await cancelDirections(page, [projectId]);
      await stopStandby();
      await stopCrashed();
    }
  });
});
