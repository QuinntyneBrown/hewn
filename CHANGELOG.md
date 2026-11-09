# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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
