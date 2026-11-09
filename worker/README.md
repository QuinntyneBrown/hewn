# Hewn worker

Leases runs from the Hewn API and executes them: register, wait for work (polling no more often than every
15 seconds), lease one run, heartbeat every 10 seconds, checkpoint after each step, report the result. A lost
lease (409 `lease_lost`, or two missed heartbeats) stops the run, and the worker reports nothing more for it.

| Variable | Meaning |
|---|---|
| `HEWN_API_URL` | The Hewn API, for example `http://localhost:5200` |
| `HEWN_WORKER_TOKEN` | Worker token; must match the API's `HEWN_WORKER_TOKEN`. Never logged. |
| `HEWN_LOCATION` | `Local` (default) or `Cloud` |
| `HEWN_WORKER_NAME` | Display name; defaults to the host name |
| `HEWN_EXECUTOR` | `stages` (default: stages built so far run for real, the rest scripted) or `scripted` |
| `HEWN_MAGIC_PATTERNS_URL`, `HEWN_MAGIC_PATTERNS_TOKEN` | Magic Patterns MCP endpoint and credential for stages 2 and 3 |
| `HEWN_MAGIC_PATTERNS_POLL_MS` | Generation poll interval; defaults to 60000, as Magic Patterns asks |
| `HEWN_SCRIPTED_STEP_MS` | Time each scripted step takes (default 1000) |
| `HEWN_SCRIPTED_FAIL_STAGE` | Stage whose main step fails, for failure demos |

Stages built so far:

- **Stage 0, Bootstrap** (`BootstrapStageExecutor`): clones the skills source named in the lease (needs `git`),
  copies `.claude/skills/` and `.agents/skills/` except folders the repository already has, writes
  `.hewn/skills.lock` and commits through the API. The worker never holds a GitHub credential.

- **Stages 1, 4, 5, 7 and 8, documents** (`DocumentStageExecutor`): checks out the product repository from the
  API's archive (needs `tar`), runs the stage's agent with its skill and file tools only, logs each question the
  agent answered for itself, validates the output and commits only the stage's documents and
  `docs/decisions.md`. The agent is `ScriptedStageAgent` until the Claude Agent SDK agent lands with run
  isolation.

- **Stage 2, Designs**: fails with "Magic Patterns unavailable: {reason}" unless Magic Patterns answers, has the
  agent design every core feature there, exports each design's `{state}.html` files to `docs/mocks/` with
  `manifest.json`, then checks coverage, states, parsing and horizontal scroll at 375, 768 and 1280 px in
  Chromium (`npx playwright-core install chromium`).
- **Stage 3, Design system**: extracts `docs/design-system/tokens.json` and component pages, fails on mock colours
  with no token, and logs Magic Patterns design-system colours it does not match.
- `node src/magic-patterns/fake-server-main.ts` (with `PORT` and `MAGIC_PATTERNS_TOKEN`) runs the fake Magic
  Patterns MCP server the e2e stack uses.

Every other stage runs the scripted executor: three steps (prepare, run, commit) with no agent, model or
GitHub call, until its real executor lands.

```sh
npm ci && npm test            # tests against a fake API
HEWN_WORKER_TOKEN=... pwsh ../eng/Start-Worker.ps1   # against eng/Start-Api.ps1
```

Node 24 runs `src/main.ts` directly; `npm run build` emits `dist/` for the container image.
