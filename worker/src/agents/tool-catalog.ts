/**
 * Every tool any stage's agent can be given (L2-042 AC4): files in the workspace, a shell in the run's container,
 * skills, and the Magic Patterns design tools. None changes Hewn configuration, budgets, secrets or another project,
 * and there is no GitHub tool: pull requests are steps the worker host takes through the API's broker. A stage gets
 * a subset, and its gate denies anything else (AC3).
 */
/** Document stages read and write files only; no shell, network or git (agent-isolation design). */
export const FILE_TOOLS = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Skill'] as const;

export const MAGIC_PATTERNS_TOOLS = [
  'mcp__magic-patterns__create_design',
  'mcp__magic-patterns__send_prompt',
  'mcp__magic-patterns__get_design_status',
  'mcp__magic-patterns__read_artifact_files',
  'mcp__magic-patterns__write_artifact_files',
  'mcp__magic-patterns__list_design_systems',
] as const;

/** Increments write code and run its tests in the run's container. */
export const INCREMENT_TOOLS = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'] as const;

/** Each kind of stage's tools. */
export const STAGE_TOOLS = {
  document: FILE_TOOLS,
  design: [...FILE_TOOLS, ...MAGIC_PATTERNS_TOOLS],
  increment: INCREMENT_TOOLS,
} as const satisfies Record<string, readonly string[]>;

export const TOOL_CATALOG: readonly string[] = [...new Set(Object.values(STAGE_TOOLS).flat())];
