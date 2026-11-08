# Contributing to Hewn

Thank you for your interest in improving Hewn. This project is a software factory: a .NET API, a
TypeScript agent worker, the Angular Mission Control app, and a Playwright test suite.

## Before you start

- Read [AGENTS.md](AGENTS.md). It is the single source of guidance for working in this
  repository.
- Check existing issues and pull requests to avoid duplicate work.
- Open an issue first for user-visible behavior changes, larger refactors, or changes that affect
  API, SignalR event or worker protocol contracts.
- Keep pull requests focused on one fix, feature, or documentation update.
- Include screenshots, a video or Playwright evidence for visible UI changes.

## Development setup

```powershell
cd frontend
npm ci

cd ../worker
npm ci

cd ../e2e
npm ci
npx playwright install chromium

cd ../backend
dotnet restore ./Hewn.sln
```

`pwsh eng/Start-LocalStack.ps1` resets and seeds a SQLite database, then starts the API, Mission
Control and one local worker. See the [README](README.md#configuration) for the settings each
part needs.

## Project layout

| Path                     | Purpose                                                                  |
| ------------------------ | ------------------------------------------------------------------------ |
| `backend/`               | .NET solution, Clean Architecture layers, EF Core, API, SignalR hubs, CLI, tests |
| `worker/`                | Agent work loop, stage runners, Claude Agent SDK integration, container image |
| `frontend/`              | Angular Mission Control app plus `api` and `components` libraries         |
| `e2e/`                   | Playwright behavior, accessibility and visual tests                       |
| `docs/specs/`            | L1 and L2 requirements                                                    |
| `docs/mocks/`            | Designs exported from Magic Patterns, the source of truth for the UI      |
| `docs/detailed-designs/` | Per-feature designs                                                       |
| `docs/adr/`              | Architecture decision records                                             |
| `eng/`                   | Local engineering automation scripts                                      |

## How a change is made

Hewn is built with the same process it runs. Every production behavior change follows it:

1. **Requirement.** Add or update the L2 in `docs/specs/L2.md`, tracing to an L1. Keep existing
   IDs; new requirements take the next free number.
2. **Design.** Design any UI change in Magic Patterns and export it to `docs/mocks/`. Do not
   hand-write mocks.
3. **Detailed design.** Add or update the feature's design in `docs/detailed-designs/`.
4. **Test first.** Commit failing acceptance tests. Every test file starts with a
   `Traces to: L2-xxx` header.
5. **Implement** in small slices until the tests pass.
6. **Pull request** titled `{journey title} (journey N, L2-xxx)`, using the
   [pull request template](.github/PULL_REQUEST_TEMPLATE.md).

## Coding guidelines

- Keep backend business rules in application handlers and domain services, not controllers or
  hubs.
- Keep EF migrations explicit. The API must not apply migrations on startup.
- Keep seed data idempotent and safe to rerun.
- Every SignalR event carries a per-project sequence number. Never add an event that bypasses
  the event store.
- Workers talk only to the API, GitHub, the model API, Magic Patterns and package registries.
  Adding any other network destination needs an ADR.
- Never log, return or emit a secret. Use the redaction helpers for anything that might contain
  one.
- Keep visual changes consistent with `docs/mocks/` unless the pull request intentionally updates
  the design. Then update the design first and re-capture baselines (`npm run baseline` in
  `e2e/`).
- Frontend and worker code is formatted with Prettier and linted with ESLint. Run `npm run lint`
  and `npm run format:check` before opening a pull request.
- Avoid unrelated formatting churn and broad refactors in feature or bug-fix pull requests.

## Tests

Run the checks that match your change. For cross-stack changes, run all of them.

```powershell
# Backend build and tests
pwsh eng/Test-Backend.ps1

# Worker
cd worker
npm run lint
npm test

# Frontend
cd frontend
npm run format:check
npm run lint
npm test
npm run build

# End to end
cd e2e
npm run test:behavior
npm run test:a11y
npm run test:visual
```

## Pull requests

- Branch from `main` as `feature/{slug}` or `fix/{slug}`.
- Fill in every section of the pull request template, including the test commands you ran and
  their pass counts.
- All required checks must pass. Pull requests are squash-merged.
- Note anything you deferred under **Deferred** in the pull request body.

## Commit messages

Write the subject in the imperative mood ("Add worker heartbeat", not "Added worker heartbeat"),
50 characters or fewer where possible, and reference requirement IDs in the body.

## Licensing

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
