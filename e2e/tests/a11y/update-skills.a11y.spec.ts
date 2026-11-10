// Acceptance Test
// Traces to: L2-008
// Description: The project page with its skills update link, and the Update skills dialog in its default, busy and failed states, have no axe-core violations

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { SkillsUpdate } from '../../pages/skills-update';
import { commitToGreenlit, greenlitHead, projectOnSkills } from '../../support/skills';

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

test('Update skills, accessibility: the link and every state of the dialog', async ({ page, project }) => {
  const skills = new SkillsUpdate(page);
  await signIn(page, 'quinntynebrown');
  const { projectId } = await projectOnSkills(page, uniqueName('Ledgerline'), greenlitHead());
  commitToGreenlit('grilling: keep questions short', { '.claude/skills/grilling/NOTES.md': 'Short questions.\n' });
  await project.open(projectId);
  await expect(skills.link).toBeVisible();
  expect(await violations(page), 'link').toEqual([]);

  await skills.open();
  expect(await violations(page), 'default').toEqual([]);

  await skills.failUpdate(502, 'Greenlit couldn’t be fetched (git exited with 128)', 'greenlit_unreachable');
  await skills.update.click();
  await expect(skills.failure).toBeVisible();
  expect(await violations(page), 'failed').toEqual([]);

  await skills.holdUpdate();
  await skills.tryAgain.click();
  await expect(skills.updating).toBeVisible();
  expect(await violations(page), 'busy').toEqual([]);
});
