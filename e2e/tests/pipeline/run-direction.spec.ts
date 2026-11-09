// Acceptance Test
// Traces to: L2-004, L2-030, L2-031
// Description: A submitted product direction runs stages 0 to 10 in order on a worker and Mission Control shows it live to Complete

import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { startScriptedWorkers } from '../../support/scripted-workers';

const STATUSES = ['Pending', 'Running', 'Paused', 'Succeeded', 'Failed', 'Skipped', 'Cancelled'];

test.describe('Run a product direction', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });

  let stopWorkers: () => Promise<void>;

  test.beforeAll(() => {
    stopWorkers = startScriptedWorkers(3, 150);
  });

  test.afterAll(async () => {
    await stopWorkers();
  });

  test.beforeEach(async ({ page }) => {
    await signIn(page, 'quinntynebrown');
  });

  test('stages run in order, live, until the direction is complete', async ({ newDirection, project }) => {
    await newDirection.open();
    await newDirection.fill({ name: uniqueName('Ledgerline'), idea: 'A web app for small accounting teams to reconcile statements.' });
    await newDirection.submit();
    await project.heading.waitFor();

    // While a stage runs, every earlier stage has Succeeded and every later stage is still Pending.
    await expect(project.currentStage()).toBeVisible({ timeout: 60_000 });
    const statuses = await project.stageStatuses();
    const running = statuses.indexOf('Running');
    expect(running).toBeGreaterThanOrEqual(0);
    expect(statuses.slice(0, running).every((s) => s === 'Succeeded')).toBe(true);
    expect(statuses.slice(running + 1).every((s) => s === 'Pending')).toBe(true);
    expect(statuses.every((s) => STATUSES.includes(s))).toBe(true);

    // No reload: the page follows the stream to the end.
    await expect(project.completeCallout).toBeVisible({ timeout: 60_000 });
    expect(await project.stageStatuses()).toEqual(Array(11).fill('Succeeded'));
    await expect(project.projectStatus).toHaveText('Complete');
    await expect(project.currentStage()).toHaveCount(0);
  });

  test('a page opened mid-run catches up and keeps following', async ({ newDirection, project, page }) => {
    await newDirection.open();
    await newDirection.fill({ name: uniqueName('Tidewater'), idea: 'Tide tables and harbour notices for small marinas.' });
    await newDirection.submit();
    await project.heading.waitFor();
    await expect(project.currentStage()).toBeVisible({ timeout: 60_000 });

    await page.reload();
    await project.heading.waitFor();

    await expect(project.completeCallout).toBeVisible({ timeout: 60_000 });
    expect(await project.stageStatuses()).toEqual(Array(11).fill('Succeeded'));
  });

  test('stage changes are announced politely', async ({ newDirection, project }) => {
    await newDirection.open();
    await newDirection.fill({ name: uniqueName('Kilnworks'), idea: 'Booking firing slots for a shared pottery kiln.' });
    await newDirection.submit();
    await project.heading.waitFor();

    await expect(project.announcer).toHaveAttribute('aria-live', 'polite');
    await expect(project.announcer).toContainText(/Stage \d+, [A-Za-z ]+, (Running|Succeeded)/, { timeout: 60_000 });
  });
});
