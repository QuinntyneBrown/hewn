# Run a direction through the pipeline

## Overview

Every direction runs the same fixed pipeline. A product direction runs stages 0 to 10 in order: Bootstrap, Idea, Designs, Design system, Stack, Requirements, Scaffold, Detailed designs, User journeys, Estimates and Increments. A feature direction skips Bootstrap (0), Stack (4) and Scaffold (6), runs the other stages against the new or changed scope only, and also skips Designs (2) and Design system (3) when the agent decides the feature has no user interface change.

The orchestrator enforces order: a stage starts only after the previous non-skipped stage has Succeeded. A project runs one direction at a time; a second direction waits in a first-in, first-out queue until the active one is Complete or Cancelled. No stage, pull request or merge waits for a human (L2-028). Where a skill would ask a question, the agent answers it and records the decision ([Record agent decisions](../record-decisions/README.md)).

The orchestrator lives in the Hewn API. It does not execute stages itself; it creates *runs* and offers them to workers through the lease mechanism in [Worker loop](../../agent-runtime/worker-loop/README.md). Failure handling is in [Retry a failed stage](../retry-failed-stage/README.md) and the safety controls are in [Pause, resume, cancel and stop all](../pause-resume-cancel-stop/README.md).

Terms used in this design:

- **run** — one execution of one stage for one direction
- **stage status** — one of Pending, Running, Paused, Succeeded, Failed, Skipped or Cancelled
- **direction queue** — per-project first-in, first-out list of directions waiting behind the active one
- **scope** — set of new or changed requirements, designs and screens a feature direction works on

## Description

The slice is server-side orchestration plus the pipeline view's status rendering.

- **`PipelineOrchestrator`** — application service in the Hewn API. It reacts to `RunSucceeded`, `DirectionQueued` and `DirectionEnded` events, decides the next stage, marks skipped stages and creates the next `Run`.
- **`StagePlan`** — pure function that returns the ordered stage list for a direction: all of 0–10 for a product direction; 1, 2, 3, 5, 7, 8, 9, 10 for a feature direction, minus 2 and 3 when the recorded `HasUiChange` decision is false.
- **`Direction`** — entity with `Status` (Queued, Running, Paused, Blocked, Cancelled, Complete) and eleven `StageState` entries. `Advance()` refuses to start a stage whose predecessor has not Succeeded.
- **`DirectionQueue`** — per-project ordering by `SubmittedAt`. `PromoteNext()` starts the oldest queued direction when the active one ends.
- **`RunQueue`** — table of leasable runs; a run becomes visible to workers when the orchestrator inserts it (L2-026).
- **`ScopeSnapshot`** — for a feature direction, the feature text plus the IDs of existing L1/L2 requirements, journeys and designs, passed to every stage so stages 5 and 8 keep existing IDs and number new ones from the next free value.
- **`NoApprovalE2ETest`** — automated end-to-end test that submits a small direction and asserts it reaches Complete with no user interaction after submission (L2-028 AC1).

The orchestrator handles each event idempotently by run id, so a redelivered `RunSucceeded` cannot start a stage twice (L2-050 AC3). The feature-direction decision about user interface change is made in stage 1 and read by `StagePlan` before stage 2 is created.

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines the level-1 (L1) requirement cited beside it. The text is copied from `docs/specs/L2.md`.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-004` | `L1-002` | **Run a product direction through every stage.**<br>1. Given a queued product direction, when a worker picks it up, then stages 0 to 10 run in order, and each stage starts only after the previous stage has status Succeeded.<br>2. Given any stage, when its status is shown, then it is exactly one of Pending, Running, Paused, Succeeded, Failed, Skipped, Cancelled. Paused applies to the active stage of a Paused direction, and Cancelled to the active stage of a Cancelled direction.<br>3. Given every stage succeeds, when stage 10 merges its last non-deferred increment, then the direction is Complete and the project is Idle.<br>4. Given a project, when a second direction is submitted while one is active, then it queues and starts only when the active one is Complete or Cancelled (one active direction per project, first in, first out). |
| `L2-005` | `L1-002` | **Run a feature direction on an existing product.** An Owner submits a feature description (10–20,000 characters) on a project whose first product direction is Complete.<br>1. Given a feature direction, when it runs, then stages 0, 4 and 6 are marked Skipped, and stages 1, 2, 3, 5, 7, 8, 9 and 10 run in order, each limited to the new or changed scope.<br>2. Given the feature has no user interface change (decided and recorded per L2-054), when it runs, then stages 2 and 3 are Skipped.<br>3. Given a feature direction, when stage 5 runs, then existing L1/L2 IDs are kept, and new requirements take the next free numbers.<br>4. Given a project whose first product direction is not Complete, when the Owner submits a feature direction, then it is queued behind it (L2-004 AC4). |
| `L2-028` | `L1-015` | **No approval steps.**<br>1. Given a product direction is submitted, when it runs to Complete, then no stage, PR or merge waits for human input. An automated end-to-end test proves this by submitting a small direction and asserting it completes with no user interaction after submission.<br>2. Given any stage, when it would normally ask a human (a skill question, a review or a PR approval), then it proceeds under L2-054 instead. |

## Diagrams

### System context

The Owner submits a direction once. From there Hewn runs agents on Claude and works in GitHub with no further human step.

![C4 system context for running a direction through the pipeline](diagrams/c4-context.png)

### Containers

The orchestrator in the Hewn API writes runs to the Hewn database; workers lease them over outbound connections and report back.

![C4 container view for running a direction through the pipeline](diagrams/c4-container.png)

### Components

On each `RunSucceeded` the orchestrator asks `StagePlan` for the next stage, marks skipped stages, and inserts the next run, or completes the direction and promotes the next queued one.

![C4 component view for running a direction through the pipeline](diagrams/c4-component.png)

### Class structure

A `Direction` owns eleven `StageState` entries and its `Run` history. `StagePlan` is a pure function of the direction kind and the recorded UI-change decision.

![Class diagram for running a direction through the pipeline](diagrams/class-structure.png)

### Behaviour — advance to the next stage

A stage starts only after its predecessor Succeeded (L2-004 AC1). For a feature direction, stages 0, 4 and 6 are Skipped, and 2 and 3 too when there is no UI change (L2-005 AC1, AC2).

![Sequence diagram: advance to the next stage](diagrams/sequence-advance.png)

### Behaviour — queue a second direction

A second direction on a busy project queues and starts when the active one is Complete or Cancelled, first in, first out (L2-004 AC4, L2-005 AC4).

![Sequence diagram: queue a second direction](diagrams/sequence-queue-second-direction.png)
