import type { Page } from '@playwright/test';
import { xsrfToken } from './queue';
import { cancelDirections } from './rate-limit';

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
 * A real project on a repository holding these files in the fake GitHub, as a direction that passed stage 2 leaves
 * it. The direction is cancelled straight away so no worker picks it up.
 */
export async function designedProject(page: Page, name: string, files: Record<string, string>): Promise<string> {
  const repository = `designs-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
  const seeded = await page.request.put(`/api/fakes/github/hewn-builds/${repository}/files`, { data: files });
  if (!seeded.ok()) throw new Error(`Seeding hewn-builds/${repository} answered ${seeded.status()}`);
  const response = await page.request.post('/api/projects', {
    data: {
      name,
      idea: 'A web app for small accounting teams to reconcile statements.',
      stackPreference: null,
      repositoryUrl: `https://github.com/hewn-builds/${repository}`,
      budgetUsd: 300,
    },
    headers: { 'X-XSRF-TOKEN': await xsrfToken(page) },
  });
  if (response.status() !== 201) throw new Error(`Submitting answered ${response.status()}: ${await response.text()}`);
  const { projectId } = (await response.json()) as { projectId: string };
  await cancelDirections(page, [projectId]);
  return projectId;
}

/**
 * Answers GET /api/projects/{id}/designs with this body (or this problem) instead of the real designs, and every
 * preview URL with an empty, transparent page, so a thumbnail shows its frame as the mock draws it.
 */
export async function serveDesigns(page: Page, body: unknown, status = 200): Promise<void> {
  await page.route(
    (url) => /^\/api\/projects\/[^/]+\/designs$/.test(url.pathname),
    (route) => route.fulfill({ status, json: body, contentType: 'application/json' }),
  );
  await page.route(
    (url) => url.pathname.startsWith('/preview/stub/'),
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><html style="background: transparent"><body></body></html>',
      }),
  );
}
