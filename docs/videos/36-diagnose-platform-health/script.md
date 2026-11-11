# 36 · Diagnose platform health

This is journey thirty six of Hewn, the software factory: diagnose platform health. It is for the operator who runs Hewn. There is no new page in Mission Control. Instead there are two health endpoints, structured logs, traces and metrics. This video shows each one working against a real API and worker, with Jaeger and Prometheus running in Docker Compose.

## The goal

The requirements come in two parts. Health checks: live answers 200 while the process runs, and ready answers 200 only when the database and the SignalR backplane are reachable, and 503 otherwise. And logs, traces and metrics: every log entry is JSON with the IDs that apply, one trace follows a run through the API, the queue, the worker and its model calls, and a scrape exports stage duration, success rate, queue depth, active workers, event latency, tokens and spend.

## Health checks

Here are both endpoints with the database in place. Live is healthy, with no checks. Ready names its two checks, database and backplane, both healthy, with a 200.

Then the database file is moved away. Live still answers 200, because the process is running. Ready answers 503, and names the database as unhealthy. It never writes the error itself, which could hold a connection string. When the file comes back, ready is 200 again.

The database check opens a new connection outside the pool, in read write mode, so SQLite never creates a missing file, and runs select one. The backplane check sends a message to a group no client joins, through the same hub context that publishes project events. Today that is SignalR's in process lifetime manager. When a scale out backplane replaces it, the check covers it with no change.

## Correlated logs

Every log entry is now one line of JSON. Here are one run's lines from the worker and from the API. Each carries the project, direction, stage and run IDs, and the same trace ID, so one search finds both sides.

In the API, a JSON logger provider writes each entry with its timestamp, level, category and message, the current trace and span IDs, and every field of its scopes. An action filter opens a scope with the run's IDs on each worker call that names a run. Text passes through the redactor, so a token quoted in a failure never reaches the log. The worker writes the same shape, and adds the run's IDs and trace ID while a run executes.

## One trace per run

Here is the trace in Jaeger. It starts with the Owner's request that submitted the direction. The first run waits in the queue, is leased, and runs in the worker. The worker's model call opens to show the model and its token counts. The trace's statistics show both services in one trace: thirty three worker spans and a hundred and fifty five from the API.

A run keeps the traceparent of the work that queued it. When a worker leases it, the API records a run queued span covering the wait, and hands the worker that span's traceparent. The worker opens a span for the run beneath it, and a client span for each model call.

Every call back to the API sends traceparent, carried by async local storage, so the API's spans join the same trace. Because each next stage is queued while the previous one reports its result, the whole direction is one trace.

The sequence diagram shows the path, from the submit request through the queue to the worker and back.

## Metrics

A scrape of slash metrics, with the scrape token, exports the meter Hewn. Stage duration is a histogram. Stage runs are counted by outcome, for the success rate. Queue depth and active workers are read from the database at each scrape. Then event latency, and tokens and spend by model. Without the token the scrape is refused with a 401, and with no token configured there is no endpoint.

Prometheus, from the same Compose stack, scrapes it every five seconds. Here are the runs by stage and outcome, and the tokens by kind.

The meter records a stage's duration and outcome when its result is reported, tokens and spend after each model call is saved, and event latency as each event goes out to Mission Control.

## The local stack

Start Observability brings up Jaeger and Prometheus with Docker Compose. Start the API and a worker with the observability switch, and they send traces to Jaeger over OTLP, and the API opens slash metrics to Prometheus with a local token.

The components diagram shows how the pieces connect.

## Tests

Each slice started with a failing test. The health tests check ready is healthy with both checks reachable, and 503 with the database file gone or the backplane failing, with no error text in the body.

The structured log test runs a project through a failed run and its retry, and reads back every line. Each is JSON with timestamp, level and message, the run's lines carry its IDs and trace ID, and the token in the failure is redacted. It failed first because the logger didn't exist. The worker has the same test of its own.

The trace test sends a traceparent with the submission. It checks the queued span, the traceparent the lease returns, and that the worker's model call and result join the trace under the worker's span. It failed first because the lease had no traceparent. The worker's trace tests check its run and model call spans, traceparent on its HTTP calls, and the OTLP body.

The metrics tests scrape after a run and a model call, and check each metric's value, and that a scrape without the token is refused. They failed first with a 404.

In all, the backend has three hundred and forty three passing tests, and the worker one hundred and sixty three.

## Recap

Journey thirty six is complete. Ready tells an orchestrator when the database or the backplane is gone. Logs, traces and metrics let an operator follow one run from the request that queued it to its model calls. And it all runs locally with one Compose stack. Next comes journey thirty seven.
