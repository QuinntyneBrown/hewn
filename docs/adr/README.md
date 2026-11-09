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
