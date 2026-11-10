/** The artifacts the mock shows (docs/mocks/pages/artifacts/default.html), with times relative to `now`. */
export function mockArtifacts(now = new Date()): unknown {
  const repository = 'hewn-builds/ledgerline';
  const at = (day: number, hours: number, minutes: number) => new Date(2026, 10, day, hours, minutes).toISOString();
  const recent = new Date(now.getTime() - 14 * 60_000 - 20_000).toISOString();
  const row = (path: string, sha: string, committedAt: string) => {
    const folder = path.endsWith('/');
    return {
      path,
      folder,
      sha: `${sha}${'0'.repeat(33)}`,
      committedAt,
      url: `https://github.com/${repository}/${folder ? 'tree' : 'blob'}/${sha}${'0'.repeat(33)}/${path}`,
    };
  };
  const stage = (n: number, name: string, rows: [string, string, string][]) => ({
    stage: n,
    name,
    artifacts: rows.map(([path, sha, when]) => row(path, sha, when)),
  });
  return {
    repository,
    stages: [
      stage(10, 'Increments', [
        ['docs/videos/split-a-transaction/', '7be0d13', recent],
        ['docs/estimates/README.md', '7be0d13', recent],
      ]),
      stage(9, 'Estimates', [
        ['docs/estimates/README.md', '19f4a8c', at(8, 16, 44)],
        ['docs/estimates/reconciliation.md', '19f4a8c', at(8, 16, 44)],
        ['docs/estimates/ledger-export.md', '19f4a8c', at(8, 16, 44)],
      ]),
      stage(8, 'User journeys', [['docs/journeys.md', '2d77e01', at(8, 16, 21)]]),
      stage(7, 'Detailed designs', [
        ['docs/detailed-designs/reconciliation/', '0b3c4f9', at(8, 16, 2)],
        ['docs/detailed-designs/receipts/', '0b3c4f9', at(8, 16, 2)],
      ]),
      stage(5, 'Requirements', [
        ['docs/specs/L1.md', 'f61a2d8', at(8, 11, 30)],
        ['docs/specs/L2.md', 'f61a2d8', at(8, 11, 30)],
      ]),
      stage(4, 'Stack', [['docs/adr/0001-stack.md', 'c03e57b', at(8, 9, 12)]]),
      stage(3, 'Design system', [['docs/design-system/', '8e2290a', at(8, 8, 51)]]),
      stage(2, 'Designs', [
        ['docs/mocks/', '5a1fe37', at(8, 8, 36)],
        ['docs/mocks/manifest.json', '5a1fe37', at(8, 8, 36)],
      ]),
      stage(1, 'Idea', [['docs/brief.md', 'e8812fa', at(7, 17, 58)]]),
      stage(0, 'Bootstrap', [['.hewn/skills.lock', '91c0b4e', at(7, 17, 51)]]),
    ],
  };
}

export const noArtifacts = { repository: 'hewn-builds/ledgerline', stages: [] };

/** Answers GET /api/projects/{id}/artifacts with this body (or this status) instead of the real artifacts. */
export async function serveArtifacts(
  page: import('@playwright/test').Page,
  body: unknown,
  status = 200,
): Promise<void> {
  await page.route(
    (url) => /^\/api\/projects\/[^/]+\/artifacts$/.test(url.pathname),
    (route) => route.fulfill({ status, json: body, contentType: 'application/json' }),
  );
}
