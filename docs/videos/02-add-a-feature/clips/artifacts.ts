// Runs a product's document stages and then a no-UI feature's against a temporary repository, with the same executor
// and scripted agent the e2e stack uses, and renders the before-and-after diffs of docs/specs/L2.md and
// docs/journeys.md, the recorded UI decision, and the validator refusing a renumbered requirement.
//   cd worker && node ../docs/videos/02-add-a-feature/clips/artifacts.ts
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../../..');
const w = (path: string) => join(repoRoot, 'worker/src', path);
const { ScriptedStageAgent } = await import(w('agents/scripted-agent.ts'));
const { DocumentStageExecutor } = await import(w('executors/document-executor.ts'));
const { chromium } = createRequire(join(repoRoot, 'worker/package.json'))('playwright-core');

const screens = resolve(here, '../screens');
mkdirSync(screens, { recursive: true });
const root = mkdtempSync(join(tmpdir(), 'hewn-video-02-'));
const repo = join(root, 'northwind-ops-abc1234');
mkdirSync(repo);
writeFileSync(join(repo, 'README.md'), '# Northwind Ops\n');

const NAMES = ['Bootstrap', 'Idea', 'Designs', 'Design system', 'Stack', 'Requirements', 'Scaffold', 'Detailed designs', 'User journeys'];
const idea = 'An operations portal for shift supervisors, with rosters and incident reports.';
const feature = 'Add a CSV export of the shift report, one row per shift, with crew, hours and incidents.';
const agent = new ScriptedStageAgent(() => '2026-11-09');

async function stage(number: number, kind: 'Product' | 'Feature', custom = agent): Promise<string[]> {
  const logs: string[] = [];
  const run = {
    runId: `run-${kind}-${number}`,
    epoch: 1,
    projectId: 'p',
    directionId: kind,
    stage: number,
    stageName: NAMES[number],
    checkpointStep: 0,
    checkpointSha: null,
    project: { id: 'p', name: 'Northwind Ops', idea, stackPreference: null, repository: 'hewn-builds/northwind-ops' },
    direction: { kind, idea: kind === 'Feature' ? feature : idea, hasUiChange: null },
    skillsSource: 'unused',
    descopeThresholdDays: 3,
    maxIterations: 10,
  };
  const context = {
    workspace: mkdtempSync(join(root, 'ws-')),
    log: async (_l: string, text: string) => void logs.push(text),
    listSkillFolders: async () => ({}),
    downloadRepository: async () => execFileSync('tar', ['-czf', '-', '-C', root, 'northwind-ops-abc1234']),
    commit: async (_s: unknown, _m: string, files: { path: string; content: Buffer }[]) => {
      for (const f of files) {
        mkdirSync(dirname(join(repo, f.path)), { recursive: true });
        writeFileSync(join(repo, f.path), f.content);
      }
      return 'c1';
    },
    reportScope: async (r: { hasUiChange: boolean; rationale: string }) => void logs.push(`reported hasUiChange=${r.hasUiChange}`),
  };
  for (const step of new DocumentStageExecutor(custom).plan(run, context)) await step.execute(new AbortController().signal);
  return logs;
}

for (const n of [1, 5, 7, 8]) await stage(n, 'Product');
const before = { l2: readFileSync(join(repo, 'docs/specs/L2.md'), 'utf8'), journeys: readFileSync(join(repo, 'docs/journeys.md'), 'utf8') };
for (const n of [1, 5, 7, 8]) await stage(n, 'Feature');
const after = { l2: readFileSync(join(repo, 'docs/specs/L2.md'), 'utf8'), journeys: readFileSync(join(repo, 'docs/journeys.md'), 'utf8') };

// The validator refusing an agent that renumbers an existing requirement.
let refusal = '';
const renumbering = {
  run: async (task: { directory: string }) => {
    await agent.run(task);
    const path = join(task.directory, 'docs/specs/L2.md');
    writeFileSync(path, readFileSync(path, 'utf8').replace('## L2-002', '## L2-009'));
  },
};
try {
  await stage(5, 'Feature', renumbering);
} catch (error) {
  refusal = (error as Error).message;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
/** A line diff: kept lines plain, added lines marked "+" and tinted, removed lines marked "−". */
function diff(a: string, b: string): string {
  const old = a.split('\n');
  const next = b.split('\n');
  const rows: string[] = [];
  let i = 0;
  for (const line of next) {
    if (old[i] === line) {
      rows.push(`<div class="k">  ${esc(line)}</div>`);
      i++;
    } else {
      rows.push(`<div class="a">+ ${esc(line)}</div>`);
    }
  }
  for (; i < old.length; i++) rows.push(`<div class="r">− ${esc(old[i]!)}</div>`);
  return rows.join('');
}
const page = await (await chromium.launch()).newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 });
const css = `body{margin:0;font:14px/1.45 ui-monospace,Menlo,monospace;background:#f5f3ef;color:#1d1b18}
  .h{padding:12px 22px;background:#fff;border-bottom:1px solid #ddd8cf;font:600 16px system-ui}.h span{color:#1a5fb4}
  .b{padding:14px 22px;white-space:pre-wrap;word-break:break-word}.k{color:#3d3a35}.a{background:#dff3e4;color:#0f5132;font-weight:600}.r{background:#fbe2e0;color:#842029}
  .legend{font:13px system-ui;color:#5b574f;padding:8px 22px 0}`;
async function render(name: string, title: string, body: string, legend = '', size = { width: 1280, height: 800 }): Promise<void> {
  await page.setViewportSize(size);
  await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body><div class="h">hewn-builds/northwind-ops · <span>${esc(title)}</span></div>${legend ? `<div class="legend">${legend}</div>` : ''}<div class="b">${body}</div></body></html>`);
  await page.screenshot({ path: join(screens, `${name}.png`) });
}
const legend = 'After the feature direction: lines marked + were added; every other line is unchanged.';
await render('diff-l2', 'docs/specs/L2.md', diff(before.l2, after.l2), legend);
const journeysStart = Math.max(0, before.journeys.split('\n').length - 14);
await render(
  'diff-journeys',
  'docs/journeys.md',
  diff(before.journeys.split('\n').slice(journeysStart).join('\n'), after.journeys.split('\n').slice(journeysStart).join('\n')),
  `${legend} Journeys 1 and 2 are above.`,
);
const decisions = readFileSync(join(repo, 'docs/decisions.md'), 'utf8');
const entry = decisions.split(/^(?=## )/m).find((e) => e.includes('Does this feature change the user interface?'))!;
await render('decision-ui', 'docs/decisions.md', esc(entry.trim()), '', { width: 760, height: 300 });
await render(
  'refusal',
  'Stage 5 run log',
  `<div class="r">✘ ${esc(refusal)}</div><div class="k">\nNothing was committed.</div>`,
  '',
  { width: 760, height: 300 },
);
await page.context().browser()!.close();

rmSync(root, { recursive: true, force: true });
console.log(`rendered to ${screens}`);
process.exit(0);
