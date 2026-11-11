// Acceptance Test
// Traces to: L2-047
// Description: On Projects, each project's stage changes are said in a polite live region, at most once every 5 seconds per project

import { expect, signIn, test, uniqueName } from '../../fixtures/test';
import { Announcer } from '../../pages/announcer';
import { drainQueue } from '../../support/queue';
import { startWorkers } from '../../support/workers';

const idea = 'Book firing slots for a shared pottery kiln.';

test.describe('Announce stage changes', () => {
  test.describe.configure({ timeout: 120_000 });

  let stopWorkers: (() => Promise<void>) | null = null;

  test.afterEach(async () => {
    await stopWorkers?.();
    stopWorkers = null;
  });

  test('Projects says each project’s stage changes, at most once every 5 seconds a project', async ({
    page,
    newDirection,
    projects,
  }) => {
    const announcer = new Announcer(page);
    await signIn(page, 'quinntynebrown');
    await drainQueue(page);
    const names = [uniqueName('Kiln'), uniqueName('Tide')];
    for (const name of names) {
      await newDirection.open();
      await newDirection.fill({ name, idea });
      await newDirection.submit();
      await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}$/);
    }
    await projects.open();
    await expect(projects.rows.first()).toBeVisible();
    await announcer.record();
    stopWorkers = startWorkers(2, 300, { executor: 'scripted' });

    const of = async (name: string) => (await announcer.said()).filter((s) => s.text.startsWith(`${name}, stage `));
    for (const name of names) {
      await expect.poll(async () => (await of(name)).length, { timeout: 60_000 }).toBeGreaterThanOrEqual(3);
    }
    await expect(announcer.region).toHaveAttribute('aria-live', 'polite');
    for (const name of names) {
      const said = await of(name);
      for (let i = 1; i < said.length; i++) {
        expect(said[i]!.at - said[i - 1]!.at, `${name}'s announcements are 5 s apart`).toBeGreaterThanOrEqual(4_900);
      }
      expect(said.at(-1)!.text).toMatch(new RegExp(`^${name}, stage \\d+, [A-Za-z ]+, [A-Za-z]+$`));
    }
  });
});
