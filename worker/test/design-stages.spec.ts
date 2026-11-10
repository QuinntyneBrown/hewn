// Acceptance Test
// Traces to: L2-010, L2-012
// Description: Stage 2 designs every core feature in Magic Patterns and commits the exported mocks and manifest; stage 3 extracts a design system that covers every mock colour and logs mismatches with Magic Patterns

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CommitFile, LeasedRun } from '../src/api.ts';
import { ScriptedStageAgent } from '../src/agents/scripted-agent.ts';
import type { StageAgent } from '../src/agents/stage-agent.ts';
import { DocumentStageExecutor } from '../src/executors/document-executor.ts';
import type { RunContext } from '../src/executors/stage-executor.ts';
import { startFakeMagicPatterns, type FakeMagicPatterns } from '../src/magic-patterns/fake-server.ts';
import { McpMagicPatterns } from '../src/magic-patterns/magic-patterns.ts';
import { closeBrowser } from '../src/validators/mock-validator.ts';
import { noPullRequests } from './support/no-pull-requests.ts';

let root: string;
let repo: string;
let fake: FakeMagicPatterns;

function write(base: string, path: string, content: string): void {
  mkdirSync(dirname(join(base, path)), { recursive: true });
  writeFileSync(join(base, path), content);
}

const BRIEF = `# Brief\n\n## Problem\nX\n\n## Users\nY\n\n## Core features\n- Sign in\n- Main workflow — booking kiln slots\n\n## Out of scope\n- Z\n\n## Assumptions\n- W\n`;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'hewn-design-stage-'));
  repo = join(root, 'kiln-abc1234');
  write(repo, 'docs/brief.md', BRIEF);
  fake = await startFakeMagicPatterns({ token: 'mp-token' });
});

afterEach(async () => {
  await fake.close();
  rmSync(root, { recursive: true, force: true });
});
afterAll(async () => closeBrowser());

const leased = (stage: number, stageName: string): LeasedRun => ({
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
    name: 'Kiln',
    idea: 'Booking kiln slots.',
    stackPreference: null,
    repository: 'hewn-builds/kiln',
  },
  skillsSource: 'unused',
  descopeThresholdDays: 3,
  maxIterations: 10,
});

function context() {
  const logs: string[] = [];
  const commits: Map<string, string>[] = [];
  const workspace = mkdtempSync(join(root, 'workspace-'));
  const ctx: RunContext = {
    workspace,
    log: async (_level, text) => void logs.push(text),
    ...noPullRequests,
    listSkillFolders: async () => ({}),
    downloadRepository: async () => execFileSync('tar', ['-czf', '-', '-C', root, 'kiln-abc1234']),
    commit: async (_step: number, _message: string, files: CommitFile[]) => {
      commits.push(new Map(files.map((f) => [f.path, f.content.toString('utf8')])));
      return 'c0ffee';
    },
  };
  return { ctx, logs, commits };
}

const client = () => new McpMagicPatterns(fake.url, 'mp-token', { pollMs: 1 });

async function execute(executor: DocumentStageExecutor, run: LeasedRun, ctx: RunContext): Promise<void> {
  for (const step of executor.plan(run, ctx)) await step.execute(new AbortController().signal);
}

describe('stage 2, Designs', () => {
  it('designs each core feature in Magic Patterns and commits every exported state with the manifest', async () => {
    const { ctx, commits } = context();

    await execute(new DocumentStageExecutor(new ScriptedStageAgent(), () => client()), leased(2, 'Designs'), ctx);

    expect(fake.designs().map((d) => d.name)).toEqual(['Sign in', 'Main workflow']);
    const files = commits[0]!;
    expect([...files.keys()].sort()).toEqual([
      'docs/decisions.md',
      'docs/mocks/main-workflow/default.html',
      'docs/mocks/main-workflow/empty.html',
      'docs/mocks/main-workflow/error.html',
      'docs/mocks/main-workflow/loading.html',
      'docs/mocks/manifest.json',
      'docs/mocks/sign-in/default.html',
      'docs/mocks/sign-in/empty.html',
      'docs/mocks/sign-in/error.html',
      'docs/mocks/sign-in/loading.html',
    ]);
    const manifest = JSON.parse(files.get('docs/mocks/manifest.json')!) as {
      screens: { screen: string; magicPatternsUrl: string }[];
    };
    expect(manifest.screens[0]).toMatchObject({
      screen: 'sign-in',
      magicPatternsUrl: `https://www.magicpatterns.com/c/${fake.designs()[0]!.editorId}`,
    });
    expect(files.get('docs/mocks/sign-in/error.html')).toContain('data-state="error"');
  }, 30_000);

  it('gives the agent the writing-html-mocks skill and the Magic Patterns tools', async () => {
    const { ctx } = context();
    const seen: { skill: string | null; tools: readonly string[]; hasClient: boolean }[] = [];
    const agent: StageAgent = {
      run: async (task) => {
        seen.push({ skill: task.skill, tools: task.allowedTools, hasClient: task.magicPatterns !== undefined });
        await new ScriptedStageAgent().run(task);
      },
    };

    await execute(new DocumentStageExecutor(agent, () => client()), leased(2, 'Designs'), ctx);

    expect(seen[0]).toEqual({
      skill: 'writing-html-mocks',
      tools: expect.arrayContaining(['mcp__magic-patterns__create_design', 'Read', 'Write']),
      hasClient: true,
    });
  }, 30_000);

  it('fails with "Magic Patterns unavailable" before the agent runs, and never hand-writes mocks', async () => {
    await fake.close();
    const { ctx, commits } = context();
    let ran = false;
    const agent: StageAgent = { run: async () => void (ran = true) };

    await expect(execute(new DocumentStageExecutor(agent, () => client()), leased(2, 'Designs'), ctx)).rejects.toThrow(
      'Magic Patterns unavailable: unreachable',
    );
    expect(ran).toBe(false);
    expect(commits).toEqual([]);
  });

  it('fails when the worker has no Magic Patterns credential', async () => {
    const { ctx } = context();

    await expect(
      execute(new DocumentStageExecutor(new ScriptedStageAgent()), leased(2, 'Designs'), ctx),
    ).rejects.toThrow('Magic Patterns unavailable: not configured');
  });
});

describe('stage 3, Design system', () => {
  async function designed(): Promise<void> {
    const { ctx, commits } = context();
    await execute(new DocumentStageExecutor(new ScriptedStageAgent(), () => client()), leased(2, 'Designs'), ctx);
    for (const [path, content] of commits[0]!) write(repo, path, content);
  }

  it('extracts tokens covering every mock colour and a page per component, and commits only the design system', async () => {
    await designed();
    const { ctx, commits, logs } = context();

    await execute(new DocumentStageExecutor(new ScriptedStageAgent(), () => client()), leased(3, 'Design system'), ctx);

    const files = [...commits[0]!.keys()];
    expect(files).toContain('docs/design-system/tokens.json');
    expect(files.some((f) => f.startsWith('docs/design-system/components/'))).toBe(true);
    expect(files.filter((f) => f.startsWith('docs/design-system/foundations/'))).toHaveLength(6);
    expect(files.every((f) => f.startsWith('docs/design-system/') || f === 'docs/decisions.md')).toBe(true);
    expect(logs.filter((l) => l.startsWith('Magic Patterns '))).toEqual([]);
  }, 30_000);

  it('logs each Magic Patterns setting the extracted tokens do not match', async () => {
    await designed();
    await fake.close();
    fake = await startFakeMagicPatterns({
      token: 'mp-token',
      designSystem: ':root { --color-accent: #e11d48; --color-surface: #ffffff; }',
    });
    const { ctx, logs } = context();

    await execute(new DocumentStageExecutor(new ScriptedStageAgent(), () => client()), leased(3, 'Design system'), ctx);

    expect(logs).toContain('Magic Patterns --color-accent is #e11d48; no extracted colour token matches');
  }, 30_000);
});
