// Acceptance Test
// Traces to: L2-023
// Description: An increment's page plays its captioned walkthrough, served by the API, with play and pause, the captions over the picture, a captions toggle and a keyboard seek slider, for an Owner or a Viewer (AC2); when the video failed it shows "Video failed: {reason}" and the increment still went on to its pull request (AC3)

import type { Page } from '@playwright/test';
import { expect, signIn, test } from '../../fixtures/test';
import { aCancelledProject } from '../../support/artifacts-project';
import { serveIncrement, serveVideo } from '../../support/increment';
import { mockIncrement, type IncrementMockState } from '../../support/mock-increment';

const file = {};

async function openIncrement(page: Page, state: IncrementMockState): Promise<string> {
  const id = await aCancelledProject(page, file);
  await serveIncrement(page, mockIncrement(state));
  await serveVideo(page);
  return id;
}

test.describe('Watch an increment demonstration', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'quinntynebrown');
  });

  test('the captioned walkthrough plays on the increment page', async ({ page, increment }) => {
    const id = await openIncrement(page, 'default');
    await signIn(page, 'ada');
    await increment.open(id, 7);

    await expect(increment.video).toHaveAttribute('src', '/api/projects/mock/increments/7/video');
    await expect(increment.video.locator('track')).toHaveAttribute(
      'src',
      '/api/projects/mock/increments/7/video/captions',
    );
    await expect(increment.videoFooter).toContainText('Captioned walkthrough · 1080p · 0:10');
    await expect(increment.position).toHaveText('0:00 / 0:10');

    await increment.play.click();
    await expect(increment.pause).toBeVisible();
    await expect(increment.caption).toHaveText('A card line within the tolerance matches its transaction.');
    await expect.poll(() => increment.currentTime()).toBeGreaterThan(0.5);
    await increment.pause.click();
    await expect(increment.play).toBeVisible();
  });

  test('captions can be turned off and on, and the seek slider moves by keyboard', async ({ page, increment }) => {
    const id = await openIncrement(page, 'default');
    await increment.open(id, 7);
    await expect(increment.position).toHaveText('0:00 / 0:10');

    await increment.seek.focus();
    await page.keyboard.press('End');
    await expect(increment.seek).toHaveAttribute('aria-valuenow', '10');
    await expect(increment.seek).toHaveAttribute('aria-valuetext', '10 seconds of 10 seconds');
    await page.keyboard.press('Home');
    await expect(increment.position).toHaveText('0:00 / 0:10');
    await page.keyboard.press('ArrowRight');
    await expect(increment.seek).toHaveAttribute('aria-valuenow', '5');
    await expect(increment.caption).toHaveText('The month closes once every line is matched.');

    await expect(increment.captions).toHaveAttribute('aria-pressed', 'true');
    await increment.captions.click();
    await expect(increment.captions).toHaveAccessibleName('Captions off');
    await expect(increment.captions).toHaveAttribute('aria-pressed', 'false');
    await expect(increment.caption).toHaveCount(0);
    await increment.captions.click();
    await expect(increment.caption).toBeVisible();
  });

  test('a failed video says why, and the increment still went on to its pull request', async ({ page, increment }) => {
    const id = await openIncrement(page, 'video-failed');
    await increment.open(id, 7);

    await expect(increment.videoPlaceholder).toContainText('Video failed: browser crashed during capture');
    await expect(increment.videoPlaceholder).toContainText(
      'The capture failed, was retried once and failed again. The pull request went ahead with this noted under Notes.',
    );
    await expect(increment.video).toHaveCount(0);
    await expect(increment.step('Video failed').detail).toContainText('browser crashed during capture');
    await expect(increment.pullRequest).toBeVisible();
    await expect(increment.body).toContainText('Video failed: browser crashed during capture');
  });

  test('before green, and when Blocked, the page says when a walkthrough is recorded', async ({ page, increment }) => {
    const id = await openIncrement(page, 'implementing');
    await increment.open(id, 7);
    await expect(increment.videoPlaceholder).toHaveText(
      'The walkthrough records once every test is green. Implementing, iteration 3 of 10.',
    );

    await page.unrouteAll();
    await serveIncrement(page, mockIncrement('blocked'));
    await increment.open(id, 7);
    await expect(increment.videoPlaceholder).toHaveText(
      'Blocked after 10 iterations; no video is recorded until every test is green.',
    );
  });
});
