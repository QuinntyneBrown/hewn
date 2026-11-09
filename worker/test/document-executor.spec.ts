// Acceptance Test
// Traces to: L2-009, L2-013, L2-014, L2-016, L2-017, L2-054
// Description: Document stages work on the repository, run their agent with the stage's skill, validate, log decisions and commit only their outputs

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CommitFile, LeasedRun } from '../src/api.ts';
import type { StageAgent, StageAgentTask } from '../src/agents/stage-agent.ts';
import { ScriptedStageAgent } from '../src/agents/scripted-agent.ts';
import { DocumentStageExecutor } from '../src/executors/document-executor.ts';
import type { RunContext } from '../src/executors/stage-executor.ts';
import { noPullRequests } from './support/no-pull-requests.ts';

let root: string;
let repo: string;

function write(base: string, path: string, content: string): void {
  mkdirSync(dirname(join(base, path)), { recursive: true });
  writeFileSync(join(base, path), content);
}

/** The product repository as the API serves it: a gzipped tarball with one top-level folder. */
function archive(): Buffer {
  return execFileSync('tar', ['-czf', '-', '-C', dirname(repo), 'ledgerline-abc1234']);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'hewn-docs-'));
  repo = join(root, 'ledgerline-abc1234');
  write(repo, 'README.md', '# Ledgerline\n');
  write(repo, '.claude/skills/grilling/SKILL.md', '# Grilling');
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

const leased = (stage: number, stageName: string, stackPreference: string | null = null): LeasedRun => ({
  runId: `run-${stage}`,
  epoch: 1,
  projectId: 'p',
  directionId: 'd',
  stage,
  stageName,
  checkpointStep: 0,
  checkpointSha: null,
  project: {
    id: 'p',
    name: 'Ledgerline',
    idea: 'A web app for small accounting teams to reconcile bank statements against receipts.',
    stackPreference,
    repository: 'hewn-builds/ledgerline',
  },
  skillsSource: 'unused',
});

interface Recorded {
  logs: string[];
  commits: { step: number; message: string; files: Map<string, string> }[];
}

function context(): RunContext & Recorded {
  const recorded: Recorded = { logs: [], commits: [] };
  const workspace = join(root, 'workspace');
  mkdirSync(workspace);
  return {
    ...recorded,
    workspace,
    log: async (_level, text) => void recorded.logs.push(text),
    ...noPullRequests,
    listSkillFolders: async () => ({}),
    downloadRepository: async () => archive(),
    commit: async (step: number, message: string, files: CommitFile[]) => {
      recorded.commits.push({ step, message, files: new Map(files.map((f) => [f.path, f.content.toString('utf8')])) });
      return 'c0ffee';
    },
  };
}

async function execute(executor: DocumentStageExecutor, run: LeasedRun, ctx: RunContext): Promise<void> {
  for (const step of executor.plan(run, ctx)) await step.execute(new AbortController().signal);
}

describe('DocumentStageExecutor', () => {
  it('gives the agent the repository, the stage skill and only file tools', async () => {
    const tasks: StageAgentTask[] = [];
    const agent: StageAgent = {
      run: async (task) => {
        tasks.push(task);
        expect(existsSync(join(task.directory, '.claude/skills/grilling/SKILL.md'))).toBe(true);
        await new ScriptedStageAgent().run(task);
      },
    };

    await execute(new DocumentStageExecutor(agent), leased(1, 'Idea'), context());

    expect(tasks[0]).toMatchObject({
      skill: 'grilling',
      allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Skill'],
    });
    expect(tasks[0]!.instructions).toContain('docs/brief.md');
    expect(tasks[0]!.instructions).toContain('docs/decisions.md');
  });

  it('commits the brief and the decision log, and logs each question and answer (stage 1)', async () => {
    const ctx = context();

    await execute(new DocumentStageExecutor(new ScriptedStageAgent()), leased(1, 'Idea'), ctx);

    expect(ctx.commits).toHaveLength(1);
    expect(ctx.commits[0]!.message).toBe('Write the product brief');
    expect([...ctx.commits[0]!.files.keys()].sort()).toEqual(['docs/brief.md', 'docs/decisions.md']);
    expect(ctx.logs.some((l) => l.startsWith('Question: '))).toBe(true);
    expect(ctx.logs.some((l) => l.startsWith('Answer: '))).toBe(true);
  });

  it('fails with the validator problems and commits nothing when the output is invalid', async () => {
    const ctx = context();
    const agent: StageAgent = {
      run: async (task) => write(task.directory, 'docs/brief.md', '# Brief\n\n## Problem\nX\n'),
    };

    const run = execute(new DocumentStageExecutor(agent), leased(1, 'Idea'), ctx);

    await expect(run).rejects.toThrow('Idea output is invalid: docs/brief.md is missing the Users section');
    expect(ctx.commits).toEqual([]);
  });

  it('commits only the stage outputs, never files the agent wrote elsewhere', async () => {
    const ctx = context();
    const agent: StageAgent = {
      run: async (task) => {
        await new ScriptedStageAgent().run(task);
        write(task.directory, '.github/workflows/evil.yml', 'on: push');
        write(task.directory, 'README.md', '# Rewritten');
      },
    };

    await execute(new DocumentStageExecutor(agent), leased(1, 'Idea'), ctx);

    expect([...ctx.commits[0]!.files.keys()].sort()).toEqual(['docs/brief.md', 'docs/decisions.md']);
    expect(ctx.logs).toContain('Ignored a change outside this stage: .github/workflows/evil.yml');
  });

  it('chooses .NET and Angular without a stack preference, and the named stack with one (stage 4)', async () => {
    const plain = context();
    await execute(new DocumentStageExecutor(new ScriptedStageAgent()), leased(4, 'Stack'), plain);
    expect(plain.commits[0]!.files.get('docs/adr/0001-stack.md')).toMatch(/\.NET .* Angular/);

    rmSync(join(root, 'workspace'), { recursive: true });
    const named = context();
    await execute(new DocumentStageExecutor(new ScriptedStageAgent()), leased(4, 'Stack', 'Go + React'), named);
    expect(named.commits[0]!.files.get('docs/adr/0001-stack.md')).toContain('Go + React');
  });

  it('runs stages 5, 7 and 8 on the documents earlier stages committed', async () => {
    const agent = new ScriptedStageAgent();
    for (const [stage, name, outputs] of [
      [1, 'Idea', ['docs/brief.md']],
      [5, 'Requirements', ['docs/specs/L1.md', 'docs/specs/L2.md']],
      [7, 'Detailed designs', ['docs/detailed-designs/']],
      [8, 'User journeys', ['docs/journeys.md']],
    ] as const) {
      rmSync(join(root, 'workspace'), { recursive: true, force: true });
      const ctx = context();
      await execute(new DocumentStageExecutor(agent), leased(stage, name), ctx);
      const files = [...ctx.commits[0]!.files.keys()];
      expect(outputs.every((o) => files.some((f) => f.startsWith(o)))).toBe(true);
      // The next stage sees this one's output, as it would after the commit lands.
      for (const [path, content] of ctx.commits[0]!.files) write(repo, path, content);
    }

    expect(readFileSync(join(repo, 'docs/journeys.md'), 'utf8')).toMatch(/^## 1\. /m);
  });
});
