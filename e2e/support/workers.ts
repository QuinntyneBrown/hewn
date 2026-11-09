import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';

/** Must match HEWN_WORKER_TOKEN in eng/Start-E2eApi.ps1. A test-only value, not a secret. */
export const E2E_WORKER_TOKEN = 'e2e-worker-token-not-a-secret';

/**
 * Starts real worker processes against the e2e API. Stages implemented so far run for real against the
 * fake GitHub and the Greenlit fixture; the rest use the scripted executor (three steps of `stepMs` each),
 * so pipeline behaviour stays deterministic.
 */
export function startWorkers(count: number, stepMs: number): () => Promise<void> {
  const main = join(import.meta.dirname, '..', '..', 'worker', 'src', 'main.ts');
  const workers: ChildProcess[] = Array.from({ length: count }, (_, i) =>
    spawn(process.execPath, [main], {
      env: {
        ...process.env,
        HEWN_API_URL: 'http://localhost:5300',
        HEWN_WORKER_TOKEN: E2E_WORKER_TOKEN,
        HEWN_LOCATION: 'Local',
        HEWN_WORKER_NAME: `e2e-worker-${i + 1}`,
        HEWN_EXECUTOR: 'stages',
        HEWN_SCRIPTED_STEP_MS: String(stepMs),
      },
      stdio: process.env['HEWN_E2E_WORKER_LOGS'] ? 'inherit' : 'ignore',
    }),
  );

  return async () => {
    await Promise.all(
      workers.map(
        (worker) =>
          new Promise<void>((resolve) => {
            if (worker.exitCode !== null) return resolve();
            worker.once('exit', () => resolve());
            worker.kill('SIGTERM');
          }),
      ),
    );
  };
}
