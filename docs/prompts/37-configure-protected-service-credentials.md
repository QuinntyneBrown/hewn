# Feature: Configure protected service credentials (journey 37)

## Goal

An operator supplies the model API key, Magic Patterns credentials and GitHub App key. They are encrypted at rest (cloud key vault in the cloud, OS key store locally) and no API response ever contains them; settings show only a secret reference with its last-updated time. Any log line, event or PR body containing a stored secret or a known token pattern (GitHub, Anthropic, Azure) is redacted to `***` before it is stored or sent. Credentials written into an agent workspace are deleted when the run ends. Agents have no tool that can change configuration, budgets, secrets or another project.

Actor: Owner (operator). Journey 37 in `docs/journeys.md`: "Supply encrypted integration credentials; keep secrets out of outputs and workspaces." Estimated effort: 6 ideal days.
Everything not named here stays unchanged.

- Requirements (in `docs/specs/L2.md`; cross-reference them, don't copy them):
  - `L2-040` Secrets (all criteria)
  - `L2-042` Agent isolation (AC4)
- Detailed designs:
  - `docs/detailed-designs/security/secrets-and-redaction/README.md` and its `diagrams/`
  - `docs/detailed-designs/agent-runtime/agent-isolation/README.md` and its `diagrams/`
- Mocks: none. This journey has no Mission Control screen in `docs/mocks/`.
- Design system: `docs/design-system/` (`tokens/tokens.css`, `assets/components.css`, one page per component).

`docs/detailed-designs/security/secrets-and-redaction/README.md` leaves the cloud vault product as "<TO SUPPLY>". Choose one that fits the deploy target, record the choice in an ADR under `docs/adr/`, and update the design.

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
- Follow `CONTRIBUTING.md` for branches (`feature/configure-protected-service-credentials`), commit messages (imperative subject, requirement IDs
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

## Phase 2: Magic Patterns design (only if a screen turns out to be needed)

- This journey has no mock. If the simplest design truly needs a new screen or state, design it in Magic Patterns
  through its MCP server, export it to `docs/mocks/`, keep the mocks checker at 0 errors, and refresh
  `docs/design-system/` with `extracting-design-systems`. Otherwise record "not applicable" in the PR.

## Phase 3: Incremental implementation (`implementing-incrementally`, test-first)

- Invoke `implementing-incrementally` before writing any production code.
- Plan thin vertical slices. Suggested slices (adjust as the code demands):
  1. `ISecretStore` with the key-vault and OS key-store implementations (L2-040 AC1).
  2. How credentials are supplied: the simplest route the detailed design allows. If it needs a screen, design it in Magic Patterns first.
  3. The redactor on logs, events and PR bodies (L2-040 AC2).
  4. Workspace credential cleanup at run end (L2-040 AC3).
  5. No agent tool exposes configuration, budgets, secrets or other projects (L2-042 AC4).
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
cue rules, build and verification. Put the video in `docs/videos/37-configure-protected-service-credentials/`. This video documents this implementation for
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
  - Supplying a credential and seeing only its reference afterwards.
  - A log line with a planted token redacted to `***`.
  - The workspace after a run, with credentials gone.
  - The redaction pipeline as a diagram.
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

- Fetch and rebase `feature/configure-protected-service-credentials` onto the latest `origin/main` first, because another session may have pushed
  to it. Rerun the full test commands after the rebase.
- Push and open the PR with `gh pr create` against `main`, titled exactly:
  `Configure protected service credentials (journey 37, L2-040, L2-042)`
- Fill every section of `.github/PULL_REQUEST_TEMPLATE.md`: What; Design and decisions (requirements, designs,
  mocks, ADRs, alternatives rejected); API (endpoints, SignalR events, worker messages, or "None"); Tests (each
  command with its pass count, and the new acceptance tests with the L2s they trace to); Video (link to
  `docs/videos/37-configure-protected-service-credentials/37-configure-protected-service-credentials.mp4` and its `README.md`); Deferred; Notes.

## Phase 6: Merge

- Watch the checks with `gh pr checks --watch`. When one fails, find the root cause, fix it on the branch, push,
  and watch again.
- When every required check passes, squash-merge and delete the branch: `gh pr merge --squash --delete-branch`.
  If the repository has no required checks yet, merge once every local test command above is green and say so in
  the PR.
- If `main` moved, rebase, rerun the tests, push and merge again.
- Confirm with `gh pr view --json state,mergedAt` that the state is `MERGED`, then update local `main`.

## Deferred (out of scope)

- Nothing beyond what other journeys cover.

## Done means

- Everything in the Goal above works end to end in the running app, proven by acceptance tests that trace to
  L2-040, L2-042.
- All the new and existing tests pass, using the repo's test commands.
- Requirements, detailed designs, mocks, design system and `CHANGELOG.md` agree with the code.
- `docs/videos/37-configure-protected-service-credentials/` holds the script, slides, outline, narration and a verified 1080p MP4. The video
  uses the Kokoro voice and the credited Pixabay soca track under the narration, and covers the whole
  implementation with screens, clips, diagrams and code.
- The PR `Configure protected service credentials (journey 37, L2-040, L2-042)` is open with every template section filled, its checks passed, and it is squash-merged to
  `main` (`gh pr view` reports `MERGED`).
- Only then end the run, with a short summary of what was built, the decisions made along the way, the PR URL,
  the video path, and anything deferred.
