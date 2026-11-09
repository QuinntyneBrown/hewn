# 0011. Pause takes effect at the next checkpoint, answered on the checkpoint call

- **Status:** Accepted
- **Date:** 2026-11-09
- **Requirements:** L2-029, L2-050

## Context

L2-029 AC1 asks that, when an Owner presses Pause, the current step finishes, the direction becomes Paused and
nothing new starts until Resume; AC2 that Resume continues from the next step. L2-050 AC3 asks that no completed
step runs twice. The pause-resume-cancel-stop design sends a `PauseAfterStep` message over a `WorkerControlChannel`
on the worker's SignalR connection. That channel does not exist yet: workers speak HTTP and poll (journey 1, part 2),
and the worker already reports a checkpoint to the API at the end of every step.

## Decision

- **Pause is a request recorded on the direction.** `POST /api/projects/{projectId}/directions/{directionId}/pause`
  (Owner policy) sets `Direction.PauseRequestedBy`, appends `PauseRequested {directionId, requestedBy}` and writes
  "Pause requested by {login}" to the run log. The direction stays Running; Mission Control shows Pausing….
- **The checkpoint answers it.** `POST /api/worker/runs/{id}/checkpoints` now answers 200
  `{verdict: "Continue" | "Pause"}`. When a pause is pending, the checkpoint that ends the step in progress records
  the checkpoint, writes "Step {n} finished · checkpoint · direction Paused" (with the short SHA when the worker
  sends one), pauses the run (lease released, checkpoint kept), its stage, the direction (reason "Paused by an Owner",
  with who and when) and the project, and answers `Pause`. The worker then ends the run without another step or a
  result, and goes back to leasing.
- **No step is waited for when none is running.** A run still waiting for a worker pauses at once. A stage that ends
  while a pause is pending creates the next stage's run already paused, so the next stage does not start.
- **Resume re-queues the same run.** `POST .../resume` (Owner policy) appends `DirectionResumed {directionId,
  resumedBy}`, writes "Resumed by {login}", and sets the run back to Queued with its checkpoint, the stage, direction
  and project to Running. The next lease bumps the epoch and starts after the checkpoint.
- **A budget stop is not resumed by Resume.** A direction Paused with "Budget reached" answers 409 `budget_reached`:
  only Raise and resume continues it (ADR 0010, journey 5). Other refusals: 409 `not_running` for Pause on a
  direction with no queued or leased run, 409 `not_paused` for Resume on a direction that is not paused, 403 for
  Viewers (AC5), 404 for another project's direction. Pressing Pause twice changes nothing.

## Alternatives considered

- **Build the `WorkerControlChannel` now**: the design's target, and Cancel and Stop all (AC3, AC4) need it to stop a
  run within 10 seconds. Pause does not: it waits for the step to end, and the worker already calls the API at that
  moment. Building a push channel for Pause alone would add a SignalR client to the worker and a delivery and
  acknowledgement protocol that this journey does not otherwise need.
- **Answer Pause on the heartbeat**: the heartbeat arrives mid-step, so the worker would still have to hold the
  answer until the step ends; the checkpoint arrives exactly when the pause can take effect.
- **Pause at the end of the stage instead of the step**: simpler for the worker, but L2-029 AC1 says the current
  step, and stages can take hours.

## Consequences

- A pause takes effect within one step. A long step (an increment's test run, for example) delays it; the header
  shows Pausing… with `aria-busy` until then.
- When Cancel and Stop all arrive (journeys 7 and 8), the control channel can carry `PauseAfterStep` too, or Pause
  can keep using the checkpoint answer; either way the API's pause and resume commands stay as they are.
- A checkpoint report is now a write that may change direction state, so it takes the project's event lock when a
  pause is pending, like any other state change.
