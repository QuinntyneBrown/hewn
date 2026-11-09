# Feature: Build a new product (journey 1)

## Goal

An Owner opens New direction, picks New product, enters a project name, an idea, an optional stack preference and an optional GitHub repository, and submits. Hewn creates the project, queues the direction and navigates to the project page. A worker then carries the direction through stages 0 to 10 with no approval step: skills bootstrap, brief, Magic Patterns designs, design system, stack ADR, requirements, scaffold, detailed designs, journeys, estimates with descoping, and test-first increments that each end in a video, a pull request and an automatic merge. When the last non-deferred increment merges, the direction is Complete and the project is Idle. Agents answer their own questions and record each decision in the target repository's `docs/decisions.md`. A Viewer cannot submit (403).

Actor: Owner. Journey 1 in `docs/journeys.md`: "Submit a direction; receive designs, documentation, and tested, automatically merged code." Estimated effort: 70 ideal days.
Everything not named here stays unchanged.

- Requirements (in `docs/specs/L2.md`; cross-reference them, don't copy them):
  - `L2-001` Submit a product direction (all criteria)
  - `L2-004` Run a product direction through every stage (all criteria)
  - `L2-007` Copy skills from Greenlit (all criteria)
  - `L2-009` Produce the product brief (all criteria)
  - `L2-010` Design the screens in Magic Patterns (all criteria)
  - `L2-012` Extract the design system (AC1-AC3)
  - `L2-013` Choose the stack (all criteria)
  - `L2-014` Generate requirements (all criteria)
  - `L2-015` Scaffold the solution (all criteria)
  - `L2-016` Write detailed designs (all criteria)
  - `L2-017` Define user journeys (AC1-AC2)
  - `L2-018` Estimate the work (all criteria)
  - `L2-019` Descope automatically (AC1-AC3)
  - `L2-020` Order the backlog (AC1)
  - `L2-021` Write the tests first (all criteria)
  - `L2-022` Implement until green (all criteria)
  - `L2-023` Record the increment video (AC1, AC3)
  - `L2-024` Open the pull request (AC1-AC2)
  - `L2-025` Merge automatically (all criteria)
  - `L2-028` No approval steps (all criteria)
  - `L2-036` Connect to GitHub (all criteria)
  - `L2-054` Agents decide and record decisions (AC1-AC2)
- Detailed designs:
  - `docs/detailed-designs/projects/submit-product-direction/README.md` and its `diagrams/`
  - `docs/detailed-designs/pipeline/run-direction/README.md` and its `diagrams/`
  - `docs/detailed-designs/pipeline/record-decisions/README.md` and its `diagrams/`
  - `docs/detailed-designs/stages/bootstrap-skills/README.md` and its `diagrams/`
  - `docs/detailed-designs/stages/produce-stage-documents/README.md` and its `diagrams/`
  - `docs/detailed-designs/stages/design-screens/README.md` and its `diagrams/`
  - `docs/detailed-designs/stages/extract-design-system/README.md` and its `diagrams/`
  - `docs/detailed-designs/stages/scaffold-solution/README.md` and its `diagrams/`
  - `docs/detailed-designs/stages/estimate-and-plan-backlog/README.md` and its `diagrams/`
  - `docs/detailed-designs/increments/write-tests-first/README.md` and its `diagrams/`
  - `docs/detailed-designs/increments/implement-until-green/README.md` and its `diagrams/`
  - `docs/detailed-designs/increments/record-increment-video/README.md` and its `diagrams/`
  - `docs/detailed-designs/increments/open-and-merge-pull-request/README.md` and its `diagrams/`
  - `docs/detailed-designs/source-control/connect-to-github/README.md` and its `diagrams/`
  - `docs/detailed-designs/agent-runtime/worker-loop/README.md` and its `diagrams/`
- Mocks (the source of truth for the UI; the visual tests compare against them):
  - `docs/mocks/pages/new-direction/default.html`
  - `docs/mocks/pages/new-direction/invalid.html`
  - `docs/mocks/pages/new-direction/submitting.html`
  - `docs/mocks/pages/new-direction/repo-no-access.html`
  - `docs/mocks/pages/new-direction/forbidden.html`
  - `docs/mocks/pages/project-pipeline/default.html`
  - `docs/mocks/pages/project-pipeline/complete.html`
  - `docs/mocks/pages/backlog/default.html`
  - `docs/mocks/pages/increment/merged.html`
- Design system: `docs/design-system/` (`tokens/tokens.css`, `assets/components.css`, one page per component).

This journey is estimated at 70 ideal days. Deliver it as a sequence of pull requests, one per slice or group of slices. Merge each one before starting the next. Every PR carries its own short video of what it added; the last PR carries the full journey video described below, covering every stage end to end.

Phases 5 and 6 apply to every PR in the sequence. Use the branch `feature/build-a-new-product-part-N` (N = 1, 2, ...), title each PR "Build a new product (journey 1, ...)" with only the L2 IDs that PR covers, and merge it before starting the next. The journey is done when the last PR is merged.

## Finish the whole feature in one run. Do not stop. (CRITICAL)

- You are authorised to take this feature all the way: requirement and design alignment, test-first
  implementation, the narrated video, green tests, a pull request and its merge. Go through every phase and every
  slice in one continuous run. Do not pause between phases to report, ask for approval, or wait for "continue".
- Do not end your turn until the "Done means" list at the bottom is fully true. A partial result, a plan, or
  "the next steps would be..." is not done.
- Where the repo's instructions say "stop and ask", treat this prompt as the confirmation in advance for
  everything in scope here. Choose the simplest option that fits the existing architecture, record it (an ADR in
  `docs/adr/`, or the design's open-questions section), and keep going.
- If a shared library, component or design asset lacks something, that is not a reason to stop. Update it
  first, as the repo's rules require, then go on.
- When a test, build or command fails, find the root cause and fix it, then go on. Never weaken a test to make
  it pass, and never skip a step quietly.
- Only stop for a real blocker you cannot resolve yourself, such as missing credentials, or an action outside
  this repo that can't be undone, such as production deploys or data changes. If that happens, finish
  everything else first, then report the blocker clearly.
- Keep track of progress (a todo list), so that nothing gets left out after context is summarised.

## Rules (read first, binding)

- Follow `AGENTS.md` exactly. It is the single source of guidance. In particular:
  - Use the domain vocabulary (project, direction, stage, run, increment, worker, lease, decision, Owner, Viewer).
    Do not invent synonyms.
  - Back end: strict layer direction `Hewn.Domain` → `Hewn.Application` → `Hewn.Infrastructure` → `Hewn.Api`.
    Business rules live in MediatR handlers and domain services, never controllers or hubs.
  - Every client-visible state change is written to the event store with the next per-project sequence number,
    then broadcast. Persist before acknowledging. The API never applies EF migrations on startup.
  - Endpoints and hubs require authentication by default; project data is scoped to the caller (404 otherwise);
    Viewers get 403 on state changes; errors are ProblemDetails with a `code` where clients branch.
  - Never return, log or emit a secret; pass anything that might hold one through the redactor.
  - Front end: `hw-*` selectors, class and file names without the `Hw` prefix; keep the mocks' class names and
    state semantics; read tokens by role, never by hex; API services behind a contract and an injection token;
    live state only through the SignalR client in `api`; status is never colour alone; CDK Dialog and Overlay
    for modals.
  - E2E: Playwright, Page Object Model under `e2e/pages/`, no selectors in tests, Chromium only.
  - Tests never need a database server (in-memory SQLite) and replace GitHub, the model API and Magic Patterns
    with fakes.
  - Every acceptance test file starts with the `// Acceptance Test` / `// Traces to: L2-xxx` / `// Description:`
    header. Never write architecture tests. Never write tests for mocks or the design system.
  - All UI design goes through the Magic Patterns MCP server. Never hand-write or hand-edit a mock.
- Follow `CONTRIBUTING.md` for branches (`feature/build-a-new-product`), commit messages (imperative subject, requirement IDs
  in the body), the pull request template and squash-merging.
- Work through the phases below **in order**, using the repo skill each phase names.
- Copy the house style of each folder. Read the existing neighbours before you write anything new.

## Before you start: what already exists

Journeys are numbered by value, not by build order. Read `git log`, the working tree and `docs/journeys.md`
first. If something this journey depends on is missing (for example the `backend/`, `worker/`, `frontend/`,
`e2e/` or `eng/` scaffold described in `AGENTS.md`, authentication, the event store, the SignalR client, the fake
worker, or the video tooling), build the smallest part of it this journey needs, in the layout `AGENTS.md`
describes, and say so in the PR. Do not build other journeys' features.

## Phase 1: Requirements and detailed design (`engineering-requirements`, `writing-software-design-documents`)

- Read every requirement listed above in full, and each detailed design. If a criterion this journey needs is
  missing, ambiguous or wrong, fix `docs/specs/L2.md` with `engineering-requirements`. Keep existing IDs; new
  requirements take the next free number (after `L2-054` unless others were added since).
- Bring the detailed designs above in line with what you will build, using `writing-software-design-documents`.
  Resolve any open question or `<TO SUPPLY>` you touch, and record decisions as ADRs in `docs/adr/`.

## Phase 2: Magic Patterns design and design system (only if the UI needs something the mocks lack)

- Compare the mocks listed above with the requirement criteria. If a screen, state or control is missing, design
  it in Magic Patterns through its MCP server, export it to `docs/mocks/` (update `docs/mocks/manifest.json` and
  keep `python .claude/skills/writing-html-mocks/scripts/check_mocks.py docs/mocks` at 0 errors), then refresh
  `docs/design-system/` with `extracting-design-systems` so both of its checkers still exit 0. Never hand-write or
  hand-edit a mock.
- If nothing is missing, say so in the PR and change nothing here.

## Phase 3: Incremental implementation (`implementing-incrementally`, test-first)

- Invoke `implementing-incrementally` before writing any production code.
- Plan thin vertical slices. Suggested slices (adjust as the code demands):
  1. Submit a product direction: validation, project and queued direction persisted, navigation to the project page (L2-001).
  2. Pipeline orchestration with fake stage executors: stages 0-10 in order, the stage status set, Complete and Idle at the end (L2-004 AC1-AC3).
  3. Stage 0: repository connection or creation and the Greenlit skills bootstrap with `.hewn/skills.lock` (L2-036 AC1, AC3; L2-007).
  4. Document stages 1, 4, 5, 7 and 8 with their output validation (L2-009, L2-013, L2-014, L2-016, L2-017).
  5. Stages 2 and 3 against a fake Magic Patterns MCP server: designs, export, manifest, design-system extraction and validation (L2-010, L2-012).
  6. Stage 6 scaffold with CI and branch protection (L2-015, L2-036 AC2).
  7. Stage 9 estimates, automatic descoping and backlog ordering (L2-018, L2-019 AC1-AC3, L2-020 AC1).
  8. Stage 10 increments: tests first, implement until green, video, PR, checks and squash-merge (L2-021 to L2-025).
  9. Self-answered questions recorded as decisions, and the no-approval end-to-end test that submits a small direction and asserts Complete (L2-054, L2-028).
- For each slice:
  - Write the Given-When-Then criteria.
  - Write the acceptance test at the level `AGENTS.md` asks for (API integration tests in the backend, fake-API
    tests in the worker, Playwright page-object tests in the front end), with the `Traces to:` header.
  - Run it and show that it fails for the expected reason.
  - Implement the minimum that makes it pass, and refactor while the tests are green.
  - Run the regression checks (`pwsh eng/Test-Backend.ps1`; `npm run lint` and `npm test` in `worker/`;
    `npm run format:check`, `npm run lint`, `npm test` and `npm run build` in `frontend/`; `npm run
    test:behavior`, `npm run test:a11y` and `npm run test:visual` in `e2e/`, as far as each exists), then commit.
- When all slices are green, add the change to `CHANGELOG.md` under `[Unreleased]`, and keep the requirements,
  detailed designs and mocks aligned with what was built.

## Phase 4: Narrated video with background music (`creating-videos`)

Follow `.claude/skills/creating-videos/SKILL.md` for the folder layout, `script.md`, `slides.html`, `README.md`,
cue rules, build and verification. Put the video in `docs/videos/01-build-a-new-product/`. This video documents this implementation for
the team. It is not one of the increment videos Hewn makes for target projects, so L2-023's 3-minute limit does
not apply.

- **Length:** as long as it takes to cover the whole implementation: every slice, the main states and the tests.
  Don't pad it or cut it short.
- **Voice:** a pleasant, free Hugging Face voice: Kokoro-82M (`hexgrad/Kokoro-82M`), run locally with the
  `kokoro` engine the skill describes (`python -m pip install kokoro-onnx soundfile`, voice `af_heart` unless
  another Kokoro voice sounds better on a test sentence). Keep identifiers in `pronunciations.json` and run the
  pronunciation test.
- **Music:** an upbeat, pleasant soca track from Pixabay Music (https://pixabay.com/music/, search "soca"), free
  under the Pixabay Content License. Save it under `docs/videos/assets/music/`, named after the track in kebab case (reuse the track an
  earlier journey video already downloaded, if any), and credit the title, artist, page URL and licence in the
  video's `README.md`. Mix it under the narration with `--music`: fade in, keep it well below the voice (about
  18–22 dB under the narration so every word stays clear), and end with the 3-second music-only tail that fades
  out.
- **Screens of the working implementation:** run the real app (`pwsh eng/Start-LocalStack.ps1`, or the e2e API
  with the fake worker for deterministic runs) and capture screenshots and short clips with Playwright, reusing
  the e2e page objects. Cover desktop (1280 px) and phone (390 px), and light and dark where the screens differ.
  Keep the capture script in the video folder (`clips/clips.mjs`) so it can be rerun.
- **Slides with explainer:** a title slide; the goal and who it is for; the journey flow; the architecture
  (reuse the PNG diagrams under the detailed designs listed above); the code that matters (excerpts of 16 lines or
  fewer, copied from the real files, with `data-mark` on the key lines); the tests going red then green; the
  screens; a recap.
- **Show, don't tell:** illustrative content (screens, clips, diagrams and code) carries the video. Text supports
  it. At most one slide in four is text-only, and a text slide holds a heading and at most three short bullets.
- The video must show:
  - Submitting a direction on New direction, including one inline validation error.
  - The project page as stages advance from Pending to Succeeded, with the fake worker driving the run.
  - The artifacts each stage writes in the target repository (brief, mocks, design system, ADR, specs, designs, journeys, estimates).
  - One increment going red to green, its PR body and its automatic merge.
  - The direction reaching Complete and the project Idle, and an excerpt of `docs/decisions.md`.
- If the repo has no video tooling yet (`tools/video-audio/`, `tools/video-build/`, `docs/videos/assets/slides.css`
  and `slides.js`), create it first as the skill's "Tooling" section describes, with Kokoro as the engine these
  videos use and `--music` support, and add a `docs/videos/README.md` index.
- Verify as the skill says: cue check clean, rendered slide PNGs reviewed for clipping, then `ffprobe` shows
  1920x1080 h264 with an audio stream and a duration matching the narration plus the music tail. Spot-check frames
  at a few cue times and listen to the start, a middle section and the end to confirm the voice sits clearly over
  the music.
- Register the video in `docs/videos/README.md`. Commit the text files, the MP3, the MP4 and the music file; never
  `.cache/`. Keep the MP4 under 100 MB (raise the CRF if needed) so GitHub accepts it.

## Phase 5: Pull request

- Fetch and rebase `feature/build-a-new-product` onto the latest `origin/main` first, because another session may have pushed
  to it. Rerun the full test commands after the rebase.
- Push and open the PR with `gh pr create` against `main`, titled exactly:
  `Build a new product (journey 1, L2-001, L2-004, L2-007, L2-009, L2-010, L2-012, L2-013, L2-014, L2-015, L2-016, L2-017, L2-018, L2-019, L2-020, L2-021, L2-022, L2-023, L2-024, L2-025, L2-028, L2-036, L2-054)`
- Fill every section of `.github/PULL_REQUEST_TEMPLATE.md`: What; Design and decisions (requirements, designs,
  mocks, ADRs, alternatives rejected); API (endpoints, SignalR events, worker messages, or "None"); Tests (each
  command with its pass count, and the new acceptance tests with the L2s they trace to); Video (link to
  `docs/videos/01-build-a-new-product/01-build-a-new-product.mp4` and its `README.md`); Deferred; Notes.

## Phase 6: Merge

- Watch the checks with `gh pr checks --watch`. When one fails, find the root cause, fix it on the branch, push,
  and watch again.
- When every required check passes, squash-merge and delete the branch: `gh pr merge --squash --delete-branch`.
  If the repository has no required checks yet, merge once every local test command above is green and say so in
  the PR.
- If `main` moved, rebase, rerun the tests, push and merge again.
- Confirm with `gh pr view --json state,mergedAt` that the state is `MERGED`, then update local `main`.

## Deferred (out of scope)

- Budgets and spend (journeys 4 and 5).
- Pause, resume, cancel and stop all (journeys 6 to 8).
- The Retry stage control (journey 9).
- Backlog, increment, designs, artifacts, traceability and decisions pages (journeys 12 to 19).

## Done means

- Everything in the Goal above works end to end in the running app, proven by acceptance tests that trace to
  L2-001, L2-004, L2-007, L2-009, L2-010, L2-012, L2-013, L2-014, L2-015, L2-016, L2-017, L2-018, L2-019, L2-020, L2-021, L2-022, L2-023, L2-024, L2-025, L2-028, L2-036, L2-054.
- All the new and existing tests pass, using the repo's test commands.
- Requirements, detailed designs, mocks, design system and `CHANGELOG.md` agree with the code.
- `docs/videos/01-build-a-new-product/` holds the script, slides, outline, narration and a verified 1080p MP4. The video
  uses the Kokoro voice and the credited Pixabay soca track under the narration, and covers the whole
  implementation with screens, clips, diagrams and code.
- The PR `Build a new product (journey 1, L2-001, L2-004, L2-007, L2-009, L2-010, L2-012, L2-013, L2-014, L2-015, L2-016, L2-017, L2-018, L2-019, L2-020, L2-021, L2-022, L2-023, L2-024, L2-025, L2-028, L2-036, L2-054)` is open with every template section filled, its checks passed, and it is squash-merged to
  `main` (`gh pr view` reports `MERGED`).
- Only then end the run, with a short summary of what was built, the decisions made along the way, the PR URL,
  the video path, and anything deferred.
