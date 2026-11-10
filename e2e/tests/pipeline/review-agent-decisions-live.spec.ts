// Acceptance Test
// Traces to: L2-054
// Description: After a real worker builds a product, Decisions lists what each stage's agent decided, newest first, each linked to the commit that recorded it in docs/decisions.md (AC2, AC3), and the stage filter narrows the list (AC3)

import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { drainQueue, xsrfToken } from '../../support/queue';
import { startWorkers } from '../../support/workers';

test.describe('Review agent decisions, live', () => {
  test.describe.configure({ timeout: 300_000 });

  let stopWorkers: (() => Promise<void>) | null = null;

  test.afterEach(async () => {
    await stopWorkers?.();
    stopWorkers = null;
  });

  test('a built product lists its decisions with the commits that recorded them', async ({ page, decisions }) => {
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

    await decisions.open(projectId);
    // Newest first: the last increment's decision leads, the brief's first decision closes the list.
    await expect(decisions.decisions.first().locator('.decision__when .text-subtle')).toHaveText('Increments');
    await expect(decisions.decisions.last().locator('.decision__when .text-subtle')).toHaveText('Idea');

    const stack = decisions.decision('Which stack should the product use?');
    await expect(stack.answer).toHaveText('.NET 10 (LTS) backend with an Angular 21 frontend');
    await expect(stack.commit).toHaveText(/^\s*[0-9a-f]{7}$/);
    const href = (await stack.commit.getAttribute('href'))!;
    const [, repository, sha] = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/commit\/([0-9a-f]{40})$/.exec(href)!;

    // The linked commit is the one that wrote the decision into docs/decisions.md.
    const commits = (await (await page.request.get(`/api/fakes/github/${repository}/commits`)).json()) as {
      sha: string;
      paths: string[];
    }[];
    expect(commits.find((c) => c.sha === sha)?.paths).toContain('docs/decisions.md');

    await decisions.filterBy('Stack');
    expect(await decisions.questions()).toEqual(['Which stack should the product use?']);
  });
});
