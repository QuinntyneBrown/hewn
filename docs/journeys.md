# User journeys

Highest value first: delivery, oversight, recovery, setup, then maintenance. Scope: [requirements](specs/L2.md) and [detailed designs](detailed-designs/README.md).

Effort: estimated ideal days for one intermediate .NET/Angular/TypeScript developer, including acceptance tests. Shared foundations are assumed; overlapping journeys are not additive.

| # | Name | Description | Effort (days) |
|---|---|---|---:|
| 1 | Build a new product | Submit a direction; receive designs, documentation, and tested, automatically merged code. | 70 |
| 2 | Add a feature | Extend an existing product while preserving requirements and journey numbering. | 12 |
| 3 | Monitor a direction | Follow stages, runs, steps, and live logs as work progresses. | 9 |
| 4 | Limit spending | Set budgets, track usage, receive warnings, and automatically pause overspending. | 8 |
| 5 | Raise budget and resume | Increase a depleted budget and continue work in one action. | 3 |
| 6 | Pause and resume a direction | Pause after the current step; resume without repeating completed work. | 4 |
| 7 | Cancel a direction | Stop unwanted work while retaining and labelling open pull requests. | 3 |
| 8 | Stop and restart all workers | Halt every worker; explicitly restart work when ready. | 4 |
| 9 | Recover a failed stage | Inspect failure details, exhaust automatic retries, then manually retry. | 5 |
| 10 | Queue further directions | Submit additional directions; execute them sequentially within each project. | 3 |
| 11 | Find a project | Filter projects by status; compare progress, spending, and recent activity. | 4 |
| 12 | Review the backlog | Inspect ordered increments, estimates, progress, and deferred work with reasons. | 5 |
| 13 | Follow an increment to merge | Inspect test results, blocked iterations, pull requests, checks, and automatic merges. | 7 |
| 14 | Preview product designs | Browse screens and states across sizes, themes, and Magic Patterns links. | 6 |
| 15 | Browse the design system | Inspect generated tokens and component pages in a sandboxed preview. | 3 |
| 16 | Inspect versioned artifacts | Open stage outputs at their exact GitHub commit versions. | 4 |
| 17 | Trace a requirement | Follow requirements through designs, journeys, tests, and pull requests. | 6 |
| 18 | Review agent decisions | Filter autonomous answers by stage; inspect rationale and recorded commits. | 4 |
| 19 | Watch an increment demonstration | Play captioned walkthroughs of delivered journeys; inspect video failure notes. | 5 |
| 20 | Sign in and sign out | Authenticate through GitHub; enforce allowed accounts, session expiry, and sign-out. | 5 |
| 21 | Manage Owner and Viewer access | Add or remove allowed accounts; enforce roles and project visibility. | 5 |
| 22 | Connect a GitHub repository | Use an existing repository or automatically create a protected private repository. | 9 |
| 23 | Run workers locally or in cloud | Start the same worker image in either location and process directions. | 12 |
| 24 | Manage worker tokens | Create expiring tokens, reveal once, and revoke connected workers. | 4 |
| 25 | Inspect worker activity | View worker location, version, status, current project, and heartbeat. | 3 |
| 26 | Continue after a worker or server crash | Recover durable work from checkpoints without duplicate steps or stale writes. | 10 |
| 27 | Reconnect Mission Control | Restore live updates after disconnection without missing or duplicating events. | 5 |
| 28 | Configure automatic descoping | Set the effort threshold governing automatic splitting and deferral. | 2 |
| 29 | Update project skills | Review available Greenlit updates; automatically merge refreshed skills after checks. | 4 |
| 30 | Archive and restore a project | Hide inactive projects; restore them from the archived list. | 2 |
| 31 | Delete a project | Confirm deletion of Hewn records while preserving the GitHub repository. | 3 |
| 32 | Review the audit log | Filter immutable records of access, directions, controls, tokens, and merges. | 4 |
| 33 | Use Mission Control on mobile | Navigate every page across phone, tablet, and desktop layouts. | 5 |
| 34 | Use keyboard and assistive technology | Complete journeys with keyboard navigation, accessible announcements, and reduced motion. | 6 |
| 35 | Choose a theme | Select Light, Dark, or System; preserve preference and readable contrast. | 2 |
| 36 | Diagnose platform health | Inspect health checks, correlated logs, traces, and operational metrics. | 6 |
| 37 | Configure protected service credentials | Supply encrypted integration credentials; keep secrets out of outputs and workspaces. | 6 |

All journeys include applicable validation, permissions, error states, and security protections. Product delivery includes stages 0–10, automatic decisions, descoping, isolated agents, and test-first increments.
