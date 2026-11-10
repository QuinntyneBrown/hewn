# 0032. A project is deleted in one save

- **Status:** Accepted
- **Date:** 2026-11-10
- **Requirements:** L2-003

## Context

L2-003 AC3 asks that, once the Owner types the project name exactly, Hewn's records, logs and stored artifacts for
the project are removed and the GitHub repository is left untouched. The design planned a `Deleting` mark on the
project and a background `PurgeProjectJob`. Everything Hewn keeps for a project is rows in its one database:
directions and their stages, runs, events, run log lines, decisions, model calls, GitHub mutations, increments and
their checks, and skills updates. The failed mock tells the Owner "Nothing was removed; try again".

## Decision

- `DeleteProjectHandler` checks the active-direction guard (409 `active_direction`) and the typed name (400
  `confirm_name`), then removes every one of those rows and the project in one `SaveChanges`. The API answers 204
  once they are gone.
- It never calls GitHub.
- After the save, `ProjectDeleted { projectId }` goes to every Projects page and to the project's own page.

## Alternatives

- **A `Deleting` mark and a background purge job.** Two states to show, a job to retry and recover after a crash,
  and a project that half exists in between; for rows that one save removes in milliseconds.
- **Database cascades.** Most of these tables have no foreign keys to the project (events, log lines and model calls
  are keyed by run or project id only), so cascades would need a migration and would hide what is removed.

## Consequences

- A failure removes nothing, so the dialog's "Nothing was removed; try again" is true.
- A project with a very long history makes one larger request; if that ever matters, the handler can move to a job
  without changing the API's contract beyond answering 202.
- Anything Hewn stores for a project in future must be added to the handler and to `DeleteProjectTests`, which
  counts every table.
