# 0031. Archiving is a flag beside the project's status

- **Status:** Accepted
- **Date:** 2026-11-10
- **Requirements:** L2-003, L2-002

## Context

L2-003 AC1 asks that an archived project leaves the default Projects list, appears under the Archived filter and
can be restored. The Projects page filters by status on the client from `GET /api/projects` (ADR 0016), and its
status tabs count projects by `ProjectStatus` (Running, Idle, Paused, Blocked, Cancelled, Complete). The archived
mock shows the row's status as "Archived", and Restore brings the project back as it was.

## Decision

- `projects.ArchivedAt` and `ArchivedBy` record the archive. `ProjectStatus` is unchanged, and the row carries
  `archived: true`.
- The page leaves archived projects out of All, the status tabs and their counts. `?status=archived` lists only
  them, showing "Archived" in place of their status.
- Archive and Restore append `ProjectArchived` and `ProjectRestored`, so every open Projects page gets the row live.
- A project with a queued, running, paused or blocked direction can't be archived: 409 `active_direction`, "Cancel
  the running direction first". An archived project takes no new direction: 409 `project_archived`, "Restore the
  project first".

## Alternatives

- **An `Archived` project status.** Restore would need to recompute the status it had, and every reader of the
  status (the pipeline, the orchestrator, the summary) would need to handle a status no direction can reach.
- **Leaving archived projects out of `GET /api/projects`, with `?archived=true`.** The page would need two requests
  and two live streams for one list, unlike the other filters.

## Consequences

- Archived projects still cost a row in the list response; the page hides them.
- Deleting a project (L2-003 AC3) uses the same active-direction guard.
