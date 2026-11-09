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
  project: { id: string; name: string; idea: string; stackPreference: string | null; repository: string | null };
}
export type RunOutcome = { outcome: 'Succeeded' } | { outcome: 'Failed'; error: string };
export class LeaseLostError extends Error {}
export interface HewnApi {
  register(registration: WorkerRegistration): Promise<string>;
  lease(workerId: string): Promise<LeasedRun | null>;
  heartbeat(workerId: string, run: LeasedRun): Promise<void>;
  checkpoint(workerId: string, run: LeasedRun, step: number, sha?: string): Promise<void>;
  result(workerId: string, run: LeasedRun, outcome: RunOutcome): Promise<void>;
}
