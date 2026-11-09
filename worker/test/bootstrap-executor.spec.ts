// Acceptance Test
// Traces to: L2-007, L2-036
// Description: Stage 0 copies Greenlit's skill folders, keeps existing ones, writes .hewn/skills.lock and commits through the API

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LeasedRun } from '../src/api.ts';
import { BootstrapStageExecutor } from '../src/executors/bootstrap-executor.ts';
import type { RunContext } from '../src/executors/stage-executor.ts';
import { noPullRequests } from './support/no-pull-requests.ts';

let root: string;
let source: string;
let sha: string;

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], { cwd })
    .toString()
    .trim();
}

function write(base: string, path: string, content: string): void {
  mkdirSync(dirname(join(base, path)), { recursive: true });
  writeFileSync(join(base, path), content);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'hewn-bootstrap-'));
  source = join(root, 'greenlit');
  mkdirSync(source);
  git(source, 'init', '-q', '-b', 'main');
  write(source, '.claude/skills/grilling/SKILL.md', '# Grilling');
  write(source, '.claude/skills/grilling/references/questions.md', 'Why?');
  write(source, '.claude/skills/estimating-designs/SKILL.md', '# Estimating');
  write(source, '.agents/skills/grilling/SKILL.md', '# Grilling (agents)');
  write(source, 'README.md', 'not a skill');
  git(source, 'add', '.');
  git(source, 'commit', '-q', '-m', 'Skills');
  sha = git(source, 'rev-parse', 'HEAD');
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

const run = (skillsSource: string): LeasedRun => ({
  runId: 'run-0',
  epoch: 1,
  projectId: 'p',
  directionId: 'd',
  stage: 0,
  stageName: 'Bootstrap',
  checkpointStep: 0,
  checkpointSha: null,
  project: { id: 'p', name: 'Kiln Booking', idea: 'x', stackPreference: null, repository: 'hewn-builds/kiln-booking' },
  skillsSource,
});

interface Recorded {
  logs: string[];
  commits: { step: number; message: string; files: Map<string, string> }[];
}

function context(existing: Record<string, string[]> = {}): RunContext & Recorded {
  const recorded: Recorded = { logs: [], commits: [] };
  return {
    ...recorded,
    workspace: join(root, 'workspace'),
    log: async (_level, text) => void recorded.logs.push(text),
    ...noPullRequests,
    downloadRepository: async () => Buffer.alloc(0),
    listSkillFolders: async () => ({ '.claude/skills': [], '.agents/skills': [], ...existing }),
    commit: async (step, message, files) => {
      recorded.commits.push({ step, message, files: new Map(files.map((f) => [f.path, f.content.toString('utf8')])) });
      return 'c0ffee';
    },
  };
}

async function runAll(executor: BootstrapStageExecutor, leased: LeasedRun, ctx: RunContext): Promise<void> {
  for (const step of executor.plan(leased, ctx)) await step.execute(new AbortController().signal);
}

describe('BootstrapStageExecutor', () => {
  it('copies every file under both skill folders and commits them with the lock', async () => {
    const ctx = context();

    await runAll(new BootstrapStageExecutor(), run(source), ctx);

    expect(ctx.commits).toHaveLength(1);
    const [commit] = ctx.commits;
    expect(commit!.message).toBe(`Bootstrap skills from greenlit@${sha.slice(0, 7)}`);
    expect([...commit!.files.keys()].sort()).toEqual([
      '.agents/skills/grilling/SKILL.md',
      '.claude/skills/estimating-designs/SKILL.md',
      '.claude/skills/grilling/SKILL.md',
      '.claude/skills/grilling/references/questions.md',
      '.hewn/skills.lock',
    ]);
    expect(commit!.files.get('.claude/skills/grilling/references/questions.md')).toBe('Why?');
    expect(JSON.parse(commit!.files.get('.hewn/skills.lock')!)).toEqual({
      source,
      sha,
      skills: ['estimating-designs', 'grilling'],
    });
  });

  it('names the plan steps and commits in the second, so a resumed run repeats only the commit', () => {
    const executor = new BootstrapStageExecutor();

    expect(executor.plan(run(source), context()).map((s) => s.name)).toEqual(['Fetch Greenlit', 'Copy skills']);
  });

  it('leaves an existing skill folder unchanged and logs it as kept existing', async () => {
    const ctx = context({ '.claude/skills': ['grilling'] });

    await runAll(new BootstrapStageExecutor(), run(source), ctx);

    const files = [...ctx.commits[0]!.files.keys()];
    expect(files.some((f) => f.startsWith('.claude/skills/grilling/'))).toBe(false);
    expect(files).toContain('.agents/skills/grilling/SKILL.md');
    expect(ctx.logs).toContain('kept existing: .claude/skills/grilling');
    expect(JSON.parse(ctx.commits[0]!.files.get('.hewn/skills.lock')!).skills).toEqual([
      'estimating-designs',
      'grilling',
    ]);
  });

  it('strips .git from a clone URL when recording the source', async () => {
    const ctx = context();
    const bare = join(root, 'greenlit.git');
    git(root, 'clone', '-q', '--bare', source, bare);

    await runAll(new BootstrapStageExecutor(), run(bare), ctx);

    expect(JSON.parse(ctx.commits[0]!.files.get('.hewn/skills.lock')!).source).toBe(join(root, 'greenlit'));
  });

  it('fails with "Greenlit unreachable" when the source cannot be fetched', async () => {
    const [fetch] = new BootstrapStageExecutor().plan(run(join(root, 'nowhere')), context());

    await expect(fetch!.execute(new AbortController().signal)).rejects.toThrow('Greenlit unreachable');
  });
});
