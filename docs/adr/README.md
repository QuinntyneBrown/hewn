# Architecture decision records

Read the ADRs that cover an area before changing it. New ADRs take the next number.

| # | Decision | Status |
|---|---|---|
| [0001](0001-sessions-and-dev-sign-in.md) | Cookie sessions against the allow list, with a dev sign-in until GitHub OAuth | Accepted |
| [0002](0002-sqlite-first.md) | SQLite is the only database provider for now | Accepted |
| [0003](0003-mission-control-uses-design-system-css.md) | Mission Control loads the design system's CSS and keeps the mocks' markup | Accepted |
| [0004](0004-video-tooling.md) | Journey videos: Greenlit's tooling, Kokoro narration, music under the voice | Accepted |
| [0005](0005-leases-on-sqlite.md) | Leases on SQLite: one conditional update, the epoch as a concurrency token, a shared worker token | Accepted |
| [0006](0006-commit-mutation-before-git-proxy.md) | Workers commit through the API's commit mutation until the git push proxy exists | Accepted |
| [0007](0007-magic-patterns-designs-hold-raw-html-states.md) | Magic Patterns designs hold one raw HTML file per state, and workers reach Magic Patterns directly | Accepted |
| [0008](0008-feature-scope-is-a-recorded-decision.md) | A feature's UI scope is a recorded decision, and later directions keep every number | Accepted |
| [0009](0009-live-progress-from-the-worker.md) | Live progress: workers name steps and batch log lines, and Hewn keeps a copy of each decision | Accepted |
| [0010](0010-spend-is-metered-per-call-against-a-configured-price-table.md) | Spend is metered per model call against a configured price table, and the budget stops the run after the call that reaches it | Accepted |
| [0011](0011-pause-takes-effect-at-the-next-checkpoint.md) | Pause takes effect at the next checkpoint, answered on the checkpoint call | Accepted |
| [0012](0012-cancel-reaches-the-worker-on-a-held-control-poll.md) | Cancel reaches the worker on a held control poll | Accepted |
| [0013](0013-stop-all-workers-halts-runs-on-the-control-poll.md) | Stop all workers halts runs on the control poll and a stored leasing switch | Accepted |
| [0014](0014-a-retry-is-a-new-run-leasable-after-its-backoff.md) | A retry is a new run, leasable once its backoff has passed | Accepted |
| [0015](0015-the-submission-limit-counts-stored-directions.md) | The direction submission limit counts stored directions | Accepted |
| [0016](0016-project-rows-are-read-on-request.md) | Project rows are read on request and pushed to a projects group | Accepted |
| [0017](0017-checks-arrive-by-signed-webhook-or-a-poll-after-silence.md) | Checks arrive by signed webhook, the worker's reads, or a poll after 60 s of silence | Accepted |
| [0018](0018-previews-are-served-from-a-signed-sandboxed-origin.md) | Previews are served from a separate origin, signed and sandboxed | Accepted |
| [0019](0019-traces-are-read-from-the-head-on-request.md) | Traces are read from the repository's head on request | Accepted |
| [0020](0020-decisions-are-listed-from-hewns-record.md) | Decisions are listed from Hewn's record, with the commit that wrote them | Accepted |
| [0021](0021-increment-videos-are-served-through-the-api.md) | Increment videos are served through the Hewn API from the commit that recorded them | Accepted |
| [0022](0022-the-api-serves-mission-control-and-ends-sessions-by-id.md) | The API serves Mission Control with its protections, and ends sessions by id | Accepted |
| [0023](0023-allow-list-changes-apply-on-the-next-request.md) | Allow-list changes apply on the next request, and new logins are confirmed with GitHub | Accepted |
| [0024](0024-installation-tokens-are-limited-to-one-repository.md) | Installation tokens are limited to one repository; creating one only administers | Accepted |
| [0025](0025-runs-are-isolated-in-the-worker-by-a-proxy-and-tool-gates.md) | Runs are isolated in the worker by an egress proxy, tool gates and a command sandbox | Accepted |
| [0026](0026-worker-tokens-are-hashed-and-revoked-through-the-control-poll.md) | Worker tokens are hashed, name their worker, and are revoked through the control poll | Accepted |
| [0027](0027-github-writes-and-lease-changes-share-a-run-lock.md) | GitHub writes and lease changes share a run lock | Accepted |
| [0028](0028-mission-control-runs-its-own-reconnect-schedule.md) | Mission Control runs its own reconnect schedule | Accepted |
| [0029](0029-a-direction-keeps-the-descope-threshold-it-was-submitted-with.md) | A direction keeps the descope threshold it was submitted with | Accepted |
| [0030](0030-the-api-updates-a-projects-skills-itself.md) | The API updates a project's skills itself | Accepted |
| [0031](0031-archiving-is-a-flag-beside-the-projects-status.md) | Archiving is a flag beside the project's status | Accepted |
