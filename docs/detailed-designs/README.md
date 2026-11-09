# Detailed designs

Each folder below is one vertically sliced feature of Hewn. A feature's `README.md` gives its background, its building blocks, the L2 requirements it realizes and its C4, class and sequence diagrams. Requirements live in [`docs/specs/`](../specs/); mocks live in [`docs/mocks/`](../mocks/).

## projects

Creating, listing, archiving and deleting projects (L1-001).

| Feature | L2 requirements |
|---------|-----------------|
| [Submit a product direction](projects/submit-product-direction/README.md) | `L2-001`, `L2-028` |
| [Projects list](projects/projects-list/README.md) | `L2-002`, `L2-045` |
| [Archive and delete a project](projects/archive-and-delete-project/README.md) | `L2-003` |

## pipeline

Driving a direction through the ordered stages, retrying, pausing and recording decisions (L1-002, L1-015, L1-024).

| Feature | L2 requirements |
|---------|-----------------|
| [Run a direction through the pipeline](pipeline/run-direction/README.md) | `L2-004`, `L2-005`, `L2-028` |
| [Retry a failed stage](pipeline/retry-failed-stage/README.md) | `L2-006` |
| [Pause, resume, cancel and stop all](pipeline/pause-resume-cancel-stop/README.md) | `L2-029` |
| [Record agent decisions](pipeline/record-decisions/README.md) | `L2-054` |

## stages

The stage executors for stages 0 to 9 and the artifacts each one writes (L1-003 to L1-012).

| Feature | L2 requirements |
|---------|-----------------|
| [Bootstrap and update skills](stages/bootstrap-skills/README.md) | `L2-007`, `L2-008` |
| [Produce and validate stage documents](stages/produce-stage-documents/README.md) | `L2-009`, `L2-013`, `L2-014`, `L2-016`, `L2-017` |
| [Design the screens in Magic Patterns](stages/design-screens/README.md) | `L2-010` |
| [Extract the design system](stages/extract-design-system/README.md) | `L2-012` |
| [Scaffold the solution](stages/scaffold-solution/README.md) | `L2-015` |
| [Estimate, descope and order the backlog](stages/estimate-and-plan-backlog/README.md) | `L2-018`, `L2-019`, `L2-020` |

## increments

Stage 10: test first, implement, record a video, open the pull request and merge (L1-013, L1-018).

| Feature | L2 requirements |
|---------|-----------------|
| [Write the tests first](increments/write-tests-first/README.md) | `L2-021` |
| [Implement until green](increments/implement-until-green/README.md) | `L2-022` |
| [Record the increment video](increments/record-increment-video/README.md) | `L2-023` |
| [Open and merge the pull request](increments/open-and-merge-pull-request/README.md) | `L2-024`, `L2-025`, `L2-037` |

## agent-runtime

The worker loop, local and cloud packaging, recovery and agent isolation (L1-014, L1-019, L1-022).

| Feature | L2 requirements |
|---------|-----------------|
| [Worker loop, packaging and recovery](agent-runtime/worker-loop/README.md) | `L2-026`, `L2-027`, `L2-050` |
| [Agent isolation](agent-runtime/agent-isolation/README.md) | `L2-042` |

## mission-control

Real-time Mission Control screens: project page, live events, previews, artifacts, traceability and the UI baseline (L1-005, L1-016, L1-017, L1-020, L1-021).

| Feature | L2 requirements |
|---------|-----------------|
| [Project page and live log](mission-control/project-page-and-live-log/README.md) | `L2-030`, `L2-033` |
| [Real-time events and reconnection](mission-control/real-time-events/README.md) | `L2-031`, `L2-032` |
| [Preview designs and the design system](mission-control/preview-designs/README.md) | `L2-011`, `L2-012` |
| [Artifacts and traceability](mission-control/artifacts-and-traceability/README.md) | `L2-034`, `L2-035` |
| [Responsive, accessible and themed UI](mission-control/responsive-accessible-ui/README.md) | `L2-046`, `L2-047`, `L2-048`, `L2-045` |

## source-control

The GitHub App connection and repository setup (L1-018).

| Feature | L2 requirements |
|---------|-----------------|
| [Connect to GitHub](source-control/connect-to-github/README.md) | `L2-036` |

## security

Authentication, authorization, secrets, worker tokens, web protections and the audit log (L1-019).

| Feature | L2 requirements |
|---------|-----------------|
| [Sign-in and access control](security/sign-in-and-access/README.md) | `L2-038`, `L2-039` |
| [Secrets and redaction](security/secrets-and-redaction/README.md) | `L2-040` |
| [Worker tokens](security/worker-tokens/README.md) | `L2-041` |
| [Input validation and web protections](security/web-protections/README.md) | `L2-043` |

## governance

Usage tracking, spend and budgets (L1-023).

| Feature | L2 requirements |
|---------|-----------------|
| [Audit log](governance/audit-log/README.md) | `L2-044` |
| [Spend and budgets](governance/spend-and-budgets/README.md) | `L2-052`, `L2-053` |

## L2 coverage

Every L2 requirement is covered by at least one design (L2-016 AC2).

| L2 ID | Title | Designs |
|-------|-------|---------|
| `L2-001` | Submit a product direction | [submit-product-direction](projects/submit-product-direction/README.md) |
| `L2-002` | Projects list | [projects-list](projects/projects-list/README.md) |
| `L2-003` | Archive and delete a project | [archive-and-delete-project](projects/archive-and-delete-project/README.md) |
| `L2-004` | Run a product direction through every stage | [run-direction](pipeline/run-direction/README.md) |
| `L2-005` | Run a feature direction on an existing product | [run-direction](pipeline/run-direction/README.md) |
| `L2-006` | Stage failure and retry | [retry-failed-stage](pipeline/retry-failed-stage/README.md) |
| `L2-007` | Copy skills from Greenlit | [bootstrap-skills](stages/bootstrap-skills/README.md) |
| `L2-008` | Update a project's skills | [bootstrap-skills](stages/bootstrap-skills/README.md) |
| `L2-009` | Produce the product brief | [produce-stage-documents](stages/produce-stage-documents/README.md) |
| `L2-010` | Design the screens in Magic Patterns | [design-screens](stages/design-screens/README.md) |
| `L2-011` | Preview designs in Mission Control | [preview-designs](mission-control/preview-designs/README.md) |
| `L2-012` | Extract the design system | [extract-design-system](stages/extract-design-system/README.md), [preview-designs](mission-control/preview-designs/README.md) |
| `L2-013` | Choose the stack | [produce-stage-documents](stages/produce-stage-documents/README.md) |
| `L2-014` | Generate requirements | [produce-stage-documents](stages/produce-stage-documents/README.md) |
| `L2-015` | Scaffold the solution | [scaffold-solution](stages/scaffold-solution/README.md) |
| `L2-016` | Write detailed designs | [produce-stage-documents](stages/produce-stage-documents/README.md) |
| `L2-017` | Define user journeys | [produce-stage-documents](stages/produce-stage-documents/README.md) |
| `L2-018` | Estimate the work | [estimate-and-plan-backlog](stages/estimate-and-plan-backlog/README.md) |
| `L2-019` | Descope automatically | [estimate-and-plan-backlog](stages/estimate-and-plan-backlog/README.md) |
| `L2-020` | Order the backlog | [estimate-and-plan-backlog](stages/estimate-and-plan-backlog/README.md) |
| `L2-021` | Write the tests first | [write-tests-first](increments/write-tests-first/README.md) |
| `L2-022` | Implement until green | [implement-until-green](increments/implement-until-green/README.md) |
| `L2-023` | Record the increment video | [record-increment-video](increments/record-increment-video/README.md) |
| `L2-024` | Open the pull request | [open-and-merge-pull-request](increments/open-and-merge-pull-request/README.md) |
| `L2-025` | Merge automatically | [open-and-merge-pull-request](increments/open-and-merge-pull-request/README.md) |
| `L2-026` | Worker loop | [worker-loop](agent-runtime/worker-loop/README.md) |
| `L2-027` | Same behaviour locally and in the cloud | [worker-loop](agent-runtime/worker-loop/README.md) |
| `L2-028` | No approval steps | [submit-product-direction](projects/submit-product-direction/README.md), [run-direction](pipeline/run-direction/README.md) |
| `L2-029` | Pause, resume, cancel and stop all | [pause-resume-cancel-stop](pipeline/pause-resume-cancel-stop/README.md) |
| `L2-030` | Project page | [project-page-and-live-log](mission-control/project-page-and-live-log/README.md) |
| `L2-031` | Real-time events | [real-time-events](mission-control/real-time-events/README.md) |
| `L2-032` | Reconnect without losing events | [real-time-events](mission-control/real-time-events/README.md) |
| `L2-033` | Live log stream | [project-page-and-live-log](mission-control/project-page-and-live-log/README.md) |
| `L2-034` | Versioned artifacts | [artifacts-and-traceability](mission-control/artifacts-and-traceability/README.md) |
| `L2-035` | Traceability view | [artifacts-and-traceability](mission-control/artifacts-and-traceability/README.md) |
| `L2-036` | Connect to GitHub | [connect-to-github](source-control/connect-to-github/README.md) |
| `L2-037` | Check status | [open-and-merge-pull-request](increments/open-and-merge-pull-request/README.md) |
| `L2-038` | Authentication | [sign-in-and-access](security/sign-in-and-access/README.md) |
| `L2-039` | Authorization | [sign-in-and-access](security/sign-in-and-access/README.md) |
| `L2-040` | Secrets | [secrets-and-redaction](security/secrets-and-redaction/README.md) |
| `L2-041` | Worker authentication | [worker-tokens](security/worker-tokens/README.md) |
| `L2-042` | Agent isolation | [agent-isolation](agent-runtime/agent-isolation/README.md) |
| `L2-043` | Input validation and web protections | [web-protections](security/web-protections/README.md) |
| `L2-044` | Audit log | [audit-log](governance/audit-log/README.md) |
| `L2-045` | Performance targets | [projects-list](projects/projects-list/README.md), [responsive-accessible-ui](mission-control/responsive-accessible-ui/README.md) |
| `L2-046` | Responsive layout | [responsive-accessible-ui](mission-control/responsive-accessible-ui/README.md) |
| `L2-047` | Accessibility | [responsive-accessible-ui](mission-control/responsive-accessible-ui/README.md) |
| `L2-048` | Light and dark themes | [responsive-accessible-ui](mission-control/responsive-accessible-ui/README.md) |
| `L2-049` | Logs, metrics and traces | [observability-and-health](operations/observability-and-health/README.md) |
| `L2-050` | Durable state and recovery | [worker-loop](agent-runtime/worker-loop/README.md) |
| `L2-051` | Health checks | [observability-and-health](operations/observability-and-health/README.md) |
| `L2-052` | Track usage and spend | [spend-and-budgets](governance/spend-and-budgets/README.md) |
| `L2-053` | Budgets | [spend-and-budgets](governance/spend-and-budgets/README.md) |
| `L2-054` | Agents decide and record decisions | [record-decisions](pipeline/record-decisions/README.md) |
