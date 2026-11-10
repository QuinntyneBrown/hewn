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
export interface WorkerOptions {
  /** `stages` runs each stage's real executor; `scripted` runs three timed steps for every stage. */
  executor?: 'stages' | 'scripted';
  /** Log lines a scripted stage writes in its main step. */
  logLines?: number;
  /** Model calls a scripted stage makes in its main step, and input tokens per call (output is a tenth). */
  modelCalls?: number;
  callTokens?: number;
  /** Stage whose scripted main step opens a pull request on hewn/scaffold (stage 6 allows it). */
  pullRequestStage?: number;
  /** Stage whose scripted main step fails, how many times per project before it passes, and with what reason. */
  fail?: { stage: number; times: number; reason: string };
  /** An increment title the scripted agent never implements, so that increment blocks (L2-022 AC2). */
  blockIncrement?: string;
  /** How long the scripted agent takes over each stage 10 session, so increments can be watched. */
  incrementMs?: number;
  /** Where the workers say they run; the same worker, configured differently (L2-027). Local by default. */
  location?: 'Local' | 'Cloud';
  /** Worker names are `{namePrefix}-1`, `-2`…; `e2e-worker` by default. */
  namePrefix?: string;
  /** A stage in which the agent tries a tool and a host it may not use, so both show refused in the log (L2-042). */
  probeStage?: number;
}

export function startWorkers(count: number, stepMs: number, options: WorkerOptions = {}): () => Promise<void> {
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
        HEWN_LOCATION: options.location ?? 'Local',
        HEWN_WORKER_NAME: `${options.namePrefix ?? 'e2e-worker'}-${i + 1}`,
        HEWN_EXECUTOR: options.executor ?? 'stages',
        HEWN_SCRIPTED_STEP_MS: String(stepMs),
        HEWN_SCRIPTED_LOG_LINES: String(options.logLines ?? 0),
        HEWN_SCRIPTED_MODEL_CALLS: String(options.modelCalls ?? 0),
        HEWN_SCRIPTED_CALL_TOKENS: String(options.callTokens ?? 10_000),
        ...(options.pullRequestStage === undefined
          ? {}
          : { HEWN_SCRIPTED_PULL_REQUEST_STAGE: String(options.pullRequestStage) }),
        ...(options.fail === undefined
          ? {}
          : {
              HEWN_SCRIPTED_FAIL_STAGE: String(options.fail.stage),
              HEWN_SCRIPTED_FAIL_TIMES: String(options.fail.times),
              HEWN_SCRIPTED_FAIL_REASON: options.fail.reason,
            }),
        ...(options.incrementMs === undefined ? {} : { HEWN_SCRIPTED_INCREMENT_MS: String(options.incrementMs) }),
        ...(options.blockIncrement === undefined ? {} : { HEWN_SCRIPTED_BLOCK_INCREMENT: options.blockIncrement }),
        ...(options.probeStage === undefined ? {} : { HEWN_SCRIPTED_PROBE_STAGE: String(options.probeStage) }),
        HEWN_MAGIC_PATTERNS_URL: `http://127.0.0.1:${MAGIC_PATTERNS_PORT}/mcp`,
        HEWN_MAGIC_PATTERNS_TOKEN: MAGIC_PATTERNS_TOKEN,
        HEWN_MAGIC_PATTERNS_POLL_MS: '200',
        HEWN_CHECK_POLL_MS: '200',
        HEWN_GATE: 'scripted',
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
