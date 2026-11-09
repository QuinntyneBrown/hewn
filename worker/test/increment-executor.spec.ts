// Acceptance Test
// Traces to: L2-021, L2-022, L2-023, L2-024, L2-025
// Description: Stage 10 delivers each increment test first, implements until the gate is green or blocks, records a video, opens a titled pull request, merges once checks pass (rebasing when the default branch moved) and updates progress

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  HewnApiError,
  type CheckRun,
  type CommitFile,
  type Increment,
  type IncrementUpdate,
  type LeasedRun,
} from '../src/api.ts';
import type { StageAgent, StageAgentTask } from '../src/agents/stage-agent.ts';
import { planBacklog } from '../src/estimates/backlog-planner.ts';
import { IncrementStageExecutor } from '../src/executors/increment-executor.ts';
import type { RunContext } from '../src/executors/stage-executor.ts';
import { ScriptedTestGate, scriptedImplementation } from '../src/increments/scripted-gate.ts';
import { dotnetAngularTemplate } from '../src/scaffold/dotnet-angular-template.ts';
import { AUTONOMY } from '../src/agents/decision-log.ts';
import { ScriptedStageAgent } from '../src/agents/scripted-agent.ts';

let root: string;
let repo: string;

function write(base: string, path: string, content: string): void {
  mkdirSync(dirname(join(base, path)), { recursive: true });
  writeFileSync(join(base, path), content);
}

const leased: LeasedRun = {
  runId: '0412abcd-run',
  epoch: 2,
  projectId: 'p',
  directionId: 'd7d7d7d7-direction',
  stage: 10,
  stageName: 'Increments',
  checkpointStep: 0,
  checkpointSha: null,
  project: { id: 'p', name: 'Kiln', idea: 'Kiln slots.', stackPreference: null, repository: 'hewn-builds/kiln' },
  skillsSource: 'unused',
  descopeThresholdDays: 3,
  maxIterations: 3,
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'hewn-increments-'));
  repo = join(root, 'kiln-abc1234');
  write(repo, 'docs/adr/0001-stack.md', '# Stack\n\n## Decision\n.NET 10 API with an Angular 21 frontend.\n');
  write(repo, 'docs/specs/L2.md', '## L2-001: Sign in\n\n## L2-002: Book\n\n## L2-003: Reports\n');
  write(repo, 'docs/detailed-designs/kiln/sign-in/README.md', '# Sign in\n\n- L2-001\n');
  write(repo, 'docs/detailed-designs/kiln/book/README.md', '# Book\n\n**Depends on:** kiln/sign-in\n\n- L2-002\n');
  write(repo, 'docs/detailed-designs/kiln/reports/README.md', '# Reports\n\n- L2-003\n');
  write(
    repo,
    'docs/estimates/kiln.md',
    '| Design | Estimate (days) | Complete |\n|---|---:|---:|\n| [sign-in](../detailed-designs/kiln/sign-in/README.md) | 1 | 0% |\n| [book](../detailed-designs/kiln/book/README.md) | 2 | 0% |\n| [reports](../detailed-designs/kiln/reports/README.md) | 1 | 0% |\n',
  );
  write(
    repo,
    'docs/journeys.md',
    '## 1. Sign in\n\n**Covers:** L2-001\n\n## 2. Book a firing\n\n**Covers:** L2-002\n\n## 3. See reports\n\n**Covers:** L2-003\n',
  );
  write(repo, 'frontend/src/app/app.ts', 'export const app = 1;\n');
  planBacklog(repo, 3);
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

/** A scripted agent per phase: tests, then the implementation the scripted gate looks for, then a video. */
class FakeAgent implements StageAgent {
  readonly tasks: StageAgentTask[] = [];
  implement: (task: StageAgentTask) => void = (task) => {
    for (const test of testsOf(task))
      write(task.directory, scriptedImplementation(test), `export const done = true;\n`);
  };
  tests: (task: StageAgentTask) => void = (task) =>
    write(
      task.directory,
      `e2e/tests/${task.increment!.slug}.spec.ts`,
      `// Acceptance Test\n// Traces to: ${task.increment!.l2Ids.join(', ')}\n// Description: x\n`,
    );
  video: (task: StageAgentTask) => void = (task) => {
    const folder = `docs/videos/${task.increment!.slug}`;
    for (const f of [`${task.increment!.slug}.mp4`, 'script.md', `${task.increment!.slug}.vtt`])
      write(task.directory, `${folder}/${f}`, 'x');
  };
  resolve: (task: StageAgentTask) => void = () => undefined;

  async run(task: StageAgentTask): Promise<void> {
    this.tasks.push(task);
    this[task.increment!.phase](task);
  }
}

function testsOf(task: StageAgentTask): string[] {
  return [`e2e/tests/${task.increment!.slug}.spec.ts`];
}

function harness(backlog: Increment[]) {
  const commits: { step: string; message: string; files: Map<string, string>; branch?: string; rebase?: boolean }[] =
    [];
  const updates: { number: number; update: IncrementUpdate }[] = [];
  const pulls: { head: string; title: string; body: string }[] = [];
  const merges: string[] = [];
  const logs: string[] = [];
  const state = { checks: [] as CheckRun[][], behind: 0 };
  const status = new Map(backlog.map((i) => [i.number, i.status]));

  const ctx: RunContext = {
    workspace: mkdtempSync(join(root, 'workspace-')),
    log: async (_level, text) => void logs.push(text),
    listSkillFolders: async () => ({}),
    recordDecisions: async () => {},
    recordModelCall: async () => {},
    downloadRepository: async () => execFileSync('tar', ['-czf', '-', '-C', root, 'kiln-abc1234']),
    commit: async (step, message, files: CommitFile[], branch, options) => {
      commits.push({
        step: String(step),
        message,
        files: new Map(files.map((f) => [f.path, f.content.toString('utf8')])),
        branch,
        rebase: options?.rebase,
      });
      // A default-branch commit lands in the repository, as GitHub would.
      if (branch === undefined) for (const f of files) write(repo, f.path, f.content.toString('utf8'));
      return 'c0ffee';
    },
    openPullRequest: async (_step, request) => {
      pulls.push(request);
      return { number: 40 + pulls.length, url: `https://github.com/hewn-builds/kiln/pull/${40 + pulls.length}` };
    },
    pullRequestChecks: async () =>
      state.checks.shift() ??
      ['backend', 'frontend', 'e2e'].map((name) => ({ name, status: 'completed', conclusion: 'success' })),
    mergePullRequest: async (step) => {
      if (state.behind > 0) {
        state.behind--;
        throw new HewnApiError('behind', 400, 'branch_behind');
      }
      merges.push(String(step));
      return 'm3rg3';
    },
    protectDefaultBranch: async () => {
      throw new Error('stage 10 never protects');
    },
    reportScope: async () => undefined,
    reportBacklog: async () => {
      throw new Error('stage 10 never reports a backlog');
    },
    nextIncrement: async () => {
      const unreachable = new Set<number>();
      for (const i of backlog)
        if (status.get(i.number) === 'Blocked' || i.dependsOn.some((d) => unreachable.has(d)))
          unreachable.add(i.number);
      const next = backlog.find(
        (i) => ['Queued', 'InProgress'].includes(status.get(i.number)!) && !unreachable.has(i.number),
      );
      return next ?? null;
    },
    updateIncrement: async (number, update) => {
      updates.push({ number, update });
      status.set(number, update.status);
    },
  };
  return { ctx, commits, updates, pulls, merges, logs, state };
}

const increment = (
  number: number,
  title: string,
  journey: number,
  l2: string,
  dependsOn: number[] = [],
): Increment => ({
  number,
  title,
  journey,
  l2Ids: [l2],
  estimateDays: 1,
  dependsOn,
  status: 'Queued',
  iterations: 0,
});

async function deliver(agent: StageAgent, ctx: RunContext, run: LeasedRun = leased): Promise<void> {
  const executor = new IncrementStageExecutor(agent, [dotnetAngularTemplate], {
    gate: () => new ScriptedTestGate(),
    probe: async () => ({ width: 1920, height: 1080, duration: 90 }),
    pollMs: 1,
  });
  for (const step of executor.plan(run, ctx)) await step.execute(new AbortController().signal);
}

describe('stage 10, Increments', () => {
  it('delivers an increment test first, then implementation, video, pull request, merge and progress', async () => {
    const h = harness([increment(1, 'Sign in', 1, 'L2-001')]);

    await deliver(new FakeAgent(), h.ctx);

    expect(h.commits.map((c) => [c.step, c.branch ?? 'default'])).toEqual([
      ['e2/i1/tests', 'feature/sign-in'],
      ['e2/i1/implement-1', 'feature/sign-in'],
      ['e2/i1/video', 'feature/sign-in'],
      ['e2/i1/progress', 'default'],
    ]);
    expect([...h.commits[0]!.files.keys()]).toEqual(['e2e/tests/sign-in.spec.ts']);
    expect([...h.commits[1]!.files.keys()]).toEqual(['frontend/src/app/increments/sign-in.ts']);
    expect([...h.commits[3]!.files.keys()].sort()).toEqual(['docs/estimates/README.md', 'docs/estimates/kiln.md']);
    expect(readFileSync(join(repo, 'docs/estimates/kiln.md'), 'utf8')).toContain(
      '| [sign-in](../detailed-designs/kiln/sign-in/README.md) | 1 | 100% |',
    );
    expect(h.updates).toEqual([
      { number: 1, update: { status: 'InProgress' } },
      { number: 1, update: { status: 'InProgress', redFailing: 1, redPassing: 0 } },
      { number: 1, update: { status: 'Merged', pullRequestNumber: 41, iterations: 1 } },
    ]);
    expect(h.pulls[0]!.title).toBe('Sign in (journey 1, L2-001)');
    expect(h.pulls[0]!.head).toBe('feature/sign-in');
    expect(h.pulls[0]!.body).toContain('[Video](docs/videos/sign-in/sign-in.mp4)');
    expect(h.pulls[0]!.body).toContain('Red recorded: 1 new acceptance tests failed on the test commit.');
    expect(h.merges).toEqual(['i1/merge-1']);
  });

  it('flags tests that pass before implementation', async () => {
    const h = harness([increment(1, 'Sign in', 1, 'L2-001')]);
    // The behaviour already exists on the default branch.
    write(repo, scriptedImplementation('e2e/tests/sign-in.spec.ts'), 'export const done = true;\n');
    const agent = new FakeAgent();

    await deliver(agent, h.ctx);

    expect(h.updates[1]!.update).toEqual({ status: 'InProgress', redFailing: 0, redPassing: 1 });
    expect(h.pulls[0]!.body).toContain('Tests passed before implementation');
  });

  it('blocks an increment after the iteration cap with its failing tests, skips its dependents and continues', async () => {
    const h = harness([
      increment(1, 'Sign in', 1, 'L2-001'),
      increment(2, 'Book a firing', 2, 'L2-002', [1]),
      increment(3, 'See reports', 3, 'L2-003'),
    ]);
    const agent = new FakeAgent();
    const implement = agent.implement;
    agent.implement = (task) =>
      task.increment!.number === 1
        ? write(task.directory, 'frontend/src/app/attempt.ts', `${Math.random()}`)
        : implement(task);

    await deliver(agent, h.ctx);

    const implementing = agent.tasks.filter((t) => t.increment!.number === 1 && t.increment!.phase === 'implement');
    expect(implementing).toHaveLength(3);
    expect(implementing[2]!.increment!.failing).toEqual(['e2e: ✘ e2e/tests/sign-in.spec.ts']);
    expect(h.updates.find((u) => u.update.status === 'Blocked')).toEqual({
      number: 1,
      update: { status: 'Blocked', iterations: 3, failingTests: ['e2e: ✘ e2e/tests/sign-in.spec.ts'] },
    });
    expect(h.updates.filter((u) => u.update.status === 'Merged').map((u) => u.number)).toEqual([3]);
    expect(h.logs).toContain('Backlog done: 1 merged, 1 blocked');
  });

  it('treats a failed required check as a failed iteration', async () => {
    const h = harness([increment(1, 'Sign in', 1, 'L2-001')]);
    h.state.checks.push([
      { name: 'backend', status: 'completed', conclusion: 'success' },
      { name: 'frontend', status: 'completed', conclusion: 'failure' },
      { name: 'e2e', status: 'completed', conclusion: 'success' },
    ]);
    const agent = new FakeAgent();

    await deliver(agent, h.ctx);

    const implementing = agent.tasks.filter((t) => t.increment!.phase === 'implement');
    expect(implementing.map((t) => t.increment!.failing)).toEqual([[], ['CI: frontend failure']]);
    expect(h.updates.at(-1)!.update).toEqual({ status: 'Merged', pullRequestNumber: 41, iterations: 2 });
  });

  it('rebases onto a moved default branch with every change the branch makes, and merges', async () => {
    const h = harness([increment(1, 'Sign in', 1, 'L2-001')]);
    h.state.behind = 1;
    write(repo, 'docs/notes.md', 'moved\n');

    await deliver(new FakeAgent(), h.ctx);

    const rebase = h.commits.find((c) => c.rebase)!;
    expect(rebase.step).toBe('e2/i1/rebase-1');
    expect([...rebase.files.keys()].sort()).toEqual([
      'docs/videos/sign-in/script.md',
      'docs/videos/sign-in/sign-in.mp4',
      'docs/videos/sign-in/sign-in.vtt',
      'e2e/tests/sign-in.spec.ts',
      'frontend/src/app/increments/sign-in.ts',
    ]);
    expect(h.merges).toEqual(['i1/merge-2']);
  });

  it('asks the agent to resolve files both the branch and the default branch changed', async () => {
    const h = harness([increment(1, 'Sign in', 1, 'L2-001')]);
    h.state.behind = 1;
    const agent = new FakeAgent();
    const implement = agent.implement;
    agent.implement = (task) => {
      implement(task);
      write(task.directory, 'frontend/src/app/app.ts', 'export const app = 2;\n');
      write(repo, 'frontend/src/app/app.ts', 'export const app = 3;\n'); // someone else changes it meanwhile
    };

    await deliver(agent, h.ctx);

    expect(agent.tasks.find((t) => t.increment!.phase === 'resolve')?.increment!.conflicts).toEqual([
      'frontend/src/app/app.ts',
    ]);
  });

  it('blocks after three rebases that still leave the branch behind', async () => {
    const h = harness([increment(1, 'Sign in', 1, 'L2-001')]);
    h.state.behind = 99;

    await deliver(new FakeAgent(), h.ctx);

    expect(h.commits.filter((c) => c.rebase)).toHaveLength(3);
    expect(h.updates.at(-1)!.update).toMatchObject({
      status: 'Blocked',
      failingTests: ['Could not rebase onto the default branch after 3 attempts'],
    });
  });

  it('tries the video twice, then opens the pull request with the failure in Notes and no video files', async () => {
    const h = harness([increment(1, 'Sign in', 1, 'L2-001')]);
    const agent = new FakeAgent();
    agent.video = () => {
      throw new Error('browser crashed during capture');
    };

    await deliver(agent, h.ctx);

    expect(agent.tasks.filter((t) => t.increment!.phase === 'video')).toHaveLength(2);
    expect(h.pulls[0]!.body).toContain('Video failed: browser crashed during capture');
    expect(h.commits.flatMap((c) => [...c.files.keys()]).some((p) => p.startsWith('docs/videos/'))).toBe(false);
    expect(h.updates.at(-1)!.update.status).toBe('Merged');
  });

  it('blocks an increment whose first commit is not traced acceptance tests, committing nothing', async () => {
    const h = harness([increment(1, 'Sign in', 1, 'L2-001')]);
    const agent = new FakeAgent();
    agent.tests = (task) => {
      write(task.directory, 'e2e/tests/sign-in.spec.ts', "import { test } from '@playwright/test';\n");
      write(task.directory, 'frontend/src/app/sign-in.ts', 'export {};\n');
    };

    await deliver(agent, h.ctx);

    expect(h.commits).toEqual([]);
    expect(h.updates.at(-1)!.update).toEqual({
      status: 'Blocked',
      iterations: 0,
      failingTests: [
        'Test commit: e2e/tests/sign-in.spec.ts has no "Traces to: L2-xxx" header',
        'Test commit: frontend/src/app/sign-in.ts is not a test file',
      ],
    });
  });

  it('keeps the progress commit off the feature branch and the branch off the default', async () => {
    const h = harness([increment(1, 'Sign in', 1, 'L2-001')]);

    await deliver(new FakeAgent(), h.ctx);

    expect(existsSync(join(repo, 'frontend/src/app/increments/sign-in.ts'))).toBe(false);
  });

  it('runs end to end with the scripted agent the e2e stack uses', async () => {
    const h = harness([increment(1, 'Sign in', 1, 'L2-001'), increment(2, 'Book a firing', 2, 'L2-002', [1])]);

    await deliver(new ScriptedStageAgent(() => '2026-11-09'), h.ctx);

    expect(h.updates.filter((u) => u.update.status === 'Merged').map((u) => u.number)).toEqual([1, 2]);
    expect(h.commits[0]!.files.get('e2e/tests/sign-in.spec.ts')).toMatch(
      /^\/\/ Acceptance Test\n\/\/ Traces to: L2-001\n/,
    );
  });

  it('tells every session to decide for itself, never gives it a way to ask, and checks the decisions it records', async () => {
    const h = harness([increment(1, 'Sign in', 1, 'L2-001')]);
    const agent = new FakeAgent();
    const implement = agent.implement;
    agent.implement = (task) => {
      implement(task);
      write(
        task.directory,
        'docs/decisions.md',
        '# Decisions\n\n## 2026-11-09 · Stage 10 Increments\n\n**Question:** Where?\n',
      );
    };

    await deliver(agent, h.ctx);

    expect(agent.tasks.every((t) => t.instructions.includes(AUTONOMY))).toBe(true);
    expect(agent.tasks.some((t) => t.allowedTools.includes('AskUserQuestion'))).toBe(false);
    expect(h.updates.at(-1)!.update).toMatchObject({
      status: 'Blocked',
      failingTests: [
        'Decision log: Decision 1 ("Where?") has no **Answer:**',
        'Decision log: Decision 1 ("Where?") has no **Rationale:**',
      ],
    });
  });
});
