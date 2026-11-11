// Acceptance Test
// Traces to: L2-049
// Description: The worker continues the trace the lease hands it: a span for the run under the queue's span, a span for
// each model call under the run's, `traceparent` on every call back to the API, and the trace ID on its log entries
// (AC1, AC2); spans export to the OTLP endpoint as OpenTelemetry JSON

import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StageExecutor } from '../src/executors/stage-executor.ts';
import { HttpHewnApi } from '../src/http-api.ts';
import { type FinishedSpan, otlpExporter, Tracer, withTrace } from '../src/tracing.ts';
import { WorkLoop } from '../src/work-loop.ts';
import { FakeHewnApi } from './support/fake-hewn-api.ts';

const registration = { name: 'hewn-local-01', location: 'Local' as const, host: 'test-host', version: '0.1.0' };
const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
const queueSpan = '00f067aa0ba902b7';

let server: Server | undefined;
afterEach(async () => {
  if (server) await new Promise((resolve) => server!.close(resolve));
  server = undefined;
});

async function serve(seen: { url?: string; traceparent?: string; body: unknown }[], status = 204): Promise<string> {
  server = createServer(async (req: IncomingMessage, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    seen.push({
      url: req.url,
      traceparent: req.headers.traceparent as string | undefined,
      body: raw ? JSON.parse(raw) : undefined,
    });
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end();
  });
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

describe('a run’s trace in the worker', () => {
  beforeEach(() =>
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Date'] }),
  );
  afterEach(() => vi.useRealTimers());

  it('spans the run and its model calls under the queue’s span, and carries the trace on calls and logs', async () => {
    const api = new FakeHewnApi();
    const spans: FinishedSpan[] = [];
    const entries: Record<string, unknown>[] = [];
    const stop = new AbortController();
    const executor: StageExecutor = {
      plan: (_run, context) => [
        {
          name: 'write the plan',
          execute: async () => {
            await context.recordModelCall({ model: 'claude-opus-5-5', inputTokens: 1200, outputTokens: 300 });
          },
        },
      ],
    };
    const run = api.enqueueStage(3, 0, 3);
    run.traceParent = `00-${traceId}-${queueSpan}-01`;
    void new WorkLoop({
      api,
      executor,
      registration,
      tracer: new Tracer((span) => spans.push(span)),
      log: (message, fields) => entries.push({ message, ...fields }),
    }).run(stop.signal);

    await vi.advanceTimersByTimeAsync(5_000);
    stop.abort();

    const runSpan = spans.find((s) => s.name === 'Run stage 3')!;
    const modelSpan = spans.find((s) => s.name === 'Model call')!;
    expect(runSpan).toMatchObject({ traceId, parentSpanId: queueSpan, kind: 'internal', status: 'ok' });
    expect(runSpan.attributes).toMatchObject({
      'hewn.run.id': run.runId,
      'hewn.stage': 3,
      'hewn.project.id': 'project-1',
    });
    expect(modelSpan).toMatchObject({ traceId, parentSpanId: runSpan.spanId, kind: 'client' });
    expect(modelSpan.attributes).toMatchObject({
      'gen_ai.request.model': 'claude-opus-5-5',
      'gen_ai.usage.input_tokens': 1200,
      'gen_ai.usage.output_tokens': 300,
    });

    // The calls back to the API were made inside those spans.
    expect(api.traceParents['recordModelCall']).toBe(`00-${traceId}-${modelSpan.spanId}-01`);
    expect(api.traceParents['result']).toBe(`00-${traceId}-${runSpan.spanId}-01`);

    const leased = entries.find((e) => e['message'] === 'Leased run')!;
    expect(leased['traceId']).toBe(traceId);
  });

  it('starts a trace of its own when the lease brings none, and marks a failed run’s span as an error', async () => {
    const api = new FakeHewnApi();
    const spans: FinishedSpan[] = [];
    const stop = new AbortController();
    const executor: StageExecutor = {
      plan: () => [{ name: 'fail', execute: () => Promise.reject(new Error('git push failed')) }],
    };
    api.enqueueStage(3, 0, 3);
    void new WorkLoop({ api, executor, registration, tracer: new Tracer((s) => spans.push(s)), log: () => {} }).run(
      stop.signal,
    );

    await vi.advanceTimersByTimeAsync(5_000);
    stop.abort();

    const runSpan = spans.find((s) => s.name === 'Run stage 3')!;
    expect(runSpan.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(runSpan.parentSpanId).toBeUndefined();
    expect(runSpan).toMatchObject({ status: 'error', statusMessage: 'git push failed' });
  });

  it('sends traceparent on HTTP calls made inside a span', async () => {
    vi.useRealTimers();
    const seen: { url?: string; traceparent?: string; body: unknown }[] = [];
    const api = new HttpHewnApi(await serve(seen), 'tok');
    const run = { runId: 'r1', epoch: 3 } as never;

    await api.heartbeat('wkr_1', run);
    const span = new Tracer(() => {}).start('Run stage 3', { traceParent: `00-${traceId}-${queueSpan}-01` });
    await withTrace(span, () => api.heartbeat('wkr_1', run));

    expect(seen[0]!.traceparent).toBeUndefined();
    expect(seen[1]!.traceparent).toBe(`00-${traceId}-${span.spanId}-01`);
  });

  it('exports finished spans to the OTLP endpoint as OpenTelemetry JSON', async () => {
    vi.useRealTimers();
    const seen: { url?: string; traceparent?: string; body: unknown }[] = [];
    const endpoint = await serve(seen, 200);
    const exporter = otlpExporter(endpoint, 'hewn-worker');
    const tracer = new Tracer(exporter.export);

    tracer
      .start('Run stage 3', { traceParent: `00-${traceId}-${queueSpan}-01`, attributes: { 'hewn.stage': 3 } })
      .end();
    await exporter.flush();

    expect(seen[0]!.url).toBe('/v1/traces');
    const body = seen[0]!.body as {
      resourceSpans: {
        resource: { attributes: { key: string; value: { stringValue: string } }[] };
        scopeSpans: { spans: Record<string, unknown>[] }[];
      }[];
    };
    expect(body.resourceSpans[0]!.resource.attributes).toContainEqual({
      key: 'service.name',
      value: { stringValue: 'hewn-worker' },
    });
    expect(body.resourceSpans[0]!.scopeSpans[0]!.spans[0]).toMatchObject({
      traceId,
      parentSpanId: queueSpan,
      name: 'Run stage 3',
      kind: 1,
      attributes: [{ key: 'hewn.stage', value: { intValue: '3' } }],
    });
  });
});
