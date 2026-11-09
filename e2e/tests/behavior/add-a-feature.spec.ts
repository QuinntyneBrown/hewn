// Acceptance Test
// Traces to: L2-005
// Description: An Owner picks Add a feature on New direction, sees which stages are skipped, and a feature for a product that is still running queues behind it

import { expect, signIn, test, uniqueName } from '../../fixtures/test';

const idea = 'An operations portal for shift supervisors, with rosters and incident reports.';
const feature = 'Add a CSV export of the shift report, one row per shift, with crew, hours and incidents.';

test.describe('Add a feature', () => {
  test('choosing Feature for a product shows the product, feature and budget fields and the skipped stages', async ({
    page,
    newDirection,
  }) => {
    await signIn(page, 'quinntynebrown');
    await newDirection.open();

    await newDirection.featureMode.click();

    await expect(newDirection.featureMode).toHaveAttribute('aria-checked', 'true');
    await expect(newDirection.productMode).toHaveAttribute('aria-checked', 'false');
    await expect(newDirection.product).toBeVisible();
    await expect(newDirection.feature).toBeVisible();
    await expect(newDirection.budget).toBeVisible();
    await expect(newDirection.name).toHaveCount(0);
    await expect(newDirection.productHint).toHaveText(
      'A product whose first direction isn’t complete queues the feature behind it',
    );
    expect(await newDirection.skippedInPlan()).toEqual(['Bootstrap', 'Stack', 'Scaffold']);
    await expect(newDirection.planNote).toHaveText(
      'Bootstrap, stack and scaffold are skipped. Designs are skipped too if there is no UI change.',
    );

    await newDirection.feature.fill(feature);
    await expect(newDirection.featureHint).toHaveText(`${feature.length} of 20,000 characters`);
  });

  test('the Feature for a product radio works from the keyboard', async ({ page, newDirection }) => {
    await signIn(page, 'quinntynebrown');
    await newDirection.open();

    await newDirection.productMode.focus();
    await page.keyboard.press('ArrowRight');

    await expect(newDirection.featureMode).toHaveAttribute('aria-checked', 'true');
    await expect(newDirection.featureMode).toBeFocused();
  });

  test('a feature for a product that is still running queues behind its direction', async ({
    page,
    newDirection,
    project,
  }) => {
    await signIn(page, 'quinntynebrown');
    const name = uniqueName('Northwind Ops');
    await newDirection.open();
    await newDirection.fill({ name, idea });
    await newDirection.submit();
    await expect(project.heading).toHaveText(name);

    await newDirection.open();
    await newDirection.featureMode.click();
    await expect(newDirection.productOption(name)).toHaveText(`${name} · queues behind the running direction`);
    await newDirection.fillFeature({ product: name, feature, budget: '60.00' });
    await newDirection.submit();

    await expect(project.heading).toHaveText(name);
    await expect(project.directionMeta).toHaveText('Product direction · submitted by quinntynebrown');
    await expect(project.queuedCallout).toContainText('1 direction queued');
    await expect(project.queuedCallout).toContainText(
      'Feature direction “Add a CSV export of the shift report”, submitted by quinntynebrown',
    );
    await expect(project.queuedCallout).toContainText(
      'starts when this direction is Complete or Cancelled. One direction runs per project, first in, first out.',
    );
  });

  test('a short feature shows an inline error and nothing is queued', async ({ page, newDirection, project }) => {
    await signIn(page, 'quinntynebrown');
    const name = uniqueName('Field Notes');
    await newDirection.open();
    await newDirection.fill({ name, idea });
    await newDirection.submit();
    await expect(project.heading).toHaveText(name);
    await newDirection.open();

    await newDirection.fillFeature({ product: name, feature: 'CSV only' });
    await newDirection.submit();

    await expect(newDirection.errorFor('feature')).toHaveText(
      'The feature must be 10 to 20,000 characters. This one has 8.',
    );
    await expect(newDirection.errorSummary).toContainText('1 thing to fix before Hewn can start');
    await expect(newDirection.feature).toHaveAttribute('aria-invalid', 'true');
  });
});
