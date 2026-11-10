// Acceptance Test
// Traces to: L2-008
// Description: With Greenlit ahead of a project's skills lock, an Owner sees "Skills update available (n commits)", reviews the commits and chooses Update skills; the pull request opens and merges once its checks pass, after which no update is offered; a failure says why and offers Try again; Viewers see no link (AC1, AC2)

import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { SkillsUpdate } from '../../pages/skills-update';
import { xsrfToken } from '../../support/queue';
import { commitToGreenlit, greenlitHead, lockedSha, projectOnSkills } from '../../support/skills';

test.describe('Update project skills', () => {
  test.describe.configure({ mode: 'serial' });

  test('an Owner updates the skills and the pull request merges when checks pass', async ({ page, project }) => {
    const skills = new SkillsUpdate(page);
    await signIn(page, 'quinntynebrown');
    const locked = greenlitHead();
    const { projectId, repository } = await projectOnSkills(page, uniqueName('Ledgerline'), locked);
    commitToGreenlit('grilling: answer for the user when running unattended', {
      '.claude/skills/grilling/SKILL.md': '# Grilling\n\nAnswer for the user when running unattended.\n',
    });
    const head = commitToGreenlit('estimating-designs: 3-day descope threshold by default', {
      '.claude/skills/estimating-designs/SKILL.md': '# Estimating designs\n\n3-day descope threshold by default.\n',
    });

    await project.open(projectId);
    await expect(skills.link).toHaveText('Skills update available (2 commits)');
    await skills.open();

    await expect(skills.since).toHaveText(`Greenlit · 2 commits since ${locked.slice(0, 7)}`);
    await expect(skills.commits).toHaveText([
      `${head.slice(0, 7)}estimating-designs: 3-day descope threshold by default`,
      /grilling: answer for the user when running unattended$/,
    ]);
    await skills.update.click();

    await expect(skills.dialog).toBeHidden();
    await expect(skills.openedToast).toContainText('It merges automatically when checks pass.');
    await expect(skills.link).toHaveCount(0);
    // The merger sweeps every 10 seconds; the fake's checks pass at once.
    await expect.poll(() => lockedSha(page, repository), { timeout: 45_000 }).toBe(head);
    await page.reload();
    await expect(project.headerMeta).toBeVisible();
    await expect(skills.link).toHaveCount(0);
  });

  test('a failed update says why and offers Try again', async ({ page, project }) => {
    const skills = new SkillsUpdate(page);
    await signIn(page, 'quinntynebrown');
    const { projectId } = await projectOnSkills(page, uniqueName('Ledgerline'), greenlitHead());
    commitToGreenlit('implementing-incrementally: record red before green', {
      '.claude/skills/grilling/NOTES.md': 'Red before green.\n',
    });
    await project.open(projectId);
    await skills.open();
    await skills.failUpdate(502, 'Greenlit couldn’t be fetched (git exited with 128)', 'greenlit_unreachable');

    await skills.update.click();

    await expect(skills.failure).toContainText('Skills weren’t updated');
    await expect(skills.failure).toContainText('Greenlit couldn’t be fetched (git exited with 128). Ledgerline');
    await expect(skills.tryAgain).toBeVisible();
    await skills.notNow.click();
    await expect(skills.dialog).toBeHidden();
    await expect(skills.link).toBeVisible();
  });

  test('a Viewer sees no skills update, and cannot ask for one', async ({ page, project }) => {
    const skills = new SkillsUpdate(page);
    await signIn(page, 'quinntynebrown');
    const { projectId } = await projectOnSkills(page, uniqueName('Ledgerline'), greenlitHead());
    commitToGreenlit('grilling: ask one question at a time', {
      '.claude/skills/grilling/NOTES.md': 'One at a time.\n',
    });

    await signIn(page, 'ada');
    await project.open(projectId);
    await expect(project.headerMeta).toBeVisible();
    await expect(skills.link).toHaveCount(0);
    const refused = await page.request.post(`/api/projects/${projectId}/skills-update`, {
      data: {},
      headers: { 'X-XSRF-TOKEN': await xsrfToken(page) },
    });
    expect(refused.status()).toBe(403);
  });
});
