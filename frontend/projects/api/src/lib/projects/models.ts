export type StageStatus =
  'Pending' | 'Running' | 'Paused' | 'Succeeded' | 'Failed' | 'Skipped' | 'Cancelled';

export type DirectionStatus =
  'Queued' | 'Running' | 'Paused' | 'Complete' | 'Cancelled' | 'Blocked';

export type DirectionKind = 'Product' | 'Feature';

export type ProjectStatus = 'Running' | 'Idle' | 'Paused' | 'Blocked' | 'Cancelled' | 'Complete';

export interface Stage {
  number: number;
  name: string;
  status: StageStatus;
  startedAt: string | null;
  endedAt: string | null;
  /** While Running: the step the worker is on and the latest log line (L2-030 AC2). */
  step?: string | null;
  latestLine?: string | null;
  /** The run the live step and line come from. */
  runId?: string | null;
}

export interface Direction {
  id: string;
  kind: DirectionKind;
  status: DirectionStatus;
  idea: string;
  budgetUsd: number;
  submittedBy: string;
  submittedAt: string;
  completedAt: string | null;
  stages: Stage[];
  /** For a feature direction, stage 1's recorded decision on whether the user interface changes. */
  hasUiChange?: boolean | null;
  uiDecision?: string | null;
  /** Spend to date (L2-052 AC2), whether the 80% warning was sent (L2-053 AC2), and why it paused (AC3). */
  spendUsd: number;
  budgetWarned: boolean;
  pauseReason: string | null;
  /** An Owner pressed Pause and the step in progress is finishing (L2-029 AC1). */
  pauseRequested: boolean;
  pausedBy: string | null;
  pausedAt: string | null;
  /** Who cancelled the direction and when (L2-029 AC3). */
  cancelledBy: string | null;
  cancelledAt: string | null;
  /** Seconds from Cancel to the worker stopping; null when no run was in progress. */
  stoppedWithinSeconds: number | null;
  /** The worker that held the run hasn't confirmed it stopped yet. */
  awaitingStop: boolean;
  /** Open pull requests labelled hewn:cancelled. */
  labelledPullRequests: number[];
  /** While Blocked (L2-006 AC2): why the stage's last attempt failed, which stage, and when. */
  failureReason: string | null;
  failedStage: number | null;
  failedAt: string | null;
  /** An automatic retry waiting out its backoff (L2-006 AC1). */
  retry: PendingRetry | null;
}

export interface PendingRetry {
  stage: number;
  /** 2 to 4: the attempt that runs next. */
  attempt: number;
  maxAttempts: number;
  notBefore: string;
  reason: string | null;
}

export interface Project {
  id: string;
  name: string;
  idea: string;
  stackPreference: string | null;
  repository: string | null;
  status: ProjectStatus;
  createdAt: string;
  lastSequence: number;
  directions: Direction[];
  /** Spend to date across the project's directions (L2-052 AC2). */
  spendUsd: number;
  /** The waits before each automatic retry, in seconds (L2-006 AC1). */
  retryBackoffSeconds?: number[];
}

export interface SubmitProductDirectionRequest {
  name: string;
  idea: string;
  stackPreference: string | null;
  repositoryUrl: string | null;
  budgetUsd: number;
}

/** Raise and resume (L2-053 AC3). `currentBudgetUsd` is the budget the Owner saw, so a stale one is refused (409). */
export interface RaiseAndResumeRequest {
  budgetUsd: number;
  currentBudgetUsd: number;
}

export interface RaiseAndResumeResult {
  directionId: string;
  budgetUsd: number;
  spendUsd: number;
  status: DirectionStatus;
}

/** What every new direction starts with, set by an Owner in Settings (L2-053 AC1). */
export interface DirectionDefaults {
  defaultBudgetUsd: number;
}

/** A project's row on the Projects page (L2-002); also sent live as each project changes. */
export interface ProjectSummary {
  id: string;
  name: string;
  /** The product's idea, or "Feature: …" while a feature direction is the current one. */
  idea: string;
  repository: string | null;
  status: ProjectStatus;
  /** The current direction's current stage. */
  stage: { number: number; name: string };
  /** What the stage is doing, or why it stopped; null when there is nothing to add. */
  note: string | null;
  percentComplete: number;
  spendUsd: number;
  lastActivityAt: string;
  /** A feature for a project whose first direction isn't Complete queues behind it. */
  firstDirectionComplete: boolean;
}

export interface SubmitFeatureDirectionRequest {
  idea: string;
  budgetUsd: number;
}

/** A run of a stage; Status is Queued, Running, Succeeded, Failed or Cancelled. */
export interface RunSummary {
  id: string;
  status: string;
  worker: string | null;
  startedAt: string | null;
  endedAt: string | null;
  error: string | null;
}

/** A file a run of the stage committed, with the commit that holds it. */
export interface Artifact {
  path: string;
  sha: string;
  committedAt: string;
}

/** A question a skill would have asked, answered by the agent (L2-054). */
export interface Decision {
  runId: string;
  question: string;
  answer: string;
  rationale: string;
  recordedAt: string;
}

/** A selected stage's runs (newest first), artifacts and decisions (L2-030 AC3). */
export interface StageDetail {
  stage: number;
  repository: string | null;
  runs: RunSummary[];
  artifacts: Artifact[];
  decisions: Decision[];
}

export type LogLevel = 'info' | 'warn' | 'error' | 'tool';

/** One numbered line of a run's log. */
export interface LogLine {
  line: number;
  at: string;
  level: LogLevel | string;
  text: string;
}

export interface SubmitProductDirectionResult {
  projectId: string;
  directionId: string;
}

/** What Pause and Resume answer (L2-029 AC1, AC2). */
/** Cancel's answer: stopped is false when the worker holding the run didn't answer in time; worker names it. */
export interface CancelDirectionResult {
  directionId: string;
  status: DirectionStatus;
  stopped: boolean;
  stoppedWithinSeconds: number | null;
  worker: string | null;
}

export interface DirectionControlResult {
  directionId: string;
  status: DirectionStatus;
  pauseRequested: boolean;
}

export type IncrementStatus = 'Queued' | 'InProgress' | 'Blocked' | 'Merged';

/** One increment of the current direction's backlog (L2-020 AC2). */
export interface BacklogIncrement {
  number: number;
  title: string;
  journey: number | null;
  l2Ids: string[];
  estimateDays: number;
  dependsOn: number[];
  status: IncrementStatus;
  iterations: number;
  /** What still fails on a Blocked increment, as the test gate reported it. */
  failingTests: string[];
  pullRequestNumber: number | null;
  pullRequestUrl: string | null;
}

/** A design stage 9 descoped, with its reason (L2-019 AC4). */
export interface DeferredDesign {
  title: string;
  l2Ids: string[];
  estimateDays: number;
  reason: string;
}

/** GET /api/projects/{id}/backlog: the increments, the deferred designs apart, and the totals (L2-018, L2-025 AC4). */
export interface Backlog {
  directionId: string | null;
  increments: BacklogIncrement[];
  deferred: DeferredDesign[];
  merged: number;
  total: number;
  mergedDays: number;
  totalDays: number;
  percentComplete: number;
}

/** A required check on an increment's pull request, as GitHub last reported it (L2-024 AC3, L2-037). */
export interface IncrementCheck {
  name: string;
  status: 'queued' | 'in_progress' | 'completed' | string;
  /** success, failure and so on once completed. */
  conclusion: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationSeconds: number | null;
}

/** An increment's pull request read from GitHub, with its body's sections apart from the attribution line. */
export interface IncrementPullRequest {
  number: number;
  url: string;
  title: string;
  state: 'open' | 'merged';
  additions: number;
  deletions: number;
  changedFiles: number;
  sections: { heading: string; text: string }[];
  attribution: string | null;
}

/** GET /api/projects/{id}/increments/{n}: one increment followed to merge (journey 13). */
export interface IncrementDetail {
  directionId: string;
  number: number;
  title: string;
  journey: number | null;
  l2Ids: string[];
  estimateDays: number;
  branch: string;
  status: IncrementStatus;
  startedAt: string | null;
  testCount: number | null;
  redFailing: number | null;
  redPassing: number | null;
  testsPassedEarly: boolean;
  testsCommittedAt: string | null;
  iterations: number;
  maxIterations: number;
  greenAfter: number | null;
  greenAt: string | null;
  video: 'Recorded' | 'Failed' | null;
  videoNote: string | null;
  videoAt: string | null;
  failingTests: string[];
  /** For a Blocked increment, the next one that doesn't depend on it. */
  movedOnTo: number | null;
  pullRequestOpenedAt: string | null;
  finishedAt: string | null;
  pullRequest: IncrementPullRequest | null;
  checks: IncrementCheck[];
}

/** One exported state of a screen; `previewUrl` is a signed URL on the separate preview origin (L2-011 AC2). */
export interface DesignState {
  state: string;
  label: string;
  /** Where the mock lives in the repository, such as `docs/mocks/statements/default.html`. */
  path: string;
  previewUrl: string;
}

/** One designed screen, as stage 2 listed it in `docs/mocks/manifest.json`. */
export interface DesignScreen {
  screen: string;
  title: string;
  magicPatternsUrl: string | null;
  states: DesignState[];
}

/** GET /api/projects/{id}/designs: every exported screen and state at one commit (L2-011 AC1). */
export interface Designs {
  /** The commit everything was read at; null before stage 2. */
  sha: string | null;
  stateCount: number;
  screens: DesignScreen[];
}

/** A token (foundation) or component page of the design system, on the separate preview origin (L2-012 AC4). */
export interface DesignSystemPage {
  /** The file's name without `.html`, such as `status-badge`. */
  page: string;
  title: string;
  /** Such as `docs/design-system/foundations/colour.html`. */
  path: string;
  previewUrl: string;
  /** For a token page, how many tokens its group holds (one theme's for colour); null for a component. */
  tokenCount: number | null;
  /** The token group has light and dark values. */
  lightAndDark: boolean;
}

/** GET /api/projects/{id}/design-system: the pages stage 3 wrote to `docs/design-system/`, at one commit. */
export interface DesignSystem {
  /** The commit everything was read at; null before stage 3. */
  sha: string | null;
  foundations: DesignSystemPage[];
  components: DesignSystemPage[];
}

/** One artifact of a stage: a file, or a folder of the stage's output standing for the files under it (L2-034). */
export interface VersionedArtifact {
  /** Such as `docs/brief.md`, or `docs/mocks/statements/` for a folder. */
  path: string;
  folder: boolean;
  /** The version: the commit that holds it (L2-034 AC1). */
  sha: string;
  committedAt: string;
  /** The file (blob) or folder (tree) on GitHub at that commit; null without a repository. */
  url: string | null;
}

export interface StageArtifacts {
  stage: number;
  name: string;
  artifacts: VersionedArtifact[];
}

/** GET /api/projects/{id}/artifacts: each stage's artifacts, newest stage first (L2-034 AC2). */
export interface Artifacts {
  repository: string | null;
  stages: StageArtifacts[];
}

export interface TracedDesign {
  title: string;
  /** Such as `docs/detailed-designs/reconciliation/match-card-lines/README.md`. */
  path: string;
}

export interface TracedJourney {
  number: number;
  title: string;
}

export interface TracedPullRequest {
  number: number;
  title: string;
  url: string;
  merged: boolean;
}

/** One L2 and where it stands (L2-035 AC1). */
export interface RequirementTrace {
  id: string;
  title: string;
  l1: { id: string; title: string } | null;
  /** The reason on its Deferred status line; null when it is not deferred. */
  deferred: string | null;
  /** No test names it and it is not deferred (L2-035 AC2). */
  noAcceptanceTest: boolean;
  designs: TracedDesign[];
  journeys: TracedJourney[];
  /** Paths of the test files whose `Traces to:` header names it. */
  tests: string[];
  pullRequests: TracedPullRequest[];
}

/** GET /api/projects/{id}/traceability: every L2, read at the default branch's head. */
export interface Traceability {
  repository: string | null;
  /** The short SHA the repository was read at. */
  commit: string | null;
  requirements: RequirementTrace[];
}

/** GET /api/projects/{id}/decisions: the project's decisions, newest first (L2-054 AC3). */
export interface Decisions {
  repository: string | null;
  decisions: ProjectDecision[];
}

export interface ProjectDecision {
  id: number;
  stage: number;
  stageName: string;
  question: string;
  answer: string;
  rationale: string;
  recordedAt: string;
  /** The commit that recorded the decision in docs/decisions.md; null if none did. */
  commit: string | null;
  commitUrl: string | null;
  /** The ADR the decision also wrote (L2-054 AC2). */
  adr: { path: string; title: string; url: string | null } | null;
}
