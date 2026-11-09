// Acceptance Test
// Traces to: L2-005, L2-054
// Description: A feature added to a complete product skips stages 0, 4 and 6, and also 2 and 3 when the agent records that the user interface does not change, and runs every other stage to Complete

import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { startWorkers } from '../../support/workers';

test.describe('Run a feature direction', () => {
  test.describe.configure({ timeout: 240_000 });

  let stopWorkers: () => Promise<void>;

  test.beforeAll(() => {
    stopWorkers = startWorkers(1, 150);
  });

  test.afterAll(async () => {
    await stopWorkers();
  });

  async function completeProduct(
    page: import('@playwright/test').Page,
    newDirection: import('../../pages/new-direction.page').NewDirectionPage,
    project: import('../../pages/project.page').ProjectPage,
  ): Promise<string> {
    await signIn(page, 'quinntynebrown');
    const name = uniqueName('Northwind Ops');
    await newDirection.open();
    await newDirection.fill({ name, idea: 'An operations portal for shift supervisors.' });
    await newDirection.submit();
    await expect(project.completeCallout).toBeVisible({ timeout: 120_000 });
    return name;
  }

  test('a feature with no user interface change skips stages 0, 2, 3, 4 and 6 and records why', async ({
    page,
    newDirection,
    project,
  }) => {
    const name = await completeProduct(page, newDirection, project);

    await newDirection.open();
    await newDirection.fillFeature({ product: name, feature: 'Add a CSV export of the shift report, one row per shift.' });
    await newDirection.submit();
    await expect(project.directionMeta).toHaveText(/^Feature direction · /);

    await expect(project.featureCompleteCallout).toBeVisible({ timeout: 120_000 });
    expect(await project.stageStatuses()).toEqual([
      'Skipped', 'Succeeded', 'Skipped', 'Skipped', 'Skipped', 'Succeeded', 'Skipped', 'Succeeded', 'Succeeded', 'Succeeded', 'Succeeded',
    ]);
    expect(await project.skippedStageNames()).toEqual(['Bootstrap', 'Designs', 'Design system', 'Stack', 'Scaffold']);
    await expect(project.featureCompleteCallout).toContainText('Bootstrap, stack and scaffold were skipped.');
    await expect(project.featureCompleteCallout).toContainText(
      'Designs and design system were skipped too: The feature adds no screen or state',
    );
    await expect(project.projectStatus).toHaveText('Complete');
    await expect(project.directionMeta).toHaveText('Feature direction · Add a CSV export of the shift report');

    const scoped = (await project.events()).filter((e) => e.type === 'DirectionScoped').map((e) => e.payload);
    expect(scoped).toEqual([expect.objectContaining({ hasUiChange: false })]);
  });

  test('a feature that adds a screen runs Designs and Design system', async ({ page, newDirection, project }) => {
    const name = await completeProduct(page, newDirection, project);

    await newDirection.open();
    await newDirection.fillFeature({ product: name, feature: 'Add a shift calendar page with a week view of every crew.' });
    await newDirection.submit();
    await expect(project.directionMeta).toHaveText(/^Feature direction · /);

    await expect(project.featureCompleteCallout).toBeVisible({ timeout: 120_000 });
    expect(await project.skippedStageNames()).toEqual(['Bootstrap', 'Stack', 'Scaffold']);
    await expect(project.stage('Designs')).toContainText('Succeeded');
    await expect(project.stage('Design system')).toContainText('Succeeded');
    const merged = (await project.events()).filter((e) => e.type === 'IncrementChanged' && e.payload['status'] === 'Merged');
    // The product's three increments, then the feature's one: only the new design is built.
    expect(merged.map((e) => e.payload['number'])).toEqual([1, 2, 3, 1]);
  });
});
