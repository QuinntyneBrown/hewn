import type { LeasedRun } from '../api.ts';
import type { MagicPatterns } from '../magic-patterns/magic-patterns.ts';

/** One agent session for one stage, working in a checked-out copy of the product repository. */
export interface StageAgentTask {
  run: LeasedRun;
  /** The product repository's working copy; the agent reads and writes only here. */
  directory: string;
  /** The Greenlit skill the stage runs, or null when it runs on instructions alone. */
  skill: string | null;
  instructions: string;
  /** Tools the agent may call; everything else is denied. */
  allowedTools: readonly string[];
  /** Magic Patterns, for the design stages (L2-010); the only way an agent designs a screen. */
  magicPatterns?: MagicPatterns;
}

export interface StageAgent {
  run(task: StageAgentTask, signal?: AbortSignal): Promise<void>;
}
