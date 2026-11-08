## Project overview

Hewn is a software factory. A person gives a **direction** (build a new product, or add a feature
to an existing one) and agents, running in a continuous loop on local or cloud workers, carry it
through a fixed pipeline to merged, tested code: brief, designs in Magic Patterns, design system,
stack, requirements, scaffold, detailed designs, user journeys, estimates with automatic
descoping, and test-first increments that each end in a video, a pull request and a merge. No
step waits for human approval. The .NET API owns projects, directions, the work queue and the
event stream; the TypeScript worker runs the agents; the Angular **Mission Control** app shows
everything in real time over SignalR.

## Repository layout

- `backend/`: .NET solution
- `worker/`: agent runtime and its container image
- `frontend/`: Angular workspace (`mission-control`, `api`, `components`)
- `e2e/`: Playwright suite
- `deploy/`: local Docker Compose stack and cloud infrastructure as code
- `docs/specs/`: requirements (`L1.md` high level, `L2.md` detailed with acceptance criteria)
- `docs/mocks/`: Mission Control designs exported from Magic Patterns, the source of truth for the UI
- `docs/design-system/`: tokens and components extracted from the mocks
- `docs/detailed-designs/`: per-feature designs derived from the requirements
- `docs/adr/`: architecture decisions. Read the relevant ADRs before changing the areas they cover.
- `eng/`: local engineering scripts (`Test-Backend.ps1`, `Start-Api.ps1`, `Start-E2eApi.ps1`, `Start-LocalStack.ps1`)
- `.claude/skills/`, `.agents/skills/`: skills copied from Greenlit

See `README.md` for setup and development commands.

## Domain vocabulary

Use these words in code, docs and UI. Do not invent synonyms.

- **Project**: one product being built. Owns one GitHub repository.
- **Direction**: an instruction to build a product (*product direction*) or add a feature
  (*feature direction*). One direction is active per project at a time; others queue.
- **Stage**: one of the pipeline steps 0–10. Status: `Pending`, `Running`, `Succeeded`, `Failed`,
  `Skipped`.
- **Run**: one execution of one stage for one direction. Has steps and checkpoints.
- **Increment**: one backlog item delivered by stage 10: tests, implementation, video, PR, merge.
- **Worker**: a process that leases runs and executes agents. Location: `Local` or `Cloud`.
- **Lease**: a worker's claim on a run, kept alive by heartbeats.
- **Decision**: a question an agent answered for itself, recorded with its rationale.
- **Owner** and **Viewer**: the two roles. Only an Owner gives direction or stops work.

## Backend architecture

Layer dependency direction (strict):

- `Hewn.Domain`: entities and enums, no dependencies
- `Hewn.Application`: MediatR handlers, validators, DTO contracts, `IAppDbContext`
- `Hewn.Infrastructure`: `AppDbContext`, EF configurations and migrations, GitHub App client,
  secret store, event store
- `Hewn.Api`: controllers, SignalR hubs (`/hubs/mission-control`, `/hubs/workers`), webhooks,
  `Program.cs`, DI composition, middleware
- `Hewn.Cli`: `hewn migrate`, `seed`, `reset`

Non-obvious rules:

- Business rules live in handlers and domain services, not controllers or hubs.
- The API does **not** apply EF migrations on startup. Run `hewn migrate` explicitly.
- Every state change that clients see is written to the event store first, with the next
  per-project sequence number, and then broadcast. Never broadcast an event that was not stored.
- Persist before acknowledging. A direction, run or event is in the database before the API
  answers.
- Endpoints and hubs require authentication by default (fallback policy). Only `/health/*` and the
  GitHub webhook are anonymous, and the webhook verifies its signature.
- Project data is scoped to the caller. Asking for a project you cannot see returns 404.
- Errors are ProblemDetails with a `code` extension where a client needs to branch on them.
- Never return, log or emit a secret. Pass anything that could contain one through the redactor.

### Tests

Tests never need a database server: API and Infrastructure tests run on a per-fixture in-memory
SQLite database. GitHub, the model API and Magic Patterns are replaced by fakes in every test.
`pwsh eng/Test-Backend.ps1` runs the suite as CI does.

## Worker architecture

- The work loop: register, wait for work (server push, polling no more often than every 15
  seconds), lease one run, heartbeat every 10 seconds, execute steps, checkpoint after each step,
  release.
- A checkpoint is the end of a completed step, committed to the run's branch. Resuming never
  repeats a completed step.
- Each run executes in its own container and workspace. The network egress allow list is GitHub,
  the model API, the Magic Patterns MCP server and the stack's package registries. Adding to it
  needs an ADR.
- Each stage has a tool allow list. A tool call outside it is denied and logged as a security
  event.
- Agents never wait for a person. When a skill asks the user a question, the agent answers it and
  records a decision in `docs/decisions.md`.
- All UI design goes through the Magic Patterns MCP server. Agents never hand-write mocks, and
  never fall back to doing so when Magic Patterns is unavailable.
- The same image runs locally and in the cloud. Only configuration differs.

## Frontend architecture

The workspace has three projects under `frontend/projects/`: `mission-control` (the app), `api`
(service contracts, implementations, the SignalR client, view models) and `components` (`hw-*` UI
atoms, the design system).

### Conventions enforced across the codebase

- Prettier owns formatting and angular-eslint owns lint. CI fails on either.
- Component selectors use `hw-*`. TypeScript class, file and folder names omit the `Hw` prefix.
- Components keep the mocks' class names and accessible state semantics. E2E locators depend on
  that parity.
- Read design tokens by role, never by hex value.
- API services have a contract and an injection token. Pages depend on the token, not the
  concrete implementation. `app.config.ts` is the composition root.
- Live state comes from the SignalR client in `api`, which owns reconnects and catch-up by
  sequence number. Components never open their own hub connection.
- Status is never carried by colour alone: every status has an icon and a text label.
- Long logs are virtualized. Status announcements go through a throttled polite live region.
- Exported mocks are only ever shown in the sandboxed preview origin, never inline.
- Use Angular CDK Dialog and Overlay for modal behavior. Don't hand-roll modals.

## E2E architecture (Playwright)

- Page Object Model: one page object per screen under `e2e/pages/`, owning the selectors and the
  interactions. Tests state intent; page objects know the DOM. Never put a selector in a test.
- Specs run against the API started by `eng/Start-E2eApi.ps1`, with a fake worker that replays
  scripted runs so pipeline behavior is deterministic.
- Visual regression (`e2e/tests/visual/`) compares the app to `docs/mocks` region by region.
  Update baselines only for intentional design changes, after updating the design first.
- axe-core runs on every page and state in `e2e/tests/a11y/`.
- Run frontend tests in Chromium only.

## Incremental implementation and ATDD (mandatory)

Designs and the design system are design artifacts. ATDD does not apply to them. Do not write
tests for mocks or the design system.

Every new feature or change to production behavior MUST have a requirement, a detailed design,
and, for UI changes, a Magic Patterns design exported to `docs/mocks/` before implementation
begins. This applies to production-code changes only.

Every production behavior implementation MUST invoke and follow the `implementing-incrementally`
skill before any code is written, combined with acceptance test-driven development. Plan small,
reviewable slices, then complete one slice at a time: write Given/When/Then acceptance criteria,
write the acceptance test, and run it to prove it fails for the expected reason BEFORE writing
production code. Implement only what satisfies that slice, refactor with tests green, and run the
relevant regression checks. Do not move to the next slice until those checks pass. No bulk
implementation, no tests added afterwards, and no weakening tests to manufacture a pass.

Every acceptance test file starts with a header naming the requirements it covers:

```typescript
// Acceptance Test
// Traces to: L2-026
// Description: A worker that stops heartbeating loses its lease after 60 seconds
```

Back end: integration tests against the API. Worker: tests against a fake API, GitHub, model and
Magic Patterns. Front end: Playwright, using the Page Object Model.

### Never write architecture tests

Never add a test that asserts the shape of the codebase rather than its behavior: no structure,
layout or naming tests, no banned-API scans, no tests that parse this repository's own
specifications. (Hewn's *product* validates the requirements it generates for other repositories;
that is behavior and is tested as such.)
