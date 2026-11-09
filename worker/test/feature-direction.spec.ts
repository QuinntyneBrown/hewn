// Acceptance Test
// Traces to: L2-005, L2-010, L2-014, L2-017, L2-054
// Description: A feature direction's stages work on the new scope only: stage 1 records whether the UI changes, stages 5 and 8 keep existing numbers, stage 2 keeps existing designs and refreshes the export, and stage 9 plans only unbuilt designs

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CommitFile, LeasedRun, ScopeReport } from '../src/api.ts';
import { ScriptedStageAgent } from '../src/agents/scripted-agent.ts';
import type { StageAgent } from '../src/agents/stage-agent.ts';
import { UI_CHANGE_QUESTION } from '../src/agents/decision-log.ts';
import { DocumentStageExecutor } from '../src/executors/document-executor.ts';
import type { RunContext } from '../src/executors/stage-executor.ts';
import { planBacklog } from '../src/estimates/backlog-planner.ts';
import { startFakeMagicPatterns, type FakeMagicPatterns } from '../src/magic-patterns/fake-server.ts';
import { McpMagicPatterns } from '../src/magic-patterns/magic-patterns.ts';
import { closeBrowser } from '../src/validators/mock-validator.ts';
import { noPullRequests } from './support/no-pull-requests.ts';

const NAMES = [
  'Bootstrap',
  'Idea',
  'Designs',
  'Design system',
  'Stack',
  'Requirements',
  'Scaffold',
  'Detailed designs',
  'User journeys',
  'Estimates',
];
const NO_UI = 'Add a CSV export of the shift report, one row per shift, with crew, hours and incidents.';
const WITH_UI = 'Add a shift calendar page with a week view of every crew.';

let root: string;
let repo: string;
let fake: FakeMagicPatterns;

function write(base: string, path: string, content: string): void {
  mkdirSync(dirname(join(base, path)), { recursive: true });
  writeFileSync(join(base, path), content);
}

const read = (path: string) => readFileSync(join(repo, path), 'utf8');

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'hewn-feature-'));
  repo = join(root, 'northwind-abc1234');
  write(repo, 'README.md', '# Northwind Ops\n');
  fake = await startFakeMagicPatterns({ token: 'mp-token' });
});

afterEach(async () => {
  await fake.close();
  rmSync(root, { recursive: true, force: true });
});
afterAll(async () => closeBrowser());

const leased = (stage: number, feature?: string): LeasedRun => ({
  runId: `run-${stage}`,
  epoch: 1,
  projectId: 'p',
  directionId: feature ? 'feature' : 'product',
  stage,
  stageName: NAMES[stage]!,
  checkpointStep: 0,
  checkpointSha: null,
  project: {
    id: 'p',
    name: 'Northwind Ops',
    idea: 'An operations portal for shift supervisors.',
    stackPreference: null,
    repository: 'hewn-builds/northwind-ops',
  },
  direction: feature
    ? { kind: 'Feature', idea: feature, hasUiChange: null }
    : { kind: 'Product', idea: 'An operations portal for shift supervisors.', hasUiChange: null },
  skillsSource: 'unused',
  descopeThresholdDays: 3,
  maxIterations: 10,
});

/** Runs one stage against the repository and lands its commit there, as the API would. */
async function stage(number: number, feature?: string, agent: StageAgent = new ScriptedStageAgent(() => '2026-11-09')) {
  const logs: string[] = [];
  const scopes: ScopeReport[] = [];
  const committed = new Map<string, string>();
  const ctx: RunContext = {
    workspace: mkdtempSync(join(root, 'workspace-')),
    log: async (_level, text) => void logs.push(text),
    ...noPullRequests,
    listSkillFolders: async () => ({}),
    downloadRepository: async () => execFileSync('tar', ['-czf', '-', '-C', root, 'northwind-abc1234']),
    commit: async (_step: number | string, _message: string, files: CommitFile[]) => {
      for (const f of files) {
        committed.set(f.path, f.content.toString('utf8'));
        write(repo, f.path, f.content.toString('utf8'));
      }
      return 'c0ffee';
    },
    reportScope: async (report) => void scopes.push(report),
  };
  const executor = new DocumentStageExecutor(agent, () => new McpMagicPatterns(fake.url, 'mp-token', { pollMs: 1 }));
  for (const step of executor.plan(leased(number, feature), ctx)) await step.execute(new AbortController().signal);
  return { logs, scopes, committed };
}

/** The product as the first direction left it: brief, requirements, designs and journeys. */
async function buildProduct(): Promise<void> {
  for (const n of [1, 5, 7, 8]) await stage(n);
}

/** An agent that runs the scripted one, then rewrites a file. */
function tampering(path: string, change: (text: string) => string): StageAgent {
  return {
    run: async (task) => {
      await new ScriptedStageAgent(() => '2026-11-09').run(task);
      write(task.directory, path, change(readFileSync(join(task.directory, path), 'utf8')));
    },
  };
}

describe('a feature direction', () => {
  it('tells every agent session the feature and to work on the new or changed scope only', async () => {
    await buildProduct();
    const tasks: string[] = [];
    const agent: StageAgent = {
      run: async (task) => {
        tasks.push(task.instructions);
        await new ScriptedStageAgent(() => '2026-11-09').run(task);
      },
    };

    await stage(1, NO_UI, agent);

    expect(tasks[0]).toContain(`Feature direction: ${NO_UI}`);
    expect(tasks[0]).toContain('new or changed scope');
    expect(tasks[0]).toContain(UI_CHANGE_QUESTION);
  });

  it('adds the feature to the brief at stage 1 and reports the recorded decision that the UI does not change', async () => {
    await buildProduct();

    const { scopes, committed, logs } = await stage(1, NO_UI);

    expect(read('docs/brief.md')).toMatch(/^- Sign in$/m);
    expect(read('docs/brief.md')).toContain('CSV export');
    expect(scopes).toEqual([{ hasUiChange: false, rationale: expect.stringMatching(/no screen/i) }]);
    expect(committed.get('docs/decisions.md')).toContain(`**Question:** ${UI_CHANGE_QUESTION}`);
    expect(logs).toContain('No user interface change: stages 2 and 3 will be skipped');
  });

  it('reports a UI change when the feature adds a screen', async () => {
    await buildProduct();

    const { scopes } = await stage(1, WITH_UI);

    expect(scopes).toEqual([{ hasUiChange: true, rationale: expect.any(String) }]);
  });

  it('fails stage 1 and commits nothing when the agent records no UI change decision', async () => {
    await buildProduct();
    const agent: StageAgent = {
      run: async (task) =>
        write(task.directory, 'docs/brief.md', `${readFileSync(join(task.directory, 'docs/brief.md'), 'utf8')}\n`),
    };

    await expect(stage(1, NO_UI, agent)).rejects.toThrow(`record the answer to "${UI_CHANGE_QUESTION}"`);
  });

  it('keeps existing requirement IDs at stage 5 and numbers the new one from the next free ID', async () => {
    await buildProduct();
    await stage(1, NO_UI);

    await stage(5, NO_UI);

    const l2 = read('docs/specs/L2.md');
    expect([...l2.matchAll(/^## (L2-\d+)/gm)].map((m) => m[1])).toEqual(['L2-001', 'L2-002', 'L2-003', 'L2-004']);
    expect(l2).toMatch(/^## L2-004: .*CSV export/im);
    expect(read('docs/specs/L1.md')).toMatch(/^## L1-004: /m);
  });

  it('fails stage 5 when an existing requirement is dropped or a new one reuses a lower number', async () => {
    await buildProduct();
    await stage(1, NO_UI);

    const dropped = stage(
      5,
      NO_UI,
      tampering('docs/specs/L2.md', (t) => t.replace(/## L2-002[\s\S]*?(?=## L2-003)/, '')),
    );
    await expect(dropped).rejects.toThrow('docs/specs/L2.md dropped L2-002');

    const renumbered = stage(
      5,
      NO_UI,
      tampering('docs/specs/L2.md', (t) => t.replace('## L2-004', '## L2-000')),
    );
    await expect(renumbered).rejects.toThrow('docs/specs/L2.md numbers new L2-000 below the next free number, L2-004');
  });

  it('keeps journey numbers at stage 8 and gives the new journey the next free number', async () => {
    await buildProduct();
    for (const n of [1, 5, 7]) await stage(n, NO_UI);

    await stage(8, NO_UI);

    const journeys = read('docs/journeys.md');
    expect([...journeys.matchAll(/^## (\d+)\./gm)].map((m) => Number(m[1]))).toEqual([1, 2, 3, 4]);
    expect(journeys).toMatch(/^## 4\. .*CSV export[\s\S]*\*\*Covers:\*\* L2-004/im);
  });

  it('fails stage 8 when an existing journey is renumbered', async () => {
    await buildProduct();
    for (const n of [1, 5, 7]) await stage(n, NO_UI);

    const renumbered = stage(
      8,
      NO_UI,
      tampering('docs/journeys.md', (t) => t.replace('## 2.', '## 7.')),
    );

    await expect(renumbered).rejects.toThrow('docs/journeys.md dropped journey 2');
  });

  it('keeps existing designs at stage 2, adds one for the new screen and refreshes the whole export', async () => {
    await stage(1);
    await stage(2);
    const before = JSON.parse(read('docs/mocks/manifest.json')) as { screens: { screen: string; editorId: string }[] };
    await stage(1, WITH_UI);

    const { committed, logs } = await stage(2, WITH_UI);

    const after = JSON.parse(read('docs/mocks/manifest.json')) as { screens: { screen: string; editorId: string }[] };
    expect(after.screens.slice(0, before.screens.length)).toEqual(before.screens);
    expect(after.screens.at(-1)!.screen).toMatch(/shift-calendar/);
    // Every design is exported again; only what changed is committed, so the new design's files land.
    expect(logs).toContain(`Exported ${after.screens.length} designs from Magic Patterns`);
    expect(committed.has(`docs/mocks/${after.screens.at(-1)!.screen}/default.html`)).toBe(true);
  }, 30_000);

  it('fails stage 2 when an existing design is dropped from the manifest', async () => {
    await stage(1);
    await stage(2);
    await stage(1, WITH_UI);

    const dropped = stage(
      2,
      WITH_UI,
      tampering('docs/mocks/manifest.json', (t) => {
        const manifest = JSON.parse(t) as { screens: unknown[] };
        return JSON.stringify({ screens: manifest.screens.slice(1) });
      }),
    );

    await expect(dropped).rejects.toThrow(/docs\/mocks\/manifest\.json dropped the sign-in design/);
  }, 30_000);
});

describe('stage 9 for a feature direction', () => {
  it('plans only designs that are not yet complete', () => {
    const designs = ['product/sign-in', 'product/csv-export'];
    for (const d of designs)
      write(repo, `docs/detailed-designs/${d}/README.md`, `# ${d}\n\n- ${d.endsWith('in') ? 'L2-001' : 'L2-004'}\n`);
    write(
      repo,
      'docs/journeys.md',
      '# User journeys\n\n## 1. Sign in\n\n**Covers:** L2-001\n\n## 4. CSV export\n\n**Covers:** L2-004\n',
    );
    write(
      repo,
      'docs/estimates/product.md',
      '# product\n\n| Design | Estimate (days) | Complete |\n|---|---:|---:|\n| [sign-in](../detailed-designs/product/sign-in/README.md) | 2 | 100% |\n| [csv-export](../detailed-designs/product/csv-export/README.md) | 1.5 | 0% |\n',
    );

    const backlog = planBacklog(repo, 3);

    expect(backlog.increments.map((i) => [i.title, i.l2Ids])).toEqual([['CSV export', ['L2-004']]]);
  });
});
