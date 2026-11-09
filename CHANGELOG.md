# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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
