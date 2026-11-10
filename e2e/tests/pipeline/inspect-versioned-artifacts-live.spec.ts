// Acceptance Test
// Traces to: L2-034
// Description: With a project's Artifacts tab open while a real worker runs it, each stage that succeeds adds the files it committed, each versioned by the commit SHA that holds it in the repository, without a reload (AC1, AC2)

import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { drainQueue, xsrfToken } from '../../support/queue';
import { cancelDirections } from '../../support/rate-limit';
import { startWorkers } from '../../support/workers';

test.describe('Inspect versioned artifacts, live', () => {
  test.describe.configure({ timeout: 180_000 });

  let stopWorkers: (() => Promise<void>) | null = null;

  test.afterEach(async () => {
    await stopWorkers?.();
    stopWorkers = null;
  });

  test('a stage that succeeds adds its files with the commit that holds them', async ({ page, artifacts }) => {
    await signIn(page, 'quinntynebrown');
    await drainQueue(page);
    const name = uniqueName('Ledgerline');
    const submitted = await page.request.post('/api/projects', {
      data: {
        name,
        idea: 'A web app for small accounting teams to reconcile statements.',
        stackPreference: null,
        repositoryUrl: null,
        budgetUsd: 300,
      },
      headers: { 'X-XSRF-TOKEN': await xsrfToken(page) },
    });
    expect(submitted.status()).toBe(201);
    const { projectId } = (await submitted.json()) as { projectId: string };

    await artifacts.open(projectId);
    await expect(artifacts.empty).toBeVisible();
    await page.evaluate(() => ((window as unknown as { loadMark: number }).loadMark = 1));

    stopWorkers = startWorkers(1, 150);

    // Stage 1 commits the brief; its version is the commit, and the link opens the file at that commit.
    const brief = artifacts.row('Idea', 'docs/brief.md');
    await expect(brief.sha).toHaveText(/^[0-9a-f]{7}$/, { timeout: 120_000 });
    const sha = (await brief.sha.innerText()).trim();
    const repo = `hewn-builds/${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    await expect(brief.open).toHaveAttribute(
      'href',
      new RegExp(`^https://github\\.com/${repo}/blob/${sha}[0-9a-f]{33}/docs/brief\\.md$`),
    );
    await expect(artifacts.row('Bootstrap', '.hewn/skills.lock').sha).toHaveText(/^[0-9a-f]{7}$/);
    // Newest stage first.
    const titles = await artifacts.stageTitles();
    expect(titles.indexOf('1 Idea')).toBeLessThan(titles.indexOf('0 Bootstrap'));
    expect(await page.evaluate(() => (window as unknown as { loadMark?: number }).loadMark)).toBe(1);

    await stopWorkers();
    stopWorkers = null;
    await cancelDirections(page, [projectId]);
  });
});
