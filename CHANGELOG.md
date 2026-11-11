# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Two writes to one project at once (a worker's log batch and its model call) no longer pick the same event sequence
  number and fail with a 500; `EventAppender` serializes a project's writes.

### Added

- Use keyboard and assistive technology (journey 34, L2-047): stage changes are announced from the shell's one polite
  live region, at most once every 5 seconds per project, on the project page and now on Projects too. Settings shows
  section skeletons while the saved defaults load. Acceptance tests run axe-core on every page while loading and when
  its data fails, tab through every page checking the focus indicator at each stop and for traps, complete sign-in
  and a direction's submission and cancellation by keyboard alone, and check that nothing animates under reduced
  motion.
- Use Mission Control on mobile (journey 33, L2-046): below 992 px the top bar's Open menu shows the sidebar as a
  menu drawer that keeps focus, and closes on Escape, a tap beside it, navigating or widening the window. Below
  992 px every button, field and tab is a 44 px touch target; from 992 px controls stay 32 and 40 px (ADR 0034).
  Acceptance tests hold every page at 320 to 2560 px without sideways scroll, and the pipeline as a list, a stepper
  and a column at each breakpoint.
- Review the audit log (journey 32, L2-044): sign-ins, direction submissions, pause, resume, cancel, stop all, start
  workers, worker token creation and revocation, and merges each record who, what, when, the target and the IP.
  Owners open Audit to see entries newest first and filter them by project and action; Viewers see the forbidden
  state. `GET /api/audit` is the only audit endpoint, and the database refuses to update or delete an entry.
- Delete a project (journey 31, L2-003 AC2, AC3): an Owner chooses Delete on a project's row, types its name exactly
  and confirms. Hewn removes its directions, runs, events, logs, decisions, spend history, increments and skills
  updates, and leaves the GitHub repository untouched, as the dialog says. Delete is disabled with "Cancel the
  running direction first" while a direction is active. `DELETE /api/projects/{id}` takes `{ confirmName }`, and
  every open Projects page drops the row.
- Archive and restore a project (journey 30, L2-003 AC1, AC2): an Owner archives a project with no active direction
  from its row on the Projects page. It leaves All and the status tabs, appears under the new Archived filter, and
  Restore brings it back. Archive is disabled with "Cancel the running direction first" while a direction is queued,
  running, paused or blocked. `POST /api/projects/{id}/archive` answers 409 `active_direction` then. An archived
  project takes no new direction until restored. Activity older than a week reads as a date.
- Update project skills (journey 29, L2-008): when Greenlit's default branch is ahead of `.hewn/skills.lock`, an Owner
  sees "Skills update available (n commits)" on the project page; Viewers don't. Update skills lists the commits and
  opens a pull request on `hewn/update-skills-{short-sha}` that updates the skill files and the lock. It merges once
  its checks pass, rebased if the default branch moved; a failing check leaves it open and the update is offered
  again. The API reads Greenlit with git (`Hewn:Skills:FetchSeconds`) and merges through `SkillsUpdateMerger`.
- Configure automatic descoping (journey 28, L2-019): an Owner sets the descope threshold in ideal days (a whole
  number from 1 to 20, default 3) in Settings beside the default budget; Viewers see it read-only. Each direction
  keeps the threshold in force when it was submitted, and stage 9's agent is told the number of days to split
  against before Hewn defers what is still above it.
- Reconnect Mission Control (journey 27, L2-032, L2-031): when the live connection drops, a strip says
  "Reconnecting… next attempt in n s" and Mission Control retries after 0, 2, 10 and 30 seconds, then every
  30 seconds, with Retry now once the connection counts as lost. On reconnect it catches up every missed event once
  and says how many for 5 seconds. The sidebar shows Live, Reconnecting… or Offline with N of M workers.
- Continue after a worker or server crash (journey 26, L2-050, L2-026): a GitHub write holds its run's write lock
  from the fence check to its record, and leases are granted and expired under the same lock, so a stale worker
  can't write after its lease moves. The run log says when a lease expires and which worker resumes after which
  step. Tests kill a worker mid-run and restart the API on the same database.
- Inspect worker activity (journey 25, L2-026, L2-031): Workers is told within a second when a worker goes Offline
  after 60 seconds without a heartbeat, or comes back. `WorkerPresenceWatcher` sweeps every second
  (`Hewn:Workers:PresenceWatcherEnabled`). The page shows its loading, empty and error states as the mocks do, offers
  an Owner a worker token when no worker has connected, and lists leased workers first, then idle, then offline.
- Manage worker tokens (journey 24, L2-041): an Owner creates a worker token on Workers with a name, Local or Cloud,
  and an expiry of 30 days, 90 days or a year. The token (`hwt_…`) is shown once, with Copy and the command that
  starts a worker; only its SHA-256 is stored. A worker on it is named and placed by it. Each worker row has Revoke:
  the token stops working at once, its run is released to resume elsewhere from its checkpoint, and the worker is
  refused within 10 seconds and exits with code 3 (ADR 0026). `POST /api/worker-tokens`,
  `POST /api/workers/{id}/revoke`; migration `ManageWorkerTokens` adds `worker_tokens` and the workers' `TokenId`
  and `RevokedAt`. The configured `HEWN_WORKER_TOKEN` still works as a development token.
- Run workers locally or in the cloud (journey 23, L2-026, L2-027, L2-042):
  - `worker/Dockerfile` builds the one worker image. It runs on a developer machine with Docker or in the cloud,
    and `HEWN_LOCATION` and the other settings are the only differences.
  - An idle worker's lease request is held open for up to 30 seconds, so newly queued work is leased at once.
  - Mission Control's Workers view is told over SignalR (`WorkersChanged`) when a worker registers or a stage
    starts or ends.
  - Each run gets its own egress proxy, which allows only the model API, Magic Patterns and the stack registries,
    and blocks and logs anything else.
  - Each stage's agent tool calls pass a tool gate that denies tools outside the stage's allow list and logs a
    security event.
  - Gate commands see no worker credential. With `HEWN_SANDBOX=docker` they run in their own containers on an
    internal network (ADR 0025).
- Connect a GitHub repository (journey 22, L2-036, L2-001 AC4). The installation token that creates a project's
  repository now asks only to administer repositories, rather than for every permission on every repository; the
  new repository is tagged with a token limited to it, like every other call (ADR 0024). The e2e stack's fake GitHub
  answers `GET /api/fakes/github/{owner}/{name}` with a repository's visibility, topics and required checks, and the
  run pipeline test checks stage 0's private repository and stage 6's branch protection.
- Manage Owner and Viewer access (journey 21, L2-038 AC5, L2-039): Settings shows "Who can sign in", each GitHub
  login with its role and last sign-in. An Owner adds a login as Viewer or Owner once GitHub confirms it exists, and
  removes any login but their own; a removed login is signed out on its next request (ADR 0023). Viewers see the
  list read-only. `GET/POST /api/allow-list`, `DELETE /api/allow-list/{login}`. Migration `ManageAllowList` adds
  `LastSignInAt`, `AddedAt` and `AddedBy` to `allow_list`. New tests call every state-changing endpoint as a Viewer
  (403) and every project route for an unseen project (404).
- Sign in and sign out (journey 20, L2-038, L2-043): Mission Control signs in with GitHub through
  `GET /api/auth/github` and its callback; logins not on the allow list are refused with "This account doesn't have
  access", and the sign-in page shows the denied, GitHub failed, expired and signed-out states. The sidebar gains
  Sign out, which revokes the session so a replayed cookie gets 401; a session ending while the app is open returns
  to sign-in. The API serves Mission Control's pages: without a session they redirect to `/sign-in?returnUrl=`, and
  every page carries a Content-Security-Policy, `frame-ancestors 'self'` and `nosniff` (ADR 0022). New settings:
  `HEWN_GITHUB_CLIENT_ID`, `HEWN_GITHUB_CLIENT_SECRET`, `Hewn:MissionControl:Root`, `Hewn:Auth:PublicOrigin`.
  Migration `RevokeSignedOutSessions` adds `revoked_sessions`.
- Watch an increment demonstration (journey 19, L2-023): the increment page plays the increment's captioned
  walkthrough, with play and pause, its captions over the picture, a captions toggle, a keyboard seek slider and full
  screen, or says "Video failed: {reason}". `GET /api/projects/{id}/increments/{n}/video` (byte ranges) and
  `.../video/captions` serve the MP4 and its WebVTT captions from the commit that recorded them (ADR 0021); the
  increment detail links them as `videoUrl` and `captionsUrl`. The pull request body now links the video on GitHub
  at that commit instead of by a relative path, which broke under `/pull/N`.
- Review agent decisions (journey 18, L2-054): a project's Decisions tab (`/projects/{id}/decisions?stage=`) lists
  the questions agents answered for themselves, newest first, with stage, time, answer, rationale and links to the
  commit that recorded each and any ADR, and filters them by stage. `GET /api/projects/{id}/decisions?stage=` lists
  them from Hewn's record, which now keeps each decision's commit and ADR (ADR 0020). Workers report a decision's
  ADR, and stage 10 now reports the decisions its increments record. A fakes-only
  `GET /api/fakes/github/{owner}/{name}/commits` lists a fake repository's commits.
- Trace a requirement (journey 17, L2-035): a project's Traceability tab (`/projects/{id}/traceability?l2=`) lists
  its L2s with search and, for the chosen one, its L1, the designs and journeys that name it, the test files whose
  `Traces to:` header names it and the pull requests whose titles name it, marked "No acceptance test" unless it is
  Deferred. `GET /api/projects/{id}/traceability` reads the repository's archive at its head and its pull requests
  on request (ADR 0019). `IGitHubRepositories.ListPullRequestsAsync` and a fake `POST /api/fakes/github/{owner}/{name}/pulls` are new.
- Inspect versioned artifacts (journey 16, L2-034): a project's Artifacts tab (`/projects/{id}/artifacts`) lists each
  stage's artifacts, newest stage first, with path, version (short commit SHA), time and a link that opens the file
  (or folder) on GitHub at that commit. `GET /api/projects/{id}/artifacts` derives them from the commits succeeded
  runs made to the default branch; commit records now keep their branch. The tab refreshes when a stage changes.
- Browse the design system (journey 15, L2-012 AC4): a project's Design system tab (`/projects/{id}/design-system`)
  lists the token pages under `docs/design-system/foundations/`, each with its group's token count, and the component
  pages under `components/`. The chosen page opens in the same sandboxed, separate-origin preview as Designs, at XS to
  XL and in Light or Dark. New `GET /api/projects/{id}/design-system` and `IGitHubRepositories.ListFilesAsync`.
  Stage 3's task now asks for a token page per group, and the scripted agent writes them.

- Preview product designs (journey 14, L2-011): a project's Designs tab (`/projects/{id}/designs`) lists every
  screen and state stage 2 exported, each with a live thumbnail and an Open in Magic Patterns link. It previews the
  chosen state in an iframe on a separate origin with `sandbox="allow-scripts"`, where the page can't read Mission
  Control's cookies, storage or page, at XS (375) to XL (1200) px and in Light or Dark. New
  `GET /api/projects/{id}/designs`. The preview host is `GET /preview/{token}/{path}`, on `Hewn:Preview:Origin`
  only: signed for one commit, limited to `docs/mocks/` and `docs/design-system/`, and sent with CSP `sandbox
  allow-scripts` (ADR 0018). The fake GitHub takes files from e2e tests (`PUT /api/fakes/github/{owner}/{name}/files`).

- Follow an increment to merge (journey 13, L2-021 AC3, L2-022 AC2, L2-024 AC3, L2-025, L2-037): an increment's
  page (`/projects/{id}/increments/{n}`, from a Backlog title) shows the test commit and red recorded, or tests
  that passed before implementation flagged; the iteration under way against the cap; Blocked with its failing
  tests and the increment Hewn moved on to; the video; the pull request with its required checks, size and body;
  and the squash-merge, all updating live. Checks are stored and emit `CheckChanged`, arriving by a signed
  `check_run` webhook (`POST /api/github/webhook`, 401 and logged when unsigned or invalid), the worker's reads,
  or a poll after 60 s of silence (ADR 0017). New `GET /api/projects/{id}/increments/{n}`. The fake CI can be
  paced (`PUT /api/fakes/github/check-seconds`) so checks can be watched turning green.

- Review the backlog (journey 12, L2-020 AC2, L2-019 AC4, L2-018, L2-025 AC4): a project's Backlog tab
  (`/projects/{id}/backlog`, beside Pipeline) lists the current direction's increments in order with status,
  estimate and pull request link, the merged and estimated totals with percent complete, and the deferred designs
  apart with their reasons. A blocked increment gets a callout with its iterations, failing tests and what Hewn
  moved on to. The tab updates after every merge without a reload. New `GET /api/projects/{id}/backlog`. The
  scripted agent lists an idea's "Nice to have" in the brief, and can block one increment
  (`HEWN_SCRIPTED_BLOCK_INCREMENT`) or slow stage 10 (`HEWN_SCRIPTED_INCREMENT_MS`) for tests and videos.

- Find a project (journey 11, L2-002, L2-045 AC1–AC2): the Projects page lists every project with its stage,
  status, percent complete, spend and last activity, newest first. A status filter in `?status=` survives a
  reload, the empty state offers New product to Owners only, and rows update in place from the hub's
  `ProjectSummary` stream (ADR 0016). `npm run test:perf` checks Lighthouse mobile LCP (1.44 s) and the initial
  JavaScript (125 KB gzipped) on the production build, and the read APIs' p95 under load. The build now merges
  chunks, start-up loads the user and the config together, and opening on Projects requests the list with them.

- Queue further directions (journey 10, L2-004 AC4, L2-005 AC4, L2-043 AC4): directions submitted on a project with
  an active one queue and start by themselves, first in, first out, now proven end to end with real workers. An
  Owner may submit at most 10 directions in any minute (`Hewn:RateLimit:DirectionsPerMinute`); the extra requests
  get 429 `rate_limited` with `retryAfterSeconds` and `Retry-After`, and create nothing (ADR 0015). New direction
  shows "Too many directions in a minute" with when the Owner can submit again, keeping what was typed.

- Recover a failed stage (journey 9, L2-006): a failed run is retried automatically up to 3 times, after 30 s, 2 min
  and 10 min (`Hewn:Retry:BackoffSeconds`); each retry is a new run that is not leased before its time, and the
  project page counts down to it. When the third retry fails, the stage is Failed, the direction and project
  Blocked, and `StageBlocked` carries the reason and the last 200 log lines; other projects keep running. The page
  shows the failure callout and a danger toast with Open log and Retry stage. An Owner's Retry stage
  (`POST /api/projects/{id}/directions/{d}/retry-stage`) runs the stage again from its start with the counter reset
  (ADR 0014). Viewers see no control and get 403. A Blocked direction can be cancelled.

- Stop and restart all workers (journey 8, L2-029 AC4, AC5): an Owner presses Stop all workers in the sidebar and
  confirms in a dialog listing the online workers. Leasing is switched off and stored, every active run halts at its
  checkpoint within 10 seconds (the worker hears `Halt` on its control poll), and nothing is leased, even after a
  restart, until the Owner presses Start workers; each halted run then resumes from its checkpoint
  (`POST /api/workers/stop`, `POST /api/workers/start`, `GET /api/workers`; ADR 0013). A banner shows on every page
  while workers are stopped, and a new Workers page lists each worker. A worker that does not answer is named in
  the dialog. Viewers see the banner but no control, and get 403.

- Cancel a direction (journey 7, L2-029 AC3, AC5, L2-004 AC4): an Owner presses Cancel on a queued, running or
  paused direction and confirms in a dialog. The direction, its run and its stage are Cancelled at once, the worker
  hears it on its held control poll (`GET /api/worker/runs/{id}/control`) and stops within 10 seconds, open pull
  requests stay open labelled `hewn:cancelled`, and the next queued direction starts
  (`POST /api/projects/{id}/directions/{d}/cancel`, `DirectionCancelled`; ADR 0012). A worker that does not answer
  is named in the dialog. Viewers see no control and get 403.

- Pause and resume a direction (journey 6, L2-029 AC1, AC2, AC5, L2-050 AC3): an Owner presses Pause on a running
  direction; the step in progress finishes and checkpoints, then the direction is Paused ("Paused by … at …") and
  nothing new starts. Resume continues the same run from the next step, and no completed step runs twice
  (`POST /api/projects/{id}/directions/{d}/pause` and `/resume`, `PauseRequested`, `DirectionResumed`; ADR 0011).
  Viewers see no control and get 403.

- Raise budget and resume (journey 5, L2-053 AC3, L2-029 AC5): on a direction Paused with "Budget reached", an
  Owner enters a new budget above the spend and presses Raise and resume; the budget is raised and the direction
  resumes from the step after its checkpoint in one action
  (`POST /api/projects/{id}/directions/{d}/raise-and-resume`, `BudgetRaised`). A budget at or below the spend is
  refused inline, a budget another session changed answers 409, and Viewers see no control and get 403.
- Limit spending (journey 4, L2-052, L2-053 AC1-AC3):
  - workers report every model call (`POST /api/worker/runs/{id}/model-calls`); Hewn prices it from a configured
    price table and records its tokens, model and cost against its run, stage, direction and project (ADR 0010);
  - spend shows live on the project header as a meter of the direction's budget (`SpendUpdated`);
  - at 80% a `BudgetWarning` raises a warning toast and turns the meter to warning;
  - at 100% the direction pauses with "Budget reached" after the current call, keeping its checkpoint;
  - Settings has Direction defaults: an Owner sets the default budget new directions start with
    (`GET`/`PUT /api/settings/direction-defaults`); Viewers see it read-only.
- Monitor a direction (journey 3, L2-030, L2-031, L2-033, L2-047 AC3):
  - the running stage shows its current step and latest log line, live, from new `StepStarted` and `LogLines`
    events; workers name each step (`PUT /api/worker/runs/{id}/step`) and send log lines in batches;
  - selecting a stage shows its runs, log, artifacts and decisions
    (`GET /api/projects/{id}/directions/{d}/stages/{n}`, `GET /api/projects/{id}/runs/{r}/logs`); workers report
    the decisions they commit (`POST /api/worker/runs/{id}/decisions`, `DecisionRecorded`, ADR 0009);
  - the live log follows new lines, holds when scrolled up with "{n} new lines — Jump to latest", and keeps at most
    500 lines in the page;
  - stage changes are announced in a polite live region at most once every 5 seconds;
  - the project page has loading and error states, and runs record when they started and which worker ran them.
- Add a feature (journey 2, L2-005, L2-010 AC6, L2-014 AC4, L2-017 AC3, L2-054):
  - New direction's Feature for a product adds a feature direction to an existing product through
    `POST /api/projects/{id}/directions`; `GET /api/projects` lists products and whether a feature would queue;
  - a feature direction skips Bootstrap, Stack and Scaffold, and also Designs and Design system when stage 1
    records that the user interface does not change (`PUT /api/worker/runs/{id}/scope`, ADR 0008);
  - a feature submitted while another direction is active queues behind it, first in, first out;
  - stages 2, 5 and 8 keep every existing design, requirement ID and journey number, and stage 9 plans only
    unbuilt designs;
  - the project page strikes through skipped stages, shows queued directions and explains a completed feature.
- Decisions and no approval steps (journey 1, L2-054 AC1-AC2, L2-028):
  - every agent session decides for itself under one shared instruction, with no tool for asking;
  - decisions are checked for their fields, and a decision that changes the architecture is recorded as a numbered ADR;
  - a pipeline e2e test proves a submitted direction reaches Complete with no human input.
- Stage 10, Increments (journey 1, L2-021 to L2-025, L2-023 AC1 and AC3, L2-024 AC1-AC2): each increment is
  delivered test first on `feature/{slug}` with red recorded, implemented until the stack's gate is green or
  Blocked after `HEWN_MAX_ITERATIONS`, recorded on video, opened as a pull request with the six-section body,
  squash-merged once checks pass (rebasing when the default branch moved) and followed by a progress commit.
- Stage 9, Estimates (journey 1, L2-018 AC1, L2-019 AC1-AC3, L2-020 AC1): estimates per design, automatic
  descoping with reasons and Deferred status lines, and a backlog of increments ordered by journey and
  dependency, stored in Hewn's new `increments` table through `PUT /api/worker/runs/{id}/backlog`.
- Stage 6, Scaffold (journey 1, L2-015 AC1-AC4, L2-036 AC2): the default .NET + Angular + Playwright template with
  a CI workflow, committed to `hewn/scaffold`, merged through a pull request once CI passes, with the CI checks
  then required on the default branch. New broker mutations `open_pull_request`, `merge_pull_request` and
  `protect_branch`, branch commits, and a pull request checks endpoint, all limited to stage 6.
- Stages 2 and 3 (journey 1, L2-010 AC1-AC5, L2-012 AC1-AC3): screens designed in Magic Patterns over MCP and
  exported to `docs/mocks/` with a manifest, validated for coverage, states, parsing and horizontal scroll; the
  design system extracted to `docs/design-system/`, validated for token groups and mock colour coverage, with
  Magic Patterns mismatches logged. A fake Magic Patterns MCP server backs tests and the e2e stack.
- Document stages 1, 4, 5, 7 and 8 (journey 1, L2-009, L2-013, L2-014, L2-016, L2-017): the worker checks out
  the product repository through `GET /api/worker/runs/{id}/repository/archive`, runs the stage's agent,
  validates the brief, stack decision, requirements, design coverage and journeys, and commits only the
  stage's documents and `docs/decisions.md`. A scripted agent stands in for the model.
- Stage 0, Bootstrap (journey 1, L2-007, L2-036 AC1 and AC3): the API creates the private product repository
  on the first lease and commits through a fenced, idempotent commit mutation; the worker copies Greenlit's
  skills, keeps existing folders and writes `.hewn/skills.lock`.
- Run a product direction through stages 0 to 10 (journey 1, L2-004 AC1-AC3): leased runs fenced by epoch,
  heartbeats and 60-second expiry, the pipeline orchestrator, the Mission Control hub with catch-up by
  sequence number, and the project page following the pipeline live to Complete.
- The worker (`worker/`): the work loop with heartbeats, checkpoints and resume, and a scripted executor for
  tests and demos.
- Submit a product direction (journey 1, L2-001): the New direction page, `POST /api/projects` with field
  validation and the GitHub write probe, the project page with every stage, and the `DirectionQueued` event.
- Backend solution (`Hewn.Domain`, `Hewn.Application`, `Hewn.Infrastructure`, `Hewn.Api`, `Hewn.Cli`) with
  cookie sessions against the allow list, a configuration-gated dev sign-in, anti-forgery on writes and the
  `hewn migrate | seed | reset` CLI.
- Angular workspace (`mission-control`, `api`, `components`) loading the design system's CSS.
- Playwright suite (behaviour, axe-core, visual parity with `docs/mocks`), CI workflow and `eng/` scripts.
- Video tooling (`tools/video-audio`, `tools/video-build`) with Kokoro narration and background music.
- L1 and L2 requirements in `docs/specs/`.
- Skills copied from Greenlit (`0e0d25a`) into `.claude/skills/` and `.agents/skills/`.
- Architecture decision records 0001 to 0004 in `docs/adr/`.
- Root documentation: README, license, contributing guide, code of conduct, security policy,
  support guide, agent guidance and GitHub templates.

### Changed

- The worker checkpoint endpoint answers 200 `{verdict: "Continue" | "Pause"}` instead of 204.

