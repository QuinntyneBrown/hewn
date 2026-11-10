import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Page } from '@playwright/test';
import { xsrfToken } from './queue';
import { cancelDirections } from './rate-limit';

/** The local Greenlit the e2e API reads (HEWN_SKILLS_SOURCE), built by eng/Start-E2eApi.ps1. */
const greenlit = join(import.meta.dirname, '..', '..', 'backend', '.e2e', 'greenlit');

const git = (...args: string[]): string => execFileSync('git', ['-C', greenlit, ...args], { encoding: 'utf8' }).trim();

/** Greenlit's default branch head. */
export function greenlitHead(): string {
  return git('rev-parse', 'HEAD');
}

/** Commits these files to Greenlit, as its maintainers would; returns the new SHA. */
export function commitToGreenlit(message: string, files: Record<string, string>): string {
  for (const [path, content] of Object.entries(files)) {
    const full = join(greenlit, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  git('add', '-A');
  git(
    '-c',
    'user.name=Greenlit',
    '-c',
    'user.email=greenlit@example.invalid',
    'commit',
    '-q',
    '--allow-empty',
    '-m',
    message,
  );
  return greenlitHead();
}

/**
 * A real project on a repository whose skills are locked at `lockedSha`, with CI checks, as stage 0 and 6 leave it.
 * The direction is cancelled straight away so no worker picks it up. Returns the project and its repository.
 */
export async function projectOnSkills(
  page: Page,
  name: string,
  lockedSha: string,
): Promise<{ projectId: string; repository: string }> {
  const repository = `skills-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
  const files = {
    '.hewn/skills.lock': `${JSON.stringify({ source: `file://${greenlit}`, sha: lockedSha, skills: ['estimating-designs', 'grilling'] }, null, 2)}\n`,
    '.claude/skills/grilling/SKILL.md': '# Grilling\n',
    '.claude/skills/estimating-designs/SKILL.md': '# Estimating designs\n',
    '.github/workflows/ci.yml': 'name: CI\non: [pull_request]\njobs:\n  build:\n    runs-on: ubuntu-latest\n',
  };
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
  return { projectId, repository };
}

/** The repository's skills lock on its default branch, as the fake GitHub holds it. */
export async function lockedSha(page: Page, repository: string): Promise<string | null> {
  const response = await page.request.get(`/api/fakes/github/hewn-builds/${repository}/contents/.hewn/skills.lock`);
  return response.ok() ? (JSON.parse(await response.text()) as { sha: string }).sha : null;
}
