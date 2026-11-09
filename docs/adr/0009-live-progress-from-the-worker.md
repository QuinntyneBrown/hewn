# 0009. Live progress: workers name steps and batch log lines, and Hewn keeps a copy of each decision

- **Status:** Accepted
- **Date:** 2026-11-09
- **Requirements:** L2-030, L2-031, L2-033, L2-047, L2-054

## Context

The project page shows a running stage's current step and latest log line, updating live (L2-030 AC2), and a
selected stage's runs, logs, artifacts and decisions (AC3). Until journey 3 the worker sent one HTTP request per
log line, the API stored lines without telling anyone, step names stayed inside the worker, and decisions lived only
in the product's `docs/decisions.md`. Runs also lost their worker when they ended and never recorded a start time.

## Decision

- Before each step the worker calls `PUT /api/worker/runs/{id}/step {step, name}`. The run stores the step, and the
  API sends a `StepStarted` event. The project read model gives a Running stage its `step`, `latestLine` and `runId`.
- The worker's `LogBatcher` sends log lines every 250 ms, at most 500 per request, and always before a checkpoint
  or result. Each batch is stored, redacted, and sent as one `LogLines` event carrying the numbered lines, so the
  event store grows by batch, not by line.
- After a document stage commits, the worker reports the new decisions (question, answer, rationale) through
  `POST /api/worker/runs/{id}/decisions`. Hewn keeps a redacted copy in `run_decisions` and sends `DecisionRecorded`.
  A resumed step that reports the same question again for the same run is ignored.
- Runs record `StartedAt` at their first grant and `RanBy`, the worker that last held the lease, which survives the
  end of the run. Commit mutations keep the committed paths alongside the SHA.
- Reads for the page: `GET /api/projects/{id}/directions/{d}/stages/{n}` (runs newest first, artifacts, decisions)
  and `GET /api/projects/{id}/runs/{r}/logs?after=&limit=` (at most 5,000 lines a page). Both are open to any
  signed-in user who can see the project; another project's direction or run is 404.
- Mission Control renders a log of more than 500 lines as a window of at most 500 rows around the view. Windowed
  lines keep to one row (ellipsis), so every row has the measured height of the first and the spacers are exact.
  While following, the window ends at the newest line.

## Alternatives considered

- **One event per log line**: simplest for clients, but a 6,000-line stage would write 6,000 events and catch-up
  pages.
- **Parse decisions from the product's repository on demand**: needs a GitHub read per page view, and the API
  would duplicate the worker's parser.
- **Variable-height virtual scrolling** (measuring each wrapped line): exact for wrapped text but much more code;
  wrapping long lines in a log of thousands matters less than a stable scroll position.

## Consequences

- Worker log calls no longer wait for the network; a failed batch is logged on the worker and the run goes on.
- `LogLines` events make up most of a busy project's events; the nightly purge in the real-time events design
  matters more once it exists.
- Increment decisions committed on feature branches are not yet reported; they reach the Decisions tab when the
  increment executor reports them (journey 18, Review agent decisions).
