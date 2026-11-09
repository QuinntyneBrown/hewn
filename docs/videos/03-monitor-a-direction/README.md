# 03 · Monitor a direction

> **Runtime:** ~4:52 · **Audience:** Owners, Viewers, Hewn contributors and reviewers · **Prerequisites:** [01 · Build a new product](../01-build-a-new-product/README.md)

**Video:** [03-monitor-a-direction.mp4](03-monitor-a-direction.mp4) · [Slides](slides.html) · **Audio:** [03-monitor-a-direction.mp3](03-monitor-a-direction.mp3) · [Transcript](script.md)

## Why this video exists

It is the video of journey 3: anyone who can see a project follows a running direction live (L2-030). The running
stage shows its step and latest log line, and a selected stage shows its runs, log, artifacts and decisions. Every
change arrives as an event with the next per-project sequence number (L2-031). The log follows new lines, holds
when scrolled up and keeps at most 500 lines in the page (L2-033), and stage changes are announced politely at most
once every 5 seconds (L2-047 AC3).

## Learning objectives

By the end, the viewer can:

- trace an event from the command handler through the event store and the SignalR hub to the page;
- explain why log lines are sent in batches, and when a batch is sent;
- describe how the log follows, holds when scrolled up, and stays light past 5,000 lines.

## Key questions

| Question | What a strong answer includes |
|---|---|
| How does the page know the running step? | The worker calls `PUT /api/worker/runs/{id}/step` before each step; Hewn sends `StepStarted`. |
| Why can't a live line appear twice? | Lines carry their number; `mergeLines` keeps one line per number, whether it came from a page or an event. |
| What does a 6,000-line log put in the page? | A window of at most 500 rows around the view, with spacers of exact height. |

## Code / assets on screen

| File | What to show |
|---|---|
| `worker/src/work-loop.ts` | Naming each step, flushing logs before the checkpoint |
| `worker/src/log-batcher.ts` | Sending pending lines in batches of up to 500 |
| `backend/src/Hewn.Application/Pipeline/RepositoryCommands.cs` | One redacted `LogLines` event per batch |
| `frontend/projects/api/src/lib/projects/apply-event.ts` | `StepStarted` and `LogLines` setting the stage's step and latest line |
| `frontend/projects/mission-control/src/app/pages/project/pipeline-view.ts` | `mergeLines` and `logWindow` |
| `backend/tests/Hewn.Api.Tests/Pipeline/MonitorDirectionTests.cs` | Log batches as numbered, redacted events |
| `screens/*.png`, `clips/*.mp4` | Mission Control with real workers, captured by `clips/clips.mjs` |
| `sequence-deliver`, `sequence-watch-stage` | The real-time events and project page designs' diagrams |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:21 | Introduction | What journey 3 is |
| 00:21-00:57 | Goal | Status, live step and line, the stage detail, the log |
| 00:57-01:24 | Events | Event store, sequence, hub group, client store; three new events |
| 01:24-01:58 | Worker | Step names, batched log lines, reported decisions |
| 01:58-02:27 | Page | Applying events, the stage detail |
| 02:27-03:00 | Log | Merging by line number, the 500-line window |
| 03:00-03:43 | Tests | 147 backend, 126 worker, 35 frontend, 34 e2e |
| 03:43-04:28 | Screens | A stage turning over, the log holding, a past stage's tabs, dark and phone, waiting |
| 04:28-04:52 | Recap | Three points and what comes next |

## Demo commands

```sh
pwsh eng/Start-E2eApi.ps1
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
node docs/videos/03-monitor-a-direction/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/03-monitor-a-direction
node tools/video-build/build-video.mjs docs/videos/03-monitor-a-direction --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- `clips.mjs` first runs whatever earlier runs left queued with fast workers, so each clip's direction starts at
  once.
- The live clips use the scripted executor, which writes `{stage} · line n of N` in its middle step; its first step
  writes nothing, so the log clip waits for lines before scrolling.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [Journey 3 prompt](../../prompts/03-monitor-a-direction.md), [docs/specs/L2.md](../../specs/L2.md),
  [ADR 0009](../../adr/0009-live-progress-from-the-worker.md)
- [Project page and live log](../../detailed-designs/mission-control/project-page-and-live-log/README.md),
  [Real-time events](../../detailed-designs/mission-control/real-time-events/README.md)
