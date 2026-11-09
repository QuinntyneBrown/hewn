import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, posix, relative, sep } from 'node:path';
import { promisify } from 'node:util';
import type { CommitFile, LeasedRun } from '../api.ts';
import { DECISIONS, parseDecisions, readDecisions } from '../agents/decision-log.ts';
import type { StageAgent } from '../agents/stage-agent.ts';
import {
  type Problems,
  validateBrief,
  validateDesignCoverage,
  validateJourneys,
  validateRequirements,
  validateStackDecision,
} from '../validators/document-validators.ts';
import type { RunContext, StageExecutor, StageStep } from './stage-executor.ts';

const run = promisify(execFile);
const COMMIT_STEP = 2;
/** Document stages read and write files only; no shell, network or git (agent-isolation design). */
const FILE_TOOLS = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Skill'] as const;

interface StageDefinition {
  skill: string | null;
  /** Exact paths, or folders ending in `/`, the stage may change; the decision log is always allowed. */
  outputs: string[];
  task: string;
  commitMessage: string;
  validate(directory: string, leased: LeasedRun): Problems;
}

export const DOCUMENT_STAGES: ReadonlyMap<number, StageDefinition> = new Map([
  [
    1,
    {
      skill: 'grilling',
      outputs: ['docs/brief.md'],
      task: 'Write docs/brief.md with the sections Problem, Users, Core features, Out of scope and Assumptions, each non-empty.',
      commitMessage: 'Write the product brief',
      validate: (d) => validateBrief(d),
    },
  ],
  [
    4,
    {
      skill: null,
      outputs: ['docs/adr/0001-stack.md'],
      task: 'Choose the stack and write docs/adr/0001-stack.md with Context, Decision, Alternatives and Consequences. Without a named stack, choose the current LTS .NET backend with the current major Angular frontend.',
      commitMessage: 'Choose the stack',
      validate: (d, leased) => validateStackDecision(d, leased.project.stackPreference),
    },
  ],
  [
    5,
    {
      skill: 'engineering-requirements',
      outputs: ['docs/specs/L1.md', 'docs/specs/L2.md'],
      task: 'Write docs/specs/L1.md and docs/specs/L2.md from docs/brief.md. Every L2 traces to an L1, every L1 has an L2, every L2 has a Given/When/Then criterion, IDs are unique, and the words should, may and might appear only in quoted text.',
      commitMessage: 'Write the requirements',
      validate: (d) => validateRequirements(d),
    },
  ],
  [
    7,
    {
      skill: 'writing-software-design-documents',
      outputs: ['docs/detailed-designs/'],
      task: 'Write one design per feature at docs/detailed-designs/{subsystem}/{feature}/README.md, each listing the L2 IDs it covers, so every L2 is covered.',
      commitMessage: 'Write the detailed designs',
      validate: (d) => validateDesignCoverage(d),
    },
  ],
  [
    8,
    {
      skill: null,
      outputs: ['docs/journeys.md'],
      task: 'Write docs/journeys.md as numbered journeys ("## {n}. {title}") with **Actor:**, **Mocks:**, **Covers:** (L2 IDs) and **Steps:**. Keep existing journey numbers; new journeys take the next free numbers. Cover every L2 with a user interface criterion.',
      commitMessage: 'Define the user journeys',
      validate: (d) => validateJourneys(d),
    },
  ],
]);

/**
 * Stages 1, 4, 5, 7 and 8 (L2-009, L2-013, L2-014, L2-016, L2-017): check out the product repository, run the
 * stage's agent, validate its output, and commit only the stage's documents and the decision log.
 */
export class DocumentStageExecutor implements StageExecutor {
  private readonly agent: StageAgent;

  constructor(agent: StageAgent) {
    this.agent = agent;
  }

  plan(leased: LeasedRun, context: RunContext): StageStep[] {
    const definition = DOCUMENT_STAGES.get(leased.stage);
    if (!definition) throw new Error(`Stage ${leased.stage} is not a document stage.`);
    const directory = join(context.workspace, 'repository');
    return [
      { name: 'Check out repository', execute: () => checkOut(context, directory) },
      { name: 'Write documents', execute: (signal) => this.write(leased, definition, context, directory, signal) },
    ];
  }

  private async write(
    leased: LeasedRun,
    definition: StageDefinition,
    context: RunContext,
    directory: string,
    signal: AbortSignal,
  ): Promise<void> {
    // A resumed run starts at this step with a fresh workspace, so check out again.
    if (!existsSync(directory)) await checkOut(context, directory);
    const before = await snapshot(directory);
    const decisionsBefore = parseDecisions(readDecisions(directory)).length;

    await this.agent.run(
      {
        run: leased,
        directory,
        skill: definition.skill,
        instructions: instructionsFor(leased, definition),
        allowedTools: FILE_TOOLS,
      },
      signal,
    );

    for (const { question, answer } of parseDecisions(readDecisions(directory)).slice(decisionsBefore)) {
      await context.log('info', `Question: ${question}`);
      await context.log('info', `Answer: ${answer}`);
    }

    const problems = definition.validate(directory, leased);
    if (problems.length > 0) throw new Error(`${leased.stageName} output is invalid: ${problems.join('; ')}`);

    const files: CommitFile[] = [];
    for (const [path, hash] of await snapshot(directory)) {
      if (before.get(path) === hash) continue;
      if (path === DECISIONS || definition.outputs.some((o) => (o.endsWith('/') ? path.startsWith(o) : path === o))) {
        files.push({ path, content: await readFile(join(directory, path)) });
      } else {
        await context.log('warn', `Ignored a change outside this stage: ${path}`);
      }
    }
    await context.commit(COMMIT_STEP, definition.commitMessage, files);
  }
}

function instructionsFor(leased: LeasedRun, definition: StageDefinition): string {
  return [
    `You are stage ${leased.stage} (${leased.stageName}) of Hewn's pipeline for "${leased.project.name}".`,
    `Direction: ${leased.project.idea}`,
    leased.project.stackPreference ? `Named stack: ${leased.project.stackPreference}` : 'No stack was named.',
    definition.task,
    `Nobody will answer questions. When a skill or this task asks one meant for the user, answer it yourself from the direction, docs/brief.md and the existing documents, and append it to ${DECISIONS} as "## {date} · Stage ${leased.stage} ${leased.stageName}" with **Question:**, **Answer:** and **Rationale:** lines.`,
    'Change no other files.',
  ].join('\n\n');
}

async function checkOut(context: RunContext, directory: string): Promise<void> {
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  const archive = join(context.workspace, 'repository.tar.gz');
  await writeFile(archive, await context.downloadRepository());
  await run('tar', ['-xzf', archive, '-C', directory, '--strip-components=1']);
  await rm(archive, { force: true });
}

async function snapshot(directory: string): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const entries = await readdir(directory, { withFileTypes: true, recursive: true });
  for (const entry of entries.filter((e) => e.isFile())) {
    const full = join(entry.parentPath, entry.name);
    const path = relative(directory, full).split(sep).join(posix.sep);
    result.set(
      path,
      createHash('sha256')
        .update(await readFile(full))
        .digest('hex'),
    );
  }
  return new Map([...result].sort(([a], [b]) => a.localeCompare(b)));
}
