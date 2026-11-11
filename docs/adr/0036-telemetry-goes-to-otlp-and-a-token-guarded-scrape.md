# 0036. Telemetry goes to OTLP and a token-guarded Prometheus scrape

- **Status:** Accepted
- **Date:** 2026-11-11
- **Requirements:** L2-049

## Context

L2-049 asks for structured JSON logs carrying run and trace IDs, OpenTelemetry traces that span the API, the queue,
the worker and model calls under one trace ID, and scraped metrics. The observability design left the telemetry
backend `<TO SUPPLY>` and named Serilog for logs. Hewn's endpoints all require authentication except the health
checks (L2-038 AC1). The worker is TypeScript with few dependencies and type-strips its sources at runtime.

## Decision

- **Logs** are one JSON line per entry on standard output, written by a small `ILoggerProvider` in the API and a
  `jsonLog` function in the worker. Both pass text through the redactor. The API adds the current trace and span
  IDs and the fields of the entry's scopes; worker calls that name a run open a scope with its project, direction,
  stage and run IDs. Collecting standard output is left to whatever runs the process.
- **Traces** use OpenTelemetry. A run stores the W3C `traceparent` of the work that queued it. Its lease records a
  "Run queued" span from queueing to lease and hands the worker that span's traceparent. The worker opens a span for
  the run under it, one per model call under that, and sends `traceparent` on every call back to the API. Each next
  stage is queued while the previous one reports its result, so a direction's runs share one trace.
- **Export** is OTLP/HTTP, set with the standard `OTEL_EXPORTER_OTLP_ENDPOINT`; with none set, nothing is exported.
  The worker writes OTLP JSON itself instead of taking the OpenTelemetry JS SDK.
- **Metrics** are on the meter `Hewn`, scraped by Prometheus at `/metrics`. The scrape needs `HEWN_METRICS_TOKEN` as
  a bearer token; with no token configured, there is no endpoint. Queue depth and active workers are read from the
  database at each scrape.
- **Locally**, `eng/Start-Observability.ps1` starts Jaeger (the trace viewer, OTLP on 4318) and Prometheus with
  Docker Compose, and `-Observability` on the API and worker scripts points them at it.

## Alternatives

- **Serilog.** A formatter and an enricher do what about 150 lines of provider do, but add packages to keep up to
  date, for no field the provider lacks.
- **The OpenTelemetry JS SDK in the worker.** It needs five packages and its context manager for what is a span
  type, an `AsyncLocalStorage` and an OTLP JSON body.
- **One trace per run, linked to the previous stage's.** Smaller traces, but the operator follows a direction by
  hopping between them; one trace shows the whole direction on one timeline.
- **An anonymous `/metrics`.** Metrics name stages and models and show spend; they are not public the way liveness
  is.

## Consequences

- A long direction is one large trace; a trace viewer that limits spans per trace will truncate it.
- The worker's OTLP body has to follow the OTLP JSON encoding by hand; a test checks its shape.
- Prometheus has to be given the scrape token, and the local stack uses a fixed local value.
- The Prometheus exporter for ASP.NET Core is a beta package.
