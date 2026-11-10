// Acceptance Test
// Traces to: L2-035
// Description: After a real worker builds a product, each L2 the stages wrote traces to its L1, the design stage 7 wrote, the journey stage 8 wrote, the acceptance test stage 10 committed and the pull request that merged it (AC1), with nothing marked No acceptance test (AC2)

import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { drainQueue, xsrfToken } from '../../support/queue';
import { startWorkers } from '../../support/workers';

test.describe('Trace a requirement, live', () => {
  test.describe.configure({ timeout: 300_000 });

  let stopWorkers: (() => Promise<void>) | null = null;

  test.afterEach(async () => {
    await stopWorkers?.();
    stopWorkers = null;
  });

  test('a built product traces each requirement to its design, journey, test and pull request', async ({
    page,
    traceability,
  }) => {
    await signIn(page, 'quinntynebrown');
    await drainQueue(page);
    const submitted = await page.request.post('/api/projects', {
      data: {
        name: uniqueName('Kiln Booking'),
        idea: 'Studio time booking for shared ceramics kilns, with firing schedules.',
        stackPreference: null,
        repositoryUrl: null,
        budgetUsd: 300,
      },
      headers: { 'X-XSRF-TOKEN': await xsrfToken(page) },
    });
    expect(submitted.status()).toBe(201);
    const { projectId } = (await submitted.json()) as { projectId: string };

    stopWorkers = startWorkers(1, 150);
    await expect
      .poll(
        async () => {
          const project = (await (await page.request.get(`/api/projects/${projectId}`)).json()) as {
            directions: { status: string }[];
          };
          return project.directions[0]!.status;
        },
        { timeout: 240_000, intervals: [1_000] },
      )
      .toBe('Complete');

    await traceability.open(projectId, 'L2-001');
    await expect(traceability.id).toHaveText('L2-001');
    await expect(traceability.l1).toHaveText(/^Traces to L1-001 \S/);
    await expect(traceability.column('Designs').count).toHaveText('1');
    await expect(traceability.column('Journeys').items).toHaveText([/^Journey 1 · /]);
    await expect(traceability.column('Acceptance tests').items.first()).toHaveText(/\S+\.spec\.ts$/);
    await expect(traceability.column('Pull requests').items).toHaveText([/^#\d+\s+.+\(journey 1, L2-001\)$/]);
    await expect(traceability.noAcceptanceTest).toHaveCount(0);
  });
});
