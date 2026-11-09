# 12 · Review the backlog

> **Runtime:** ~5:28 · **Audience:** Owners, Viewers, Hewn contributors and reviewers · **Prerequisites:** [11 · Find a project](../11-find-a-project/README.md)

**Video:** [12-review-the-backlog.mp4](12-review-the-backlog.mp4) · [Slides](slides.html) · **Audio:** [12-review-the-backlog.mp3](12-review-the-backlog.mp3) · [Transcript](script.md)

## Why this video exists

It is the video of journey 12: a project's Backlog tab shows the current direction's increments in order with
status (Queued, In progress, Blocked, Merged), estimate and pull request link (L2-020 AC2); the deferred designs
appear apart with their reasons (L2-019 AC4); a blocked increment says why; and the merged totals and percent
complete move after every merge, without a reload (L2-025 AC4, L2-018).

## Learning objectives

By the end, the viewer can:

- say what `GET /api/projects/{id}/backlog` returns, and which direction it describes;
- explain how the Backlog tab stays current without applying events in place;
- drive a deferred design and a blocked increment through the real pipeline with the scripted agent.

## Key questions

| Question | What a strong answer includes |
|---|---|
| Which direction's backlog is shown? | The active direction, else the latest, as Projects describes it. |
| How are deferred designs told apart? | They are increments rows with no number; they come back ordered by title, with their reasons. |
| Where does percent complete come from? | `ProjectSummaryReader`, the same reader as the Projects list, so the two agree. |
| How does a merge reach the open tab? | `BacklogPlanned`, `IncrementChanged`, `StageChanged` or `DirectionChanged` bump a counter; the tab reads the backlog again. |
| What does the blocked callout name? | Iterations used, failing tests, and the first increment left that doesn't depend on it, directly or transitively. |

## Code / assets on screen

| File | What to show |
|---|---|
| `backend/src/Hewn.Application/Projects/GetProjectBacklog.cs` | The direction, increments in order, PR links, deferred, totals |
| `frontend/projects/mission-control/src/app/pages/project/project.page.html` | The Pipeline and Backlog tabs |
| `frontend/projects/mission-control/src/app/pages/project/backlog-view.ts` | Status labels, the PR cell, the blocked notice |
| `frontend/projects/mission-control/src/app/pages/project/project.page.ts` | The events that re-read the backlog |
| `worker/src/agents/scripted-agent.ts` | Nice-to-have in the brief; blocking and slowing an increment |
| `backend/tests/Hewn.Api.Tests/Projects/ProjectBacklogTests.cs` | The first failing test |
| `e2e/tests/pipeline/review-the-backlog-live.spec.ts`, `e2e/support/mocks.ts` | The live test; the pixel-grid fix in the visual helper |
| `sequence-view-backlog` | The estimate-and-plan-backlog design's diagram |
| `screens/*.png`, `clips/*.mp4` | Mission Control with real workers running the stage executors, captured by `clips/clips.mjs` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:26 | Introduction | What journey 12 is |
| 00:26-01:15 | Goal | Order, status, estimate, PR, deferred, blocked, live; the flow diagram |
| 01:15-01:45 | Endpoint | The backlog query, deferred rows, totals and percent |
| 01:45-02:12 | Backlog tab | Section tabs; statuses and the PR column |
| 02:12-02:34 | Blocked | The callout and what Hewn moved on to |
| 02:34-03:03 | Live | Events that re-read the backlog |
| 03:03-03:23 | Real runs | Nice-to-have, a blocked increment, slowed increments |
| 03:23-04:23 | Tests | 206 backend, 144 worker, 110 frontend, 13 new e2e |
| 04:23-05:05 | Screens | Kiln Booking live; merged, dark and phone; Parcel Post blocked |
| 05:05-05:28 | Recap | Four points and what comes next |

## Demo commands

```sh
pwsh eng/Start-E2eApi.ps1                       # a fresh database, so no other directions are queued
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
node docs/videos/12-review-the-backlog/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/12-review-the-backlog
node tools/video-build/build-video.mjs docs/videos/12-review-the-backlog --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- The capture uses the real stage executors against the fakes, which report no model usage, so spend reads $0.00.
- `HEWN_SCRIPTED_INCREMENT_MS` slows each stage 10 session; without it a two-increment backlog merges in seconds
  and the In progress state is gone before the page shows it.
- Parcel Post's blocked direction is cancelled at the end, so no later run picks it up.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [Journey 12 prompt](../../prompts/12-review-the-backlog.md), [docs/specs/L2.md](../../specs/L2.md)
- [Estimate and plan the backlog](../../detailed-designs/stages/estimate-and-plan-backlog/README.md)
