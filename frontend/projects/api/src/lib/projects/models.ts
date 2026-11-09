export type StageStatus =
  'Pending' | 'Running' | 'Paused' | 'Succeeded' | 'Failed' | 'Skipped' | 'Cancelled';

export type DirectionStatus = 'Queued' | 'Running' | 'Paused' | 'Complete' | 'Cancelled';

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
}

export interface SubmitProductDirectionRequest {
  name: string;
  idea: string;
  stackPreference: string | null;
  repositoryUrl: string | null;
  budgetUsd: number;
}

/** What every new direction starts with, set by an Owner in Settings (L2-053 AC1). */
export interface DirectionDefaults {
  defaultBudgetUsd: number;
}

/** A project in the list; a feature for one whose first direction isn't Complete queues behind it. */
export interface ProjectSummary {
  id: string;
  name: string;
  repository: string | null;
  status: ProjectStatus;
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
