# 0012. Cancel reaches the worker on a held control poll

- **Status:** Accepted
- **Date:** 2026-11-09
- **Requirements:** L2-029, L2-004

## Context

L2-029 AC3 asks that, when an Owner presses Cancel on a running or paused direction and confirms, the active run
stops within 10 seconds, the direction is Cancelled, and open pull requests are left open and labelled
`hewn:cancelled`. L2-004 AC4 asks that a queued direction starts when the active one is Complete or Cancelled. The
pause-resume-cancel-stop design sends `CancelRun` over a `WorkerControlChannel` on the worker's outbound SignalR
connection. Workers speak HTTP and poll (ADR 0011 left the channel unbuilt). A step can run for minutes, so neither
the heartbeat (every 10 seconds) nor the checkpoint can carry a cancel in time on its own.

## Decision

- **The worker holds a control poll open while its run executes.** `GET /api/worker/runs/{id}/control?workerId&epoch&waitSeconds`
  waits up to `waitSeconds` (at most 30; the worker asks for 20) and answers 200 `{control: "Cancel"}` the moment the
  run is cancelled, or 204 to poll again. The connection is outbound from the worker, so a Local worker still needs
  no inbound port (L2-027 AC3). On Cancel the worker aborts the step in progress and reports nothing more.
- **Cancel commits first, then waits.** `POST /api/projects/{projectId}/directions/{directionId}/cancel` (Owner
  policy) appends `DirectionCancelled`, writes "Cancel requested by {login}", labels the direction's open pull
  requests, and cancels the run (its lease stops fencing, so every write the worker tries is refused), its running or
  paused stage, and the direction, then starts the next queued direction or sets the project Cancelled, in one save.
  It then wakes the held poll and waits up to 10 seconds (`Hewn:Control:StopDeadlineSeconds`) for the worker to hear.
- **The worker hearing it is the stop.** The poll that answers Cancel records `StopAcknowledgedAt`, the seconds it
  took (`stoppedWithinSeconds`) and "Run stopped at step {n}". Cancel answers `{status, stopped, stoppedWithinSeconds,
  worker}`; `stopped: false` names the worker that did not answer. The direction is Cancelled either way; pressing
  Cancel again only waits for the worker again.
- **Pull requests come from the mutation ledger.** Every `open_pull_request` the direction's runs made is read
  back; each that is not merged gets the `hewn:cancelled` label through the GitHub App
  (`POST /repos/{owner}/{name}/issues/{n}/labels`) and a `gh pr edit {n} --add-label hewn:cancelled` line in the
  run log. Merged work stays merged.
- **Signals are in process.** `RunControlSignals` wakes a held poll and the waiting Cancel; the database records
  the outcome, so a poll or a retry that misses a signal still finds the run Cancelled.

## Alternatives considered

- **Build the SignalR `WorkerControlChannel`**: the design's target, but it adds a SignalR client and a delivery and
  acknowledgement protocol to the worker for one message, where a held HTTP request gives the same latency over the
  connection the worker already makes.
- **Answer Cancel on the heartbeat or the checkpoint**: the heartbeat is 10 seconds apart and a checkpoint can be
  minutes away, so neither meets the 10-second limit; the heartbeat still sees 409 and stops the run as a backstop.
- **Wait for the worker before changing state**: a worker that never answers would leave the direction Running
  and the next direction waiting. Committing first means Cancel always takes effect and the worker's writes are
  refused at once; the wait only reports whether the worker heard.
- **Expire the lease when the worker does not answer**: the run is already Cancelled and fenced, so there is nothing
  for the lease to protect; the failed dialog tells the Owner the lease expires and the run won't resume.

## Consequences

- A worker holds one extra request open during a run. Signals live in the API process; with several API instances
  a poll held by another instance hears the cancel when it ends (at most 20 seconds) and re-reads the database.
- Stop all workers (journey 8) can answer `Halt` on the same poll.
- Pause keeps its checkpoint answer (ADR 0011).
