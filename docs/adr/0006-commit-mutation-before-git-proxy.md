# 0006. Workers commit through the API's commit mutation until the git push proxy exists

- **Status:** Accepted
- **Date:** 2026-11-09
- **Requirements:** L2-007, L2-036 AC3, L2-050

## Context

The [Connect to GitHub](../detailed-designs/source-control/connect-to-github/README.md) design routes every
worker push through `GitPushProxy`, a git smart-HTTP reverse proxy in the API reached from the run container
through the worker's git sidecar. That keeps GitHub credentials out of workers and fences each push by epoch.
Stage 0 is the first stage that writes to a product repository, and it writes a known, small set of files.

## Decision

Until a stage needs a real working tree pushed (the scaffold and increment stages), workers write through a
`commit` mutation on the GitHub write broker: `POST /api/worker/runs/{id}/github/mutations` with the files
(base64), a message and an idempotency key `{run}/{step}/commit`.

- The API fences the request by worker and epoch, checks every path against the stage's allow list
  (`CommitPolicy`; stage 0 may write only `.claude/skills/`, `.agents/skills/` and `.hewn/skills.lock`),
  and commits with a repository-scoped installation token through GitHub's Git Data API.
- The result is stored in `github_mutations` under the key, so a resumed step gets the first commit's SHA
  instead of committing twice.
- Workers still hold no GitHub credential. Skill folders already in the repository are read through
  `GET /api/worker/runs/{id}/repository/skill-folders`.

## Consequences

- Stage 0 is fenced, idempotent and confined to its paths today, without the proxy, the sidecar or a run
  container.
- File contents travel as JSON, which suits stage 0's few hundred files but not a full working tree. The git
  push proxy, with ref-level checks and the run write lock, comes with the scaffold stage.
- Two concurrent requests with the same key can both reach GitHub before either is stored; the run write
  lock, also deferred to the proxy, closes that window. A single leased worker does not send them.
