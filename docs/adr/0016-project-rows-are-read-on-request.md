# 0016. Project rows are read on request and pushed to a projects group

- **Status:** Accepted
- **Date:** 2026-11-09
- **Requirements:** L2-002, L2-031, L2-045

## Context

The Projects page shows each project's stage, status, percent complete, spend and last activity, newest first
(L2-002 AC1), and updates a row within 1 second when the project changes (AC4). The projects-list design proposed
a `project_summaries` read model kept current by a `ProjectSummaryProjector`, publishing `ProjectChanged` to each
project's hub group. L2-045 AC2 asks for a p95 of 300 ms or less on the read APIs with 50 projects and 20 workers.

## Decision

- **Rows are read on request.** `ProjectSummaryReader` builds each row from the project, its directions and stages,
  its leased runs (for the step), its increments (for stage 10's progress) and its latest stored event (for last
  activity). One reader serves `GET /api/projects` and the live updates, so they always agree.
- **Live rows go to a projects group.** A client on the Projects page calls `JoinProjects` on the Mission Control
  hub. After events are stored and broadcast, the publisher reads each affected project's row and sends it to
  that group as `ProjectSummary`. Log lines and decisions never change a row, so they don't trigger a read. A new
  project's row arrives the same way, so the page adds it.
- **The row describes the current direction**: the active one, else the latest. Its stage is the first not yet
  Succeeded or Skipped, else the last; percent complete is the share of its planned stages that Succeeded, with
  stage 10's merged increments as a fraction, and 100 once Complete; spend is the total across all directions.
- **Status is the project's own.** A project whose last direction finished is Idle (L2-004 AC3); nothing sets
  Complete yet, so the Complete filter is empty until something does.

## Alternatives considered

- **A `project_summaries` table kept by a projector**: one more table and a migration, kept in step with every
  event, for 50 projects. Reading on request measured a p95 of 15 ms for the list under 20 concurrent clients.
- **Joining every project's group from the list page**: one hub call per project, and a new project would never
  appear.
- **Refetching the whole list on any event**: one list read per event per open page, instead of one row read
  per change.

## Consequences

- The list query grows with the number of projects; it should become a read model if the factory runs hundreds.
- Last activity in an open list moves on the next row-changing event, not on every log line.
