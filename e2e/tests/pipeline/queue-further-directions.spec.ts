// Acceptance Test
// Traces to: L2-004, L2-005
// Description: An Owner submits two more directions on a project whose direction is running; both queue on the project page, and each starts by itself when the one before it is Complete, first in, first out

import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { drainQueue } from '../../support/queue';
import { startWorkers } from '../../support/workers';

const idea = 'A web app for small accounting teams to reconcile statements.';
const csv = 'Add a CSV export to the reconciliation report, so accountants can open it in Excel.';
const email = 'Email a summary to the reviewer when a month is closed, with the totals per account.';

test.describe('Queue further directions', () => {
  test.describe.configure({ timeout: 300_000 });

  let stopWorkers: (() => Promise<void>) | null = null;

  test.afterEach(async () => {
    await stopWorkers?.();
    stopWorkers = null;
  });

  test('two more directions queue behind the running one and start by themselves, first in, first out', async ({
    page,
    newDirection,
    project,
  }) => {
    await signIn(page, 'quinntynebrown');
    await drainQueue(page);
    // Scripted stages of three 1-second steps.
    stopWorkers = startWorkers(1, 1_000, { executor: 'scripted', logLines: 2 });
    const name = uniqueName('Ledgerline');
    await newDirection.open();
    await newDirection.fill({ name, idea });
    await newDirection.submit();
    await expect(project.heading).toHaveText(name);

    // L2-004 AC4, L2-005 AC4: two feature directions submitted while the product direction runs both queue.
    for (const feature of [csv, email]) {
      await newDirection.open();
      await newDirection.fillFeature({ product: name, feature, budget: '60.00' });
      await newDirection.submit();
      await expect(project.heading).toHaveText(name);
    }
    await expect(project.projectStatus).toHaveText('Running');
    await expect(project.directionMeta).toHaveText('Product direction · submitted by quinntynebrown');
    await expect(project.queuedCallout).toContainText('2 directions queued');
    await expect(project.queuedCallout).toContainText(
      'Feature direction “Add a CSV export to the reconciliation report”, submitted by quinntynebrown',
    );

    // When the product direction is Complete, the first feature starts by itself; the second still waits.
    await expect(project.headerMeta).toContainText(
      'Feature direction · Add a CSV export to the reconciliation report',
      {
        timeout: 180_000,
      },
    );
    await expect(project.projectStatus).toHaveText('Running');
    await expect(project.queuedCallout).toContainText('1 direction queued');
    await expect(project.queuedCallout).toContainText(
      'Feature direction “Email a summary to the reviewer when a month is closed”',
    );

    // Then the second, once the first is Complete.
    await expect(project.headerMeta).toContainText('Feature direction · Email a summary to the reviewer', {
      timeout: 120_000,
    });
    await expect(project.queuedCallout).toHaveCount(0);
    // Let the last direction finish, so no worker is left holding a lease when this test stops its workers.
    await expect(project.projectStatus).toHaveText('Complete', { timeout: 120_000 });

    const changes = (await project.events())
      .filter((e) => e.type === 'DirectionChanged')
      .map((e) => `${String(e.payload['directionId']).slice(0, 8)}:${String(e.payload['status'])}`);
    const directions = (
      (await (await page.request.get(`/api/projects/${project.projectIdFromUrl()}`)).json()) as {
        directions: { id: string; kind: string; idea: string }[];
      }
    ).directions;
    const [product, first, second] = directions.map((d) => d.id.slice(0, 8));
    expect(directions.map((d) => d.kind)).toEqual(['Product', 'Feature', 'Feature']);
    // First in, first out: each starts only after the one before it is Complete.
    expect(changes.indexOf(`${product}:Complete`)).toBeLessThan(changes.indexOf(`${first}:Running`));
    expect(changes.indexOf(`${first}:Complete`)).toBeLessThan(changes.indexOf(`${second}:Running`));
    expect(changes.indexOf(`${second}:Complete`)).toBeGreaterThan(changes.indexOf(`${second}:Running`));
  });
});
