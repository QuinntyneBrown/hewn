# Estimate, descope and order the backlog

## Overview

Stage 9 sizes the work and turns it into an implementation plan. It runs the `estimating-designs` skill to estimate each detailed design in ideal days, writes `docs/estimates/`, and produces the ordered backlog that stage 10 delivers one increment at a time.

Oversized or off-path work is descoped automatically. A design above the descope threshold (3 ideal days by default, set by an Owner in Settings) is first split into designs at or below the threshold; if no split works, it is descoped. A design whose L2s appear in no journey's main path, or that the brief lists as out of scope or nice-to-have, is descoped too. Each descoped design is listed under "Deferred" with its reason, and its L2s in `docs/specs/L2.md` gain `**Status:** Deferred ({reason})`. The Backlog page in Mission Control shows the active increments with status, estimate and pull request link, and the deferred items apart with their reasons.

Terms used in this design:

- **ideal day** — one day of focused work with no interruptions, the unit of every estimate
- **descope threshold** — largest estimate a design may have before Hewn tries to split or defer it
- **increment** — one backlog item: one journey or part of one, with its L2 IDs
- **deferred** — descoped from this direction, with a recorded reason

## Description

The slice spans the stage executor, three planners and the Backlog page.

- **`EstimateStageExecutor (worker)`** — runs `StageAgent` with `estimating-designs`, then the planners, then writes `docs/estimates/README.md` (overall estimate, percent complete, roadmap, Deferred) and `docs/estimates/{subsystem}.md` (ideal days per design).
- **`Descoper`** — applies the threshold rule with one split attempt, then the journey-main-path and out-of-scope rules, and annotates each deferred L2 in `docs/specs/L2.md`.
- **`BacklogPlanner`** — builds increments of one journey or part of one, orders them by journey number, and topologically sorts so no increment precedes one it depends on.
- **`BacklogIndex`** — Hewn database table of increments (number, title, journey, L2 IDs, estimate, status, PR number) updated by stage 9 and by stage 10 events.
- **`BacklogPage (Angular)`** — lists increments with status (Queued, In progress, Blocked, Merged, Deferred), estimate and PR link, and a separate Deferred section with reasons.

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines the level-1 (L1) requirement cited beside it. The text is copied from `docs/specs/L2.md`.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-018` | `L1-012` | **Estimate the work.**<br>1. Given stage 9 runs with `estimating-designs`, when it completes, then `docs/estimates/README.md` gives the overall estimate, percent complete and roadmap, and `docs/estimates/{subsystem}.md` gives an estimate in ideal days for each detailed design. |
| `L2-019` | `L1-012` | **Descope automatically.**<br>1. Given a design estimated at more than the descope threshold (3 ideal days by default, set by an Owner in Settings), when stage 9 runs, then the agent first tries to split it into designs of 3 days or less. If that fails, the design is descoped.<br>2. Given a design whose L2s appear in no journey's main path, or which the brief lists as out of scope or nice-to-have, when stage 9 runs, then it is descoped.<br>3. Given a design is descoped, when stage 9 completes, then it appears under "Deferred" in `docs/estimates/README.md` with its reason, and its L2s in `docs/specs/L2.md` gain the line `**Status:** Deferred ({reason})`.<br>4. Given deferred items, when a user opens the project's Backlog in Mission Control, then they are shown apart from the active backlog, with their reasons. |
| `L2-020` | `L1-012` | **Order the backlog.**<br>1. Given stage 9 completes, when the backlog is produced, then each increment covers one journey, or one part of a journey, with its L2 IDs, ordered by journey number, and no increment comes before an increment it depends on.<br>2. Given the backlog, when a user opens Backlog, then each increment shows its status (Queued, In progress, Blocked, Merged, Deferred), its estimate and a link to its pull request once one exists. |

## Diagrams

### System context

Hewn estimates with Claude and commits the plan; Owners and Viewers read the backlog in Mission Control.

![C4 system context for estimating, descoping and ordering the backlog](diagrams/c4-context.png)

### Containers

The worker computes and commits the plan, and reports the backlog to the Hewn API for the Backlog page.

![C4 container view for estimating, descoping and ordering the backlog](diagrams/c4-container.png)

### Components

The agent estimates; the descoper and planner are deterministic code applied to its estimates.

![C4 component view for estimating, descoping and ordering the backlog](diagrams/c4-component.png)

### Class structure

`Descoper` splits estimates into active designs and `DeferredItem`s; `BacklogPlanner` turns active designs into ordered `Increment`s with dependencies.

![Class diagram for estimating, descoping and ordering the backlog](diagrams/class-structure.png)

### Behaviour — estimate, descope and plan

Estimates are written (L2-018 AC1). Oversized designs are split or deferred (L2-019 AC1), off-path ones deferred (AC2) and annotated (AC3). Increments are ordered by journey and dependency (L2-020 AC1).

![Sequence diagram: estimate, descope and plan](diagrams/sequence-estimate-and-plan.png)

### Behaviour — view the backlog

Active increments show status, estimate and PR link (L2-020 AC2); deferred items appear apart with reasons (L2-019 AC4).

![Sequence diagram: view the backlog](diagrams/sequence-view-backlog.png)

## Decisions made while building the slice

- **Agent then planners.** Stage 9 is a definition in `DocumentStageExecutor`. The `estimating-designs` agent writes
  `docs/estimates/{subsystem}.md` (columns Design, Estimate (days), Complete) and splits oversized designs; the
  deterministic `Descoper` and `BacklogPlanner` (`worker/src/estimates/backlog-planner.ts`) then write
  `docs/estimates/README.md`, `docs/estimates/backlog.json` and the Deferred status lines.
- **Splits.** The commit mutation cannot delete, so a split design's README gains `**Status:** Split into …` and is
  ignored from then on; the new designs carry its L2s.
- **Descope rules, in order.** Above the threshold after the split attempt; listed under the brief's Out of scope
  or Nice to have (case-insensitive containment of the bullet and the design title); no L2 in any journey's
  `**Covers:**`; depends on a deferred design (repeated until stable). Each deferred design keeps its first reason.
- **Deferred L2s.** An L2 is marked only when every design covering it is deferred; the status line sits directly
  under its heading and is replaced, not duplicated, on a rerun.
- **Increments.** Journeys in number order; each journey's designs are placed after their dependencies (pulled
  forward from later journeys when needed), then split greedily into parts of at most the threshold, titled
  "{journey} (part k of n)". A dependency cycle fails the run naming the designs.
- **Threshold.** `HEWN_DESCOPE_THRESHOLD_DAYS` on the API (default 3) is sent with every lease until the Settings
  page (journey 28) stores it per project.
- **`BacklogIndex`.** The `increments` table: number, title, journey, L2 IDs, estimate, depends-on, status
  (Queued, InProgress, Blocked, Merged, Deferred), reason and pull request number. `PUT
  /api/worker/runs/{id}/backlog` (stage 9 only) replaces a direction's rows and appends `BacklogPlanned`; the API
  rejects numbering gaps and any dependency on a later or missing increment.
- **Deferred.** The Backlog page (L2-019 AC4, L2-020 AC2) with journey 12.
