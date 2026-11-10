// Acceptance Test
// Traces to: L2-034
// Description: The Artifacts tab lists each stage's artifacts, newest stage first, with path, version (short SHA), time and a link that opens it on GitHub at that commit, for an Owner or a Viewer; with the empty and error states (AC2)

import { expect, signIn, test } from '../../fixtures/test';
import { aCancelledProject, artifactsFailure } from '../../support/artifacts-project';
import { mockArtifacts, noArtifacts, serveArtifacts } from '../../support/mock-artifacts';

const file = {};

test.describe('Inspect versioned artifacts', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'quinntynebrown');
  });

  test('each stage lists its artifacts newest stage first with version, time and a GitHub link', async ({
    page,
    artifacts,
  }) => {
    const id = await aCancelledProject(page, file);
    await signIn(page, 'ada');
    await serveArtifacts(page, mockArtifacts());
    await artifacts.open(id);

    await expect(artifacts.tab('Artifacts')).toHaveAttribute('aria-current', 'page');
    await expect(artifacts.description).toHaveText(
      'Each version is the commit that holds it in hewn-builds/ledgerline.',
    );
    expect(await artifacts.stageTitles()).toEqual([
      '10 Increments',
      '9 Estimates',
      '8 User journeys',
      '7 Detailed designs',
      '5 Requirements',
      '4 Stack',
      '3 Design system',
      '2 Designs',
      '1 Idea',
      '0 Bootstrap',
    ]);
    expect(await artifacts.paths('Estimates')).toEqual([
      'docs/estimates/README.md',
      'docs/estimates/reconciliation.md',
      'docs/estimates/ledger-export.md',
    ]);

    const brief = artifacts.row('Idea', 'docs/brief.md');
    await expect(brief.sha).toHaveText('e8812fa');
    await expect(brief.when).toHaveText('7 Nov, 17:58');
    await expect(brief.open).toHaveAccessibleName('Open docs/brief.md on GitHub at e8812fa');
    await expect(brief.open).toHaveAttribute(
      'href',
      `https://github.com/hewn-builds/ledgerline/blob/e8812fa${'0'.repeat(33)}/docs/brief.md`,
    );
    await expect(brief.open).toHaveAttribute('target', '_blank');

    // A folder of a stage's output opens as a tree at its commit; a recent commit reads as minutes ago.
    const video = artifacts.row('Increments', 'docs/videos/split-a-transaction/');
    await expect(video.when).toHaveText('14 min ago');
    await expect(video.open).toHaveAttribute('href', /\/tree\/7be0d13[0-9]+\/docs\/videos\/split-a-transaction\/$/);
  });

  test('before any stage commits, there are no artifacts yet', async ({ page, artifacts }) => {
    const id = await aCancelledProject(page, file);
    await serveArtifacts(page, noArtifacts);
    await artifacts.open(id);

    await expect(artifacts.empty).toContainText('No artifacts yet');
    await expect(artifacts.stages).toHaveCount(0);
  });

  test('when the artifacts can’t load it says why, and Try again reads them again', async ({ page, artifacts }) => {
    const id = await aCancelledProject(page, file);
    await serveArtifacts(page, artifactsFailure, 502);
    await artifacts.open(id);

    await expect(artifacts.failure).toContainText('GitHub returned 502 while listing commits. Try again in a moment.');
    await page.unrouteAll();
    await serveArtifacts(page, mockArtifacts());
    await artifacts.tryAgain.click();
    await expect(artifacts.stages).toHaveCount(10);
    await expect(artifacts.failure).toHaveCount(0);
  });
});
