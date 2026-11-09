import type { BacklogReport, CheckRun, CommitFile, LeasedRun, LogLevel, PullRequest } from '../api.ts';

export interface StageStep {
  name: string;
  execute(signal: AbortSignal): Promise<void>;
}

/** What a stage may do beyond its own workspace, all through the API with the run's lease. */
export interface RunContext {
  /** A directory private to this run; removed when the run ends. */
  workspace: string;
  log(level: LogLevel, text: string): Promise<void>;
  listSkillFolders(): Promise<Record<string, string[]>>;
  /** The product repository's default branch as a gzipped tarball with one top-level folder. */
  downloadRepository(): Promise<Buffer>;
  /** Commits as step `step`; the idempotency key is `{run}/{step}/commit`, so a resumed step cannot commit twice. */
  commit(step: number, message: string, files: CommitFile[], branch?: string): Promise<string>;
  /** Opens a pull request into the default branch; keyed `{run}/{step}/pull-request`, so repeating it returns the first. */
  openPullRequest(step: number, request: { head: string; title: string; body: string }): Promise<PullRequest>;
  pullRequestChecks(number: number): Promise<CheckRun[]>;
  /** Stage 9: replaces the direction's backlog in Hewn. */
  reportBacklog(report: BacklogReport): Promise<void>;
  /** Squash-merges; keyed `{run}/{step}/merge`. */
  mergePullRequest(step: number, number: number): Promise<string>;
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
