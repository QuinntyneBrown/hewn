// Acceptance Test
// Traces to: L2-032, L2-031
// Description: Events that happen while the live connection is down are caught up after their last sequence number, each applied once, and the project page then matches a fresh load; the banner goes once catch-up finishes (L2-032 AC2, AC3; L2-031 AC2)

import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { LiveConnection } from '../../pages/live-connection';
import { NewDirectionPage } from '../../pages/new-direction.page';
import { ProjectPage } from '../../pages/project.page';
import { cancelDirections } from '../../support/rate-limit';
import { startWorkers } from '../../support/workers';

const unique = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

test.describe('Reconnect Mission Control, catch-up', () => {
  test.describe.configure({ timeout: 120_000 });

  test('missed events are applied once and the page matches a fresh load', async ({ page, browser }) => {
    const live = new LiveConnection(page);
    await live.intercept();
    await signIn(page, 'quinntynebrown');
    const name = unique('caught');
    let stop = startWorkers(1, 1_500, { executor: 'scripted', namePrefix: name, logLines: 2 });
    let projectId = '';
    try {
      const submit = new NewDirectionPage(page);
      await submit.open();
      await submit.fill({ name: uniqueName('Catch Up'), idea: 'A seed swap register for a community garden.' });
      await submit.submit();
      const project = new ProjectPage(page);
      await expect(project.currentStage()).toBeVisible({ timeout: 15_000 });
      projectId = new URL(page.url()).pathname.split('/')[2]!;
      await project.selectStage('Bootstrap');
      await expect(project.logLines.first()).toBeVisible({ timeout: 15_000 });

      // The network drops while the worker keeps going; nothing new reaches the page.
      await live.drop();
      await expect(live.banner).toContainText('Reconnecting…');
      const shown = await project.logLines.count();
      await page.waitForTimeout(6_000);
      await stop();
      stop = async () => {};
      expect(await project.logLines.count(), 'nothing arrives while the connection is down').toBe(shown);

      // Back before the attempt at 12 s: the page catches up and says how much.
      live.restore();
      await expect(live.banner).toHaveText(/^Reconnected\. Caught up \d+ missed events?, #[\d,]+( to #[\d,]+)?\.$/, {
        timeout: 15_000,
      });
      await expect(live.banner).toBeHidden({ timeout: 10_000 });

      // A fresh load shows exactly the same pipeline and log: nothing missed, nothing twice.
      const fresh = await browser.newPage();
      await signIn(fresh, 'quinntynebrown');
      const reloaded = new ProjectPage(fresh);
      await fresh.goto(`/projects/${projectId}`);
      await expect(reloaded.pipeline).toBeVisible();
      await reloaded.selectStage('Bootstrap');
      await expect(reloaded.logLines.first()).toBeVisible();
      // Running stages show a ticking duration; the rest must be identical.
      const stages = async (p: ProjectPage) => (await p.pipeline.innerText()).replace(/\d+:\d\d(:\d\d)?/g, 'm:ss');
      expect(await stages(project)).toBe(await stages(reloaded));
      expect(await project.logLines.allInnerTexts()).toEqual(await reloaded.logLines.allInnerTexts());
      await fresh.close();
    } finally {
      await stop();
      if (projectId) await cancelDirections(page, [projectId]);
    }
  });
});
