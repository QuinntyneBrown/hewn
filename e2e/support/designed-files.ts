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

/**
 * A design-system page as stage 3 writes it: themed by `data-theme` on `<html>`, and reporting the theme and width it
 * sees from inside the preview frame (L2-012 AC4).
 */
export function systemPage(title: string, body = ''): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
<style>
html { --accent: #2f6fed; --surface: #ffffff; --text: #14181d; background: var(--surface); color: var(--text); font: 16px system-ui; }
html[data-theme="dark"] { --accent: #6f9bff; --surface: #14181d; --text: #f4f5f7; }
main { padding: 24px; } .swatch { display: inline-block; width: 64px; height: 40px; border-radius: 8px; margin-right: 8px; border: 1px solid #8884; }
.btn { font: inherit; padding: 8px 16px; border-radius: 8px; border: 0; background: var(--accent); color: #fff; }
</style></head><body><main><h1>${title}</h1>${body}
<p id="seen">Theme <span data-probe="theme"></span> · <span data-probe="width"></span> px</p></main>
<script>
  const show = () => {
    document.querySelector('[data-probe="theme"]').textContent = document.documentElement.dataset.theme || 'none';
    document.querySelector('[data-probe="width"]').textContent = String(innerWidth);
  };
  show();
  addEventListener('resize', show);
</script></body></html>
`;
}

/** What stage 3 leaves in docs/design-system/: tokens.json, the token pages and the component pages. */
export function extractedFiles(): Record<string, string> {
  const color = (accent: string, surface: string, text: string) => ({
    accent: { $type: 'color', $value: accent },
    surface: { $type: 'color', $value: surface },
    text: { $type: 'color', $value: text },
  });
  const tokens = {
    color: { light: color('#2f6fed', '#ffffff', '#14181d'), dark: color('#6f9bff', '#14181d', '#f4f5f7') },
    typography: { body: { $type: 'fontFamily', $value: 'system-ui, sans-serif' } },
    spacing: { '2': { $type: 'dimension', $value: '8px' }, '4': { $type: 'dimension', $value: '16px' } },
    radius: { md: { $type: 'dimension', $value: '8px' } },
    elevation: { '1': { $type: 'shadow', $value: '0 1px 2px rgb(0 0 0 / 10%)' } },
    motion: { fast: { $type: 'duration', $value: '150ms' } },
  };
  const swatches =
    '<p><span class="swatch" style="background: var(--accent)"></span><span class="swatch" style="background: var(--surface)"></span><span class="swatch" style="background: var(--text)"></span></p>';
  return {
    'docs/design-system/tokens.json': `${JSON.stringify(tokens, null, 2)}\n`,
    'docs/design-system/foundations/colour.html': systemPage('Colour', swatches),
    'docs/design-system/foundations/typography.html': systemPage('Typography', '<p>Reconcile the statement</p>'),
    'docs/design-system/foundations/spacing.html': systemPage('Spacing'),
    'docs/design-system/foundations/radius.html': systemPage('Radius'),
    'docs/design-system/foundations/elevation.html': systemPage('Elevation'),
    'docs/design-system/foundations/motion.html': systemPage('Motion'),
    'docs/design-system/components/button.html': systemPage(
      'Button',
      '<p><button class="btn" type="button">Save</button></p>',
    ),
    'docs/design-system/components/status-badge.html': systemPage('Status badge', '<p>Running · Blocked · Complete</p>'),
  };
}
