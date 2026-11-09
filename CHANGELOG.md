# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Two writes to one project at once (a worker's log batch and its model call) no longer pick the same event sequence
  number and fail with a 500; `EventAppender` serializes a project's writes.

### Added

- Stop and restart all workers (journey 8, L2-029 AC4, AC5): an Owner presses Stop all workers in the sidebar and
  confirms in a dialog listing the online workers. Leasing is switched off and stored, every active run halts at its
  checkpoint within 10 seconds (the worker hears `Halt` on its control poll), and nothing is leased, even after a
  restart, until the Owner presses Start workers; each halted run then resumes from its checkpoint
  (`POST /api/workers/stop`, `POST /api/workers/start`, `GET /api/workers`; ADR 0013). A banner shows on every page
  while workers are stopped, and a new Workers page lists each worker. A worker that does not answer is named in
  the dialog. Viewers see the banner but no control, and get 403.

- Cancel a direction (journey 7, L2-029 AC3, AC5, L2-004 AC4): an Owner presses Cancel on a queued, running or
  paused direction and confirms in a dialog. The direction, its run and its stage are Cancelled at once, the worker
  hears it on its held control poll (`GET /api/worker/runs/{id}/control`) and stops within 10 seconds, open pull
  requests stay open labelled `hewn:cancelled`, and the next queued direction starts
  (`POST /api/projects/{id}/directions/{d}/cancel`, `DirectionCancelled`; ADR 0012). A worker that does not answer
  is named in the dialog. Viewers see no control and get 403.

- Pause and resume a direction (journey 6, L2-029 AC1, AC2, AC5, L2-050 AC3): an Owner presses Pause on a running
  direction; the step in progress finishes and checkpoints, then the direction is Paused ("Paused by … at …") and
  nothing new starts. Resume continues the same run from the next step, and no completed step runs twice
  (`POST /api/projects/{id}/directions/{d}/pause` and `/resume`, `PauseRequested`, `DirectionResumed`; ADR 0011).
  Viewers see no control and get 403.

- Raise budget and resume (journey 5, L2-053 AC3, L2-029 AC5): on a direction Paused with "Budget reached", an
  Owner enters a new budget above the spend and presses Raise and resume; the budget is raised and the direction
  resumes from the step after its checkpoint in one action
  (`POST /api/projects/{id}/directions/{d}/raise-and-resume`, `BudgetRaised`). A budget at or below the spend is
  refused inline, a budget another session changed answers 409, and Viewers see no control and get 403.
- Limit spending (journey 4, L2-052, L2-053 AC1-AC3):
  - workers report every model call (`POST /api/worker/runs/{id}/model-calls`); Hewn prices it from a configured
    price table and records its tokens, model and cost against its run, stage, direction and project (ADR 0010);
  - spend shows live on the project header as a meter of the direction's budget (`SpendUpdated`);
  - at 80% a `BudgetWarning` raises a warning toast and turns the meter to warning;
  - at 100% the direction pauses with "Budget reached" after the current call, keeping its checkpoint;
  - Settings has Direction defaults: an Owner sets the default budget new directions start with
    (`GET`/`PUT /api/settings/direction-defaults`); Viewers see it read-only.
- Monitor a direction (journey 3, L2-030, L2-031, L2-033, L2-047 AC3):
  - the running stage shows its current step and latest log line, live, from new `StepStarted` and `LogLines`
    events; workers name each step (`PUT /api/worker/runs/{id}/step`) and send log lines in batches;
  - selecting a stage shows its runs, log, artifacts and decisions
    (`GET /api/projects/{id}/directions/{d}/stages/{n}`, `GET /api/projects/{id}/runs/{r}/logs`); workers report
    the decisions they commit (`POST /api/worker/runs/{id}/decisions`, `DecisionRecorded`, ADR 0009);
  - the live log follows new lines, holds when scrolled up with "{n} new lines — Jump to latest", and keeps at most
    500 lines in the page;
  - stage changes are announced in a polite live region at most once every 5 seconds;
  - the project page has loading and error states, and runs record when they started and which worker ran them.
- Add a feature (journey 2, L2-005, L2-010 AC6, L2-014 AC4, L2-017 AC3, L2-054):
  - New direction's Feature for a product adds a feature direction to an existing product through
    `POST /api/projects/{id}/directions`; `GET /api/projects` lists products and whether a feature would queue;
  - a feature direction skips Bootstrap, Stack and Scaffold, and also Designs and Design system when stage 1
    records that the user interface does not change (`PUT /api/worker/runs/{id}/scope`, ADR 0008);
  - a feature submitted while another direction is active queues behind it, first in, first out;
  - stages 2, 5 and 8 keep every existing design, requirement ID and journey number, and stage 9 plans only
    unbuilt designs;
  - the project page strikes through skipped stages, shows queued directions and explains a completed feature.
- Decisions and no approval steps (journey 1, L2-054 AC1-AC2, L2-028):
  - every agent session decides for itself under one shared instruction, with no tool for asking;
  - decisions are checked for their fields, and a decision that changes the architecture is recorded as a numbered ADR;
  - a pipeline e2e test proves a submitted direction reaches Complete with no human input.
- Stage 10, Increments (journey 1, L2-021 to L2-025, L2-023 AC1 and AC3, L2-024 AC1-AC2): each increment is
  delivered test first on `feature/{slug}` with red recorded, implemented until the stack's gate is green or
  Blocked after `HEWN_MAX_ITERATIONS`, recorded on video, opened as a pull request with the six-section body,
  squash-merged once checks pass (rebasing when the default branch moved) and followed by a progress commit.
- Stage 9, Estimates (journey 1, L2-018 AC1, L2-019 AC1-AC3, L2-020 AC1): estimates per design, automatic
  descoping with reasons and Deferred status lines, and a backlog of increments ordered by journey and
  dependency, stored in Hewn's new `increments` table through `PUT /api/worker/runs/{id}/backlog`.
- Stage 6, Scaffold (journey 1, L2-015 AC1-AC4, L2-036 AC2): the default .NET + Angular + Playwright template with
  a CI workflow, committed to `hewn/scaffold`, merged through a pull request once CI passes, with the CI checks
  then required on the default branch. New broker mutations `open_pull_request`, `merge_pull_request` and
  `protect_branch`, branch commits, and a pull request checks endpoint, all limited to stage 6.
- Stages 2 and 3 (journey 1, L2-010 AC1-AC5, L2-012 AC1-AC3): screens designed in Magic Patterns over MCP and
  exported to `docs/mocks/` with a manifest, validated for coverage, states, parsing and horizontal scroll; the
  design system extracted to `docs/design-system/`, validated for token groups and mock colour coverage, with
  Magic Patterns mismatches logged. A fake Magic Patterns MCP server backs tests and the e2e stack.
- Document stages 1, 4, 5, 7 and 8 (journey 1, L2-009, L2-013, L2-014, L2-016, L2-017): the worker checks out
  the product repository through `GET /api/worker/runs/{id}/repository/archive`, runs the stage's agent,
  validates the brief, stack decision, requirements, design coverage and journeys, and commits only the
  stage's documents and `docs/decisions.md`. A scripted agent stands in for the model.
- Stage 0, Bootstrap (journey 1, L2-007, L2-036 AC1 and AC3): the API creates the private product repository
  on the first lease and commits through a fenced, idempotent commit mutation; the worker copies Greenlit's
  skills, keeps existing folders and writes `.hewn/skills.lock`.
- Run a product direction through stages 0 to 10 (journey 1, L2-004 AC1-AC3): leased runs fenced by epoch,
  heartbeats and 60-second expiry, the pipeline orchestrator, the Mission Control hub with catch-up by
  sequence number, and the project page following the pipeline live to Complete.
- The worker (`worker/`): the work loop with heartbeats, checkpoints and resume, and a scripted executor for
  tests and demos.
- Submit a product direction (journey 1, L2-001): the New direction page, `POST /api/projects` with field
  validation and the GitHub write probe, the project page with every stage, and the `DirectionQueued` event.
- Backend solution (`Hewn.Domain`, `Hewn.Application`, `Hewn.Infrastructure`, `Hewn.Api`, `Hewn.Cli`) with
  cookie sessions against the allow list, a configuration-gated dev sign-in, anti-forgery on writes and the
  `hewn migrate | seed | reset` CLI.
- Angular workspace (`mission-control`, `api`, `components`) loading the design system's CSS.
- Playwright suite (behaviour, axe-core, visual parity with `docs/mocks`), CI workflow and `eng/` scripts.
- Video tooling (`tools/video-audio`, `tools/video-build`) with Kokoro narration and background music.
- L1 and L2 requirements in `docs/specs/`.
- Skills copied from Greenlit (`0e0d25a`) into `.claude/skills/` and `.agents/skills/`.
- Architecture decision records 0001 to 0004 in `docs/adr/`.
- Root documentation: README, license, contributing guide, code of conduct, security policy,
  support guide, agent guidance and GitHub templates.

### Changed

- The worker checkpoint endpoint answers 200 `{verdict: "Continue" | "Pause"}` instead of 204.

