import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes } from 'node:crypto';

/**
 * The worker's part of a run's trace (L2-049 AC2). The lease hands over the W3C traceparent of the run's time in the
 * queue; the worker opens a span for the run under it and one for each model call under that, sends `traceparent` on
 * its calls back to the API so those join too, and exports its spans over OTLP/HTTP as OpenTelemetry JSON.
 */
export type SpanKind = 'internal' | 'client';
export type Attributes = Record<string, string | number | boolean>;

export interface FinishedSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: SpanKind;
  startMs: number;
  endMs: number;
  attributes: Attributes;
  status: 'ok' | 'error';
  statusMessage?: string;
}

export type SpanSink = (span: FinishedSpan) => void;

const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/;

/** The trace and parent span IDs in a W3C traceparent; null when it is absent or malformed. */
export function parseTraceParent(value: string | null | undefined): { traceId: string; spanId: string } | null {
  const match = TRACEPARENT.exec(value ?? '');
  return match ? { traceId: match[1]!, spanId: match[2]! } : null;
}

const hex = (bytes: number) => randomBytes(bytes).toString('hex');

export class Span {
  private ended = false;
  private failure: string | undefined;

  readonly name: string;
  readonly kind: SpanKind;
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId: string | undefined;
  private readonly sink: SpanSink;
  private readonly attributes: Attributes;
  private readonly startMs: number;

  constructor(
    sink: SpanSink,
    name: string,
    kind: SpanKind,
    traceId: string,
    spanId: string,
    parentSpanId: string | undefined,
    attributes: Attributes,
    startMs: number,
  ) {
    this.sink = sink;
    this.name = name;
    this.kind = kind;
    this.traceId = traceId;
    this.spanId = spanId;
    this.parentSpanId = parentSpanId;
    this.attributes = attributes;
    this.startMs = startMs;
  }

  /** What a call made inside this span sends as `traceparent`. */
  get traceParent(): string {
    return `00-${this.traceId}-${this.spanId}-01`;
  }

  fail(message: string): void {
    this.failure = message;
  }

  end(): void {
    if (this.ended) return;
    this.ended = true;
    this.sink({
      traceId: this.traceId,
      spanId: this.spanId,
      ...(this.parentSpanId ? { parentSpanId: this.parentSpanId } : {}),
      name: this.name,
      kind: this.kind,
      startMs: this.startMs,
      endMs: Date.now(),
      attributes: this.attributes,
      status: this.failure === undefined ? 'ok' : 'error',
      ...(this.failure === undefined ? {} : { statusMessage: this.failure }),
    });
  }
}

export interface SpanOptions {
  /** A W3C traceparent to continue, such as the one a lease brings. */
  traceParent?: string | null;
  /** A span of this worker's to nest under; it wins over `traceParent`. */
  parent?: Span;
  kind?: SpanKind;
  attributes?: Attributes;
  startMs?: number;
}

/** Starts spans and hands each, once ended, to the sink; with no sink they are dropped. */
export class Tracer {
  private readonly sink: SpanSink;

  constructor(sink: SpanSink = () => {}) {
    this.sink = sink;
  }

  start(name: string, options: SpanOptions = {}): Span {
    const parent = options.parent
      ? { traceId: options.parent.traceId, spanId: options.parent.spanId }
      : parseTraceParent(options.traceParent);
    return new Span(
      this.sink,
      name,
      options.kind ?? 'internal',
      parent?.traceId ?? hex(16),
      hex(8),
      parent?.spanId,
      options.attributes ?? {},
      options.startMs ?? Date.now(),
    );
  }
}

const current = new AsyncLocalStorage<Span>();

/** Runs `body` with `span` current, so log entries and API calls made inside it, however deep, carry its trace. */
export function withTrace<T>(span: Span, body: () => T): T {
  return current.run(span, body);
}

export function currentSpan(): Span | undefined {
  return current.getStore();
}

const OTLP_KIND: Record<SpanKind, number> = { internal: 1, client: 3 };

function otlpValue(value: string | number | boolean): Record<string, unknown> {
  if (typeof value === 'boolean') return { boolValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { intValue: String(value) } : { doubleValue: value };
  return { stringValue: value };
}

const nanos = (ms: number) => `${BigInt(Math.round(ms)) * 1_000_000n}`;

/**
 * Sends finished spans to `{endpoint}/v1/traces` (OTLP/HTTP with JSON), every two seconds and on `flush`. Export is
 * best effort: a trace viewer that is down never stops a run.
 */
export function otlpExporter(endpoint: string, serviceName: string): { export: SpanSink; flush(): Promise<void> } {
  const url = `${endpoint.replace(/\/+$/, '')}/v1/traces`;
  let pending: FinishedSpan[] = [];
  let timer: NodeJS.Timeout | undefined;

  async function flush(): Promise<void> {
    clearTimeout(timer);
    timer = undefined;
    if (pending.length === 0) return;
    const spans = pending;
    pending = [];
    const body = {
      resourceSpans: [
        {
          resource: { attributes: [{ key: 'service.name', value: { stringValue: serviceName } }] },
          scopeSpans: [
            {
              scope: { name: 'hewn-worker' },
              spans: spans.map((s) => ({
                traceId: s.traceId,
                spanId: s.spanId,
                ...(s.parentSpanId ? { parentSpanId: s.parentSpanId } : {}),
                name: s.name,
                kind: OTLP_KIND[s.kind],
                startTimeUnixNano: nanos(s.startMs),
                endTimeUnixNano: nanos(s.endMs),
                attributes: Object.entries(s.attributes).map(([key, value]) => ({ key, value: otlpValue(value) })),
                status: s.status === 'ok' ? { code: 1 } : { code: 2, message: s.statusMessage ?? '' },
              })),
            },
          ],
        },
      ],
    };
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => undefined);
  }

  return {
    export(span) {
      pending.push(span);
      timer ??= setTimeout(() => void flush(), 2_000).unref();
    },
    flush,
  };
}
