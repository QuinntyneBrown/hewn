# 0020. Decisions are listed from Hewn's record, with the commit that wrote them

- **Status:** Accepted
- **Date:** 2026-11-10
- **Requirements:** L2-054

## Context

Agents answer the questions skills would have asked the user and append each answer to the product's
`docs/decisions.md` (L2-054 AC2). Mission Control must list them newest first, filter them by stage and link each
to the commit that recorded it (AC3). The record-decisions design planned a `DecisionIndex` table mirroring the file,
filled by a `DecisionRecorded` report carrying the commit SHA, and a `DecisionsController`. Hewn already keeps each
reported decision in `run_decisions` for a stage's Decisions tab, and keeps every commit a run makes, with its
paths, in its GitHub mutations. ADR 0019 reads traces from the repository instead, because a trace depends on files
anyone can change; a decision is written once, by a run, and the file only grows.

## Decision

- **List from `run_decisions`.** `GET /api/projects/{id}/decisions?stage=` reads Hewn's database, newest first by the
  time each was reported. No GitHub call is needed, so the list is fast and works while GitHub is down.
- **The commit is captured when the decision is reported.** Workers commit `docs/decisions.md` first and report
  the decisions after, so the API stores the run's latest commit whose paths include `docs/decisions.md` as the
  decision's commit SHA. Stage 10 now reports the decisions each increment commit writes, which it didn't before.
- **ADRs are reported with the decision.** The worker reads the entry's `**ADR:**` link and reports
  `docs/adr/NNNN-slug.md`, validated by pattern; the page links it at the recording commit.
- **The stage filter is in the address** (`?stage=`), and the API filters, so a link opens one stage.

## Alternatives

- **Parse `docs/decisions.md` at the head and find each entry's commit from history.** Needs a file read per commit
  that touched the log (or a blame), and the file only records the date, not the time.
- **A separate `DecisionIndex` table.** Duplicates `run_decisions`.

## Consequences

- Decisions written to `docs/decisions.md` outside Hewn don't appear until a run reports them.
- Decisions reported before this change have no commit link; new ones always do.
- A decision committed on an increment's feature branch links to that branch commit, which GitHub keeps after the
  squash merge.
