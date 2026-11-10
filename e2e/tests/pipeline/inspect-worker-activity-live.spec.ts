// Acceptance Test
// Traces to: L2-026, L2-031
// Description: Workers follows a worker live without a reload: it appears when it connects, shows Leased with its project while it runs a stage, and turns Offline within a second of missing heartbeats for 60 seconds (L2-026 AC1, L2-031 AC1)

import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { NewDirectionPage } from '../../pages/new-direction.page';
import { ProjectPage } from '../../pages/project.page';
import { WorkersPage } from '../../pages/workers.page';
import { drainQueue } from '../../support/queue';
import { cancelDirections } from '../../support/rate-limit';
import { startWorkers } from '../../support/workers';

const unique = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

test.describe('Inspect worker activity, live', () => {
  test.describe.configure({ timeout: 150_000 });

  test('a worker connects, leases, and goes offline, all without a reload', async ({ page }) => {
    const workers = new WorkersPage(page);
    await signIn(page, 'quinntynebrown');
    // Earlier specs may leave work queued; this spec's worker must lease only its own.
    await drainQueue(page);
    await workers.open();
    // A marker that a reload would clear.
    await page.evaluate(() => ((window as unknown as { followed: boolean }).followed = true));
    const name = `${unique('watched')}-1`;

    let stop = startWorkers(1, 4_000, { executor: 'scripted', namePrefix: name.slice(0, -2) });
    try {
      await expect(workers.details(name).status).toHaveText('Idle', { timeout: 10_000 });
      await expect(workers.details(name).location).toContainText('Local');

      // Submitted from another tab, so this one stays on Workers.
      const other = await page.context().newPage();
      const direction = uniqueName('Watched');
      const submit = new NewDirectionPage(other);
      await submit.open();
      await submit.fill({ name: direction, idea: 'A seed swap register for a community garden.' });
      await submit.submit();
      await expect(new ProjectPage(other).currentStage()).toBeVisible({ timeout: 15_000 });
      const projectId = new URL(other.url()).pathname.split('/')[2]!;
      await expect(workers.details(name).status).toHaveText('Leased', { timeout: 15_000 });
      await expect(workers.details(name).workingOn).toHaveText(direction);
      // Leave nothing queued for later suites once this worker is gone.
      await cancelDirections(other, [projectId]);
      await other.close();
    } finally {
      await stop();
      stop = async () => {};
    }

    // It stopped heartbeating; 60 seconds after it was last heard from it is Offline.
    const last = (await workers.workers()).workers.find((w) => w.name === name) as unknown as { lastSeenAt: string };
    const due = Date.parse(last.lastSeenAt) + 60_000;
    await expect(workers.details(name).status).toHaveText('Offline', { timeout: due - Date.now() + 5_000 });
    expect(Date.now() - due, 'shown Offline within a second or so of the 60-second mark').toBeLessThan(1_500);
    expect(await page.evaluate(() => (window as unknown as { followed?: boolean }).followed)).toBe(true);
  });
});
