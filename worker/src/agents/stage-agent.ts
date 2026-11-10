import type { ToolGate } from '../isolation/tool-gate.ts';
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
  /** Checks each tool call against `allowedTools`, denying and logging the rest (L2-042 AC3). */
  gate?: ToolGate;
  /** The run's egress proxy; the agent's network requests go through it (L2-042 AC2). */
  egressProxyUrl?: string;
  /** Stage 10: which part of which increment this session works on. */
  increment?: IncrementTask;
}

export interface IncrementTask {
  number: number;
  title: string;
  slug: string;
  l2Ids: string[];
  designs: string[];
  phase: 'tests' | 'implement' | 'video' | 'resolve';
  /** Failing tests or checks from the last gate or CI run, for `implement`. */
  failing?: string[];
  /** Paths changed both on the branch and on the default branch, for `resolve`. */
  conflicts?: string[];
}

export interface StageAgent {
  run(task: StageAgentTask, signal?: AbortSignal): Promise<void>;
}
