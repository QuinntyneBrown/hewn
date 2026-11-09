// Acceptance Test
// Traces to: L2-001, L2-030
// Description: An Owner submits a product direction and lands on the project page with stage 0 Pending; invalid input shows inline errors; a Viewer is refused

import { expect, signIn, test, uniqueName } from '../../fixtures/test';

const idea =
  'A web app for small accounting teams to reconcile bank and card statements against receipts.';

test.describe('Submit a product direction', () => {
  test('an Owner submits and reaches the project page within 2 seconds with stage 0 Pending', async ({
    page,
    newDirection,
    project,
  }) => {
    await signIn(page, 'quinntynebrown');
    await newDirection.open();
    const name = uniqueName('Ledgerline');
    await newDirection.fill({ name, idea, budget: '400.00' });

    const started = Date.now();
    await newDirection.submit();
    await expect(project.heading).toHaveText(name);
    expect(Date.now() - started).toBeLessThan(2_000);

    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}$/);
    await expect(project.projectStatus).toHaveText('Running');
    await expect(project.stages()).toHaveCount(11);
    await expect(project.stage('Bootstrap')).toContainText('Pending');
    await expect(project.stage('Increments')).toContainText('Pending');
  });

  test('the idea counter and repository placeholder follow what the Owner types', async ({
    page,
    newDirection,
  }) => {
    await signIn(page, 'quinntynebrown');
    await newDirection.open();

    await newDirection.fill({ name: 'Field Notes', idea: 'x'.repeat(323) });

    await expect(newDirection.ideaHint).toHaveText('323 of 20,000 characters');
    await expect(newDirection.repository).toHaveAttribute('placeholder', 'Creates hewn-builds/field-notes');
  });

  test('an empty name and a short idea show inline errors and a linked summary, and nothing is created', async ({
    page,
    newDirection,
  }) => {
    await signIn(page, 'quinntynebrown');
    await newDirection.open();
    await newDirection.fill({ name: '', idea: 'Expenses' });

    await newDirection.submit();

    await expect(newDirection.errorFor('name')).toHaveText('Enter a name.');
    await expect(newDirection.errorFor('idea')).toHaveText(
      'The idea must be 10 to 20,000 characters. This one has 8.',
    );
    await expect(newDirection.errorSummary).toContainText('2 things to fix before Hewn can start');
    await expect(newDirection.errorSummary).toBeFocused();
    await expect(newDirection.name).toHaveAttribute('aria-invalid', 'true');
    await expect(page).toHaveURL(/\/projects\/new$/);

    await newDirection.summaryLink('The idea must be 10 to 20,000 characters').click();
    await expect(newDirection.idea).toBeFocused();
  });

  test('a name already used by another project is refused', async ({ page, newDirection, project }) => {
    await signIn(page, 'quinntynebrown');
    const name = uniqueName('Field Notes');
    await newDirection.open();
    await newDirection.fill({ name, idea });
    await newDirection.submit();
    await expect(project.heading).toHaveText(name);

    await newDirection.open();
    await newDirection.fill({ name: name.toUpperCase(), idea });
    await newDirection.submit();

    await expect(newDirection.errorFor('name')).toHaveText(
      'Name is already used by another project. Pick a different name.',
    );
  });

  test('a repository URL that is not on GitHub is refused', async ({ page, newDirection }) => {
    await signIn(page, 'quinntynebrown');
    await newDirection.open();
    await newDirection.fill({ name: uniqueName('Ledgerline'), idea, repository: 'gitlab.com/ledgerline' });

    await newDirection.submit();

    await expect(newDirection.errorFor('repo')).toHaveText('Use a https://github.com/{owner}/{repo} URL.');
    await expect(newDirection.summaryLink('Existing repository must be a GitHub URL')).toBeVisible();
  });

  test('a repository Hewn cannot write to is refused with the reason', async ({ page, newDirection }) => {
    await signIn(page, 'quinntynebrown');
    await newDirection.open();
    await newDirection.fill({
      name: uniqueName('Ledgerline'),
      idea,
      repository: 'https://github.com/northwind/handover',
    });

    await newDirection.submit();

    await expect(newDirection.errorFor('repo')).toHaveText(
      'Hewn’s GitHub App can’t write to northwind/handover. Install the app on that repository, or leave this empty to create one.',
    );
    await expect(newDirection.summaryLink('Hewn can’t write to this repository')).toBeVisible();
  });

  test('a writable existing repository is shown on the project page', async ({ page, newDirection, project }) => {
    await signIn(page, 'quinntynebrown');
    await newDirection.open();
    await newDirection.fill({ name: uniqueName('Handover'), idea, repository: 'https://github.com/acme/handover' });

    await newDirection.submit();

    await expect(project.repository).toHaveText('acme/handover');
  });

  test('a Viewer opening New direction sees "You don’t have permission"', async ({ page, newDirection }) => {
    await signIn(page, 'ada');

    await newDirection.open();

    await expect(newDirection.forbidden).toBeVisible();
    await expect(newDirection.form).toHaveCount(0);
  });
});
