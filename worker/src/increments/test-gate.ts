import { spawn } from 'node:child_process';
import { ProcessSandbox, type CommandSandbox } from '../isolation/run-sandbox.ts';

/** One suite of a stack's gate; the acceptance suite also runs alone on the new test files for the red run. */
export interface GateCommand {
  suite: string;
  command: string;
  args: readonly string[];
  /** Working directory relative to the repository root. */
  cwd?: string;
  /** The suite that runs acceptance tests; the red run passes it the new test files. */
  acceptance?: boolean;
  /** Prefix stripped from test file paths before they are passed to the acceptance suite (its cwd). */
  stripPrefix?: string;
  /** Commands run first in the same directory, such as `npm install`; a failure fails the suite. */
  before?: readonly { command: string; args: readonly string[] }[];
}

export interface Counts {
  passed: number;
  failed: number;
}

export interface SuiteResult {
  suite: string;
  commandLine: string;
  passed: boolean;
  counts: Counts;
  output: string;
}

export interface GateResult {
  passed: boolean;
  suites: SuiteResult[];
  /** "{suite}: {test}" for each failing test found in the output, or the suite's exit when none is named. */
  failing: string[];
}

/**
 * L2-022 AC1: the fixed gate that decides when an increment is done, never the model. `full` runs every suite;
 * `acceptance` runs only the new acceptance tests, for the red run (L2-021 AC3).
 */
export interface TestGate {
  acceptance(directory: string, testFiles: string[], signal?: AbortSignal): Promise<SuiteResult>;
  full(directory: string, testFiles: string[], signal?: AbortSignal): Promise<GateResult>;
}

const OUTPUT_LIMIT = 200_000;

export class CommandTestGate implements TestGate {
  private readonly commands: readonly GateCommand[];
  /** Starts each command; by default as a process that sees no credential (L2-042 AC1). */
  private readonly sandbox: CommandSandbox;

  constructor(commands: readonly GateCommand[], sandbox: CommandSandbox = new ProcessSandbox('')) {
    this.commands = commands;
    this.sandbox = sandbox;
  }

  async acceptance(directory: string, testFiles: string[], signal?: AbortSignal): Promise<SuiteResult> {
    const command = this.commands.find((c) => c.acceptance);
    if (!command) throw new Error('The stack has no acceptance suite');
    const files = testFiles
      .filter((f) => !command.stripPrefix || f.startsWith(command.stripPrefix))
      .map((f) => (command.stripPrefix ? f.slice(command.stripPrefix.length) : f));
    return run(this.sandbox, directory, command, files, signal);
  }

  async full(directory: string, _testFiles: string[], signal?: AbortSignal): Promise<GateResult> {
    const suites: SuiteResult[] = [];
    for (const command of this.commands) suites.push(await run(this.sandbox, directory, command, [], signal));
    return {
      passed: suites.every((s) => s.passed),
      suites,
      failing: suites.filter((s) => !s.passed).flatMap(failingTests),
    };
  }
}

/** Pass and fail counts from dotnet test, vitest or Playwright output; zero when none are printed. */
export function parseCounts(output: string): Counts {
  const last = (pattern: RegExp) => {
    const all = [...output.matchAll(pattern)];
    return all.length ? Number(all.at(-1)![1]) : 0;
  };
  const dotnetPassed = last(/Passed:\s+(\d+)/g);
  const dotnetFailed = last(/Failed:\s+(\d+)/g);
  if (/Passed:\s+\d+/.test(output)) return { passed: dotnetPassed, failed: dotnetFailed };
  // vitest prints "Tests  1 failed | 7 passed (8)" after "Test Files …"; Playwright prints "5 passed" and "2 failed".
  const testsLine = /^\s*Tests\s+(.+)$/m.exec(output)?.[1];
  const scope = testsLine ?? output;
  return { passed: lastIn(scope, /(\d+) passed/g), failed: lastIn(scope, /(\d+) failed/g) };
}

function lastIn(text: string, pattern: RegExp): number {
  const all = [...text.matchAll(pattern)];
  return all.length ? Number(all.at(-1)![1]) : 0;
}

function failingTests(result: SuiteResult): string[] {
  const named = result.output
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^(✘|×|✗|FAIL\b|Failed\s+\S)/.test(l))
    .slice(0, 20);
  return named.length ? named.map((l) => `${result.suite}: ${l}`) : [`${result.suite}: ${result.commandLine} failed`];
}

async function run(
  sandbox: CommandSandbox,
  directory: string,
  command: GateCommand,
  extra: string[],
  signal?: AbortSignal,
): Promise<SuiteResult> {
  for (const setup of command.before ?? []) {
    const prepared = await spawnOnce(
      sandbox,
      directory,
      { ...command, command: setup.command, args: setup.args },
      [],
      signal,
    );
    if (!prepared.passed) return { ...prepared, suite: command.suite };
  }
  return spawnOnce(sandbox, directory, command, extra, signal);
}

function spawnOnce(
  sandbox: CommandSandbox,
  directory: string,
  command: GateCommand,
  extra: string[],
  signal?: AbortSignal,
): Promise<SuiteResult> {
  const args = [...command.args, ...extra];
  const commandLine = [command.command, ...command.args].join(' ');
  return new Promise((resolve) => {
    let output = '';
    // L2-042 AC1: the command sees no credential, and runs in its own container when the worker is set to.
    const prepared = sandbox.prepare(directory, {
      command: command.command,
      args,
      ...(command.cwd ? { cwd: command.cwd } : {}),
    });
    const child = spawn(prepared.command, prepared.args, { cwd: prepared.cwd, env: prepared.env, signal });
    const collect = (chunk: Buffer) => {
      if (output.length < OUTPUT_LIMIT) output += chunk.toString('utf8');
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    const finish = (code: number | null, error?: Error) => {
      if (error) output += `\n${error.message}`;
      const counts = parseCounts(output);
      resolve({ suite: command.suite, commandLine, passed: code === 0 && !error, counts, output });
    };
    child.on('error', (error) => finish(null, error));
    child.on('close', (code) => finish(code));
  });
}
