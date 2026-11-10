// Acceptance Test
// Traces to: L2-054
// Description: Decisions lists the questions agents answered for themselves, newest first, each with its stage, answer, rationale and a link to the commit that recorded it (and any ADR), for an Owner or a Viewer; the stage filter narrows the list, with the no-results, empty and error states (AC2, AC3)

import { expect, signIn, test } from '../../fixtures/test';
import { aCancelledProject } from '../../support/artifacts-project';
import { decisionsFailure, mockDecisions, noDecisions, serveDecisions } from '../../support/mock-decisions';

const file = {};

test.describe('Review agent decisions', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'quinntynebrown');
  });

  test('decisions are listed newest first with stage, rationale and the commit that recorded them', async ({
    page,
    decisions,
  }) => {
    const id = await aCancelledProject(page, file);
    await signIn(page, 'ada');
    await serveDecisions(page, mockDecisions());
    await decisions.open(id);

    await expect(decisions.tab('Decisions')).toHaveAttribute('aria-current', 'page');
    await expect(decisions.stage).toHaveValue('');
    expect(await decisions.questions()).toEqual([
      'Which time zone decides whether a card transaction falls on a statement date?',
      'Should a split transaction keep the original receipt on every part?',
      'Multi-currency reconciliation is 7 days. Split or defer?',
      'The direction mentions “works offline on site visits”. Add a PWA layer?',
      'Who approves a reconciled period: the preparer or a second person?',
    ]);

    const pwa = decisions.decision(/Add a PWA layer\?$/);
    await expect(pwa.when).toHaveText('8 Nov, 09:12');
    await expect(pwa.stage).toHaveText('Stack');
    await expect(pwa.answer).toHaveText(
      'No. Keep the default .NET + Angular stack; offline is out of scope in the brief.',
    );
    await expect(pwa.rationale).toHaveText(/^The brief’s users reconcile at a desk;/);
    await expect(pwa.commit).toHaveText('c03e57b');
    await expect(pwa.commit).toHaveAttribute(
      'href',
      `https://github.com/hewn-builds/ledgerline/commit/${'c03e57b'.padEnd(40, '0')}`,
    );
    await expect(pwa.commit).toHaveAttribute('target', '_blank');
    await expect(pwa.adr).toHaveText('ADR 0001');
    await expect(pwa.adr).toHaveAttribute(
      'href',
      'https://github.com/hewn-builds/ledgerline/blob/main/docs/adr/0001-stack.md',
    );
    await expect(decisions.decision(/^Who approves/).adr).toHaveCount(0);
  });

  test('the stage filter narrows the list and keeps the stage in the address', async ({ page, decisions }) => {
    const id = await aCancelledProject(page, file);
    const asked = await serveDecisions(page, mockDecisions());
    await decisions.open(id);
    await expect(decisions.decisions).toHaveCount(5);

    await decisions.filterBy('Increments');
    await expect(page).toHaveURL(/\/decisions\?stage=10$/);
    expect(await decisions.questions()).toEqual([
      'Which time zone decides whether a card transaction falls on a statement date?',
      'Should a split transaction keep the original receipt on every part?',
    ]);
    await expect(decisions.decisions.locator('.decision__when .text-subtle')).toHaveText(['Increments', 'Increments']);
    expect(asked.at(-1)).toBe('10');

    // A link to a stage opens filtered.
    await decisions.open(id, 4);
    await expect(decisions.stage).toHaveValue('4');
    expect(await decisions.questions()).toEqual([
      'The direction mentions “works offline on site visits”. Add a PWA layer?',
    ]);

    await decisions.filterBy('All stages');
    await expect(page).toHaveURL(/\/decisions$/);
    await expect(decisions.decisions).toHaveCount(5);
  });

  test('a stage with no decisions says so and offers every stage again', async ({ page, decisions }) => {
    const id = await aCancelledProject(page, file);
    await serveDecisions(page, mockDecisions());
    await decisions.open(id, 3);

    await expect(decisions.noResults).toContainText('No decisions in Design system');
    await expect(decisions.noResults).toContainText('The agent didn’t need to decide anything during that stage.');
    await decisions.showAllStages.click();
    await expect(page).toHaveURL(/\/decisions$/);
    await expect(decisions.stage).toHaveValue('');
    await expect(decisions.decisions).toHaveCount(5);
  });

  test('a project with no decisions yet says so', async ({ page, decisions }) => {
    const id = await aCancelledProject(page, file);
    await serveDecisions(page, noDecisions);
    await decisions.open(id);

    await expect(decisions.empty).toContainText('No decisions yet');
    await expect(decisions.decisions).toHaveCount(0);
  });

  test('a failure says what went wrong, and Try again reads the decisions again', async ({ page, decisions }) => {
    const id = await aCancelledProject(page, file);
    await serveDecisions(page, decisionsFailure, 502);
    await decisions.open(id);

    await expect(decisions.failure).toContainText(
      'docs/decisions.md couldn’t be read from hewn-builds/ledgerline. Decisions are still being recorded in the repository.',
    );
    await page.unrouteAll();
    await serveDecisions(page, mockDecisions());
    await decisions.tryAgain.click();
    await expect(decisions.decisions).toHaveCount(5);
  });
});
