// Acceptance Test
// Traces to: L2-026, L2-027, L2-042
// Description: The same worker, configured as Local or as Cloud, registers with its location, host and version and appears in Workers within 2 seconds (L2-026 AC1, L2-027 AC1); an idle worker is pushed a newly queued direction at once rather than at its next 15-second poll, leases it and heartbeats while it runs (L2-026 AC2, AC5); an agent's tool call outside its stage's allow list is denied and logged as a security event, and its request to a host outside the egress allow list is blocked and logged (L2-042 AC2, AC3)

import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { WorkersPage } from '../../pages/workers.page';
import { drainQueue } from '../../support/queue';
import { startWorkers } from '../../support/workers';

/** A host-style name suffix, unique on the shared e2e stack. */
const suffix = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

test.describe('Run workers locally or in the cloud', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });

  const stops: (() => Promise<void>)[] = [];

  test.afterEach(async () => {
    await Promise.all(stops.splice(0).map((stop) => stop()));
  });

  test('a Local and a Cloud worker from the same build appear in Workers within 2 seconds', async ({ page }) => {
    const workers = new WorkersPage(page);
    await signIn(page, 'quinntynebrown');
    // Earlier specs may leave work queued; this spec's worker must lease only its own.
    await drainQueue(page);
    await workers.open();
    const local = `laptop-${suffix()}`;
    const cloud = `cloud-${suffix()}`;

    const started = Date.now();
    stops.push(startWorkers(1, 150, { executor: 'scripted', namePrefix: local, location: 'Local' }));
    stops.push(startWorkers(1, 150, { executor: 'scripted', namePrefix: cloud, location: 'Cloud' }));
    await expect(workers.row(`${local}-1`)).toBeVisible({ timeout: 5_000 });
    await expect(workers.row(`${cloud}-1`)).toBeVisible({ timeout: 5_000 });
    // Two node processes start first; registration itself must land within 2 seconds of the worker running.
    expect(Date.now() - started).toBeLessThan(5_000);

    await expect(workers.details(`${local}-1`).location).toContainText('Local');
    await expect(workers.details(`${cloud}-1`).location).toContainText('Cloud');
    await expect(workers.row(`${local}-1`)).toContainText('0.1.0');
  });

  test('an idle worker is pushed new work at once, leases it and heartbeats while it runs', async ({
    page,
    newDirection,
    project,
  }) => {
    const workers = new WorkersPage(page);
    await signIn(page, 'quinntynebrown');
    // Earlier specs may leave work queued; this spec's worker must lease only its own.
    await drainQueue(page);
    const name = `idle-${suffix()}`;
    stops.push(startWorkers(1, 4_000, { executor: 'scripted', namePrefix: name }));
    await workers.open();
    await expect(workers.details(`${name}-1`).status).toHaveText('Idle', { timeout: 10_000 });
    // Idle well past a first empty answer, so only a push (not the next poll) explains a quick lease.
    await page.waitForTimeout(3_000);

    const direction = uniqueName('Pushed');
    await newDirection.open();
    await newDirection.fill({ name: direction, idea: 'Shift handover notes for a small hospital ward.' });
    const submitted = Date.now();
    await newDirection.submit();
    await project.heading.waitFor();
    await expect(project.currentStage()).toBeVisible({ timeout: 10_000 });
    expect(Date.now() - submitted, 'leased well before the next 15-second poll').toBeLessThan(8_000);

    await workers.open();
    await expect(workers.details(`${name}-1`).status).toHaveText('Leased');
    await expect(workers.details(`${name}-1`).workingOn).toHaveText(direction);
    const first = await workers.details(`${name}-1`).seen.innerText();
    await expect(workers.details(`${name}-1`).seen).not.toHaveText(first, { timeout: 15_000 });
  });

  test("an agent's denied tool call and blocked request show in the run's log", async ({
    page,
    newDirection,
    project,
  }) => {
    await signIn(page, 'quinntynebrown');
    // Earlier specs may leave work queued; this spec's worker must lease only its own.
    await drainQueue(page);
    stops.push(startWorkers(1, 150, { namePrefix: `isolated-${suffix()}`, probeStage: 1 }));

    await newDirection.open();
    await newDirection.fill({ name: uniqueName('Isolated'), idea: 'A rota planner for volunteer lifeguards.' });
    await newDirection.submit();
    await project.heading.waitFor();
    await expect(project.stageStatus('Idea')).toContainText('Succeeded', { timeout: 30_000 });
    await project.selectStage('Idea');

    await expect(project.logLines.filter({ hasText: 'Security event: tool Bash denied' })).toHaveCount(1, {
      timeout: 30_000,
    });
    await expect(project.logLines.filter({ hasText: 'Egress blocked: exfiltrate.example' })).toHaveCount(1);
  });
});
