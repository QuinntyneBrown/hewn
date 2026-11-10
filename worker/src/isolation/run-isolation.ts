import type { RunIsolation } from '../executors/stage-executor.ts';
import type { LogLevel } from '../api.ts';
import { EgressProxy } from './egress-proxy.ts';
import { ContainerSandbox, ProcessSandbox, type CommandSandbox } from './run-sandbox.ts';
import { ToolGate } from './tool-gate.ts';

export interface IsolationSettings {
  /** The hosts a run may reach (L2-042 AC2). */
  allowedHosts: readonly string[];
  /** `process` (default): commands run as processes with a scrubbed environment; `docker`: each in its own container. */
  sandbox: 'process' | 'docker';
  /** The image commands run in under `docker`. */
  image: string;
}

/**
 * Starts a run's isolation: its own egress proxy, a sandbox for its commands and a tool gate per stage. Blocked
 * requests and denied tools land in the run's log, so they show in Mission Control next to the run.
 */
export async function startRunIsolation(
  settings: IsolationSettings,
  runId: string,
  log: (level: LogLevel, text: string) => void,
): Promise<{ isolation: RunIsolation; stop(): Promise<void> }> {
  const proxy = new EgressProxy(settings.allowedHosts, (host) =>
    log('warn', `Egress blocked: ${host} is not an allowed host (L2-042)`),
  );
  const egressProxyUrl = await proxy.start();
  const port = Number(new URL(egressProxyUrl).port);
  const sandbox: CommandSandbox =
    settings.sandbox === 'docker'
      ? new ContainerSandbox({ image: settings.image, runId, proxyPort: port })
      : new ProcessSandbox(egressProxyUrl);

  return {
    isolation: {
      egressProxyUrl,
      sandbox,
      toolGate: (allowed) =>
        new ToolGate(allowed, (tool) =>
          log('error', `Security event: tool ${tool} denied; it is not on this stage's allow list (L2-042)`),
        ),
    },
    stop: () => proxy.stop(),
  };
}
