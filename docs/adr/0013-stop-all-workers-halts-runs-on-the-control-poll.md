# 0013. Stop all workers halts runs on the control poll and a stored leasing switch

- **Status:** Accepted
- **Date:** 2026-11-09
- **Requirements:** L2-029

## Context

L2-029 AC4 asks that, when an Owner presses Stop all workers and confirms, every worker halts its active run within
10 seconds and leases no new work until the Owner presses Start workers; the design adds that each halted run then
resumes from its last checkpoint. The design sends `HaltRun` over the SignalR `WorkerControlChannel` and consults a
`LeasingSwitch` before every lease. ADR 0012 built a held control poll for Cancel instead of the channel.

## Decision

- **Halt rides the control poll.** `POST /api/workers/stop` (Owner policy) saves the leasing switch first, then
  halts every leased run, project by project under each project's lock: the run turns `Halted`, keeps its worker,
  epoch and checkpoint, and stops fencing, so the worker's writes are refused. The run log reads "Halted: all workers
  stopped by {login}; resumes from step {n}". Each worker's held poll then answers `{control: "Halt"}`, the worker
  aborts the step in progress, and the poll records "Run halted at step {n}". Stop waits up to 10 seconds
  (`Hewn:Control:StopDeadlineSeconds`) and answers `{stopped, halted, unconfirmed}`, naming each worker that didn't
  hear. Pressing it again waits again for those workers.
- **The switch is stored.** One row in `leasing_switches` (`stopped`, `changedBy`, `changedAt`), so a restarted
  server stays stopped. The lease's `UPDATE` checks it in the same statement as the grant, so no lease is granted
  after Stop saves the switch, and a lease granted just before is found and halted.
- **Start queues the halted runs, then switches leasing on.** `POST /api/workers/start` returns each halted run to
  the queue ("Queued again: workers started by {login}"), keeping its place, and the next lease raises the epoch and
  carries on after the checkpoint.
- **Mission Control reads `GET /api/workers`.** It holds the switch and the workers (status, what each works on,
  `holding` for a halted run). The shell refreshes it on every navigation and every 5 seconds, so the banner and the
  sidebar's Stop all workers or Start workers follow the switch on every page.

## Alternatives considered

- **Build the SignalR `WorkerControlChannel`**: rejected for the reasons in ADR 0012; one held poll serves Cancel
  and Halt.
- **Pause every running direction**: Pause waits for the step in progress to finish, which can take minutes, and
  it changes each direction's state, so the projects would need resuming one by one.
- **Keep the switch in memory**: a restart would turn leasing back on without the Owner pressing Start workers.
- **A system event on the hub for the switch**: project events are per project and sequenced; a global event needs
  its own catch-up. Worker activity goes live with journey 25, so the shell refreshes for now.

## Consequences

- A halted run occupies no lease, and a Pause or Cancel on its direction takes effect at once.
- Several API instances: as in ADR 0012, a poll held by another instance hears the halt when it ends (at most
  20 seconds), and the run is refused writes from the moment Stop saves.
- Viewers see the banner but no control; the API answers 403 to them.
