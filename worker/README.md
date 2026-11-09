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
| `HEWN_SCRIPTED_STEP_MS` | Time each scripted step takes (default 1000) |
| `HEWN_SCRIPTED_FAIL_STAGE` | Stage whose main step fails, for failure demos |

Stages built so far:

- **Stage 0, Bootstrap** (`BootstrapStageExecutor`): clones the skills source named in the lease (needs `git`),
  copies `.claude/skills/` and `.agents/skills/` except folders the repository already has, writes
  `.hewn/skills.lock` and commits through the API. The worker never holds a GitHub credential.

Every other stage runs the scripted executor: three steps (prepare, run, commit) with no agent, model or
GitHub call, until its real executor lands.

```sh
npm ci && npm test            # tests against a fake API
HEWN_WORKER_TOKEN=... pwsh ../eng/Start-Worker.ps1   # against eng/Start-Api.ps1
```

Node 24 runs `src/main.ts` directly; `npm run build` emits `dist/` for the container image.
