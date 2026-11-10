# 0019. Traces are read from the repository's head on request

- **Status:** Accepted
- **Date:** 2026-11-10
- **Requirements:** L2-035, L2-034

## Context

Traceability shows, for any L2, its L1, the designs that cover it, the journeys it appears in, the test files whose
`Traces to:` header names it and the pull requests whose titles name it, and marks an L2 with no test "No
acceptance test" unless it is Deferred (L2-035). The artifacts-and-traceability design planned a `TraceIndexer`
background job: after stages 5, 7 and 8 and each merge, it would rebuild a `trace_links` table at the new SHA, read
by a `TraceabilityController`. Journey 16 built artifacts on read from the broker's commit records instead of an
`ArtifactRecorder` and table.

## Decision

- **Read on request, at the head.** `GET /api/projects/{id}/traceability` downloads one archive of the default
  branch (the same tarball workers use) and lists the repository's pull requests once. It returns every L2 with its
  whole trace; Mission Control picks the one in `?l2=`. The archive's top folder names the commit, so every answer
  says which short SHA it was read at.
- **What names an L2.** The ID is matched whole (`L2-001` is not in `L2-0010`):
  - L2s are the `## L2-NNN: Title` headings of `docs/specs/L2.md`, with `**Traces to:** L1-NNN` and an optional
    `**Status:** Deferred (reason)` line under each. L1 titles come from `docs/specs/L1.md`.
  - Designs are `docs/detailed-designs/{subsystem}/{feature}/README.md` files that name the ID, titled by their
    first `# ` heading.
  - Journeys are the `## N. Title` sections of `docs/journeys.md` that name it.
  - Tests are files outside `docs/`, `.claude/`, `.agents/`, `.hewn/` and `.github/` whose first 20 lines hold a
    `Traces to:` comment (`//`, `#`, `--`, `*`, `/*` or `<!--`) naming it. Binary and over-512 KB files are skipped.
  - Pull requests are any, open or merged, whose title names it. Hewn's increments title them
    `{journey} (journey N, L2-xxx)` (L2-024).
- **A malformed L2.md is an error, not a guess.** An `## L2-` heading that doesn't parse, or a repeated ID, is
  `502 github_failed` titled "docs/specs/L2.md couldn’t be parsed at {sha7} (… on line N)". Nothing is written.
- **Fresh by events.** Mission Control reads the trace again on `StageChanged` and `IncrementChanged`, the events
  that follow the commits and merges the index would have waited for.

## Alternatives considered

- **The planned `TraceIndexer` and `trace_links` table**: a job, a table and a migration to keep in step with the
  repository, and a trace that lags or misses commits made outside Hewn. Reading at the head is always current.
- **One request per L2 (`?l2=`)**: the list needs every L2's Deferred flag and, for search, its title anyway, and
  each request would download the same archive.
- **Reading files one by one through the contents API**: dozens of calls for designs and every test file; the
  archive is one.
- **PR titles from the increments table**: misses pull requests Hewn didn't open, such as the scaffold's or a
  person's, and doesn't read the titles the requirement names.

## Consequences

- Each open of the tab costs one archive download and up to ten pages of pull requests. A large repository makes
  it slower; caching by head SHA can come later without changing the API.
- A trace reflects the default branch only: tests on an open pull request's branch don't count until it merges.
- Requirement files that stray from the format the stages write show as an error that names the line, so they get
  fixed rather than half-traced.
