/** A tool the stage doesn't allow; the agent's call fails and nothing runs. */
export class ToolDeniedError extends Error {
  readonly tool: string;

  constructor(tool: string) {
    super(`The ${tool} tool is not on this stage's allow list.`);
    this.tool = tool;
  }
}

/**
 * Every agent tool call passes this gate (L2-042 AC3). A tool the stage doesn't allow is denied and reported as a
 * security event. No tool reaches Hewn's configuration, budgets, secrets or another project (AC4): none is offered.
 */
export class ToolGate {
  private readonly allowed: ReadonlySet<string>;

  private readonly onDenied: (tool: string) => void;

  constructor(allowed: readonly string[], onDenied: (tool: string) => void = () => {}) {
    this.allowed = new Set(allowed);
    this.onDenied = onDenied;
  }

  allows(tool: string): boolean {
    return this.allowed.has(tool);
  }

  /** Throws {@link ToolDeniedError}, after reporting it, unless the stage allows the tool. */
  require(tool: string): void {
    if (this.allowed.has(tool)) return;
    this.onDenied(tool);
    throw new ToolDeniedError(tool);
  }
}
