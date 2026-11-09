import { hostname } from 'node:os';
import type { WorkerLocation } from './api.ts';
import { ScriptedStageExecutor } from './executors/scripted-executor.ts';
import { HttpHewnApi } from './http-api.ts';
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

const executorName = process.env.HEWN_EXECUTOR ?? 'scripted';
if (executorName !== 'scripted') {
  console.error(`HEWN_EXECUTOR=${executorName} is not available yet; only "scripted" is.`);
  process.exit(2);
}

const failStage = process.env.HEWN_SCRIPTED_FAIL_STAGE;
const executor = new ScriptedStageExecutor({
  stepMs: Number(process.env.HEWN_SCRIPTED_STEP_MS ?? 1000),
  failStage: failStage === undefined ? undefined : Number(failStage),
});

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
