import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir, readFile, rm } from 'node:fs/promises';
import { join, posix, relative, sep } from 'node:path';
import { promisify } from 'node:util';
import type { CommitFile, LeasedRun } from '../api.ts';
import type { RunContext, StageExecutor, StageStep } from './stage-executor.ts';

const run = promisify(execFile);
const SKILL_ROOTS = ['.claude/skills', '.agents/skills'] as const;
const COMMIT_STEP = 2;

/**
 * Stage 0 (L2-007): fetch Greenlit's default branch, copy every file under both skill folders to the same
 * paths, keep skill folders the repository already has, write `.hewn/skills.lock`, and commit
 * "Bootstrap skills from greenlit@{short-sha}". The repository itself is created by the API on lease.
 */
export class BootstrapStageExecutor implements StageExecutor {
  plan(leased: LeasedRun, context: RunContext): StageStep[] {
    const clone = join(context.workspace, 'greenlit');
    return [
      { name: 'Fetch Greenlit', execute: () => fetchSource(leased.skillsSource, clone) },
      { name: 'Copy skills', execute: () => copySkills(leased.skillsSource, clone, context) },
    ];
  }
}

async function fetchSource(source: string, clone: string): Promise<void> {
  await rm(clone, { recursive: true, force: true });
  try {
    await run('git', ['clone', '--quiet', '--depth', '1', '--', source, clone], { timeout: 120_000 });
  } catch {
    // git's message can echo the URL; the run log and the failure carry only the fixed reason.
    throw new Error('Greenlit unreachable');
  }
}

async function copySkills(source: string, clone: string, context: RunContext): Promise<void> {
  // A resumed run starts at this step with a fresh workspace, so fetch again.
  if (!existsSync(join(clone, '.git'))) await fetchSource(source, clone);
  const { stdout } = await run('git', ['rev-parse', 'HEAD'], { cwd: clone });
  const sha = stdout.trim();
  const existing = await context.listSkillFolders();

  const files: CommitFile[] = [];
  const copied = new Set<string>();
  for (const root of SKILL_ROOTS) {
    for (const skill of await directories(join(clone, root))) {
      if ((existing[root] ?? []).includes(skill)) {
        await context.log('info', `kept existing: ${root}/${skill}`);
        continue;
      }

      for (const file of await filesUnder(join(clone, root, skill))) {
        const path = toRepoPath(relative(clone, file));
        files.push({ path, content: await readFile(file) });
      }
      copied.add(skill);
    }
  }

  if (copied.size === 0 && files.length === 0) {
    await context.log('info', 'Every skill folder already exists; only the lock changes');
  }

  const lock = { source: source.replace(/\.git\/?$/, ''), sha, skills: [...copied].sort() };
  files.push({ path: '.hewn/skills.lock', content: Buffer.from(`${JSON.stringify(lock, null, 2)}\n`) });
  await context.commit(COMMIT_STEP, `Bootstrap skills from greenlit@${sha.slice(0, 7)}`, files);
  await context.log('info', `Copied ${copied.size} skills from greenlit@${sha.slice(0, 7)}`);
}

async function directories(path: string): Promise<string[]> {
  if (!existsSync(path)) return [];
  return (await readdir(path, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

async function filesUnder(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true, recursive: true });
  return entries
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath, e.name))
    .sort();
}

function toRepoPath(path: string): string {
  return path.split(sep).join(posix.sep);
}
