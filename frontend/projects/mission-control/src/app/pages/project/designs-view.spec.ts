import { Designs } from '@hewn/api';
import { WIDTHS, caption, frameLabel, previewHost, previewSrc, selection } from './designs-view';

const designs: Designs = {
  sha: '5a1fe37c0ffee',
  stateCount: 3,
  screens: [
    {
      screen: 'statements',
      title: 'Statements',
      magicPatternsUrl: 'https://www.magicpatterns.com/c/statements',
      states: [
        {
          state: 'default',
          label: 'Default',
          path: 'docs/mocks/statements/default.html',
          previewUrl: 'https://mocks.hewn.dev/preview/t1/docs/mocks/statements/default.html',
        },
      ],
    },
    {
      screen: 'reconcile-statement',
      title: 'Reconcile statement',
      magicPatternsUrl: null,
      states: [
        {
          state: 'default',
          label: 'Default',
          path: 'docs/mocks/reconcile-statement/default.html',
          previewUrl:
            'https://mocks.hewn.dev/preview/t1/docs/mocks/reconcile-statement/default.html',
        },
        {
          state: 'review',
          label: 'Review',
          path: 'docs/mocks/reconcile-statement/review.html',
          previewUrl:
            'https://mocks.hewn.dev/preview/t1/docs/mocks/reconcile-statement/review.html',
        },
      ],
    },
  ],
};

describe('designs view', () => {
  it('offers the five widths of L2-011 AC3, XS to XL', () => {
    expect(WIDTHS.map((w) => `${w.size} ${w.px}`)).toEqual([
      'XS 375',
      'S 576',
      'M 768',
      'L 992',
      'XL 1200',
    ]);
  });

  it('counts screens and states', () => {
    expect(caption(designs)).toBe('2 screens · 3 states · exported to docs/mocks/');
    expect(caption({ ...designs, stateCount: 1, screens: designs.screens.slice(0, 1) })).toBe(
      '1 screen · 1 state · exported to docs/mocks/',
    );
  });

  it('selects the first state until one is chosen, and keeps a chosen one that still exists', () => {
    expect(selection(designs, null)?.state.path).toBe('docs/mocks/statements/default.html');
    expect(selection(designs, 'docs/mocks/reconcile-statement/review.html')?.screen.title).toBe(
      'Reconcile statement',
    );
    expect(selection(designs, 'docs/mocks/gone/default.html')?.state.path).toBe(
      'docs/mocks/statements/default.html',
    );
    expect(selection({ sha: null, stateCount: 0, screens: [] }, null)).toBeNull();
  });

  it('asks the preview host for the theme', () => {
    const url = designs.screens[1].states[1].previewUrl;
    expect(previewSrc(url, 'dark')).toBe(`${url}?theme=dark`);
    expect(previewSrc(url, 'light')).toBe(`${url}?theme=light`);
  });

  it('names the preview origin and describes the frame', () => {
    expect(previewHost(designs.screens[0].states[0].previewUrl)).toBe('mocks.hewn.dev');
    expect(previewHost('http://127.0.0.1:5300/preview/t/docs/mocks/a/b.html')).toBe(
      '127.0.0.1:5300',
    );
    expect(frameLabel('Reconcile statement', 'Review', 992, 'light')).toBe(
      'Exported mock: Reconcile statement, Review state, 992 px, light',
    );
  });
});
