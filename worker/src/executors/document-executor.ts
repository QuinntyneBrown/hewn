import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, posix, relative, sep } from 'node:path';
import { promisify } from 'node:util';
import type { CommitFile, LeasedRun } from '../api.ts';
import {
  AUTONOMY,
  DECISIONS,
  linkedAdrs,
  parseDecisions,
  readDecisions,
  UI_CHANGE_QUESTION,
  uiChangeDecision,
  validateDecisions,
} from '../agents/decision-log.ts';
import type { StageAgent } from '../agents/stage-agent.ts';
import { MagicPatternsUnavailable, type MagicPatterns } from '../magic-patterns/magic-patterns.ts';
import {
  tokenMismatches,
  validateDesignSystem,
  validateTokenCoverage,
} from '../validators/design-system-validators.ts';
import { mockPath, readManifest, validateMocks } from '../validators/mock-validator.ts';
import { validateEstimates } from '../validators/estimate-validator.ts';
import { planBacklog, type Backlog } from '../estimates/backlog-planner.ts';
import {
  type Baseline,
  type Problems,
  validateBrief,
  validateKeptDesigns,
  validateKeptNumbers,
  validateDesignCoverage,
  validateJourneys,
  validateRequirements,
  validateStackDecision,
} from '../validators/document-validators.ts';
import { checkOut } from './checkout.ts';
import type { RunContext, StageExecutor, StageStep } from './stage-executor.ts';

const run = promisify(execFile);
const COMMIT_STEP = 2;
/** Document stages read and write files only; no shell, network or git (agent-isolation design). */
const FILE_TOOLS = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Skill'] as const;
const MAGIC_PATTERNS_TOOLS = [
  'mcp__magic-patterns__create_design',
  'mcp__magic-patterns__send_prompt',
  'mcp__magic-patterns__get_design_status',
  'mcp__magic-patterns__read_artifact_files',
  'mcp__magic-patterns__write_artifact_files',
  'mcp__magic-patterns__list_design_systems',
] as const;

interface StageHookContext {
  directory: string;
  context: RunContext;
  magicPatterns: MagicPatterns | undefined;
  leased: LeasedRun;
}

interface StageDefinition {
  skill: string | null;
  /** Exact paths, or folders ending in `/`, the stage may change; the decision log is always allowed. */
  outputs: string[];
  task: string;
  commitMessage: string;
  /** `required` fails the run before the agent starts when Magic Patterns is unreachable (L2-010 AC5). */
  magicPatterns?: 'required' | 'optional';
  /** Runs after the agent and before validation, e.g. exporting designs. */
  afterAgent?(hook: StageHookContext): Promise<void>;
  /** `baseline` holds the numbered documents as they were before the agent ran, so later directions keep their numbers. */
  validate(directory: string, leased: LeasedRun, baseline: Baseline): Problems | Promise<Problems>;
  /** Runs once the stage's commit has landed. */
  afterCommit?(hook: StageHookContext): Promise<void>;
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
    2,
    {
      skill: 'writing-html-mocks',
      outputs: ['docs/mocks/'],
      task: 'Design every screen for the core features in docs/brief.md in Magic Patterns, never by hand, following the writing-html-mocks screen inventory and state rules. Give each screen default, loading, empty and error states as default.html, loading.html, empty.html and error.html in its design, or record why a state does not apply. List every design in docs/mocks/manifest.json as {"screens": [{screen, feature, magicPatternsUrl, editorId, states, notApplicable}]}; Hewn exports the HTML.',
      commitMessage: 'Design the screens in Magic Patterns',
      magicPatterns: 'required',
      afterAgent: exportMocks,
      validate: async (d, _l, b) => [...(await validateMocks(d)), ...validateKeptDesigns(d, b)],
    },
  ],
  [
    3,
    {
      skill: 'extracting-design-systems',
      outputs: ['docs/design-system/'],
      task: 'Extract the design system from docs/mocks/ into docs/design-system/: tokens.json (DTCG) with color.light, color.dark, typography, spacing, radius, elevation and motion; one token page per group under foundations/ (colour, typography, spacing, radius, elevation and motion); and one page per component under components/. Pages follow <html data-theme="light|dark"> as the mocks do. Every colour used in the mocks must match a colour token.',
      commitMessage: 'Extract the design system',
      magicPatterns: 'optional',
      afterAgent: compareWithMagicPatterns,
      validate: (d) => [...validateDesignSystem(d), ...validateTokenCoverage(d)],
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
      validate: (d, _l, b) => [
        ...validateRequirements(d),
        ...validateKeptNumbers(d, b, 'docs/specs/L1.md', /^##\s+L1-(\d+)/gm, (n) => `L1-${n}`),
        ...validateKeptNumbers(d, b, 'docs/specs/L2.md', /^##\s+L2-(\d+)/gm, (n) => `L2-${n}`),
      ],
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
      validate: (d, _l, b) => [
        ...validateJourneys(d),
        ...validateKeptNumbers(d, b, 'docs/journeys.md', /^##\s+(\d+)\./gm, (n) => `journey ${n}`),
      ],
    },
  ],
  [
    9,
    {
      skill: 'estimating-designs',
      outputs: ['docs/estimates/', 'docs/detailed-designs/', 'docs/specs/L2.md'],
      task: 'Estimate every design under docs/detailed-designs/ in ideal days for one intermediate developer, in docs/estimates/{subsystem}.md as a table with the columns Design (a link to the design README), Estimate (days) and Complete (percent). First split any design above the descope threshold into designs at or below it: write the new designs, and mark the original README with "**Status:** Split into {subsystem}/{feature}, …". Hewn then descopes, plans the backlog and writes docs/estimates/README.md.',
      commitMessage: 'Estimate the work and plan the backlog',
      afterAgent: async ({ directory, leased }) => void planIfEstimated(directory, leased),
      validate: (d) => validateEstimates(d),
      afterCommit: reportBacklog,
    },
  ],
]);

/**
 * Stages 1, 4, 5, 7 and 8 (L2-009, L2-013, L2-014, L2-016, L2-017): check out the product repository, run the
 * stage's agent, validate its output, and commit only the stage's documents and the decision log.
 */
export class DocumentStageExecutor implements StageExecutor {
  private readonly agent: StageAgent;
  private readonly magicPatterns: (() => MagicPatterns) | undefined;

  /** `magicPatterns` opens a client per run; without it the design stages fail as not configured. */
  constructor(agent: StageAgent, magicPatterns?: () => MagicPatterns) {
    this.agent = agent;
    this.magicPatterns = magicPatterns;
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
    const magicPatterns = await this.openMagicPatterns(definition, context);
    try {
      await this.runAgent(leased, definition, context, directory, magicPatterns, signal);
    } finally {
      await magicPatterns?.close();
    }
  }

  private async openMagicPatterns(
    definition: StageDefinition,
    context: RunContext,
  ): Promise<MagicPatterns | undefined> {
    if (!definition.magicPatterns) return undefined;
    if (!this.magicPatterns) {
      if (definition.magicPatterns === 'required') throw new MagicPatternsUnavailable('not configured');
      await context.log('warn', 'Magic Patterns is not configured; its design-system settings were not compared');
      return undefined;
    }
    const client = this.magicPatterns();
    try {
      await client.ping();
      return client;
    } catch (error) {
      await client.close();
      if (definition.magicPatterns === 'required') throw error;
      await context.log('warn', `${(error as Error).message}; its design-system settings were not compared`);
      return undefined;
    }
  }

  private async runAgent(
    leased: LeasedRun,
    definition: StageDefinition,
    context: RunContext,
    directory: string,
    magicPatterns: MagicPatterns | undefined,
    signal: AbortSignal,
  ): Promise<void> {
    // A resumed run starts at this step with a fresh workspace, so check out again.
    if (!existsSync(directory)) await checkOut(context, directory);
    const before = await snapshot(directory);
    const decisionsBefore = readDecisions(directory).split(/^## /m).length - 1;
    const baseline: Baseline = new Map(
      KEPT.filter((p) => existsSync(join(directory, p))).map((p) => [p, readFileSync(join(directory, p), 'utf8')]),
    );

    await this.agent.run(
      {
        run: leased,
        directory,
        skill: definition.skill,
        instructions: instructionsFor(leased, definition),
        allowedTools: definition.magicPatterns === 'required' ? [...FILE_TOOLS, ...MAGIC_PATTERNS_TOOLS] : FILE_TOOLS,
        ...(magicPatterns ? { magicPatterns } : {}),
      },
      signal,
    );
    await definition.afterAgent?.({ directory, context, magicPatterns, leased });

    const decisions = parseDecisions(
      readDecisions(directory)
        .split(/^(?=## )/m)
        .slice(1 + decisionsBefore)
        .join(''),
    );
    for (const { question, answer } of decisions) {
      await context.log('info', `Question: ${question}`);
      await context.log('info', `Answer: ${answer}`);
    }

    const scope = decidesScope(leased) ? uiChangeDecision(directory, decisionsBefore) : null;
    const problems = [
      ...(await definition.validate(directory, leased, baseline)),
      ...validateDecisions(directory),
      ...(decidesScope(leased) && !scope
        ? [`Feature direction: record the answer to "${UI_CHANGE_QUESTION}" in docs/decisions.md`]
        : []),
    ];
    if (problems.length > 0) throw new Error(`${leased.stageName} output is invalid: ${problems.join('; ')}`);

    const files: CommitFile[] = [];
    const adrs = new Set(linkedAdrs(directory));
    for (const [path, hash] of await snapshot(directory)) {
      if (before.get(path) === hash) continue;
      if (
        path === DECISIONS ||
        adrs.has(path) ||
        definition.outputs.some((o) => (o.endsWith('/') ? path.startsWith(o) : path === o))
      ) {
        files.push({ path, content: await readFile(join(directory, path)) });
      } else {
        await context.log('warn', `Ignored a change outside this stage: ${path}`);
      }
    }
    await context.commit(COMMIT_STEP, definition.commitMessage, files);
    // Only committed decisions reach the Decisions tab; Hewn ignores ones a resumed step reports again.
    if (decisions.length > 0) await context.recordDecisions(decisions);
    if (scope) {
      await context.reportScope(scope);
      await context.log(
        'info',
        scope.hasUiChange
          ? 'User interface change: stages 2 and 3 run'
          : 'No user interface change: stages 2 and 3 will be skipped',
      );
    }
    await definition.afterCommit?.({ directory, context, magicPatterns, leased });
  }
}

/** Stage 2 (L2-010 AC3): writes each design's state files from Magic Patterns into docs/mocks/{screen}/{state}.html. */
async function exportMocks({ directory, context, magicPatterns }: StageHookContext): Promise<void> {
  const screens = readManifest(directory) ?? [];
  for (const screen of screens) {
    const files = await magicPatterns!.readFiles(
      screen.editorId,
      screen.states.map((s) => `${s}.html`),
    );
    for (const state of screen.states) {
      const html = files[`${state}.html`];
      if (html === undefined) continue;
      const path = join(directory, mockPath(screen.screen, state));
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, html);
    }
  }
  await context.log('info', `Exported ${screens.length} designs from Magic Patterns`);
}

/** Stage 9: plans only once every design has an estimate, so a missing one fails validation, not the planner. */
function planIfEstimated(directory: string, leased: LeasedRun): void {
  if (validateEstimates(directory).length === 0) planBacklog(directory, leased.descopeThresholdDays);
}

/** Stage 9 (L2-020): Hewn's copy of the committed plan, for stage 10 and the Backlog page. */
async function reportBacklog({ directory, context }: StageHookContext): Promise<void> {
  const plan = JSON.parse(await readFile(join(directory, 'docs/estimates/backlog.json'), 'utf8')) as Backlog;
  await context.reportBacklog({
    increments: plan.increments.map(({ designs: _designs, ...increment }) => increment),
    deferred: plan.deferred.map(({ design: _design, ...deferred }) => deferred),
  });
  await context.log('info', `Planned ${plan.increments.length} increments; deferred ${plan.deferred.length} designs`);
}

/** Stage 3 (L2-012 AC3): logs Magic Patterns design-system colours the extracted tokens do not match. */
async function compareWithMagicPatterns({ directory, context, magicPatterns }: StageHookContext): Promise<void> {
  const settings = await magicPatterns?.designSystemTokens();
  if (!settings) return;
  for (const mismatch of tokenMismatches(directory, settings)) await context.log('warn', mismatch);
}

/** Numbered documents a later direction keeps: requirement IDs, journey numbers and designs (L2-005 AC3, L2-010 AC6). */
const KEPT = ['docs/specs/L1.md', 'docs/specs/L2.md', 'docs/journeys.md', 'docs/mocks/manifest.json'];

/** Stage 1 of a feature direction decides whether the feature changes the user interface (L2-005 AC2). */
function decidesScope(leased: LeasedRun): boolean {
  return leased.stage === 1 && leased.direction?.kind === 'Feature';
}

function instructionsFor(leased: LeasedRun, definition: StageDefinition): string {
  const feature =
    leased.direction?.kind === 'Feature'
      ? [
          `Feature direction: ${leased.direction.idea}`,
          'The product already exists. Work on the new or changed scope only: update the existing documents and designs, keep every existing requirement ID, journey number and design, and give new ones the next free numbers.',
          ...(decidesScope(leased)
            ? [
                `Add the feature to the Core features in docs/brief.md. Then answer "${UI_CHANGE_QUESTION}" in docs/decisions.md with an answer starting Yes or No; with No, Hewn skips Designs and Design system.`,
              ]
            : []),
        ]
      : [];
  return [
    `You are stage ${leased.stage} (${leased.stageName}) of Hewn's pipeline for "${leased.project.name}".`,
    `Direction: ${leased.project.idea}`,
    ...feature,
    leased.project.stackPreference ? `Named stack: ${leased.project.stackPreference}` : 'No stack was named.',
    definition.task,
    AUTONOMY,
    'Change no other files.',
  ].join('\n\n');
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
