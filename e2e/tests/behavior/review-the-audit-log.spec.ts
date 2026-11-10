// Acceptance Test
// Traces to: L2-044
// Description: An Owner's sign-in, direction submissions, cancel, stop all and start workers each appear in Audit, newest first, with who, what, the target and an IP; the Owner filters by project and by action, an empty filter explains itself and Clear filters shows everything again. No API method edits an entry, and a Viewer sees the forbidden state (AC1, AC2)

import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { AuditPage } from '../../pages/audit.page';
import { aProjectNamed } from '../../support/archive';
import { tryToEditAuditEntries } from '../../support/audit';
import { xsrfToken } from '../../support/queue';
import { cancelDirections } from '../../support/rate-limit';

test.describe('Review the audit log', () => {
  test.describe.configure({ mode: 'serial' });

  test('an Owner finds what they just did, and filters by project and action', async ({ page }) => {
    await signIn(page, 'quinntynebrown');
    const ledgerline = uniqueName('Ledgerline');
    const tidewater = uniqueName('Tidewater');
    await aProjectNamed(page, ledgerline, { idle: true });
    const tidewaterId = await aProjectNamed(page, tidewater, { idle: false });
    await cancelDirections(page, [tidewaterId]);
    const headers = { 'X-XSRF-TOKEN': await xsrfToken(page) };
    expect((await page.request.post('/api/workers/stop', { data: {}, headers })).status()).toBe(200);
    expect((await page.request.post('/api/workers/start', { data: {}, headers })).status()).toBe(200);
    const audit = new AuditPage(page);

    await audit.open();

    await expect(audit.heading).toHaveText('Audit');
    await expect(audit.description).toHaveText('Who did what, when and from where. Entries can’t be edited.');
    const newest = (await audit.entries()).slice(0, 7);
    expect(newest.map((e) => [e.who, e.action, e.target])).toEqual([
      ['quinntynebrown', 'Start workers', 'All projects'],
      ['quinntynebrown', 'Stop all workers', 'All projects'],
      ['quinntynebrown', 'Cancel', tidewater],
      ['quinntynebrown', 'Direction submitted', tidewater],
      ['quinntynebrown', 'Cancel', ledgerline],
      ['quinntynebrown', 'Direction submitted', ledgerline],
      ['quinntynebrown', 'Sign in', '—'],
    ]);
    for (const e of newest) {
      expect(e.when).toMatch(/^\d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2}:\d{2}$/);
      expect(e.ip).toMatch(/^[0-9a-f.:]+$/);
    }

    await audit.projectFilter.selectOption({ label: tidewater });
    await expect(page).toHaveURL(new RegExp(`project=${tidewaterId}`));
    await expect(audit.rows).toHaveCount(2);
    expect((await audit.entries()).map((e) => e.action)).toEqual(['Cancel', 'Direction submitted']);

    await audit.actionFilter.selectOption({ label: 'Cancel' });
    await expect(audit.rows).toHaveCount(1);
    expect((await audit.entries())[0]).toMatchObject({ action: 'Cancel', target: tidewater });

    await audit.actionFilter.selectOption({ label: 'Stop all workers' });
    await expect(audit.emptyTitle).toHaveText('No entries match these filters');
    await expect(audit.emptyText).toHaveText(
      `Nobody stopped all workers from ${tidewater}. Stop all is recorded against All projects.`,
    );
    // A reload keeps the filters.
    await page.reload();
    await expect(audit.actionFilter).toHaveValue('StopAll');
    await expect(audit.emptyTitle).toHaveText('No entries match these filters');

    await audit.clearFilters.click();
    await expect(audit.projectFilter).toHaveValue('');
    await expect(audit.actionFilter).toHaveValue('');
    expect((await audit.entries())[0].action).toBe('Start workers');
  });

  test('no API edits an entry, and a Viewer is refused', async ({ page }) => {
    await signIn(page, 'quinntynebrown');
    const answers = await tryToEditAuditEntries(page);
    for (const [request, status] of Object.entries(answers)) {
      expect([404, 405], `${request} answered ${status}`).toContain(status);
    }

    await signIn(page, 'ada');
    expect((await page.request.get('/api/audit')).status()).toBe(403);
    const audit = new AuditPage(page);
    await audit.open();
    await expect(audit.description).toHaveText('Only Owners can read the audit log.');
    await expect(audit.emptyTitle).toHaveText('You don’t have access');
    await expect(audit.projectFilter).toHaveCount(0);
    await expect(audit.backToDashboard).toBeVisible();
  });
});
