# Observability and health checks

## Overview

Operators need to see what Hewn is doing and whether it is healthy. Every server and worker log entry is structured JSON with timestamp, level and message, plus project, direction, stage, run and trace IDs where they apply. OpenTelemetry traces follow a run across the API, the queue, the worker and its model calls under one trace ID. Metrics cover stage duration, stage success rate, queue depth, active workers, event latency, tokens and spend.

Two health endpoints serve load balancers and orchestrators. `/health/live` returns 200 while the process runs. `/health/ready` returns 200 only when the database and the SignalR backplane are reachable, and 503 otherwise. Both are anonymous (L2-038 AC1).

Terms used in this design:

- **trace** — tree of timed spans sharing one trace ID
- **liveness** — whether the process is running
- **readiness** — whether the process can serve requests, meaning its dependencies are reachable

## Description

The slice is cross-cutting instrumentation plus two endpoints.

- **`JsonLoggerProvider`** (API) and **`jsonLog`** (worker) — one JSON line per entry on standard output: `timestamp`, `level`, `message`, then the entry's fields. The API adds `category`, `traceId` and `spanId`, and every field of the entry's scopes; `RunLogScopeFilter` opens a scope with `projectId`, `directionId`, `stage` and `runId` on each worker call that names a run. The worker adds the same IDs and `traceId` to every entry while a run executes. Text passes the redactor first (L2-040).
- **`RunTracing`** (API) — OpenTelemetry tracing with ASP.NET Core and HttpClient instrumentation. A `Run` keeps the `TraceParent` of the work that queued it. Its lease records a "Run queued" span, from queueing to lease, and returns that span's traceparent to the worker. Each next stage is queued while the previous one reports its result, so a direction's runs share one trace (ADR 0036).
- **`Tracer`** (worker) — a span for the run under the lease's traceparent, a client span per model call under it with the model and token counts, and `traceparent` on every call back to the API, carried by `AsyncLocalStorage`. Spans export as OTLP JSON.
- **`HewnMetrics`** — the meter `Hewn`: `hewn_stage_duration_seconds` (histogram) and `hewn_stage_runs_total` by stage and outcome (success rate is succeeded over all), `hewn_queue_depth` and `hewn_workers_active` read from the database at each scrape, `hewn_event_latency_seconds` from an event being stored to its being sent, `hewn_model_tokens_total` by model and kind (input or output) and `hewn_spend_usd_total` by model. Prometheus scrapes `/metrics` with `HEWN_METRICS_TOKEN` as a bearer token; with none configured there is no endpoint.
- **`Health checks`** — ASP.NET Core health checks: `/health/live` with no checks; `/health/ready` with `DatabaseReadinessCheck` (a new SQLite connection that never creates the file, then `SELECT 1`) and `BackplaneReadinessCheck` (a message to an empty group through the hub's lifetime manager), returning 503 when either fails. The body names each check and its status, never an error (ADR 0035).
- **`Telemetry backend`** — anything that takes OTLP/HTTP and scrapes Prometheus, set with `OTEL_EXPORTER_OTLP_ENDPOINT`. Locally, `eng/Start-Observability.ps1` starts Jaeger (the trace viewer) and Prometheus with Docker Compose (ADR 0036).

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines the level-1 (L1) requirement cited beside it. The text is copied from `docs/specs/L2.md`.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-049` | `L1-022` | **Logs, metrics and traces.**<br>1. Given any server or worker log entry, when it is written, then it is structured JSON with timestamp, level, message, and project, direction, stage, run and trace IDs where they apply.<br>2. Given a run, when it executes, then OpenTelemetry traces span the API, the queue, the worker and model calls under one trace ID.<br>3. Given the platform, when metrics are scraped, then stage duration, stage success rate, queue depth, active workers, event latency, tokens and spend are exported. |
| `L2-051` | `L1-022` | **Health checks.**<br>1. Given the server, when `/health/live` is requested, then it returns 200 while the process is running.<br>2. Given the server, when `/health/ready` is requested, then it returns 200 only when the database and SignalR backplane are reachable, and 503 otherwise. |

## Diagrams

### System context

Hewn sends traces over OTLP and is scraped for metrics; logs go to standard output.

![C4 system context for observability and health checks](diagrams/c4-context.png)

### Containers

The API and worker both export; the run's trace context travels with the lease so their spans join.

![C4 container view for observability and health checks](diagrams/c4-container.png)

### Components

Readiness depends on exactly the database and the backplane, as L2-051 AC2 requires.

![C4 component view for observability and health checks](diagrams/c4-component.png)

### Class structure

`TraceParent` stored on `Run` is what links API, queue and worker spans under one trace ID.

![Class diagram for observability and health checks](diagrams/class-structure.png)

### Behaviour — trace a run

One trace ID spans the API, the queue, the worker and model calls (L2-049 AC2); every log line carries it (AC1).

![Sequence diagram: trace a run](diagrams/sequence-trace-a-run.png)

### Behaviour — answer health probes

Liveness is 200 while running (L2-051 AC1); readiness is 200 only with database and backplane reachable, else 503 (AC2).

![Sequence diagram: answer health probes](diagrams/sequence-health.png)

## Decisions made while building (journey 36)

- The telemetry backend is anything that speaks OTLP/HTTP and Prometheus; Jaeger and Prometheus run locally with Docker Compose (ADR 0036).
- Logs are written by a small JSON logger provider rather than Serilog, and the worker writes OTLP JSON itself rather than taking the OpenTelemetry JS SDK (ADR 0036).
- A direction's runs share one trace: each next stage is queued inside the previous stage's result request.
- `/metrics` needs the scrape token; with none configured it does not exist.
- Readiness checks the backplane by sending through the hub's lifetime manager, which is in-process today (ADR 0035). The database is SQLite.
