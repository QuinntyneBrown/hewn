# 0030. The API updates a project's skills itself

- **Status:** Accepted
- **Date:** 2026-11-10
- **Requirements:** L2-008, L2-025

## Context

L2-008 asks that an Owner sees "Skills update available ({n} commits)" when Greenlit's default branch is ahead of
`.hewn/skills.lock`, and that Update skills opens a pull request updating the skill files and the lock, which merges
when checks pass. The bootstrap-skills design planned an `UpdateSkills` run executed by a worker. A run belongs to a
direction and a stage, and the orchestrator, leases, budgets and pipeline view all assume that. The mocks show the
dialog going busy, then either closing or saying why it failed ("Greenlit couldn't be fetched…"), with Try again.

## Decision

- **No run.** `POST /api/projects/{id}/skills-update` reads Greenlit, commits its skill files and the new lock to
  `hewn/update-skills-{short-sha}`, opens the pull request and answers with it, or with the error. The dialog's
  states are that one request.
- **Greenlit through git.** `GitSkillsSource` keeps a bare clone of `HEWN_SKILLS_SOURCE`, fetched at most once a
  minute, for both the commit count and the files. It works the same for GitHub and for the e2e stack's local
  repository.
- **A merger in the API.** `SkillsUpdateMerger` sweeps open updates every 10 seconds and merges when every check has
  passed. It rebases when the default branch moved, and leaves a pull request with a failing check open.

## Alternatives

- **A worker run with a pseudo-stage.** That would reuse the worker's commit and merge path, but every part of the
  pipeline would need to treat an update as no stage of any direction, and the dialog could only report a queued run.
- **GitHub's compare API for the count.** It doesn't reach the e2e stack's local Greenlit, and the files would still
  need a clone.

## Consequences

- The API needs git on its path.
- The update doesn't wait for a worker and doesn't stop the running increment; that increment finishes on the skills
  it started with.
- At most one update is open per project; `skills_updates` records each one.
