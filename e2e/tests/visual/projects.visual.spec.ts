// Acceptance Test
// Traces to: L2-002
// Description: Projects matches docs/mocks region by region: the rows as a Viewer sees them, and the empty state for an Owner and for a Viewer, fed the mock's own projects

import { expect, signIn, test } from '../../fixtures/test';
import { mockProjects } from '../../support/mock-projects';
import { compare, mockRegion, region } from '../../support/mocks';
import { serveProjects } from '../../support/projects';

const tolerance = 0.02;
const now = new Date('2026-11-09T12:00:00Z');

test.beforeEach(async ({ page }) => {
  // The activity column reads "4s ago" and so on from this moment, as the mock does.
  await page.clock.setFixedTime(now);
});

test('viewer: the rows match the mock', async ({ page, projects }) => {
  await serveProjects(page, mockProjects(now));
  await signIn(page, 'ada');
  await projects.open();
  await expect(projects.rows).toHaveCount(7);

  const diff = compare(await region(projects.list), await mockRegion(page, 'pages/projects/viewer.html', '.rows'));
  expect(diff.ratio, '.rows differs from the mock').toBeLessThan(tolerance);
});

for (const [login, mock] of [
  ['quinntynebrown', 'pages/projects/empty.html'],
  ['ada', 'pages/projects/viewer-empty.html'],
] as const) {
  test(`${mock.split('/').at(-1)}: the empty state matches the mock`, async ({ page, projects }) => {
    await serveProjects(page, []);
    await signIn(page, login);
    await projects.open();
    await expect(projects.emptyTitle).toBeVisible();

    const diff = compare(await region(projects.empty), await mockRegion(page, mock, '.empty'));
    expect(diff.ratio, '.empty differs from the mock').toBeLessThan(tolerance);
  });
}
