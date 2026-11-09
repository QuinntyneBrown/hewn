import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';

/** Must match HEWN_WORKER_TOKEN in eng/Start-E2eApi.ps1. A test-only value, not a secret. */
export const E2E_WORKER_TOKEN = 'e2e-worker-token-not-a-secret';

/** The fake Magic Patterns MCP server the e2e workers design with. Test-only values. */
const MAGIC_PATTERNS_PORT = 5310;
const MAGIC_PATTERNS_TOKEN = 'e2e-magic-patterns-token-not-a-secret';

/**
 * Starts real worker processes against the e2e API. Stages implemented so far run for real against the
 * fake GitHub, the Greenlit fixture and a fake Magic Patterns MCP server; the rest use the scripted executor (three steps of `stepMs` each),
 * so pipeline behaviour stays deterministic.
 */
export function startWorkers(count: number, stepMs: number): () => Promise<void> {
  const src = join(import.meta.dirname, '..', '..', 'worker', 'src');
  const output = process.env['HEWN_E2E_WORKER_LOGS'] ? 'inherit' : 'ignore';
  const magicPatterns = spawn(process.execPath, [join(src, 'magic-patterns', 'fake-server-main.ts')], {
    env: { ...process.env, PORT: String(MAGIC_PATTERNS_PORT), MAGIC_PATTERNS_TOKEN },
    stdio: output,
  });
  const main = join(src, 'main.ts');
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
        HEWN_MAGIC_PATTERNS_URL: `http://127.0.0.1:${MAGIC_PATTERNS_PORT}/mcp`,
        HEWN_MAGIC_PATTERNS_TOKEN: MAGIC_PATTERNS_TOKEN,
        HEWN_MAGIC_PATTERNS_POLL_MS: '200',
        HEWN_CHECK_POLL_MS: '200',
      },
      stdio: output,
    }),
  );

  return async () => {
    await Promise.all(
      [...workers, magicPatterns].map(
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
