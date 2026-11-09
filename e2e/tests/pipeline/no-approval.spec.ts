// Acceptance Test
// Traces to: L2-028, L2-054
// Description: A small product direction runs to Complete with no human input after submission: no dialog, no approval, and every increment's pull request merged by Hewn

import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { startWorkers } from '../../support/workers';

test.describe('No approval steps', () => {
  test.describe.configure({ timeout: 150_000 });

  let stopWorkers: () => Promise<void>;

  test.beforeAll(() => {
    stopWorkers = startWorkers(1, 150);
  });

  test.afterAll(async () => {
    await stopWorkers();
  });

  test('a small direction completes with no input after it is submitted', async ({ page, newDirection, project }) => {
    const prompts: string[] = [];
    page.on('dialog', (dialog) => {
      prompts.push(dialog.message());
      void dialog.dismiss();
    });
    await signIn(page, 'quinntynebrown');
    await newDirection.open();
    await newDirection.fill({ name: uniqueName('Pocket Tide'), idea: 'Tide times for one harbour.' });
    await newDirection.submit();
    await project.heading.waitFor();

    // From here the test only watches: no clicks, no typing, no reloads.
    await expect(project.completeCallout).toBeVisible({ timeout: 120_000 });
    expect(await project.stageStatuses()).toEqual(Array(11).fill('Succeeded'));
    await expect(project.projectStatus).toHaveText('Complete');
    await expect(project.dialogs).toHaveCount(0);
    expect(prompts).toEqual([]);

    // Every planned increment merged through its pull request, with none blocked waiting on anyone.
    const events = await project.events();
    const planned = events.find((e) => e.type === 'BacklogPlanned')?.payload['increments'];
    const increments = events.filter((e) => e.type === 'IncrementChanged').map((e) => e.payload);
    const merged = increments.filter((p) => p['status'] === 'Merged');
    expect(planned).toBeGreaterThan(0);
    expect(merged).toHaveLength(planned as number);
    expect(merged.every((p) => (p['pullRequestNumber'] as number) > 0)).toBe(true);
    expect(increments.some((p) => p['status'] === 'Blocked')).toBe(false);
  });
});
