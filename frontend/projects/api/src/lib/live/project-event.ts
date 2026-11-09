/** A stored, client-visible change to a project, numbered one more than the last for that project. */
export interface ProjectEvent {
  projectId: string;
  sequence: number;
  type: 'DirectionQueued' | 'StageChanged' | 'DirectionChanged' | 'ProjectChanged' | string;
  payload: Record<string, unknown>;
  occurredAt: string;
}
