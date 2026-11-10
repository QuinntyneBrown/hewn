/** The designs the mocks show (docs/mocks/pages/designs/default.html): Ledgerline's six screens and seventeen states. */
export function mockDesigns(origin = 'http://127.0.0.1:5300'): unknown {
  const screens: [string, string, string[]][] = [
    ['statements', 'Statements', ['Default', 'Loading', 'Empty', 'Error']],
    ['reconcile-statement', 'Reconcile statement', ['Default', 'Review', 'Loading', 'Error']],
    ['receipts', 'Receipts', ['Default', 'Empty', 'Upload error']],
    ['close-period', 'Close period', ['Default', 'Awaiting review', 'Locked']],
    ['sign-in', 'Sign in', ['Default', 'Error']],
    ['settings', 'Settings', ['Default']],
  ];
  const slug = (label: string) => label.toLowerCase().replace(/ /g, '-');
  return {
    sha: '5a1fe37c0ffee5a1fe37c0ffee5a1fe37c0ffee5',
    stateCount: 17,
    screens: screens.map(([screen, title, states]) => ({
      screen,
      title,
      magicPatternsUrl: 'https://www.magicpatterns.com/os/c9upyFcFm8ZTUr3n843kZW',
      states: states.map((label) => ({
        state: slug(label),
        label,
        path: `docs/mocks/${screen}/${slug(label)}.html`,
        previewUrl: `${origin}/preview/stub/docs/mocks/${screen}/${slug(label)}.html`,
      })),
    })),
  };
}

export const noDesigns = { sha: null, stateCount: 0, screens: [] };
