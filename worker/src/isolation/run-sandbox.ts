import { join } from 'node:path';

/** Variables a run's commands may see from the worker: none of them holds a credential. */
const PASSED_THROUGH = ['PATH', 'LANG', 'TZ', 'TERM'] as const;

/**
 * The environment for a command the worker runs in a run's workspace (L2-042 AC1, AC2): the workspace as its home,
 * the run's egress proxy as its only route out, and none of the worker's variables, so never the worker token, a
 * Magic Patterns token or any other credential the worker holds.
 */
export function commandEnvironment(
  workspace: string,
  proxyUrl: string,
  worker: Record<string, string | undefined> = process.env,
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const name of PASSED_THROUGH) {
    const value = worker[name];
    if (value !== undefined) env[name] = value;
  }

  if (!proxyUrl) return { ...env, HOME: workspace, CI: '1' };
  return {
    ...env,
    HOME: workspace,
    CI: '1',
    HTTPS_PROXY: proxyUrl,
    HTTP_PROXY: proxyUrl,
    https_proxy: proxyUrl,
    http_proxy: proxyUrl,
    NO_PROXY: '',
  };
}

export interface ContainerSettings {
  /** The image commands run in (the stack's toolchain). */
  image: string;
  runId: string;
  /** The run's workspace on the host; the only host path the container sees. */
  workspace: string;
  /** The run's egress proxy port on the worker host. */
  proxyPort: number;
}

/**
 * With `HEWN_SANDBOX=docker`, each command runs in its own container (L2-042 AC1): only the run's workspace is
 * mounted, every Linux capability is dropped, it can't gain privileges, it runs as an unprivileged user, and it sees
 * no worker variable, only its proxy settings.
 */
export function containerCommand(
  settings: ContainerSettings,
  run: { command: string; args: readonly string[]; cwd?: string },
): { command: string; args: string[] } {
  const proxy = `http://host.docker.internal:${settings.proxyPort}`;
  return {
    command: 'docker',
    args: [
      'run',
      '--rm',
      '--name',
      `hewn-${settings.runId}-${run.command.replace(/[^a-zA-Z0-9_.-]/g, '')}`,
      '--cap-drop',
      'ALL',
      '--security-opt',
      'no-new-privileges',
      '--user',
      '1000:1000',
      '--add-host',
      'host.docker.internal:host-gateway',
      '-v',
      `${settings.workspace}:/workspace`,
      '-w',
      run.cwd ? `/workspace/${run.cwd}` : '/workspace',
      '-e',
      'HOME=/workspace',
      '-e',
      'CI=1',
      '-e',
      `HTTPS_PROXY=${proxy}`,
      '-e',
      `HTTP_PROXY=${proxy}`,
      settings.image,
      run.command,
      ...run.args,
    ],
  };
}

/** A command ready to spawn: what to run, where, and with which environment. */
export interface PreparedCommand {
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
}

/** How a run's commands are started: as processes with a scrubbed environment, or each in its own container. */
export interface CommandSandbox {
  prepare(directory: string, run: { command: string; args: readonly string[]; cwd?: string }): PreparedCommand;
}

/** Commands as processes in the workspace, seeing no credential and reaching the network through the run's proxy. */
export class ProcessSandbox implements CommandSandbox {
  private readonly proxyUrl: string;
  private readonly worker: Record<string, string | undefined>;

  constructor(proxyUrl: string, worker: Record<string, string | undefined> = process.env) {
    this.proxyUrl = proxyUrl;
    this.worker = worker;
  }

  prepare(directory: string, run: { command: string; args: readonly string[]; cwd?: string }): PreparedCommand {
    return {
      command: run.command,
      args: [...run.args],
      cwd: join(directory, run.cwd ?? '.'),
      env: commandEnvironment(directory, this.proxyUrl, this.worker),
    };
  }
}

/** Commands each in their own container (`HEWN_SANDBOX=docker`); the docker CLI itself gets only what it needs. */
export class ContainerSandbox implements CommandSandbox {
  private readonly settings: Omit<ContainerSettings, 'workspace'>;
  private readonly worker: Record<string, string | undefined>;

  constructor(
    settings: Omit<ContainerSettings, 'workspace'>,
    worker: Record<string, string | undefined> = process.env,
  ) {
    this.settings = settings;
    this.worker = worker;
  }

  prepare(directory: string, run: { command: string; args: readonly string[]; cwd?: string }): PreparedCommand {
    const { command, args } = containerCommand({ ...this.settings, workspace: directory }, run);
    const env: Record<string, string> = {};
    for (const name of ['PATH', 'HOME', 'DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_CONFIG']) {
      const value = this.worker[name];
      if (value !== undefined) env[name] = value;
    }
    return { command, args, cwd: directory, env };
  }
}
