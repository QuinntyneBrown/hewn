# 0014. A retry is a new run, leasable once its backoff has passed

- **Status:** Accepted
- **Date:** 2026-11-09
- **Requirements:** L2-006

## Context

L2-006 asks that a failed run be retried up to 3 times, after 30 s, 2 min and 10 min; that the stage be Failed and
the direction Blocked when the third retry fails, with an event carrying the reason and the last 200 log lines; that
other projects keep running; and that an Owner's Retry stage run the failed stage again from its start with its
counter reset. The design names a `RetryPolicy`, a `RunFailureHandler`, a `NotBefore` time the `RunQueue` honours,
a `StageBlocked` event and `POST /api/directions/{id}/retry-stage`.

## Decision

- **Each attempt is its own run.** A failed run stays Failed with its error and log. Below the limit,
  `PipelineOrchestrator.OnFailedAsync` queues a new run of the same stage with `Attempt` one higher and
  `NotBefore = now + backoff`, in the same save as the failure. The run log reads "Attempt {n} failed: {reason}.
  Retry {n} of 3 in {wait}." and `RunRetryScheduled` carries the attempt, the wait and the reason. The stage and
  direction stay Running, so nothing else changes while the retry waits.
- **The lease honours `NotBefore`.** The lease query and its guarded `UPDATE` skip a run whose `NotBefore` is in the
  future, using the injected clock. Workers need no timers, a restart keeps the schedule, and other projects' runs
  are leased meanwhile because the waiting run is not leased.
- **The policy is configuration.** `Hewn:Retry:BackoffSeconds` (default `30,120,600`) sets the waits; its length is
  the number of retries. The e2e stack uses `2,3,4`. `RetryPolicy` and `RunFailureHandler` are not separate types;
  the orchestrator already owns what a failed run means for its stage.
- **Blocked is a direction status.** When attempt 4 fails, the stage is Failed, the direction Blocked with its
  `failureReason`, `failedStage` and `failedAt`, and the project Blocked. `StageBlocked` carries the reason and the
  run's last 200 log lines, already redacted when they were stored. A Blocked direction keeps the project's turn
  (queued directions wait behind it) and can be cancelled.
- **Retry stage sits under the project:** `POST /api/projects/{projectId}/directions/{directionId}/retry-stage`
  (Owner policy), like Pause, Resume and Cancel, so another project's direction is 404. It queues attempt 1 of the
  failed stage with no checkpoint, so the stage runs from its start, and records "Retry stage requested by {login}"
  and `StageRetried`. Anything but a Blocked direction is 409 `not_blocked`.

## Alternatives considered

- **Retry inside the worker**: a worker that crashes loses the schedule, and the run would hold its lease for up to
  12 minutes doing nothing, so the project's other work could not run on another worker.
- **A timer service that re-queues runs**: another moving part to keep alive, when the lease already decides what
  runs next.
- **Re-queue the same run row**: the per-attempt error, duration and log would be overwritten, and the Runs tab
  could not show what each attempt did.
- **`POST /api/directions/{id}/retry-stage`**: every other direction control is under its project, which keeps
  caller-scoped lookups and 404s consistent.

## Consequences

- The Runs tab lists every attempt; the Log tab shows the newest run, so the Blocked page shows the last attempt's
  log, which ends with "Attempt 4 failed: {reason}. Retries exhausted; the stage is Failed."
- The project read model carries the pending retry (`retry`) and the configured waits (`retryBackoffSeconds`), so a
  page loaded mid-wait counts down and the Blocked callout names the waits Hewn used.
- Blocked directions are not yet listed on the dashboard's Needs attention tile; the dashboard is a later journey.
