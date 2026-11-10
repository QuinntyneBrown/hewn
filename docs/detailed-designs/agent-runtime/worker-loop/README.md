# Worker loop, packaging and recovery

## Overview

A *worker* is a process that runs agents. It starts with a worker token, connects out to the Hewn API, registers its ID, location (Local or Cloud), host name and version, and appears on the Workers page within 2 seconds. It then loops: when work is queued and it is free, it leases one run, heartbeats every 10 seconds, and holds the lease only while heartbeats arrive. When idle it waits for a server push, falls back to polling no more than every 15 seconds, and stays under 1% CPU.

One container image serves both locations; configuration alone sets Local or Cloud, and the same direction produces the same stages, validations and outputs in either place. A Local worker uses outbound connections only. At most one worker holds a lease per project at a time.

Work survives failure. A run checkpoints at the end of each completed step by committing to its branch and reporting the commit to the API; a checkpoint counts only once the API has recorded it. If a worker stops heartbeating for 60 seconds its lease expires and another worker resumes the run from the last recorded checkpoint, so no completed step runs twice. The API persists every direction, run and event before acknowledging it, and after a server restart each lease is either kept by its worker's next heartbeat or expires as above.

A worker whose lease has expired may still be alive, cut off by a network partition or a long pause, and may still try to write. Such a worker is *fenced*. Workers hold no GitHub credential: every write to GitHub, whether a git push or a pull request operation, goes through the Hewn API's *write broker* ([Connect to GitHub](../../source-control/connect-to-github/README.md)), which checks the lease epoch and takes a per-run write lock before it touches GitHub. Lease reassignment takes the same lock, so a mutation either completes under the old epoch before the new lease is issued or is rejected after it; nothing interleaves. The stale worker can therefore neither report work nor change the repository. When a run resumes, the new worker starts after the recorded checkpoint, and every GitHub write is idempotent by a key naming its run and step, so a step that wrote but whose checkpoint report was lost gets its first result back instead of writing twice.

Terms used in this design:

- **worker** — process that runs agents, Local or Cloud
- **lease** — time-limited claim by one worker on one run, renewed by heartbeats
- **heartbeat** — message a leasing worker sends every 10 seconds
- **checkpoint** — end of the last completed step: a commit on the branch plus the API's record of it
- **lease epoch** — number on the run that increases by one each time the run is leased; sent with every call the leasing worker makes
- **fencing** — rejecting writes from a worker whose lease epoch is no longer current, before any mutation is executed
- **write broker** — the API component through which every GitHub write passes; the only holder of GitHub write credentials
- **run write lock** — per-run mutual exclusion held while a GitHub mutation executes and while a lease is granted or expired
- **reconciliation** — comparing the branch head with the recorded checkpoint before a resumed run starts

## Description

The slice spans the worker host, the lease service in the API and the Workers page.

- **`WorkerHost (worker)`** — entry point of the container image. Reads `HEWN_API_URL`, `HEWN_WORKER_TOKEN` and `HEWN_LOCATION`, opens the outbound SignalR connection, registers, and runs the loop. It stops the run container within 10 seconds of two missed heartbeats or of any `LeaseLost` response, and reports nothing further for that run.
- **`LeaseClient (worker)`** — requests a lease when free, sends heartbeats every 10 seconds while running, and listens for `WorkAvailable` pushes; without a push it polls at most every 15 seconds. Every call it makes for a run carries the lease epoch.
- **`WorkerGitSidecar (worker)`** — small HTTP endpoint in the worker host process, reachable from the run container as the git remote `http://sidecar/git/{run}`. It adds the worker token and the current epoch and forwards `git-upload-pack` and `git-receive-pack` to the API's `GitPushProxy`. The run container therefore holds neither a GitHub credential nor the worker token; an agent that reads an injected instruction has nothing to exfiltrate and nowhere to push but its own branch ([Agent isolation](../agent-isolation/README.md)).
- **`CheckpointWriter (worker)`** — after each completed step commits to the branch with a `Hewn-Checkpoint: {run}/{step}` trailer and pushes through the sidecar with `--force-with-lease={branch}:{lastKnownHead}`. The broker fences the epoch and records the new branch head on the run; the writer then reports `{step, sha, epoch}`. The checkpoint exists only once the API accepts the report.
- **`CheckpointReconciler (worker)`** — runs before the first step of a resumed run. It fetches the branch and compares its head with the recorded checkpoint SHA. Equal: resume at the next step. Head ahead by commits whose latest `Hewn-Checkpoint` trailer names the next step: that step finished but its report was lost, so the worker reports it now and resumes after it. Head ahead by commits without such a trailer: partial work, which the worker discards by resetting the branch to the checkpoint with `--force-with-lease`. Head behind or unrelated: the run fails with "Branch diverged from checkpoint" and the retry policy applies (L2-006).
- **`Idempotent external steps`** — every step with an effect outside the branch checks for its own effect before acting, keyed by `{run}/{step}`: open a pull request only if the branch has no open one, and adopt it when it does; merge only if the pull request is still open, and treat an already-merged one as success; create a repository only if the project records none; add a label only if absent. Pull request bodies carry `Hewn-Run: {run}/{step}` so a resumed worker recognizes its own work ([Open and merge the pull request](../../increments/open-and-merge-pull-request/README.md), [Connect to GitHub](../../source-control/connect-to-github/README.md)).
- **`WorkerRegistry`** — API service storing worker ID, location, host, version, status and last heartbeat. Clients on Workers join the hub's `workers` group and get `WorkersChanged` when a worker registers or is revoked, when a stage starts or ends, and when a worker goes Offline or comes back; they then read the list again (L2-031 AC1). Heartbeat times are refreshed by a 5-second read, and the page counts the seconds in between.
- **`WorkerPresence`** and **`WorkerPresenceWatcher`** — a worker is Offline once 60 seconds pass without hearing from it, which no request marks. The watcher sweeps every second; the sweep compares the online workers with the last sweep and sends `WorkersChanged` when they differ, so the change shows within a second.
- **`LeaseService`** — grants a lease with one conditional update that moves the run from unleased to leased by this worker and the project's single lease slot from empty to this run, in the same statement; when another worker got there first the statement changes zero rows and the caller gets nothing. Each grant sets `Run.LeaseEpoch = LeaseEpoch + 1` and returns the epoch with the recorded checkpoint. It renews on heartbeat and expires leases with no heartbeat for 60 seconds, returning the run to the queue.
- **`LeaseFence`** — API action filter on every worker endpoint and hub method that names a run: heartbeat, log lines, checkpoint reports, results, control acknowledgements, git proxy requests and GitHub mutation requests. It compares the request's epoch and worker with `Run.LeaseEpoch` and the current lease; a mismatch returns 409 `LeaseLost` and changes nothing. For git and mutation requests the check happens inside the run write lock, so it cannot be overtaken by a reassignment.
- **`RunWriteLock`** — per-run mutual exclusion in the API, held in memory (Hewn runs one API process on SQLite; [ADR 0027](../../../adr/0027-github-writes-and-lease-changes-share-a-run-lock.md)) with a 30-second ceiling. `GitHubWriteBroker` holds it for the duration of one mutation or one push; `LeaseService.TryLeaseAsync` and `ExpireStaleAsync` hold it while they change the lease and bump the epoch. A reassignment therefore waits for an in-flight write to finish, and every write that arrives afterwards carries an epoch the fence rejects.
- **`LeaseReaper`** — background service that runs the expiry sweep every 10 seconds and once at API start-up.
- **`WorkersPage (Angular)`** — lists host, ID, location, version, status, current project, last heartbeat and connected time, leased workers first, then idle, then offline, the longest connected first. Owners also see New worker token and Revoke. It shows a placeholder while it first loads, "No workers yet" before any worker connects (with New worker token for an Owner), and "Workers couldn’t load" with Try again when the list can't be read; a later failed read keeps the rows shown.

Durable acknowledgement is a rule applied across every write endpoint: handlers commit before returning success (L2-050 AC1). The CPU target in L2-026 AC5 is measured in the container with no run leased.

Because no GitHub credential ever reaches a worker, fencing does not depend on token expiry or revocation: a stale worker's pushes and pull request operations are refused at the broker by epoch, inside the same lock that reassignment takes. `--force-with-lease` and reconciliation remain as defence in depth: the first catches a push whose base is stale for any other reason, and the second handles the case where a push succeeded through the broker but the checkpoint report never arrived, by adopting a completed step or resetting partial work to the recorded checkpoint.

Routing pushes through the API puts the API in the data path of every push. A Local worker on a laptop pushes through the cloud API, and a large repository makes the proxy the bottleneck. The proxy streams and keeps no state, so it scales with API instances; the latency cost is accepted for the isolation and fencing it buys.

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines the level-1 (L1) requirement cited beside it. The text is copied from `docs/specs/L2.md`.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-026` | `L1-014` | **Worker loop.**<br>1. Given a worker starts with a valid worker token, when it connects, then it registers with an ID, location (Local or Cloud), host name and version, and appears in Mission Control's Workers view within 2 seconds.<br>2. Given queued work, when a worker is free, then it leases one run, sends a heartbeat every 10 seconds, and holds the lease only while heartbeats arrive.<br>3. Given a worker stops heartbeating for 60 seconds, when the lease expires, then the run is offered to another worker and resumes from its last checkpoint (L2-050).<br>4. Given a project, when runs are leased, then at most one worker holds a lease for that project at a time.<br>5. Given no queued work, when a worker is idle, then it waits for a push from the server, falling back to polling no more than every 15 seconds, and uses under 1% CPU. |
| `L2-027` | `L1-014` | **Same behaviour locally and in the cloud.**<br>1. Given the worker, when it is packaged, then one container image runs either on a developer machine (Docker) or in the cloud, and the location is set only by configuration.<br>2. Given the same direction and repository, when it runs on a Local worker and on a Cloud worker, then the same stages, validations and outputs are produced.<br>3. Given a Local worker, when it connects, then it uses outbound connections only, needing no inbound ports on the developer machine. |
| `L2-031` | `L1-016` | **Real-time events.**<br>1. Given a stage status change, log line, artifact, PR, check status, spend update or worker status change, when it happens, then a SignalR event reaches subscribed clients with a p95 latency of 1 second or less.<br>2. Given each event, when it is sent, then it carries a per-project sequence number that increases by one. |
| `L2-050` | `L1-022` | **Durable state and recovery.**<br>1. Given a direction, run or event, when the API acknowledges it, then it has already been persisted to the database.<br>2. Given the server restarts during a run, when it comes back, then no direction is lost, and every lease is either kept by its worker's next heartbeat or expires per L2-026 AC3.<br>3. Given a run is resumed after a crash, when it restarts, then it continues from its last checkpoint (the end of the last completed step, committed to the branch). No completed step runs twice. |

## Diagrams

### System context

The Owner starts workers on a laptop or in the cloud; the workers call Claude and commit checkpoints to GitHub.

![C4 system context for the worker loop, packaging and recovery](diagrams/c4-context.png)

### Containers

The worker opens every connection outbound (L2-027 AC3); the API pushes work and control over that same connection.

![C4 container view for the worker loop, packaging and recovery](diagrams/c4-container.png)

### Components

`LeaseService` enforces one lease per project and stamps each grant with an epoch; `LeaseFence` rejects stale epochs on every run-scoped call; `GitHubWriteBroker` is the only path to GitHub and checks the fence inside the `RunWriteLock` that `LeaseService` also takes, so a write and a reassignment never interleave. `LeaseReaper` expires silent leases, including after an API restart (L2-050 AC2).

![C4 component view for the worker loop, packaging and recovery](diagrams/c4-component.png)

### Class structure

A `Lease` ties one `Run` to one `Worker` until `ExpiresAt` and carries the `Epoch` that `LeaseFence` checks against `Run.LeaseEpoch`. `GitHubWriteBroker` and `LeaseService` share `RunWriteLock`. The run's recorded `Checkpoint` and `BranchHead` are what `CheckpointReconciler` compares with the branch when a run resumes.

![Class diagram for the worker loop, packaging and recovery](diagrams/class-structure.png)

### Behaviour — register, lease and heartbeat

The worker registers and shows on the Workers page within 2 seconds (L2-026 AC1), leases one run and heartbeats every 10 seconds (AC2), with at most one lease per project (AC4). Idle, it leases with a request the API holds open, so queued work is pushed to it at once, and it asks at most every 15 seconds (AC5).

![Sequence diagram: register, lease and heartbeat](diagrams/sequence-register-and-lease.png)

### Behaviour — commit and record a checkpoint

A checkpoint is a pushed commit plus the API's record of it (L2-050 AC3). The push leaves the run container without any credential, gains the worker token and epoch in the sidecar, and is fenced and locked in the broker before GitHub sees it.

![Sequence diagram: commit and record a checkpoint](diagrams/sequence-checkpoint.png)

### Behaviour — expire a lease and resume

After 60 seconds without heartbeats the lease expires, under the run's write lock, and the run log says so; another worker leases the run atomically with a new epoch, and the log names it and the step it resumes after (L2-026 AC3). It starts after the recorded checkpoint, and a write it repeats from an unreported step returns the first result by its idempotency key, so no completed step runs twice (L2-050 AC3). The same sweep runs at API start-up, so after a restart each lease is kept by its worker's next heartbeat or expires (L2-050 AC2).

![Sequence diagram: expire a lease and resume](diagrams/sequence-expire-and-resume.png)

### Behaviour — fence a stale worker

A write that passed the fence holds the run's write lock until it is recorded, so the expiry waits for it. Every request the stale worker makes afterwards carries epoch 1 while the run holds epoch 2: the fence answers 409 `lease_lost`, nothing reaches GitHub, and the worker stops the run.

![Sequence diagram: fence a stale worker](diagrams/sequence-fence-stale-worker.png)

## Decisions made while building the slice

Journey 1, part 2 built the loop, leases and fencing that L2-004 needs.

- **Protocol over HTTP.** Register, lease (204 when there is no work), heartbeat, checkpoint and result are
  `POST /api/worker/...` calls carrying `{workerId, epoch}`. The `/hubs/workers` push (`WorkAvailable`)
  is not built yet; workers poll every 15 seconds, the ceiling L2-026 AC5 allows.
- **Fencing without a row lock** on SQLite: see [ADR 0005](../../../adr/0005-leases-on-sqlite.md).
- **Scripted executor.** Until stage executors land, the worker runs `ScriptedStageExecutor`: three steps
  per stage (prepare, run, commit), no agent, model or GitHub call. The e2e suite starts real worker
  processes with it, so the fake worker AGENTS.md describes is the real worker with a scripted executor.
- **Checkpoints** carry a step number and an optional SHA; the git sidecar, the reconciler and the
  write broker come with the stages that push (part 3 onward).
- **The checkpoint answers with a verdict** (journey 6): `{verdict: "Continue" | "Pause"}`. On `Pause` the run has
  been paused at this checkpoint and its lease released; the worker ends the run without another step or a result
  ([ADR 0011](../../../adr/0011-pause-takes-effect-at-the-next-checkpoint.md)).
- **The control poll (journey 7).** While a run executes, the worker also holds
  `GET /api/worker/runs/{id}/control?workerId&epoch&waitSeconds=20` open. It answers 204 to poll again, or
  `{control: "Cancel"}` the moment an Owner cancels the direction; the worker then aborts the step in progress and
  reports no further step, checkpoint or result ([ADR 0012](../../../adr/0012-cancel-reaches-the-worker-on-a-held-control-poll.md)).
  Since journey 8 it can also answer `{control: "Halt"}` when an Owner stops all workers: the worker aborts the same
  way, and after Start workers it leases the halted run again and carries on after its checkpoint. While leasing is
  off, `POST /api/worker/lease` answers 204 ([ADR 0013](../../../adr/0013-stop-all-workers-halts-runs-on-the-control-poll.md)).
- **Failure text is redacted** before it is stored (`SecretRedactor`).
- **The Workers page (journey 8)** lists each worker's host, location, version, status, what it works on and its
  last heartbeat, from `GET /api/workers`.
- **Not built yet:** issued tokens and Revoke (built in journey 24), and the `RunWriteLock` (journey 26). The git sidecar and `CheckpointReconciler` are not built: see journey 26 below.

## Decisions made while running workers locally or in the cloud

Journey 23 built L2-026 AC1, AC2 and AC5 and L2-027 AC1.

- **One image.** `worker/Dockerfile` builds the worker on `node:24-bookworm-slim` with git and ffmpeg. It runs as
  the unprivileged `node` user, opens no port and starts `node dist/main.js`. `HEWN_LOCATION` (`Local` by
  default), `HEWN_API_URL`, `HEWN_WORKER_TOKEN` and `HEWN_WORKER_NAME` are the only differences between a
  developer machine (`docker run`) and the cloud.
- **The push is a held lease request**, not a `/hubs/workers` hub. An idle worker calls
  `POST /api/worker/lease?waitSeconds=20`, and the API holds it open for up to 30 seconds. `EventAppender` pulses
  `WorkSignal` after every stored event, so a newly queued run is leased at once. The worker asks again no sooner
  than its 15-second poll interval after the previous request started, so an idle worker makes at most 4 requests
  a minute and uses no CPU between them.
- **`WorkersChanged` instead of `WorkerChanged`.** The hub's `workers` group (`JoinWorkers`) is told when a worker
  registers and whenever a stage starts or ends. Mission Control then reads `GET /api/workers` again, so a new
  worker shows within 2 seconds. The 5-second refresh stays for heartbeats.
- **Isolation per run** (L2-042) is started by the work loop: see
  [Agent isolation](../agent-isolation/README.md) and [ADR 0025](../../../adr/0025-runs-are-isolated-in-the-worker-by-a-proxy-and-tool-gates.md).

## Decisions made while continuing after a crash

Journey 26 built L2-050 and L2-026 AC3 end to end ([ADR 0027](../../../adr/0027-github-writes-and-lease-changes-share-a-run-lock.md)).

- **`RunWriteLock` is in memory.** `LeaseService.FenceForWriteAsync` takes it before the fence check, and the
  commit, pull request, merge and branch-protection handlers keep it until the write is recorded.
  `TryLeaseAsync` and `ExpireStaleAsync` take it for each run they change, so an expiry waits for a write in
  flight and every later write from the old worker is fenced out.
- **The run log shows recovery.** The expiry logs "Lease expired: no heartbeat from {worker} for 60 seconds;
  queued again after step N", and a lease of a run leased before logs "Resumed by {worker} after step N". The
  Owner follows a crash on the project page without a new screen.
- **No branch reconciler.** Workers write to GitHub only through the API's mutation calls, one commit each, so a
  branch never holds part of a step. A step repeated after a lost checkpoint report sends the same idempotency
  key, `{run}/{step}/…`, and gets the first SHA back. The git sidecar, `--force-with-lease` and
  `CheckpointReconciler` described above are needed only if workers push with git, so they are left out.
- **Persist before acknowledging** was already true: every handler saves before it answers, and events are
  published after `SaveChangesAsync`. Tests restart the API on the same database file to prove it (L2-050 AC1,
  AC2).
