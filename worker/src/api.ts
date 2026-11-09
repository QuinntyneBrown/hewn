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
  /** Clone URL of the skill library stage 0 copies from. */
  skillsSource: string;
  /** Designs estimated above this many ideal days are split or descoped (stage 9). */
  descopeThresholdDays: number;
}
export type RunOutcome = { outcome: 'Succeeded' } | { outcome: 'Failed'; error: string };
export class LeaseLostError extends Error {}

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
export interface HewnApi {
  register(registration: WorkerRegistration): Promise<string>;
  lease(workerId: string): Promise<LeasedRun | null>;
  heartbeat(workerId: string, run: LeasedRun): Promise<void>;
  checkpoint(workerId: string, run: LeasedRun, step: number, sha?: string): Promise<void>;
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
  ): Promise<string>;
  openPullRequest(
    workerId: string,
    run: LeasedRun,
    idempotencyKey: string,
    request: { head: string; title: string; body: string },
  ): Promise<PullRequest>;
  pullRequestChecks(workerId: string, run: LeasedRun, number: number): Promise<CheckRun[]>;
  reportBacklog(workerId: string, run: LeasedRun, report: BacklogReport): Promise<void>;
  mergePullRequest(workerId: string, run: LeasedRun, idempotencyKey: string, number: number): Promise<string>;
  protectDefaultBranch(workerId: string, run: LeasedRun, idempotencyKey: string, checks: string[]): Promise<void>;
  log(workerId: string, run: LeasedRun, lines: { level: LogLevel; text: string }[]): Promise<void>;
}
