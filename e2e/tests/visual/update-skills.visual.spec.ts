// Acceptance Test
// Traces to: L2-008
// Description: The project header's skills update link matches the project-pipeline mock, and the Update skills dialog matches its default, busy and failed mocks (AC1, AC2)

import type { Page } from '@playwright/test';
import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { SkillsUpdate } from '../../pages/skills-update';
import { compare, mockRegion, region } from '../../support/mocks';
import { greenlitHead, projectOnSkills } from '../../support/skills';

const tolerance = 0.02;

/** The mocks' four Greenlit commits since 91c0b4e, newest first. */
const mockUpdate = {
  available: 4,
  lockedSha: '91c0b4e2a7d5c3b1f0e9d8c7b6a5f4e3d2c1b0a9',
  headSha: '3e1a9f0c4b5a6d7e8f90a1b2c3d4e5f6a7b8c9d0',
  commits: [
    {
      sha: '3e1a9f0c4b5a6d7e8f90a1b2c3d4e5f6a7b8c9d0',
      message: 'writing-html-mocks: require a bottom sheet under 640 px',
    },
    {
      sha: 'b72c4d1e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c',
      message: 'estimating-designs: 3-day descope threshold by default',
    },
    { sha: '90fe2150a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6', message: 'implementing-incrementally: record red before green' },
    {
      sha: '4d0b8aa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7',
      message: 'grilling: answer for the user when running unattended',
    },
  ],
  pullRequest: null,
};

/** A project named Ledgerline, as in the mocks, with the mocks' update on offer. */
async function ledgerline(page: Page, skills: SkillsUpdate): Promise<string> {
  await signIn(page, 'quinntynebrown');
  const { projectId } = await projectOnSkills(page, uniqueName('Ledgerline'), greenlitHead());
  await page.route(`**/api/projects/${projectId}`, async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...(await response.json()), name: 'Ledgerline' } });
  });
  await skills.serve(mockUpdate);
  return projectId;
}

async function matches(page: Page, skills: SkillsUpdate, mock: string): Promise<number> {
  await page.mouse.move(0, 0);
  return compare(await region(skills.panel), await mockRegion(page, mock, '.dialog__panel')).ratio;
}

test.describe('Update skills, visual', () => {
  test.describe.configure({ mode: 'serial' });

  test('the header link as the project-pipeline mock shows it', async ({ page, project }) => {
    const skills = new SkillsUpdate(page);
    await project.open(await ledgerline(page, skills));
    await expect(skills.link).toHaveText('Skills update available (4 commits)');

    const app = await region(skills.link, { snap: true });
    const mock = await mockRegion(page, 'pages/project-pipeline/default.html', '.phead__meta .btn--link', {
      snap: true,
    });
    await test.info().attach('app link', { body: app, contentType: 'image/png' });
    await test.info().attach('mock link', { body: mock, contentType: 'image/png' });
    const diff = compare(app, mock);
    expect(diff.ratio, 'the link differs from the mock').toBeLessThan(tolerance);
  });

  test('default and busy as the mocks show them', async ({ page, project }) => {
    const skills = new SkillsUpdate(page);
    await project.open(await ledgerline(page, skills));
    await skills.open();
    expect(await matches(page, skills, 'dialogs/update-skills/default.html'), 'default').toBeLessThan(tolerance);

    await skills.holdUpdate();
    await skills.update.click();
    await expect(skills.updating).toBeVisible();
    expect(await matches(page, skills, 'dialogs/update-skills/busy.html'), 'busy').toBeLessThan(tolerance);
  });

  test('failed as the mock shows it', async ({ page, project }) => {
    const skills = new SkillsUpdate(page);
    await project.open(await ledgerline(page, skills));
    await skills.open();
    await skills.failUpdate(502, 'Greenlit couldn’t be fetched (GitHub returned 502)', 'greenlit_unreachable');
    await skills.update.click();
    await expect(skills.failure).toBeVisible();
    await skills.tryAgain.blur();

    expect(await matches(page, skills, 'dialogs/update-skills/failed.html'), 'failed').toBeLessThan(tolerance);
  });
});
