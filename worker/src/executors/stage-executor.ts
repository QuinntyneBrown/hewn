import type { ToolGate } from '../isolation/tool-gate.ts';
import type { CommandSandbox } from '../isolation/run-sandbox.ts';
import type {
  BacklogReport,
  ScopeReport,
  ReportedDecision,
  CheckRun,
  CommitFile,
  CommitOptions,
  Increment,
  IncrementUpdate,
  LeasedRun,
  LogLevel,
  PullRequest,
} from '../api.ts';

/** A model call's model and token counts, as the model API reported them. */
export interface ModelCall {
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/** A step number, or a name for the steps inside a stage-10 increment (`i3/tests`); keys are `{run}/{step}/…`. */
export type StepKey = number | string;

export interface StageStep {
  name: string;
  execute(signal: AbortSignal): Promise<void>;
}

/** What a stage may do beyond its own workspace, all through the API with the run's lease. */
export interface RunContext {
  /** A directory private to this run; removed when the run ends. */
  workspace: string;
  /** The run's isolation (L2-042): its tool gate, how its commands start, and its egress proxy. */
  isolation?: RunIsolation;
  log(level: LogLevel, text: string): Promise<void>;
  listSkillFolders(): Promise<Record<string, string[]>>;
  /** The product repository's default branch as a gzipped tarball with one top-level folder. */
  downloadRepository(): Promise<Buffer>;
  /** Commits as step `step`; the idempotency key is `{run}/{step}/commit`, so a resumed step cannot commit twice. */
  commit(
    step: StepKey,
    message: string,
    files: CommitFile[],
    branch?: string,
    options?: CommitOptions,
  ): Promise<string>;
  /** Opens a pull request into the default branch; keyed `{run}/{step}/pull-request`, so repeating it returns the first. */
  openPullRequest(step: StepKey, request: { head: string; title: string; body: string }): Promise<PullRequest>;
  pullRequestChecks(number: number): Promise<CheckRun[]>;
  /** Stage 9: replaces the direction's backlog in Hewn. */
  reportBacklog(report: BacklogReport): Promise<void>;
  /** The decisions this run committed to docs/decisions.md (L2-054), for the stage's Decisions tab. */
  recordDecisions(decisions: ReportedDecision[]): Promise<void>;
  /**
   * Reports a model call the moment it returns (L2-052 AC1). Throws BudgetReachedError when the call reached the
   * direction's budget, so the stage stops before its next call (L2-053 AC3).
   */
  recordModelCall(call: ModelCall): Promise<void>;
  /** Stage 1 of a feature direction: tells Hewn whether stages 2 and 3 run. */
  reportScope(report: ScopeReport): Promise<void>;
  /** Squash-merges; keyed `{run}/{step}/merge`. */
  mergePullRequest(step: StepKey, number: number): Promise<string>;
  /** Stage 10: the next runnable increment, or null when the backlog is done. */
  nextIncrement(): Promise<Increment | null>;
  updateIncrement(number: number, update: IncrementUpdate): Promise<void>;
  /** Requires the checks on the default branch; keyed `{run}/{step}/protect`. */
  protectDefaultBranch(step: number, checks: string[]): Promise<void>;
}

export interface StageExecutor {
  plan(run: LeasedRun, context: RunContext): StageStep[];
}

/** Sends each stage to its executor, and stages without one yet to the fallback. */
export class StageRouter implements StageExecutor {
  private readonly stages: ReadonlyMap<number, StageExecutor>;
  private readonly fallback: StageExecutor;

  constructor(stages: ReadonlyMap<number, StageExecutor>, fallback: StageExecutor) {
    this.stages = stages;
    this.fallback = fallback;
  }

  plan(run: LeasedRun, context: RunContext): StageStep[] {
    return (this.stages.get(run.stage) ?? this.fallback).plan(run, context);
  }
}

/** What keeps a run to itself (L2-042). */
export interface RunIsolation {
  /** A gate for a stage's tool allow list; a denied call is logged as a security event (AC3). */
  toolGate(allowed: readonly string[]): ToolGate;
  /** How the run's commands start (AC1). */
  sandbox: CommandSandbox;
  /** The run's egress proxy, its only route out (AC2). */
  egressProxyUrl: string;
}
