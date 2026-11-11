// Acceptance Test
// Traces to: L2-035
// Description: Traceability lists a project's L2s and, for the one opened, shows its L1, the designs that cover it, the journeys it appears in, the test files whose Traces to: header names it and the pull requests whose titles name it (AC1); an L2 with no test is marked No acceptance test unless it is Deferred (AC2); with search, the empty state and an unparsable L2.md

import type { Page } from '@playwright/test';
import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { tracedProject } from '../../support/traceability';
import { tracedFiles } from '../../support/traced-files';

let shared: string | undefined;
/** One project per file, on a repository with requirements, designs, journeys, tests and pull requests. */
async function aTracedProject(page: Page): Promise<string> {
  shared ??= await tracedProject(page, uniqueName('Ledgerline'), tracedFiles(), [
    { title: 'Reconcile a card statement (journey 4, L2-018)', merged: true },
    { title: 'Snap a receipt (journey 3, L2-013)', merged: false },
  ]);
  return shared;
}

test.describe('Trace a requirement', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'quinntynebrown');
  });

  test('an L2 shows its L1, designs, journeys, acceptance tests and pull requests', async ({ page, traceability }) => {
    const id = await aTracedProject(page);
    await signIn(page, 'ada');
    await traceability.open(id, 'L2-018');

    await expect(traceability.tab('Traceability')).toHaveAttribute('aria-current', 'page');
    await expect.poll(() => traceability.ids()).toEqual(['L2-013', 'L2-018', 'L2-020', 'L2-031']);
    await expect(traceability.link('L2-018')).toHaveAttribute('aria-current', 'true');
    await expect(traceability.link('L2-031')).toContainText('Deferred');

    await expect(traceability.id).toHaveText('L2-018');
    await expect(traceability.title).toHaveText('Match card lines to transactions within a tolerance');
    await expect(traceability.l1).toHaveText('Traces to L1-006 Statement reconciliation');
    await expect(traceability.noAcceptanceTest).toHaveCount(0);
    await expect(traceability.column('Designs').items).toHaveText(['Reconcile statement']);
    await expect(traceability.column('Journeys').items).toHaveText(['Journey 4 · Close the month']);
    await expect(traceability.column('Acceptance tests').count).toHaveText('2');
    await expect(traceability.column('Acceptance tests').items).toHaveText([
      'backend/tests/StatementMatcherTests.cs',
      'e2e/tests/reconcile-card-statement.spec.ts',
    ]);
    await expect(traceability.column('Pull requests').items).toHaveText([
      /#1\s+Reconcile a card statement \(journey 4, L2-018\)/,
    ]);
  });

  test('an L2 with no test is marked No acceptance test, unless it is Deferred', async ({ page, traceability }) => {
    const id = await aTracedProject(page);
    await traceability.open(id);

    // The first L2 opens by default; choosing another opens its trace.
    await expect(traceability.id).toHaveText('L2-013');
    await traceability.link('L2-020').click();
    await expect(traceability.id).toHaveText('L2-020');
    await expect(page).toHaveURL(/\?l2=L2-020$/);
    await expect(traceability.noAcceptanceTest).toHaveText('No acceptance test');
    await expect(traceability.column('Acceptance tests').empty).toHaveText('None yet');
    await expect(traceability.column('Pull requests').empty).toHaveText('None yet');

    await traceability.link('L2-031').click();
    await expect(traceability.deferred).toHaveText('Deferred. Estimated 7 days; could not be split below 3.');
    await expect(traceability.noAcceptanceTest).toHaveCount(0);
    await expect(traceability.column('Designs').empty).toHaveText('No design covers it');
    await expect(traceability.column('Journeys').empty).toHaveText('In no journey');
    await expect(traceability.column('Acceptance tests').empty).toHaveText('Not needed while deferred');
  });

  test('Find an L2 narrows the list, and says when nothing matches', async ({ page, traceability }) => {
    const id = await aTracedProject(page);
    await traceability.open(id, 'L2-018');

    await traceability.search.fill('close');
    await expect.poll(() => traceability.ids()).toEqual(['L2-020']);
    await traceability.search.fill('L2-099');
    await expect(traceability.noMatch).toHaveText(/^No requirement matches “L2-099”\. .+ has L2-013 to L2-031\.$/);
    // The open trace stays while searching.
    await expect(traceability.id).toHaveText('L2-018');
  });

  test('before stage 5 there are no requirements yet', async ({ page, traceability }) => {
    const id = await tracedProject(page, uniqueName('Parcel Post'), { 'docs/brief.md': '# Brief\n' });
    await traceability.open(id);

    await expect(traceability.empty).toBeVisible();
    await expect(traceability.empty.getByRole('link', { name: 'Open the pipeline' })).toHaveAttribute(
      'href',
      `/projects/${id}`,
    );
  });

  test('an L2.md that can’t be parsed names the commit and line, and leaves the repository unchanged', async ({
    page,
    traceability,
  }) => {
    const files = tracedFiles();
    files['docs/specs/L2.md'] += '\n## L2-040 Missing its colon\n';
    const id = await tracedProject(page, uniqueName('Harbour Rota'), files);
    await traceability.open(id);

    await expect(traceability.failure).toContainText(
      /docs\/specs\/L2\.md couldn’t be parsed at [0-9a-f]{7} \(unexpected heading on line \d+\)\. The repository is unchanged\./,
    );
    await expect(traceability.tryAgain).toBeVisible();
  });
});
