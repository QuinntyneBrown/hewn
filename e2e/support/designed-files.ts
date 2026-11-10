// The repository files a direction that passed stage 2 leaves: no imports, so video capture scripts load it too.

/** A mock page as stage 2 exports it, themed by `data-theme` on `<html>` as the preview host sets it. */
export function mockPage(heading: string, body = ''): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${heading}</title>
<style>html { background: #fff; color: #101828; font: 16px system-ui; } html[data-theme="dark"] { background: #101828; color: #f2f4f7; } main { padding: 24px; }</style>
</head><body><main><h1>${heading}</h1>${body}</main></body></html>
`;
}

/**
 * A mock that reports what it can reach from inside the preview frame: its own origin, Mission Control's cookies and
 * storage, the parent page, its viewport width and theme (L2-011 AC2, AC3).
 */
export const probeMock = mockPage(
  'Reconcile statement',
  `<dl id="probe">
<dt>origin</dt><dd data-probe="origin"></dd>
<dt>cookie</dt><dd data-probe="cookie"></dd>
<dt>storage</dt><dd data-probe="storage"></dd>
<dt>parent</dt><dd data-probe="parent"></dd>
<dt>width</dt><dd data-probe="width"></dd>
<dt>theme</dt><dd data-probe="theme"></dd>
</dl>
<script>
  const attempt = (read) => { try { return String(read()); } catch (error) { return 'blocked: ' + error.name; } };
  const show = (key, value) => { document.querySelector('[data-probe="' + key + '"]').textContent = value; };
  show('origin', self.origin);
  show('cookie', attempt(() => document.cookie));
  show('storage', attempt(() => localStorage.getItem('hewn-probe')));
  show('parent', attempt(() => parent.document.title));
  show('theme', document.documentElement.dataset.theme || 'none');
  const width = () => show('width', String(innerWidth));
  width();
  addEventListener('resize', width);
</script>`,
);

/** The manifest stage 2 writes, and its mocks: two screens, the second's Review state the probe. */
export function designedFiles(): Record<string, string> {
  const screens = [
    {
      screen: 'statements',
      feature: 'Statements',
      magicPatternsUrl: 'https://www.magicpatterns.com/c/statements',
      editorId: 'statements',
      states: ['default', 'empty'],
      notApplicable: {},
    },
    {
      screen: 'reconcile-statement',
      feature: 'Reconcile statement',
      magicPatternsUrl: 'https://www.magicpatterns.com/c/reconcile-statement',
      editorId: 'reconcile-statement',
      states: ['default', 'review', 'upload-error'],
      notApplicable: { empty: 'A reconciliation always has a statement.' },
    },
  ];
  return {
    'docs/mocks/manifest.json': `${JSON.stringify({ screens }, null, 2)}\n`,
    'docs/mocks/statements/default.html': mockPage('Statements'),
    'docs/mocks/statements/empty.html': mockPage('No statements yet'),
    'docs/mocks/reconcile-statement/default.html': mockPage('Reconcile a statement'),
    'docs/mocks/reconcile-statement/review.html': probeMock,
    'docs/mocks/reconcile-statement/upload-error.html': mockPage('The statement couldn’t upload'),
  };
}
