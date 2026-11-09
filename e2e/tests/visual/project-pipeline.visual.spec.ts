// Acceptance Test
// Traces to: L2-030
// Description: The project page's stage detail matches docs/mocks while the direction waits for a worker

import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { compare, mockRegion, region } from '../../support/mocks';

const tolerance = 0.02;

test('empty: a direction waiting for a worker says so as the mock does', async ({ page, newDirection, project }) => {
  await signIn(page, 'quinntynebrown');
  await newDirection.open();
  await newDirection.fill({
    name: uniqueName('Visual wait'),
    idea: 'A web app for small accounting teams to reconcile statements.',
  });
  await newDirection.submit();
  await expect(project.notice).toHaveText(/Waiting for a worker/);

  const diff = compare(
    await region(project.notice),
    await mockRegion(page, 'pages/project-pipeline/empty.html', 'section .empty'),
  );
  expect(diff.ratio, 'the waiting notice differs from the mock').toBeLessThan(tolerance);
});
