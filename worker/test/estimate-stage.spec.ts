// Acceptance Test
// Traces to: L2-018, L2-019, L2-020
// Description: Stage 9 runs estimating-designs, plans and descopes with the leased threshold, commits the estimates and reports the backlog to Hewn

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BacklogReport, CommitFile, LeasedRun } from '../src/api.ts';
import { ScriptedStageAgent } from '../src/agents/scripted-agent.ts';
import type { StageAgent } from '../src/agents/stage-agent.ts';
import { DocumentStageExecutor } from '../src/executors/document-executor.ts';
import type { RunContext } from '../src/executors/stage-executor.ts';
import { noPullRequests } from './support/no-pull-requests.ts';

let root: string;
let repo: string;

function write(base: string, path: string, content: string): void {
  mkdirSync(dirname(join(base, path)), { recursive: true });
  writeFileSync(join(base, path), content);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'hewn-estimate-'));
  repo = join(root, 'kiln-abc1234');
  write(repo, 'docs/brief.md', '# Brief\n\n## Out of scope\n- Payroll\n');
  write(
    repo,
    'docs/specs/L2.md',
    '# L2\n\n## L2-001: Sign in\n**Traces to:** L1-001\n\n## L2-002: Payroll\n**Traces to:** L1-002\n',
  );
  write(repo, 'docs/detailed-designs/product/sign-in/README.md', '# Sign in\n\n- L2-001\n');
  write(repo, 'docs/detailed-designs/product/payroll/README.md', '# Payroll\n\n- L2-002\n');
  write(
    repo,
    'docs/journeys.md',
    '# Journeys\n\n## 1. Sign in\n\n**Actor:** User\n\n**Mocks:** x\n\n**Covers:** L2-001, L2-002\n\n**Steps:**\n1. Go.\n',
  );
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const leased: LeasedRun = {
  runId: 'run-9',
  epoch: 1,
  projectId: 'p',
  directionId: 'd',
  stage: 9,
  stageName: 'Estimates',
  checkpointStep: 0,
  checkpointSha: null,
  project: { id: 'p', name: 'Kiln', idea: 'Kiln slots.', stackPreference: null, repository: 'hewn-builds/kiln' },
  skillsSource: 'unused',
  descopeThresholdDays: 3,
  maxIterations: 10,
};

function context() {
  const commits: Map<string, string>[] = [];
  const reports: BacklogReport[] = [];
  const order: string[] = [];
  const ctx: RunContext = {
    ...noPullRequests,
    workspace: mkdtempSync(join(root, 'workspace-')),
    log: async () => undefined,
    listSkillFolders: async () => ({}),
    downloadRepository: async () => execFileSync('tar', ['-czf', '-', '-C', root, 'kiln-abc1234']),
    commit: async (_s: number, _m: string, files: CommitFile[]) => {
      order.push('commit');
      commits.push(new Map(files.map((f) => [f.path, f.content.toString('utf8')])));
      return 'c0ffee';
    },
    reportBacklog: async (report) => {
      order.push('report');
      reports.push(report);
    },
  };
  return { ctx, commits, reports, order };
}

async function execute(agent: StageAgent, ctx: RunContext): Promise<void> {
  for (const step of new DocumentStageExecutor(agent).plan(leased, ctx))
    await step.execute(new AbortController().signal);
}

describe('stage 9, Estimates', () => {
  it('commits the estimates, the plan and the Deferred status lines, then reports the backlog', async () => {
    const { ctx, commits, reports, order } = context();
    const skills: (string | null)[] = [];

    await execute({ run: async (task) => (skills.push(task.skill), new ScriptedStageAgent().run(task)) }, ctx);

    expect(skills).toEqual(['estimating-designs']);
    expect([...commits[0]!.keys()].sort()).toEqual([
      'docs/decisions.md',
      'docs/estimates/README.md',
      'docs/estimates/backlog.json',
      'docs/estimates/product.md',
      'docs/specs/L2.md',
    ]);
    expect(commits[0]!.get('docs/specs/L2.md')).toContain(
      '## L2-002: Payroll\n**Status:** Deferred (Listed as out of scope in the brief: Payroll)',
    );
    expect(order).toEqual(['commit', 'report']);
    expect(reports[0]).toEqual({
      increments: [{ number: 1, title: 'Sign in', journey: 1, l2Ids: ['L2-001'], estimateDays: 2, dependsOn: [] }],
      deferred: [
        {
          title: 'Payroll',
          l2Ids: ['L2-002'],
          estimateDays: 2,
          reason: 'Listed as out of scope in the brief: Payroll',
        },
      ],
    });
  });

  it('uses the threshold from the lease', async () => {
    const { ctx, reports } = context();
    const run = { ...leased, descopeThresholdDays: 1 };

    for (const step of new DocumentStageExecutor(new ScriptedStageAgent()).plan(run, ctx))
      await step.execute(new AbortController().signal);

    expect(reports[0]!.increments).toEqual([]);
    expect(reports[0]!.deferred.map((d) => d.reason)).toContain(
      'Estimated at 2 days, above the 1-day threshold, and could not be split',
    );
  });

  it('fails before committing when a design has no estimate', async () => {
    const { ctx, commits, reports } = context();
    const agent: StageAgent = { run: async () => undefined };

    await expect(execute(agent, ctx)).rejects.toThrow(
      'Estimates output is invalid: No estimate for docs/detailed-designs/product/payroll; No estimate for docs/detailed-designs/product/sign-in',
    );
    expect(commits).toEqual([]);
    expect(reports).toEqual([]);
  });
});
