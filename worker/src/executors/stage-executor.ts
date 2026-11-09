import type { LeasedRun } from '../api.ts';
export interface StageStep {
  name: string;
  execute(signal: AbortSignal): Promise<void>;
}
export interface StageExecutor {
  plan(run: LeasedRun): StageStep[];
}
