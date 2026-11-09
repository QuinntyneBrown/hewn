<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/design-system/assets/logo/hewn-wordmark-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="docs/design-system/assets/logo/hewn-wordmark-light.svg">
    <img src="docs/design-system/assets/logo/hewn-wordmark-light.svg" alt="Hewn" width="320">
  </picture>
</h1>

<p align="center">
  <strong>A software factory. Give it a direction; get back merged, tested code.</strong>
</p>

<p align="center">
  <a href="https://github.com/QuinntyneBrown/hewn/actions/workflows/ci.yml"><img src="https://github.com/QuinntyneBrown/hewn/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License: MIT"></a>
</p>

Hewn turns a product idea, or a feature for an existing product, into merged code. You give it a
**direction** in plain language. Agents running in a continuous loop, on your machine or in the
cloud, carry that direction through a fixed pipeline: brief, designs, design system, stack,
requirements, scaffold, detailed designs, user journeys, estimates, and then test-first increments
that each end in a recorded video, a pull request and a merge. Once a direction is given, nothing
waits for human approval.

**Mission Control** is the Angular web app where you give direction and watch the work happen in
real time over SignalR: every stage, log line, decision, design, pull request and dollar spent.

## Table of contents

- [How it works](#how-it-works)
- [Features](#features)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Running the tests](#running-the-tests)
- [Deployment](#deployment)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [Security](#security)
- [Support](#support)
- [License](#license)

## How it works

Every direction runs through the same ordered pipeline. Each stage is driven by a skill copied
from the [Greenlit](https://github.com/QuinntyneBrown/greenlit) skill library and writes its
output into the target product's repository.

| #  | Stage                      | How                                           | Output in the product repository                     |
| -- | -------------------------- | --------------------------------------------- | ---------------------------------------------------- |
| 0  | Bootstrap                  | Copy skills from Greenlit                     | `.claude/skills/`, `.agents/skills/`, `.hewn/skills.lock` |
| 1  | Idea                       | `grilling`, answered by the agent itself      | `docs/brief.md`                                      |
| 2  | Designs                    | [Magic Patterns](https://www.magicpatterns.com) through its MCP server | Designs in Magic Patterns, exported to `docs/mocks/` |
| 3  | Design system              | `extracting-design-systems`                   | `docs/design-system/`                                |
| 4  | Stack selection            | Default: .NET backend, Angular frontend       | `docs/adr/0001-stack.md`                             |
| 5  | Requirements               | `engineering-requirements`                    | `docs/specs/L1.md`, `docs/specs/L2.md`               |
| 6  | Scaffold                   | Stack-specific template                       | Solution, folder structure, CI workflow              |
| 7  | Detailed designs           | `writing-software-design-documents`           | `docs/detailed-designs/`                             |
| 8  | User journeys              | Numbered journeys over the requirements       | `docs/journeys.md`                                   |
| 9  | Estimates                  | `estimating-designs`, with automatic descoping | `docs/estimates/`                                   |
| 10 | Incremental implementation | `implementing-incrementally`, `creating-videos` | Test → Implement → Video → PR → Merge, per increment |

A **feature direction** on an existing product skips bootstrap, stack selection and scaffold, and
skips the design stages when there is no UI change.

Where a skill would normally ask a person a question, the agent answers it from the direction and
the existing artifacts and records the decision in `docs/decisions.md`. You can read every decision
afterwards in Mission Control.

## Features

- **Directions, not tickets.** Describe a product or a feature in plain language; Hewn runs it to
  completion.
- **Fully autonomous.** No approval gates. Pull requests merge automatically once all required
  checks pass.
- **Test first, always.** Every increment commits failing acceptance tests before any
  implementation. Each test names the L2 requirements it covers.
- **A video for every increment.** A captioned 1080p walkthrough of the working journey, linked
  from the pull request.
- **Automatic descoping.** Designs that are oversized, off the main path of every journey or
  marked nice-to-have are deferred, each with a written reason.
- **Live Mission Control.** Pipeline, logs, designs, decisions, pull requests, check status and
  spend update in real time, and catch up without gaps after a dropped connection.
- **Local or cloud workers.** One container image runs on your machine or in the cloud with the
  same behavior. Local workers need no inbound ports.
- **End-to-end traceability.** From any requirement, see its designs, journeys, acceptance tests
  and pull requests.
- **Safety stops.** Pause, resume or cancel a direction; stop every worker at once; cap spend
  with a per-direction budget.
- **Secure by default.** GitHub sign-in with an allow list, Owner and Viewer roles, encrypted
  secrets, sandboxed agents with an egress allow list and per-stage tool allow lists.

Hewn is under active development. See [docs/estimates](docs/estimates/README.md) for the current
percentage complete and the roadmap.

## Architecture

```text
             ┌─────────────────────────────┐
  Browser ──▶│ Mission Control (Angular)   │
             └──────────────┬──────────────┘
                     HTTPS  │  SignalR (/hubs/mission-control)
             ┌──────────────▼──────────────┐        ┌────────────────────┐
             │ Hewn API (ASP.NET Core)     │◀──────▶│ Database           │
             │ directions · queue · events │        │ (SQL Server/SQLite)│
             └──────────────┬──────────────┘        └────────────────────┘
               outbound     │  SignalR (/hubs/workers) + leases
          ┌─────────────────┴─────────────────┐
  ┌───────▼────────┐                 ┌────────▼───────┐
  │ Worker (local) │       ...       │ Worker (cloud) │
  │ Claude Agent   │                 │ Claude Agent   │
  │ SDK + skills   │                 │ SDK + skills   │
  └───┬────────┬───┘                 └───┬────────┬───┘
      │        │                         │        │
   GitHub   Magic Patterns MCP        GitHub   Magic Patterns MCP
```

- **Hewn API** owns projects, directions, the work queue, leases, events and budgets. It is the
  only component that talks to the database.
- **Workers** lease one run at a time, heartbeat every 10 seconds, checkpoint after every step and
  resume from the last checkpoint if a lease is reassigned. Each run executes in its own isolated
  workspace.
- **Mission Control** subscribes to per-project event streams. Every event carries a sequence
  number, so a reconnecting client fetches exactly what it missed.

The decisions behind this design are recorded in [docs/adr](docs/adr/).

## Project structure

| Path                     | Description                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| `backend/`               | .NET 10 solution: `Hewn.Api` (REST + SignalR), `Hewn.Application`, `Hewn.Domain`, `Hewn.Infrastructure`, `Hewn.Cli`, tests |
| `worker/`                | Agent runtime: the work loop, stage runners and the Claude Agent SDK integration, plus its container image |
| `frontend/`              | Angular 21 workspace: `mission-control` (app), `api` (contracts and SignalR client), `components` (`hw-*`) |
| `e2e/`                   | Playwright suite: behavior, accessibility (axe-core) and visual parity with the mocks       |
| `deploy/`                | `docker-compose.yml` for a local stack, and infrastructure as code for the cloud            |
| `eng/`                   | PowerShell scripts for local runs and CI                                                     |
| `.claude/skills/`, `.agents/skills/` | Skills copied from Greenlit, used to build Hewn and copied into every product   |
| `docs/specs/`            | Requirements: `L1.md` (high level) and `L2.md` (detailed, with acceptance criteria)          |
| `docs/mocks/`            | Mission Control designs exported from Magic Patterns, the source of truth for the UI       |
| `docs/design-system/`    | Tokens, foundations and components extracted from the mocks                                 |
| `docs/detailed-designs/` | Per-feature designs with C4, class and sequence diagrams                                    |
| `docs/adr/`              | Architecture decision records                                                                |

[AGENTS.md](AGENTS.md) is the single source of engineering guidance for this repository, for
people and agents alike.

## Getting started

### Prerequisites

- [.NET SDK 10.0](https://dotnet.microsoft.com/download) (see `backend/global.json`)
- [Node.js 22](https://nodejs.org/) and npm
- [Docker](https://www.docker.com/) to run workers
- [PowerShell 7](https://github.com/PowerShell/PowerShell) for the scripts in `eng/`
- A GitHub App installed on the account or organization where products will live
- An Anthropic API key and a Magic Patterns account

### Build

```powershell
dotnet build backend/Hewn.sln

cd frontend
npm ci
npm run build

cd ../worker
npm ci
npm run build
```

### Run locally

The quickest way to run everything is the local stack, which starts the API on SQLite, Mission
Control and one local worker:

```powershell
pwsh eng/Start-LocalStack.ps1         # API on http://localhost:5200
                                      # Mission Control on http://localhost:4200
```

To run the parts separately:

```powershell
pwsh eng/Start-Api.ps1                # API on http://localhost:5200

cd frontend
npm start                             # Mission Control on http://localhost:4200

# A worker with the scripted executor; the API needs the same HEWN_WORKER_TOKEN
pwsh eng/Start-Worker.ps1
```

Sign in with a GitHub account on the allow list (`HEWN_ALLOWED_GITHUB_USERS`). Until GitHub sign-in
lands, the local stack enables a development sign-in (`POST /api/auth/dev/sign-in`) for allow-listed
logins; see [ADR 0001](docs/adr/0001-sessions-and-dev-sign-in.md). Open
**Workers → New worker token** to register additional workers.

### Give your first direction

1. In Mission Control, choose **New product**.
2. Name it, describe the idea, and optionally name a stack or an existing repository.
3. Submit. Watch the pipeline on the project page; the first pull request appears after the
   scaffold stage.

The API does not apply migrations on startup. Use the CLI:

```powershell
dotnet run --project backend/src/Hewn.Cli -- migrate
dotnet run --project backend/src/Hewn.Cli -- seed
dotnet run --project backend/src/Hewn.Cli -- reset --yes
```

## Configuration

Settings are read from `appsettings.json`, environment variables and, in the cloud, a key vault.
Secrets are never written to configuration files in the repository.

| Setting                         | Used by | Description                                                              |
| ------------------------------- | ------- | ------------------------------------------------------------------------ |
| `HEWN_ALLOWED_GITHUB_USERS`     | API     | Comma-separated GitHub logins allowed to sign in                         |
| `HEWN_GITHUB_APP_ID`            | API     | GitHub App used for repositories, pull requests and checks               |
| `HEWN_GITHUB_APP_PRIVATE_KEY`   | API     | GitHub App private key (secret)                                          |
| `HEWN_GITHUB_WEBHOOK_SECRET`    | API     | Verifies GitHub webhook signatures (secret)                              |
| `HEWN_GITHUB_OWNER`             | API     | Account or organization where new product repositories are created      |
| `ANTHROPIC_API_KEY`             | Worker  | Model access for agents (secret)                                         |
| `HEWN_MAGIC_PATTERNS_TOKEN`     | Worker  | Magic Patterns MCP credential (secret)                                   |
| `HEWN_SKILLS_SOURCE`            | API     | Skill library repository; defaults to `QuinntyneBrown/greenlit`          |
| `HEWN_DEFAULT_BUDGET_USD`       | API     | Default spend cap per direction                                          |
| `HEWN_DESCOPE_THRESHOLD_DAYS`   | API     | Designs estimated above this are split or deferred; defaults to `3`      |
| `HEWN_WORKER_TOKEN`             | API, Worker | Worker token (secret). For now one shared value set on both; Mission Control will issue tokens |
| `HEWN_API_URL`                  | Worker  | Where the worker connects                                                |
| `HEWN_LOCATION`                 | Worker  | `Local` or `Cloud`                                                       |
| `HEWN_EXECUTOR`                 | Worker  | `stages` (default: built stages run for real, the rest scripted) or `scripted` |
| `HEWN_MAGIC_PATTERNS_URL`       | Worker  | Magic Patterns MCP endpoint (streamable HTTP); stage 2 fails without it   |
| `HEWN_MAGIC_PATTERNS_TOKEN`     | Worker  | Magic Patterns credential (secret); moves to the credential store with L2-040 |
| `HEWN_CHECK_POLL_MS`            | Worker  | How often stage 6 reads its pull request's checks; defaults to 30000      |

## Running the tests

No database server is required. Backend tests run on in-memory SQLite; Playwright starts the API
with `eng/Start-E2eApi.ps1` on http://localhost:5300 (fake GitHub, model and Magic Patterns services,
seeded Owner `quinntynebrown` and Viewer `ada`) and Mission Control on http://localhost:4300, so it
never reuses a development server on 4200 or 5200.

```powershell
# Backend, as CI runs it
pwsh eng/Test-Backend.ps1

# Worker
cd worker
npm test

# Frontend: format, lint, unit tests
cd frontend
npm run format:check
npm run lint
npm test

# End to end
cd e2e
npm ci
npx playwright install chromium
npm run test:behavior                 # behavior
npm run test:a11y                     # axe-core on every page and state
npm run test:visual                   # visual parity with docs/mocks
npm run test:pipeline                 # directions run live on scripted workers
```

Every acceptance test file starts with a header naming the requirements it covers:

```typescript
// Acceptance Test
// Traces to: L2-031, L2-032
// Description: Events arrive within a second and survive a reconnect without gaps
```

## Deployment

The cloud deployment runs the API and Mission Control as web apps, workers as containers, and
keeps secrets in a key vault. The workflow in `.github/workflows/deploy.yml` deploys `main` after
CI passes. See [docs/adr](docs/adr/) for the hosting decisions and `deploy/` for the
infrastructure as code.

## Documentation

- [Requirements](docs/specs/): L1 and L2 with acceptance criteria
- [User journeys](docs/journeys.md): the scenarios Mission Control serves, in priority order
- [Detailed designs](docs/detailed-designs/): one per feature, derived from the requirements
- [Designs](docs/mocks/): Mission Control screens in every state, from Magic Patterns
- [Design system](docs/design-system/): tokens, foundations and components
- [Architecture decisions](docs/adr/)
- [Estimates](docs/estimates/README.md): effort, percentage complete and roadmap
- [Changelog](CHANGELOG.md)

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md)
before you start: every production change begins with a requirement, a detailed design and a
design in Magic Patterns, and lands in small, test-first slices. Changes to `main` go through a
pull request.

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

To report a vulnerability, follow the process in [SECURITY.md](SECURITY.md). Please do not open a
public issue for security problems.

## Support

See [SUPPORT.md](SUPPORT.md) for how to ask questions and file bugs.

## License

Hewn is licensed under the [MIT License](LICENSE).
