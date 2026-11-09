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
}
export type RunOutcome = { outcome: 'Succeeded' } | { outcome: 'Failed'; error: string };
export class LeaseLostError extends Error {}

export interface CommitFile {
  path: string;
  content: Buffer;
}

export type LogLevel = 'info' | 'warn' | 'error';
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
  ): Promise<string>;
  log(workerId: string, run: LeasedRun, lines: { level: LogLevel; text: string }[]): Promise<void>;
}
