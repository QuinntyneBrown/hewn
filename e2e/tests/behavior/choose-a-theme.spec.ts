// Acceptance Test
// Traces to: L2-048
// Description: With no saved choice Mission Control follows the OS colour scheme, live; a choice of Light, Dark or
// System made in Settings is kept across a reload, for Owners and Viewers alike

import { expect, signIn, test } from '../../fixtures/test';
import { Navigation } from '../../pages/navigation';

test.describe('Choose a theme', () => {
  test('with no saved choice, the theme follows the operating system, and changes when it does', async ({
    page,
    settings,
    theme,
  }) => {
    await theme.osPrefers('dark');
    await signIn(page, 'quinntynebrown');
    await settings.open();
    expect(await theme.shown()).toBe('dark');
    await expect(settings.themeChoice('System')).toBeChecked();

    await theme.osPrefers('light');
    expect(await theme.shown()).toBe('light');
    await theme.osPrefers('dark');
    expect(await theme.shown()).toBe('dark');
  });

  test('Dark and Light override the operating system and are kept across a reload', async ({
    page,
    settings,
    theme,
  }) => {
    await theme.osPrefers('light');
    await signIn(page, 'quinntynebrown');
    await settings.open();
    const light = await theme.background();

    await settings.themeChoice('Dark').check();
    expect(await theme.shown()).toBe('dark');
    const dark = await theme.background();
    expect(dark, 'the page background changes with the theme').not.toBe(light);

    await page.reload();
    await expect(settings.themeChoice('Dark')).toBeChecked();
    expect(await theme.shown()).toBe('dark');
    await theme.osPrefers('dark');
    await theme.osPrefers('light');
    expect(await theme.shown(), 'a saved Dark ignores the OS').toBe('dark');

    await theme.osPrefers('dark');
    await settings.themeChoice('Light').check();
    expect(await theme.shown()).toBe('light');
    await page.reload();
    await expect(settings.themeChoice('Light')).toBeChecked();
    expect(await theme.shown(), 'a saved Light ignores the OS').toBe('light');
    expect(await theme.background()).toBe(light);
  });

  test('choosing System goes back to following the operating system, after a reload too', async ({
    page,
    settings,
    theme,
  }) => {
    await theme.osPrefers('light');
    await signIn(page, 'quinntynebrown');
    await settings.open();
    await settings.themeChoice('Dark').check();
    await settings.themeChoice('System').check();
    expect(await theme.shown()).toBe('light');

    await page.reload();
    await expect(settings.themeChoice('System')).toBeChecked();
    await theme.osPrefers('dark');
    expect(await theme.shown()).toBe('dark');
  });

  test('a Viewer chooses a theme too, and it shows on every page', async ({ page, settings, theme }) => {
    const nav = new Navigation(page);
    await theme.osPrefers('light');
    await signIn(page, 'ada');
    await settings.open();
    await expect(settings.themeChoice('Dark')).toBeEnabled();
    await settings.themeChoice('Dark').check();

    await nav.visit('/projects');
    expect(await theme.shown()).toBe('dark');
    await nav.visit('/workers');
    expect(await theme.shown()).toBe('dark');
  });
});
