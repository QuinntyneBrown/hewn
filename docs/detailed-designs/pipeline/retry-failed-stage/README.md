# Retry a failed stage

## Overview

A run can fail: a skill output may not validate, an external service may be down, or a check may fail. Hewn retries a failed run automatically up to 3 times, waiting 30 seconds, 2 minutes and 10 minutes before each retry. If the third retry also fails, the stage becomes Failed and the direction Blocked. Mission Control receives an event with the failure reason and the last 200 log lines, and every other project keeps running.

A Blocked direction stays put until an Owner presses Retry stage on the project page or the dashboard's Needs attention tile. Retry stage runs the failed stage again from its start with its retry counter reset. This is the only human step in failure handling, and it is a recovery action, not an approval (L2-028).

Terms used in this design:

- **attempt** — one numbered execution of a stage within a run sequence; attempt 1 is the first try, attempts 2–4 are retries
- **backoff** — delay before a retry: 30 s, then 2 min, then 10 min
- **Blocked** — direction status after a stage exhausts its retries

## Description

The slice spans the orchestrator, a delayed-run scheduler, the event stream and the Retry stage control.

- **`RetryPolicy`** — value object: `MaxRetries = 3`, `Backoff = [30 s, 2 min, 10 min]`.
- **`RunFailureHandler`** — handles `RunFailed`. Below the limit it schedules a new attempt with `NotBefore = now + backoff`; at the limit it marks the stage Failed and the direction Blocked and publishes `StageBlocked`.
- **`RunQueue`** — leases only runs whose `NotBefore` has passed, so backoff needs no timers in workers.
- **`StageBlocked`** — event carrying `Reason` and `LastLogLines` (the last 200 lines, already redacted per L2-040).
- **`DirectionsController.RetryStage`** — `POST /api/directions/{id}/retry-stage`, Owner policy. It resets the attempt counter and inserts attempt 1 of the failed stage.
- **`StageDetail (Angular)`** — on the project page, shows the failure callout, the 200 log lines and the Retry stage button. The dashboard's Needs attention tile offers the same action.

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines the level-1 (L1) requirement cited beside it. The text is copied from `docs/specs/L2.md`.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-006` | `L1-002` | **Stage failure and retry.**<br>1. Given a run fails, when it is retried automatically, then it is retried up to 3 times with backoff of 30 s, 2 min and 10 min.<br>2. Given the 3rd retry fails, when the stage ends, then the stage is Failed, the direction is Blocked, an event is pushed to Mission Control with the failure reason and the last 200 log lines, and other projects keep running.<br>3. Given a Blocked direction, when the Owner presses Retry stage, then the failed stage runs again from its start with its retry counter reset. |

## Diagrams

### System context

Only the Owner is involved, and only after retries are exhausted.

![C4 system context for retrying a failed stage](diagrams/c4-context.png)

### Containers

Workers report failures to the Hewn API, which schedules the next attempt in the database or pushes `StageBlocked` to Mission Control.

![C4 container view for retrying a failed stage](diagrams/c4-container.png)

### Components

Backoff is a `NotBefore` timestamp on the run, so the delay survives restarts and no worker holds a timer.

![C4 component view for retrying a failed stage](diagrams/c4-component.png)

### Class structure

`RunFailureHandler` consults `RetryPolicy` to schedule the next `Run` attempt or to publish `StageBlocked` with the last 200 log lines.

![Class diagram for retrying a failed stage](diagrams/class-structure.png)

### Backoff schedule

A failed run is retried after 30 s, 2 min and 10 min; the fourth failure blocks the stage until an Owner presses Retry stage (L2-006).

![Diagram: attempts 1 to 4 with waits of 30 s, 2 min and 10 min, then Blocked and Retry stage](diagrams/backoff-schedule.png)

### Behaviour — retry automatically, then block

Attempts 2–4 wait 30 s, 2 min and 10 min (L2-006 AC1). After the third retry fails, the stage is Failed, the direction Blocked, and Mission Control gets the reason and 200 log lines (AC2).

![Sequence diagram: retry automatically, then block](diagrams/sequence-auto-retry-and-block.png)

### Behaviour — Owner presses Retry stage

The failed stage restarts from its beginning with the counter reset (L2-006 AC3).

![Sequence diagram: Owner presses Retry stage](diagrams/sequence-retry-stage.png)

## Decisions made while building retries and Retry stage

Journey 9 built L2-006.

- **Each attempt is a new run, leasable once its backoff has passed** ([ADR 0014](../../../adr/0014-a-retry-is-a-new-run-leasable-after-its-backoff.md)).
  `Run.Attempt` (1 to 4) and `Run.NotBefore` replace `RetryPolicy` and `RunFailureHandler`:
  `PipelineOrchestrator.OnFailedAsync` queues the next attempt with `NotBefore = now + backoff`, and the lease
  skips runs whose time has not come. The waits are `Hewn:Retry:BackoffSeconds` (default `30,120,600`).
- **While a retry waits** the stage and direction stay Running. The run log reads "Attempt {n} failed: {reason}.
  Retry {n} of 3 in {wait}.", `RunRetryScheduled` carries the attempt and wait, and the project read model's
  `retry` lets the stage's live line count down ("Retry 1 of 3 in 0:24"). This reuses the live line, so no new mock
  was needed.
- **Blocked** is a new direction status with `failureReason`, `failedStage` and `failedAt`. `StageBlocked` carries
  `{directionId, stage, stageName, runId, attempts, reason, lastLogLines}`; the lines were redacted when stored. A
  Blocked direction keeps the project's turn and can be cancelled, as the blocked mock shows.
- **The route sits under the project**: `POST /api/projects/{projectId}/directions/{directionId}/retry-stage`
  (Owner policy), like Pause, Resume and Cancel; 409 `not_blocked`, 403 for Viewers, 404 for another project's
  direction. It queues attempt 1 from step 0 and records "Retry stage requested by {login}" and `StageRetried`.
- **The page** follows `pages/project-pipeline/blocked.html`: Blocked status, Retry stage and Cancel in the header,
  the danger callout "Stage failed after 3 retries" with the reason and the waits Hewn used, and the Failed stage
  selected by default. The Log tab shows the last attempt's log; the Runs tab lists every attempt. A stage that
  blocks while the page is open raises the danger toast from `notifications/live-toast/with-action.html`, which
  stays until dismissed and offers Open log and, for Owners, Retry stage.
- **Not built yet:** Retry stage on the dashboard's Needs attention tile (the dashboard is a later journey), and the
  toast on pages other than the project's.
