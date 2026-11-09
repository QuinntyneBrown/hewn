# 11 · Find a project

> **Runtime:** ~6:14 · **Audience:** Owners, Viewers, Hewn contributors and reviewers · **Prerequisites:** [10 · Queue further directions](../10-queue-further-directions/README.md)

**Video:** [11-find-a-project.mp4](11-find-a-project.mp4) · [Slides](slides.html) · **Audio:** [11-find-a-project.mp3](11-find-a-project.mp3) · [Transcript](script.md)

## Why this video exists

It is the video of journey 11: Projects lists every project with its name, current stage, status, percent
complete, spend and last activity, newest first. A status filter lives in the query string and survives a reload,
rows update in place within a second, and the empty state offers New product to Owners only (L2-002). The page
meets its Lighthouse mobile budget, and the read APIs meet their p95 under load (L2-045 AC1–AC2).

## Learning objectives

By the end, the viewer can:

- say how a row's stage, percent complete, note, spend and last activity are worked out;
- explain why rows are read on request and pushed to a `projects` hub group ([ADR 0016](../../adr/0016-project-rows-are-read-on-request.md));
- name the three changes that brought LCP from about 2.6 s to 1.44 s, and how `npm run test:perf` measures it.

## Key questions

| Question | What a strong answer includes |
|---|---|
| Which direction does a row describe? | The active one, else the latest; spend is the total across all directions. |
| How is percent complete counted? | Succeeded stages over planned (not Skipped) stages, stage 10's merged increments as a fraction, 100 once Complete. |
| How does a row change live? | After events are stored, the publisher reads each changed project's row and sends `ProjectSummary` to the `projects` group; log lines and decisions are skipped. |
| Why does a reload keep the filter? | The filter is `?status=…`, read on load; the page filters the rows it loaded and counts every status. |
| What made LCP fast? | One merged initial chunk, the user and config loaded together, and the list requested alongside them when the app opens on Projects. |

## Code / assets on screen

| File | What to show |
|---|---|
| `backend/src/Hewn.Application/Projects/ListProjects.cs` | The row: direction, stage, percent; sorting newest first |
| `backend/src/Hewn.Api/Hubs/SignalRProjectEventPublisher.cs` | Changed rows sent to the `projects` group |
| `frontend/projects/mission-control/src/app/pages/projects/projects-list.ts` | `upsertRow` and `parseStatusFilter` |
| `frontend/projects/mission-control/src/app/pages/projects/projects.page.ts` | Live rows and the resync |
| `frontend/projects/mission-control/src/app/core/session-store.ts`, `core/projects-prefetch.ts`, `app.config.ts` | The start-up changes for LCP |
| `e2e/tests/perf/projects-page.perf.spec.ts`, `read-api-load.perf.spec.ts` | Lighthouse mobile and the load test |
| `backend/tests/Hewn.Api.Tests/Projects/ProjectsListTests.cs` | The first failing test |
| `e2e/tests/pipeline/find-a-project-live.spec.ts` | A row updating live with a real worker |
| `sequence-load-and-filter`, `sequence-live-row-update` | The projects-list design's diagrams |
| `screens/*.png`, `clips/*.mp4` | Mission Control with real scripted workers, captured by `clips/clips.mjs` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:25 | Introduction | What journey 11 is |
| 00:25-01:03 | Goal | The columns, the filter, live rows, the budgets; the flow diagram |
| 01:03-01:51 | Rows | The summary reader; sorting; ADR 0016 |
| 01:51-02:15 | Live | The `projects` group and the live diagram |
| 02:15-02:36 | Page | Live rows, the filter, the resync |
| 02:36-03:52 | Performance | Lighthouse budget, the three changes, 1.44 s, p95 13 ms |
| 03:52-04:41 | Tests | 202 backend, 140 worker, 104 frontend, 11 new e2e, 2 perf |
| 04:41-05:47 | Screens | The list, dark and phone; filter and reload; live rows; empty states; Lighthouse |
| 05:47-06:14 | Recap | Four points and what comes next |

## Demo commands

```sh
pwsh eng/Start-E2eApi.ps1                       # a fresh database: the empty states need no projects
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
cd e2e && npm run test:perf                     # writes e2e/perf-results/lighthouse-report.html
node docs/videos/11-find-a-project/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/11-find-a-project
node tools/video-build/build-video.mjs docs/videos/11-find-a-project --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- The capture refuses to run unless the API has no projects; restart the e2e API first. Run `npm run test:perf`
  before restarting, so the Lighthouse report measures a list with many projects.
- The scripted workers report one model call per step, so the spend column has real values.
- The capture cancels the projects still running when it ends, so no later run picks them up.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [Journey 11 prompt](../../prompts/11-find-a-project.md), [docs/specs/L2.md](../../specs/L2.md),
  [ADR 0016](../../adr/0016-project-rows-are-read-on-request.md)
- [Projects list](../../detailed-designs/projects/projects-list/README.md)
