export type WorkerLocation = 'Local' | 'Cloud';
export interface WorkerRegistration {
  name: string;
  location: WorkerLocation;
  host: string;
  version: string;
}
export interface LeasedRun {
  runId: string;
  epoch: number;
  projectId: string;
  directionId: string;
  stage: number;
  stageName: string;
  checkpointStep: number;
  checkpointSha: string | null;
  project: {
    id: string;
    name: string;
    idea: string;
    stackPreference: string | null;
    repository: string | null;
  };
  /** What the direction asks for. A feature direction works on the new or changed scope only (L2-005). */
  direction?: LeasedDirection;
  /** Clone URL of the skill library stage 0 copies from. */
  skillsSource: string;
  /** Designs estimated above this many ideal days are split or descoped (stage 9). */
  descopeThresholdDays: number;
  /** Implement-and-test iterations before an increment is Blocked (stage 10). */
  maxIterations: number;
}
export interface LeasedDirection {
  kind: 'Product' | 'Feature';
  /** The product idea, or the feature to add. */
  idea: string;
  /** Stage 1's recorded decision for a feature direction; null until it is made. */
  hasUiChange: boolean | null;
}

/** Stage 1 of a feature direction: the recorded decision on whether the feature changes the UI (L2-005 AC2). */
/** A decision the run recorded in docs/decisions.md (L2-054), reported for the stage's Decisions tab. */
export interface ReportedDecision {
  question: string;
  answer: string;
  rationale: string;
  /** The ADR the decision also wrote, as docs/adr/NNNN-slug.md (L2-054 AC2). */
  adr?: string;
}

export interface ScopeReport {
  hasUiChange: boolean;
  rationale: string;
}

export type RunOutcome = { outcome: 'Succeeded' } | { outcome: 'Failed'; error: string };
export class LeaseLostError extends Error {}

/** The direction reached its budget and is Paused; the run ends after the call that reached it (L2-053 AC3). */
export class BudgetReachedError extends Error {}

/** 401: the worker's token was revoked or has expired (L2-041); the worker stops. */
export class TokenRefusedError extends Error {}

/** A model call a run made (L2-052 AC1). The call id makes a retried report count once. */
export interface ModelCallReport {
  callId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface ModelCallVerdict {
  verdict: 'Continue' | 'Warn' | 'Stop';
  directionSpendUsd: number;
  budgetUsd: number;
}

export interface CommitFile {
  path: string;
  content: Buffer;
}

export type LogLevel = 'info' | 'warn' | 'error';

/** Stage 9's plan, as Hewn stores it (L2-019, L2-020). */
export interface BacklogReport {
  increments: {
    number: number;
    title: string;
    journey: number;
    l2Ids: string[];
    estimateDays: number;
    dependsOn: number[];
  }[];
  deferred: { title: string; l2Ids: string[]; estimateDays: number; reason: string }[];
}

/** A backlog increment, as Hewn offers it to stage 10. */
export interface Increment {
  number: number;
  title: string;
  journey: number;
  l2Ids: string[];
  estimateDays: number;
  dependsOn: number[];
  status: string;
  iterations: number;
}

/** Stage 10's progress on one increment (L2-021 AC3, L2-022 AC2, L2-025). */
export interface IncrementUpdate {
  status: 'InProgress' | 'Blocked' | 'Merged';
  redFailing?: number;
  redPassing?: number;
  iterations?: number;
  failingTests?: string[];
  pullRequestNumber?: number;
  /** Acceptance tests in the test commit. */
  testCount?: number;
  /** The iteration on which every test first passed. */
  greenAfter?: number;
  /** The video's outcome, with its folder or why it failed (never blocks the increment). */
  video?: 'Recorded' | 'Failed';
  videoNote?: string;
}

/** A refusal from the API, with the ProblemDetails code clients branch on. */
export class HewnApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface PullRequest {
  number: number;
  url: string;
}

/** A check on a pull request's head commit, as GitHub reports it. */
export interface CheckRun {
  name: string;
  status: 'queued' | 'in_progress' | 'completed' | string;
  conclusion: string | null;
}
/** What to do after a checkpoint: carry on, or stop the run there because an Owner pressed Pause. */
export type CheckpointVerdict = 'Continue' | 'Pause';

/** What the control poll can tell a running worker. */
export type RunControl = 'Cancel' | 'Halt';

export interface HewnApi {
  register(registration: WorkerRegistration): Promise<string>;
  /**
   * Asks for a run. With `waitSeconds`, the API holds the request until work is queued or the wait ends, which is how
   * the server pushes work to an idle worker (L2-026 AC5).
   */
  lease(workerId: string, waitSeconds?: number, signal?: AbortSignal): Promise<LeasedRun | null>;
  heartbeat(workerId: string, run: LeasedRun): Promise<void>;
  /** Names the step (1-based) the worker is starting, shown live on the running stage. */
  startStep(workerId: string, run: LeasedRun, step: number, name: string): Promise<void>;
  /** Reports a completed step; the answer is Pause when an Owner pressed Pause (L2-029 AC1). */
  checkpoint(workerId: string, run: LeasedRun, step: number, sha?: string): Promise<CheckpointVerdict>;
  /**
   * The control poll, held open up to `waitSeconds` while the run executes: Cancel when an Owner cancelled the
   * direction (L2-029 AC3), null to poll again. Aborting `signal` ends the poll.
   */
  control(workerId: string, run: LeasedRun, waitSeconds: number, signal: AbortSignal): Promise<RunControl | null>;
  result(workerId: string, run: LeasedRun, outcome: RunOutcome): Promise<void>;
  /** Skill folder names already in the product repository, by skill root. */
  listSkillFolders(workerId: string, run: LeasedRun): Promise<Record<string, string[]>>;
  /** The product repository's default branch as a gzipped tarball with one top-level folder. */
  downloadRepository(workerId: string, run: LeasedRun): Promise<Buffer>;
  /** Commits through the API's GitHub write broker; repeating a key returns the first commit's SHA. */
  commit(
    workerId: string,
    run: LeasedRun,
    idempotencyKey: string,
    message: string,
    files: CommitFile[],
    branch?: string,
    options?: CommitOptions,
  ): Promise<string>;
  openPullRequest(
    workerId: string,
    run: LeasedRun,
    idempotencyKey: string,
    request: { head: string; title: string; body: string },
  ): Promise<PullRequest>;
  pullRequestChecks(workerId: string, run: LeasedRun, number: number): Promise<CheckRun[]>;
  reportBacklog(workerId: string, run: LeasedRun, report: BacklogReport): Promise<void>;
  reportScope(workerId: string, run: LeasedRun, report: ScopeReport): Promise<void>;
  recordDecisions(workerId: string, run: LeasedRun, decisions: ReportedDecision[]): Promise<void>;
  recordModelCall(workerId: string, run: LeasedRun, call: ModelCallReport): Promise<ModelCallVerdict>;
  mergePullRequest(workerId: string, run: LeasedRun, idempotencyKey: string, number: number): Promise<string>;
  protectDefaultBranch(workerId: string, run: LeasedRun, idempotencyKey: string, checks: string[]): Promise<void>;
  log(workerId: string, run: LeasedRun, lines: { level: LogLevel; text: string }[]): Promise<void>;
  /** Stage 10: the next runnable increment, or null when none is left. */
  nextIncrement(workerId: string, run: LeasedRun): Promise<Increment | null>;
  updateIncrement(workerId: string, run: LeasedRun, number: number, update: IncrementUpdate): Promise<void>;
}

export interface CommitOptions {
  /** Put the commit on the default branch's head and move the branch there; `files` must be all the branch changes. */
  rebase?: boolean;
}
