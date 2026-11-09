// Acceptance Test
// Traces to: L2-015, L2-036
// Description: Stage 6 generates the scaffold for the chosen stack, merges it through a pull request once CI passes, requires the CI checks on the default branch, and fails when CI fails

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CheckRun, CommitFile, LeasedRun } from '../src/api.ts';
import { ScaffoldStageExecutor } from '../src/executors/scaffold-executor.ts';
import type { RunContext } from '../src/executors/stage-executor.ts';
import { dotnetAngularTemplate } from '../src/scaffold/dotnet-angular-template.ts';

let root: string;

const ADR = (decision: string) =>
  `# 0001. Stack\n\n## Context\nA web app.\n\n## Decision\n${decision}\n\n## Alternatives\nX\n\n## Consequences\nY\n`;

function repo(decision: string): void {
  const dir = join(root, 'kiln-abc1234');
  mkdirSync(join(dir, 'docs/adr'), { recursive: true });
  writeFileSync(join(dir, 'docs/adr/0001-stack.md'), ADR(decision));
}

beforeEach(() => (root = mkdtempSync(join(tmpdir(), 'hewn-scaffold-'))));
afterEach(() => rmSync(root, { recursive: true, force: true }));

const leased: LeasedRun = {
  runId: 'run-6',
  epoch: 1,
  projectId: 'p',
  directionId: 'd',
  stage: 6,
  stageName: 'Scaffold',
  checkpointStep: 0,
  checkpointSha: null,
  project: {
    id: 'p',
    name: 'Kiln Booking',
    idea: 'Kiln slots.',
    stackPreference: null,
    repository: 'hewn-builds/kiln-booking',
  },
  skillsSource: 'unused',
  descopeThresholdDays: 3,
  maxIterations: 10,
};

function context(checkResponses: CheckRun[][]) {
  const calls: string[] = [];
  const committed: { branch: string | undefined; files: CommitFile[] }[] = [];
  const logs: string[] = [];
  let polls = 0;
  const workspace = mkdtempSync(join(root, 'workspace-'));
  const ctx: RunContext = {
    workspace,
    log: async (_l, text) => void logs.push(text),
    listSkillFolders: async () => ({}),
    downloadRepository: async () => execFileSync('tar', ['-czf', '-', '-C', root, 'kiln-abc1234']),
    commit: async (step, message, files, branch) => {
      calls.push(`commit ${step} ${branch ?? 'main'} ${message}`);
      committed.push({ branch, files });
      return 'c0ffee';
    },
    openPullRequest: async (step, request) => {
      calls.push(`open ${step} ${request.head}`);
      return { number: 7, url: 'https://github.com/hewn-builds/kiln-booking/pull/7' };
    },
    pullRequestChecks: async (number) => {
      calls.push(`checks ${number}`);
      return checkResponses[Math.min(polls++, checkResponses.length - 1)]!;
    },
    mergePullRequest: async (step, number) => {
      calls.push(`merge ${step} ${number}`);
      return 'm3rge';
    },
    protectDefaultBranch: async (step, checks) => void calls.push(`protect ${step} ${checks.join(',')}`),
    nextIncrement: async () => null,
    updateIncrement: async () => undefined,
    reportScope: async () => undefined,
    reportBacklog: async () => {
      throw new Error('reportBacklog is only for stage 9');
    },
  };
  return { ctx, calls, committed, logs };
}

const done = (conclusion: (name: string) => string): CheckRun[] =>
  ['backend', 'frontend', 'e2e'].map((name) => ({ name, status: 'completed', conclusion: conclusion(name) }));

const executor = () => new ScaffoldStageExecutor([dotnetAngularTemplate], { pollMs: 1, timeoutMs: 1000 });

async function execute(ctx: RunContext): Promise<void> {
  for (const step of executor().plan(leased, ctx)) await step.execute(new AbortController().signal);
}

describe('ScaffoldStageExecutor', () => {
  it('names its four steps', () => {
    const { ctx } = context([]);

    expect(
      executor()
        .plan(leased, ctx)
        .map((s) => s.name),
    ).toEqual(['Generate scaffold', 'Open pull request', 'Wait for checks', 'Merge and protect']);
  });

  it('commits the default stack to hewn/scaffold, waits for CI, merges, then requires the CI checks', async () => {
    repo('Stack: .NET 10 (LTS) backend with an Angular 21 frontend.');
    const pending: CheckRun[] = [{ name: 'backend', status: 'in_progress', conclusion: null }];
    const { ctx, calls, committed, logs } = context([[], pending, done(() => 'success')]);

    await execute(ctx);

    expect(calls.filter((c) => !c.startsWith('checks'))).toEqual([
      'commit 2 hewn/scaffold Scaffold the solution',
      'open 2 hewn/scaffold',
      'open 2 hewn/scaffold',
      'open 2 hewn/scaffold',
      'merge 4 7',
      'protect 4 backend,frontend,e2e',
    ]);
    expect(calls.filter((c) => c.startsWith('checks')).length).toBe(3);
    const paths = committed[0]!.files.map((f) => f.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        'README.md',
        '.github/workflows/ci.yml',
        'backend/KilnBooking.slnx',
        'frontend/angular.json',
        'e2e/playwright.config.ts',
      ]),
    );
    expect(logs).toContain('CI passed on pull request #7: backend, frontend, e2e');
  });

  it('fails naming the failed checks, and neither merges nor protects', async () => {
    repo('.NET 10 and Angular 21.');
    const { ctx, calls } = context([done((n) => (n === 'frontend' ? 'failure' : 'success'))]);

    await expect(execute(ctx)).rejects.toThrow('CI failed on the scaffold pull request #7: frontend');
    expect(calls.some((c) => c.startsWith('merge') || c.startsWith('protect'))).toBe(false);
  });

  it('fails when CI does not finish in time', async () => {
    repo('.NET 10 and Angular 21.');
    const { ctx } = context([[{ name: 'backend', status: 'queued', conclusion: null }]]);

    await expect(execute(ctx)).rejects.toThrow('CI did not finish on the scaffold pull request #7');
  });

  it('fails when no template matches the chosen stack', async () => {
    repo('Stack: Go + React, as the direction asked.');
    const { ctx, calls } = context([]);

    await expect(execute(ctx)).rejects.toThrow(
      'No scaffold template for the chosen stack: Stack: Go + React, as the direction asked.',
    );
    expect(calls).toEqual([]);
  });
});

describe('dotnetAngularTemplate', () => {
  it('derives names from the project and documents structure and commands in the README', () => {
    const files = new Map(dotnetAngularTemplate.generate('Kiln Booking').map((f) => [f.path, f.content]));

    expect(files.has('backend/src/KilnBooking.Api/Program.cs')).toBe(true);
    expect(JSON.parse(files.get('frontend/package.json')!).name).toBe('kiln-booking');
    expect(files.get('README.md')).toMatch(
      /## Folder structure[\s\S]*## Build, test and run[\s\S]*dotnet test KilnBooking\.slnx/,
    );
    expect(files.get('.github/workflows/ci.yml')).toMatch(/^  backend:$[\s\S]*^  frontend:$[\s\S]*^  e2e:$/m);
  });
});
