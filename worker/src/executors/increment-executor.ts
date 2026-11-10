import type { CommandSandbox } from '../isolation/run-sandbox.ts';
import { isolationFor } from './document-executor.ts';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { HewnApiError, type CheckRun, type CommitFile, type Increment, type LeasedRun } from '../api.ts';
import { AUTONOMY, DECISIONS, parseDecisions, readDecisions, validateDecisions } from '../agents/decision-log.ts';
import type { IncrementTask, StageAgent } from '../agents/stage-agent.ts';
import type { Backlog } from '../estimates/backlog-planner.ts';
import { markComplete } from '../increments/progress.ts';
import { pullRequestBody, pullRequestTitle } from '../increments/pull-request-template.ts';
import { checkTestCommit } from '../increments/test-files.ts';
import { CommandTestGate, type Counts, type GateResult, type TestGate } from '../increments/test-gate.ts';
import { validateVideo, type Probe } from '../increments/video.ts';
import { kebab, type StackTemplate } from '../scaffold/stack-template.ts';
import { checkOut } from './checkout.ts';
import { stackDecision } from './scaffold-executor.ts';
import type { RunContext, StageExecutor, StageStep, StepKey } from './stage-executor.ts';

const PASSING = new Set(['success', 'neutral', 'skipped']);
const MAX_REBASES = 3;
const VIDEO_ATTEMPTS = 2;
const TOOLS = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'] as const;

export interface IncrementOptions {
  /** The local gate for a stack; the stack's own commands by default. */
  gate?: (template: StackTemplate, sandbox?: CommandSandbox) => TestGate;
  probe?: Probe;
  pollMs?: number;
  timeoutMs?: number;
}

/** Why an increment stops short of a merge. */
class Blocked extends Error {
  readonly failing: string[];

  constructor(failing: string[]) {
    super(`Blocked: ${failing.join('; ')}`);
    this.failing = failing;
  }
}

/**
 * Stage 10 (L2-021 to L2-025): deliver the backlog one increment at a time. Each increment gets a feature branch from
 * the latest default branch, a first commit of traced acceptance tests and a recorded red run, implement-and-test
 * iterations until the fixed gate is green (or Blocked after the lease's cap), a video, a pull request, and a
 * squash-merge once its checks pass, rebasing when the default branch moved. Progress is committed after each merge.
 */
export class IncrementStageExecutor implements StageExecutor {
  private readonly agent: StageAgent;
  private readonly templates: readonly StackTemplate[];
  private readonly gateFor: (template: StackTemplate, sandbox?: CommandSandbox) => TestGate;
  private readonly probe: Probe | undefined;
  private readonly pollMs: number;
  private readonly timeoutMs: number;

  constructor(agent: StageAgent, templates: readonly StackTemplate[], options: IncrementOptions = {}) {
    this.agent = agent;
    this.templates = templates;
    this.gateFor = options.gate ?? ((template, sandbox) => new CommandTestGate(template.gate, sandbox));
    this.probe = options.probe;
    this.pollMs = options.pollMs ?? 30_000;
    this.timeoutMs = options.timeoutMs ?? 60 * 60_000;
  }

  plan(leased: LeasedRun, context: RunContext): StageStep[] {
    return [
      {
        name: 'Deliver increments',
        execute: async (signal) => {
          const outcomes: string[] = [];
          for (let increment = await context.nextIncrement(); increment; increment = await context.nextIncrement()) {
            if (signal.aborted) return;
            outcomes.push(await this.deliver(leased, context, increment, signal));
          }
          const blocked = outcomes.filter((o) => o === 'Blocked').length;
          await context.log(
            blocked ? 'warn' : 'info',
            `Backlog done: ${outcomes.length - blocked} merged, ${blocked} blocked`,
          );
        },
      },
    ];
  }

  private async deliver(leased: LeasedRun, context: RunContext, increment: Increment, signal: AbortSignal) {
    const n = increment.number;
    const slug = kebab(increment.title);
    const branch = `feature/${slug}`;
    // Commits carry the lease epoch, so a resumed run commits its own work instead of getting an old SHA back.
    const key = (name: string): StepKey => `e${leased.epoch}/i${n}/${name}`;
    await context.updateIncrement(n, { status: 'InProgress' });
    await context.log('info', `Increment ${n}: ${increment.title} on ${branch}`);

    // L2-021 AC1: from the latest default branch.
    let directory = join(context.workspace, `increment-${n}`);
    await checkOut(context, directory);
    const template = this.template(directory);
    const gate = this.gateFor(template, context.isolation?.sandbox);
    const designs = designsOf(directory, n);
    const task = (phase: IncrementTask['phase'], extra: Partial<IncrementTask> = {}): IncrementTask => ({
      number: n,
      title: increment.title,
      slug,
      l2Ids: increment.l2Ids,
      designs,
      phase,
      ...extra,
    });
    let base = snapshot(directory);
    let committed = new Map(base);
    const state = { iterations: increment.iterations, rebases: 0 };
    const maxIterations = leased.maxIterations;

    // L2-054 AC3: decisions already on the default branch were reported by the run that recorded them.
    const reported = new Set(parseDecisions(readDecisions(directory)).map((d) => d.question));
    /** Reports the decisions the last commit wrote, once each, so the Decisions tab links them to it. */
    const reportDecisions = async () => {
      const recorded = parseDecisions(readDecisions(directory)).filter((d) => !reported.has(d.question));
      if (recorded.length === 0) return;
      await context.recordDecisions(recorded);
      for (const d of recorded) reported.add(d.question);
    };

    const commitChanges = async (step: StepKey, message: string) => {
      const now = snapshot(directory);
      const paths = [...now.keys()].filter((p) => now.get(p) !== committed.get(p));
      if (paths.length === 0) return undefined;
      const sha = await context.commit(step, message, read(directory, paths), branch);
      committed = now;
      if (paths.includes(DECISIONS)) await reportDecisions();
      return sha;
    };

    try {
      // Test first (L2-021 AC2, AC3).
      await this.agent.run(
        this.agentTask(leased, directory, 'implementing-incrementally', task('tests'), context),
        signal,
      );
      const testFiles = changedSince(base, directory);
      const problems = checkTestCommit(directory, testFiles, increment.l2Ids);
      if (problems.length) throw new Blocked(problems.map((p) => `Test commit: ${p}`));
      await commitChanges(key('tests'), `Add acceptance tests for ${increment.title}`);
      const red = (await gate.acceptance(directory, testFiles, signal)).counts;
      await context.updateIncrement(n, {
        status: 'InProgress',
        testCount: red.failed + red.passed,
        redFailing: red.failed,
        redPassing: red.passed,
      });
      await context.log(
        'info',
        red.failed > 0
          ? `Increment ${n}: red recorded, ${red.failed} failing`
          : `Increment ${n}: tests passed before implementation`,
      );

      // Implement until green (L2-022).
      const implement = async (failing: string[]): Promise<GateResult> => {
        while (state.iterations < maxIterations) {
          state.iterations++;
          // Each iteration is reported as it starts, so Mission Control shows "iteration n of 10" live.
          await context.updateIncrement(n, { status: 'InProgress', iterations: state.iterations });
          await this.agent.run(
            this.agentTask(leased, directory, 'implementing-incrementally', task('implement', { failing }), context),
            signal,
          );
          await commitChanges(
            key(`implement-${state.iterations}`),
            `Implement ${increment.title} (iteration ${state.iterations})`,
          );
          const gated = await gate.full(directory, testFiles, signal);
          // L2-054 AC2: an incomplete decision log keeps the increment from being green.
          const decisions = validateDecisions(directory).map((p) => `Decision log: ${p}`);
          const result = decisions.length
            ? { ...gated, passed: false, failing: [...gated.failing, ...decisions] }
            : gated;
          await context.log(
            'info',
            `Increment ${n}: iteration ${state.iterations} of ${maxIterations} ${result.passed ? 'green' : 'failed'}`,
          );
          if (result.passed) {
            await context.updateIncrement(n, {
              status: 'InProgress',
              iterations: state.iterations,
              greenAfter: state.iterations,
            });
            return result;
          }
          failing = result.failing;
        }
        throw new Blocked(failing);
      };
      let green = await implement([]);

      // Video (L2-023 AC1, AC3): tried at most twice, never blocking the increment.
      const video = await this.video(leased, directory, slug, task('video'), signal, context);
      if ('path' in video) {
        // L2-023 AC2: a relative link in a PR body resolves under /pull/N, so link the file at the commit that holds it.
        const sha = await commitChanges(key('video'), `Record the video for ${increment.title}`);
        const repository = leased.project.repository;
        if (sha && repository) video.url = `https://github.com/${repository}/blob/${sha}/${video.path}`;
      } else {
        rmSync(join(directory, 'docs/videos', slug), { recursive: true, force: true });
        await context.log('warn', `Increment ${n}: video failed: ${video.failed}`);
      }
      await context.updateIncrement(
        n,
        'path' in video
          ? { status: 'InProgress', video: 'Recorded', videoNote: `docs/videos/${slug}/` }
          : { status: 'InProgress', video: 'Failed', videoNote: video.failed.slice(0, 500) },
      );

      // Pull request (L2-024 AC1, AC2); the key has no epoch, so a resumed run gets the same pull request.
      const journeyTitle = journeyTitleOf(directory, increment.journey) ?? increment.title;
      const facts = () => ({
        increment,
        journeyTitle,
        designs,
        changed: changedSince(base, directory),
        gate: green,
        red: red as Counts,
        iterations: state.iterations,
        maxIterations,
        rebases: state.rebases,
        video,
        runId: leased.runId,
        directionId: leased.directionId,
      });
      const pull = await context.openPullRequest(`i${n}/pull-request`, {
        head: branch,
        title: pullRequestTitle(journeyTitle, increment),
        body: pullRequestBody(facts()),
      });
      await context.log('info', `Increment ${n}: opened #${pull.number} ${pull.url}`);
      // L2-024 AC3: the increment shows its pull request, and the API follows its checks from now on.
      await context.updateIncrement(n, { status: 'InProgress', pullRequestNumber: pull.number });

      // Checks and merge (L2-025).
      for (let attempt = 1; ; attempt++) {
        const failed = await this.waitForChecks(context, pull.number, template, signal);
        if (failed.length) {
          // L2-025 AC3: a failed required check is a failed iteration.
          green = await implement(failed.map((c) => `CI: ${c.name} ${c.conclusion ?? 'failed'}`));
          continue;
        }
        try {
          await context.mergePullRequest(`i${n}/merge-${attempt}`, pull.number);
          break;
        } catch (error) {
          if (!(error instanceof HewnApiError && error.code === 'branch_behind')) throw error;
          if (state.rebases >= MAX_REBASES) {
            throw new Blocked([`Could not rebase onto the default branch after ${MAX_REBASES} attempts`]);
          }
          state.rebases++;
          ({ directory, base } = await this.rebase(leased, context, directory, base, task, signal, state.rebases));
          await context.commit(
            key(`rebase-${state.rebases}`),
            `Rebase ${increment.title} onto the default branch`,
            read(directory, changedSince(base, directory)),
            branch,
            { rebase: true },
          );
          committed = snapshot(directory);
          await reportDecisions();
          await context.log(
            'info',
            `Increment ${n}: rebased onto the default branch (${state.rebases} of ${MAX_REBASES})`,
          );
          const result = await gate.full(directory, testFiles, signal);
          green = result.passed ? result : await implement(result.failing);
        }
      }

      await context.updateIncrement(n, {
        status: 'Merged',
        pullRequestNumber: pull.number,
        iterations: state.iterations,
      });
      await context.log('info', `Increment ${n}: merged #${pull.number}`);
      await this.updateProgress(leased, context, n, designs, key('progress'), increment.title);
      return 'Merged';
    } catch (error) {
      if (!(error instanceof Blocked)) throw error;
      // L2-022 AC2: Blocked with its failing tests; the API skips increments that depend on it.
      await context.updateIncrement(n, {
        status: 'Blocked',
        iterations: state.iterations,
        failingTests: error.failing.slice(0, 100).map((f) => f.slice(0, 500)),
      });
      await context.log('warn', `Increment ${n}: blocked: ${error.failing.slice(0, 3).join('; ')}`);
      return 'Blocked';
    }
  }

  private template(directory: string): StackTemplate {
    const decision = stackDecision(directory);
    const template = this.templates.find((t) => t.matches(decision));
    if (!template) throw new Error('No stack template matches the stack decision, so there is no test gate');
    return template;
  }

  private agentTask(
    leased: LeasedRun,
    directory: string,
    skill: string | null,
    increment: IncrementTask,
    context?: RunContext,
  ) {
    return {
      run: leased,
      directory,
      skill,
      instructions: instructionsFor(increment),
      allowedTools: TOOLS,
      increment,
      ...(context ? isolationFor(context, TOOLS) : {}),
    };
  }

  private async video(
    leased: LeasedRun,
    directory: string,
    slug: string,
    task: IncrementTask,
    signal: AbortSignal,
    context?: RunContext,
  ): Promise<{ path: string; url?: string } | { failed: string }> {
    let reason = 'unknown';
    for (let attempt = 1; attempt <= VIDEO_ATTEMPTS; attempt++) {
      try {
        await this.agent.run(this.agentTask(leased, directory, 'creating-videos', task, context), signal);
        const problems = await validateVideo(directory, slug, this.probe);
        if (problems.length === 0) return { path: `docs/videos/${slug}/${slug}.mp4` };
        reason = problems.join('; ');
      } catch (error) {
        reason = error instanceof Error ? error.message : String(error);
      }
    }
    return { failed: reason };
  }

  /**
   * L2-025 AC2: replay the branch's changes onto the latest default branch. A path both sides changed is a conflict;
   * the branch's version is kept and the agent resolves it against the default branch's version.
   */
  private async rebase(
    leased: LeasedRun,
    context: RunContext,
    directory: string,
    base: Map<string, string>,
    task: (phase: IncrementTask['phase'], extra?: Partial<IncrementTask>) => IncrementTask,
    signal: AbortSignal,
    attempt: number,
  ) {
    const changed = changedSince(base, directory);
    const files = read(directory, changed);
    const target = `${directory}-rebase-${attempt}`;
    await checkOut(context, target);
    const latest = snapshot(target);
    const conflicts = changed.filter((p) => latest.get(p) !== base.get(p) && latest.get(p) !== undefined);
    for (const file of files) {
      await mkdir(dirname(join(target, file.path)), { recursive: true });
      await writeFile(join(target, file.path), file.content);
    }
    if (conflicts.length) {
      await context.log('info', `Resolving conflicts in ${conflicts.join(', ')}`);
      await this.agent.run(this.agentTask(leased, target, null, task('resolve', { conflicts }), context), signal);
    }
    return { directory: target, base: latest };
  }

  private async waitForChecks(context: RunContext, number: number, template: StackTemplate, signal: AbortSignal) {
    const deadline = Date.now() + this.timeoutMs;
    while (true) {
      const checks = await context.pullRequestChecks(number);
      const done = template.checks.every((name) => checks.some((c) => c.name === name && c.status === 'completed'));
      if (done) return checks.filter((c: CheckRun) => c.status === 'completed' && !PASSING.has(c.conclusion ?? ''));
      if (signal.aborted) throw new Error('Stopped while waiting for CI');
      if (Date.now() + this.pollMs > deadline) throw new Blocked([`CI did not finish on #${number}`]);
      await new Promise((resolve) => setTimeout(resolve, this.pollMs));
    }
  }

  /** L2-025 AC4: before the next increment starts. */
  private async updateProgress(
    leased: LeasedRun,
    context: RunContext,
    n: number,
    designs: string[],
    step: StepKey,
    title: string,
  ) {
    const directory = join(context.workspace, `progress-${n}`);
    await checkOut(context, directory);
    const changed = markComplete(directory, designs, leased.descopeThresholdDays);
    if (changed.length) await context.commit(step, `Update progress after ${title}`, read(directory, changed));
    const percent = /\*\*Percent complete:\*\*\s*(\d+)%/.exec(
      existsSync(join(directory, 'docs/estimates/README.md'))
        ? readFileSync(join(directory, 'docs/estimates/README.md'), 'utf8')
        : '',
    )?.[1];
    if (percent) await context.log('info', `Percent complete: ${percent}%`);
  }
}

function instructionsFor(task: IncrementTask): string {
  return `${phaseInstructions(task)}\n\n${AUTONOMY}`;
}

function phaseInstructions(task: IncrementTask): string {
  const scope = `Increment ${task.number}, "${task.title}", covering ${task.l2Ids.join(', ')}${
    task.designs.length ? ` (designs: ${task.designs.join(', ')})` : ''
  }.`;
  switch (task.phase) {
    case 'tests':
      return `${scope} Write only the acceptance tests for these requirements, first. Every test file starts with a header comment "Traces to: L2-xxx" naming only these L2s. Do not write any implementation.`;
    case 'implement':
      return `${scope} Implement until the backend tests, frontend lint and unit tests, the new acceptance tests and the full e2e suite pass. Do not weaken or delete the acceptance tests.${
        task.failing?.length ? `\n\nStill failing:\n${task.failing.map((f) => `- ${f}`).join('\n')}` : ''
      }`;
    case 'video':
      return `${scope} Use creating-videos to record a captioned 1920x1080 MP4 of 3 minutes or less walking through this journey in the running app. Save it as docs/videos/${task.slug}/${task.slug}.mp4 with ${task.slug}.vtt and script.md.`;
    case 'resolve':
      return `${scope} The default branch changed these files since the branch was made: ${task.conflicts?.join(', ')}. Each holds this increment's version; merge in the default branch's changes so both survive.`;
  }
}

/** The designs stage 9 planned for increment `n`, from `docs/estimates/backlog.json`. */
function designsOf(directory: string, n: number): string[] {
  const path = join(directory, 'docs/estimates/backlog.json');
  if (!existsSync(path)) return [];
  const backlog = JSON.parse(readFileSync(path, 'utf8')) as Backlog;
  return backlog.increments.find((i) => i.number === n)?.designs ?? [];
}

function journeyTitleOf(directory: string, journey: number): string | null {
  const path = join(directory, 'docs/journeys.md');
  if (!existsSync(path)) return null;
  return new RegExp(`^##\\s+${journey}\\.\\s+(.+)$`, 'm').exec(readFileSync(path, 'utf8'))?.[1]?.trim() ?? null;
}

/** Content hashes of every file, by repository-relative path. */
function snapshot(directory: string): Map<string, string> {
  const hashes = new Map<string, string>();
  const walk = (folder: string) => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const path = join(folder, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (statSync(path).isFile()) {
        hashes.set(
          relative(directory, path).split('\\').join('/'),
          createHash('sha1').update(readFileSync(path)).digest('hex'),
        );
      }
    }
  };
  walk(directory);
  return hashes;
}

function changedSince(base: Map<string, string>, directory: string): string[] {
  const now = snapshot(directory);
  return [...now.keys()].filter((p) => now.get(p) !== base.get(p)).sort();
}

function read(directory: string, paths: string[]): CommitFile[] {
  return paths.map((path) => ({ path, content: readFileSync(join(directory, path)) }));
}
