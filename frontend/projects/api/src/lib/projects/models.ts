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
}

export interface SubmitProductDirectionRequest {
  name: string;
  idea: string;
  stackPreference: string | null;
  repositoryUrl: string | null;
  budgetUsd: number;
}

export interface SubmitProductDirectionResult {
  projectId: string;
  directionId: string;
}
