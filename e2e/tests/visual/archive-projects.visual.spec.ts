// Acceptance Test
// Traces to: L2-003
// Description: The Archived filter matches pages/projects/archived.html (its tabs and the archived row with Restore), and an Owner's Archive controls match pages/projects/default.html, enabled on an idle project and disabled on a running one (AC1, AC2)

import { expect, signIn, test } from '../../fixtures/test';
import { mockProjects } from '../../support/mock-projects';
import { compare, mockRegion, region } from '../../support/mocks';
import { serveProjects } from '../../support/projects';

const tolerance = 0.02;
const now = new Date('2026-11-09T12:00:00Z');

/** The archived mock's one project: Saltmarsh Survey, complete, last active on 12 Oct. */
const saltmarsh = {
  id: '00000000-0000-4000-8000-000000000100',
  name: 'Saltmarsh Survey',
  idea: 'Bird-count logging for estuary volunteers',
  repository: null,
  status: 'Complete',
  stage: { number: 10, name: 'Increments' },
  note: null,
  percentComplete: 100,
  spendUsd: 288.15,
  lastActivityAt: '2026-10-12T09:00:00Z',
  firstDirectionComplete: true,
  archived: true,
};

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(now);
  await serveProjects(page, [...mockProjects(now), saltmarsh]);
  await signIn(page, 'quinntynebrown');
});

test('archived: the tabs and the archived row match the mock', async ({ page, projects }) => {
  await projects.open('?status=archived');
  await expect(projects.row('Saltmarsh Survey').restore).toBeVisible();
  await page.mouse.move(0, 0);

  const tabs = compare(
    await region(projects.filters),
    await mockRegion(page, 'pages/projects/archived.html', 'nav[aria-label="Filter by status"]'),
  );
  expect(tabs.ratio, 'the tabs differ from archived.html').toBeLessThan(tolerance);
  const rows = compare(await region(projects.list), await mockRegion(page, 'pages/projects/archived.html', '.rows'));
  expect(rows.ratio, '.rows differs from archived.html').toBeLessThan(tolerance);
});

test('default: Archive, enabled and disabled, matches the mock', async ({ page, projects }) => {
  await projects.open();
  await expect(projects.rows).toHaveCount(7);
  await page.mouse.move(0, 0);

  const enabled = compare(
    await region(projects.row('Field Notes').archive, { snap: true }),
    await mockRegion(page, 'pages/projects/default.html', '[aria-label="Archive Field Notes"]', { snap: true }),
  );
  expect(enabled.ratio, 'Archive differs from default.html').toBeLessThan(tolerance);
  const disabled = compare(
    await region(projects.row('Ledgerline').archiveRefused, { snap: true }),
    await mockRegion(page, 'pages/projects/default.html', '[aria-label^="Archive Ledgerline"]', { snap: true }),
  );
  expect(disabled.ratio, 'the disabled Archive differs from default.html').toBeLessThan(tolerance);
});
