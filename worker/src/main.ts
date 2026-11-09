import { hostname } from 'node:os';
import type { WorkerLocation } from './api.ts';
import { ScriptedStageAgent } from './agents/scripted-agent.ts';
import { BootstrapStageExecutor } from './executors/bootstrap-executor.ts';
import { DOCUMENT_STAGES, DocumentStageExecutor } from './executors/document-executor.ts';
import { ScaffoldStageExecutor } from './executors/scaffold-executor.ts';
import { IncrementStageExecutor } from './executors/increment-executor.ts';
import { ScriptedTestGate } from './increments/scripted-gate.ts';
import { dotnetAngularTemplate } from './scaffold/dotnet-angular-template.ts';
import { ScriptedStageExecutor } from './executors/scripted-executor.ts';
import { StageRouter, type StageExecutor } from './executors/stage-executor.ts';
import { HttpHewnApi } from './http-api.ts';
import { McpMagicPatterns } from './magic-patterns/magic-patterns.ts';
import { WorkLoop } from './work-loop.ts';

const VERSION = '0.1.0';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} is required.`);
    process.exit(2);
  }
  return value;
}

const apiUrl = required('HEWN_API_URL');
const token = required('HEWN_WORKER_TOKEN');
const location = (process.env.HEWN_LOCATION ?? 'Local') as WorkerLocation;
if (location !== 'Local' && location !== 'Cloud') {
  console.error('HEWN_LOCATION must be Local or Cloud.');
  process.exit(2);
}

// `stages` runs the stages implemented so far for real and scripts the rest; `scripted` scripts every stage.
const executorName = process.env.HEWN_EXECUTOR ?? 'stages';
if (executorName !== 'scripted' && executorName !== 'stages') {
  console.error('HEWN_EXECUTOR must be "stages" or "scripted".');
  process.exit(2);
}

const failStage = process.env.HEWN_SCRIPTED_FAIL_STAGE;
const pullRequestStage = process.env.HEWN_SCRIPTED_PULL_REQUEST_STAGE;
const scripted = new ScriptedStageExecutor({
  stepMs: Number(process.env.HEWN_SCRIPTED_STEP_MS ?? 1000),
  logLines: Number(process.env.HEWN_SCRIPTED_LOG_LINES ?? 0),
  modelCalls: Number(process.env.HEWN_SCRIPTED_MODEL_CALLS ?? 0),
  callTokens: Number(process.env.HEWN_SCRIPTED_CALL_TOKENS ?? 10_000),
  failStage: failStage === undefined ? undefined : Number(failStage),
  failTimes:
    process.env.HEWN_SCRIPTED_FAIL_TIMES === undefined ? undefined : Number(process.env.HEWN_SCRIPTED_FAIL_TIMES),
  failReason: process.env.HEWN_SCRIPTED_FAIL_REASON,
  pullRequestStage: pullRequestStage === undefined ? undefined : Number(pullRequestStage),
});
// Magic Patterns' MCP endpoint and credential; without them the design stages fail as not configured.
const magicPatternsUrl = process.env.HEWN_MAGIC_PATTERNS_URL;
const magicPatternsToken = process.env.HEWN_MAGIC_PATTERNS_TOKEN;
const pollMs = Number(process.env.HEWN_MAGIC_PATTERNS_POLL_MS ?? 60_000);
const magicPatterns =
  magicPatternsUrl && magicPatternsToken
    ? () => new McpMagicPatterns(magicPatternsUrl, magicPatternsToken, { pollMs })
    : undefined;

// Only the scripted agent exists so far; the Claude Agent SDK agent arrives with run isolation.
const documents = new DocumentStageExecutor(new ScriptedStageAgent(), magicPatterns);
// Templates for stacks other than the default are still to be supplied (scaffold-solution design).
const scaffold = new ScaffoldStageExecutor([dotnetAngularTemplate], {
  pollMs: Number(process.env.HEWN_CHECK_POLL_MS ?? 30_000),
});
// HEWN_GATE=scripted pairs the scripted agent with a stand-in gate in the e2e stack; otherwise the stack's own commands run.
const gateName = process.env.HEWN_GATE ?? 'stack';
if (gateName !== 'stack' && gateName !== 'scripted') {
  console.error('HEWN_GATE must be "stack" or "scripted".');
  process.exit(2);
}
// HEWN_SCRIPTED_BLOCK_INCREMENT: an increment title the scripted agent never implements, so it blocks (e2e, videos).
const blockIncrement = process.env['HEWN_SCRIPTED_BLOCK_INCREMENT'];
const increments = new IncrementStageExecutor(
  new ScriptedStageAgent(undefined, blockIncrement ? { blockIncrement } : {}),
  [dotnetAngularTemplate],
  {
    pollMs: Number(process.env.HEWN_CHECK_POLL_MS ?? 30_000),
    ...(gateName === 'scripted' ? { gate: () => new ScriptedTestGate() } : {}),
  },
);
const executor: StageExecutor =
  executorName === 'scripted'
    ? scripted
    : new StageRouter(
        new Map<number, StageExecutor>([
          [0, new BootstrapStageExecutor()],
          [6, scaffold],
          [10, increments],
          ...[...DOCUMENT_STAGES.keys()].map((stage) => [stage, documents] as const),
        ]),
        scripted,
      );

const stop = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => stop.abort());

const log = (message: string, fields?: Record<string, unknown>) =>
  console.log(JSON.stringify({ at: new Date().toISOString(), message, ...fields }));

await new WorkLoop({
  api: new HttpHewnApi(apiUrl, token),
  executor,
  registration: { name: process.env.HEWN_WORKER_NAME ?? hostname(), location, host: hostname(), version: VERSION },
  log,
}).run(stop.signal);
