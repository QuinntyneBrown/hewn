# 01 · Build a new product, part two: run the pipeline

In part one, an Owner submitted a direction and Hewn queued it. In part two, the direction actually runs: a worker leases each stage, from zero to ten, in order, and Mission Control follows along live until the direction is Complete and the project is Idle.

## What we built

Three pieces meet in this slice. The API gains the pipeline orchestrator and a lease service. A new TypeScript worker leases runs, sends heartbeats and reports checkpoints. And the project page in Mission Control listens to a SignalR hub, so every stage change appears without a reload.

The worker doesn't call a model yet. It runs a scripted executor: three steps per stage, with no agent and no GitHub call. That keeps tests and demos deterministic, and later parts swap in the real stages one at a time.

## How it fits together

Here is the advance sequence from the design. When a worker reports that a run succeeded, the orchestrator marks the stage Succeeded and queues a run for the next stage, all in one commit with the matching events. After stage ten, it marks the direction Complete and the project Idle.

A lease is one conditional update. The run moves from Queued to Leased only if no other run of the same project is leased, so one project never has two workers. Every grant raises the run's epoch. A worker that missed sixty seconds of heartbeats loses the run, and any call it makes with the old epoch is refused with lease lost.

## The code that matters

The worker loop is small. It leases a run, starts a ten-second heartbeat, and walks the steps after the last checkpoint, reporting each one. If the lease is lost, or two heartbeats in a row fail, it stops and reports nothing more.

In Mission Control, the API library owns the hub connection. It replays any events the page missed by sequence number, then streams the rest. The page folds each event into its snapshot.

## Tests first

The backend gained fifteen acceptance tests: stages in order, one lease per project, expiry after sixty seconds with the checkpoint kept, stale epochs refused, and live events in sequence. The worker has sixteen tests against a fake API, with fake timers for heartbeats and polling. Playwright now starts real workers and watches a direction run to Complete.

## The screens

Here is the real app, with one scripted worker running in the background. The Owner names the project, describes the idea and submits. The project page opens, and within a moment the worker leases stage zero. From there, stages tick from Pending to Running to Succeeded, each one starting only after the one before it, and the running stage's timer counts up as it goes. Nobody reloads the page and nobody approves anything. When stage ten finishes, the header reads Complete and the callout confirms that all eleven stages succeeded.

The running stage is marked as the current step, with a spinner and a text label, so status never depends on colour. Screen readers hear each change through a polite live region. On a phone and in dark mode the pipeline reads the same.

## Recap

Directions now run end to end on a worker, fenced by leases and shown live. Next, stage zero does real work: it creates the repository and installs the Greenlit skills.
