# 0008. A feature's UI scope is a recorded decision, and later directions keep every number

- **Status:** Accepted
- **Date:** 2026-11-09
- **Requirements:** L2-005, L2-010, L2-014, L2-017, L2-054

## Context

A feature direction (L2-005) skips Bootstrap, Stack and Scaffold, and also Designs and Design system when it
has no user interface change. That last part is a judgement only the agent can make, and L2-054 says agents
answer such questions themselves and record them in `docs/decisions.md`. The orchestrator in the API still has
to know the answer before it queues stage 2.

A feature also runs stages 2, 5 and 8 over documents an earlier direction wrote. Requirement IDs and journey
numbers appear in tests, pull request titles and videos, so a later direction must never renumber them.

## Decision

- Stage 1 of a feature direction answers one fixed question, "Does this feature change the user interface?",
  in `docs/decisions.md`. An answer starting "No" means no change. The worker validates that the entry exists,
  commits it with the brief, then reports it through `PUT /api/worker/runs/{id}/scope`
  `{hasUiChange, rationale}`. The API stores the decision on the direction and, without a UI change, marks
  stages 2 and 3 Skipped with `StageChanged` events and a `DirectionScoped` event. Only stage 1 of a feature
  direction may report it (`400 scope_not_allowed`).
- Stages 0, 4 and 6 are Skipped when the feature direction is created, so the project page shows the plan at
  once. A feature submitted while another direction is active stays Queued; when the active direction
  completes, the orchestrator starts the oldest queued one.
- Before a document stage's agent runs, the worker keeps a copy of `docs/specs/L1.md`, `docs/specs/L2.md`,
  `docs/journeys.md` and `docs/mocks/manifest.json`. Validation then fails when a requirement, journey or
  design has disappeared, or when a new one takes a number at or below the highest existing one.
- Stage 9 plans increments only for designs below 100% complete. After each merge, progress refreshes the
  estimates README from the committed `backlog.json` rather than planning again, so the roadmap stays stable.

## Alternatives considered

- **A structured scope file written by the agent** (`.hewn/scope.json`): another artifact to validate and
  commit, and the decision log already holds the answer with its rationale.
- **Let the API parse `docs/decisions.md`**: the API would need the repository contents at stage end, and the
  parsing rule would live in two places.
- **An `IdAllocator` that hands the agent IDs**: the agent can number from the files it reads; checking the
  result is simpler and catches any agent that gets it wrong.

## Consequences

- The UI-change question is fixed text; changing it means changing the worker and the scripted agent together.
- A dropped or renumbered requirement, journey or design fails the stage with a message naming it, and nothing
  is committed.
- Cancelling a direction (journey 6) must also start the next queued direction, through the same orchestrator
  path.
