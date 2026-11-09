# 09 · Recover a failed stage

> **Runtime:** ~5:28 · **Audience:** Owners, Viewers, Hewn contributors and reviewers · **Prerequisites:** [08 · Stop and restart all workers](../08-stop-and-restart-all-workers/README.md)

**Video:** [09-recover-a-failed-stage.mp4](09-recover-a-failed-stage.mp4) · [Slides](slides.html) · **Audio:** [09-recover-a-failed-stage.mp3](09-recover-a-failed-stage.mp3) · [Transcript](script.md)

## Why this video exists

It is the video of journey 9: a failed run is retried automatically up to 3 times, after 30 s, 2 min and 10 min
(L2-006 AC1). When the third retry fails, the stage is Failed, the direction Blocked, and Mission Control gets an
event with the reason and the last 200 log lines while other projects keep running (AC2). An Owner's Retry stage
runs the failed stage again from its start with its retry counter reset (AC3).

## Learning objectives

By the end, the viewer can:

- explain why each retry is a new run with a `NotBefore` time, and how the lease waits for it ([ADR 0014](../../adr/0014-a-retry-is-a-new-run-leasable-after-its-backoff.md));
- say what changes when the retries run out: Failed, Blocked, `StageBlocked`;
- show Retry stage running the stage from its start, and what a Viewer sees.

## Key questions

| Question | What a strong answer includes |
|---|---|
| Who waits out the backoff? | The lease: its query skips runs whose `NotBefore` is in the future, so workers need no timers and a restart keeps the schedule. |
| Why does another project keep running? | The waiting retry is a queued run nobody can lease yet, so it holds no lease; other projects' runs are leased as usual. |
| What does the Blocked event carry? | The reason and the run's last 200 log lines, which were redacted when stored. |
| What does Retry stage reset? | It queues attempt 1 with no checkpoint, so the stage starts from its first step and gets three retries again. |

## Code / assets on screen

| File | What to show |
|---|---|
| `backend/src/Hewn.Application/Pipeline/PipelineOrchestrator.cs` | Queuing the next attempt; blocking when the retries run out |
| `backend/src/Hewn.Application/Pipeline/LeaseService.cs` | The `NotBefore` filter |
| `backend/src/Hewn.Application/Pipeline/RetryStage.cs` | Retry stage |
| `frontend/projects/mission-control/src/app/pages/project/project.page.ts` | The danger toast with Open log and Retry stage |
| `backend/tests/Hewn.Api.Tests/Pipeline/RetryFailedStageTests.cs`, `worker/test/scripted-executor.spec.ts` | The first failing tests |
| `e2e/tests/pipeline/recover-a-failed-stage.spec.ts` | Retry stage reruns the stage to success |
| `backoff-schedule` | The retry design's backoff diagram |
| `screens/*.png`, `clips/*.mp4` | Mission Control with a real scripted worker, captured by `clips/clips.mjs` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:28 | Introduction | What journey 9 is |
| 00:28-00:55 | Goal | Three retries, Blocked, the event, Retry stage |
| 00:55-01:14 | Backoff | The schedule diagram |
| 01:14-02:02 | Retries | The next attempt, the lease's filter, the first test |
| 02:02-02:21 | Blocked | Failed, Blocked, `StageBlocked` |
| 02:21-02:38 | Retry stage | The endpoint |
| 02:38-03:15 | Page | Countdown, callout, toast, dark, phone, Viewer |
| 03:15-04:05 | Tests | 194 backend, 140 worker, 93 frontend, 53 e2e |
| 04:05-04:58 | Screens | Retries and Blocked, the Runs tab, Retry stage |
| 04:58-05:28 | Recap | Three points and what comes next |

## Demo commands

```sh
Hewn__Retry__BackoffSeconds=5,8,12 pwsh eng/Start-E2eApi.ps1
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
node docs/videos/09-recover-a-failed-stage/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/09-recover-a-failed-stage
node tools/video-build/build-video.mjs docs/videos/09-recover-a-failed-stage --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- The real waits are 30 s, 2 min and 10 min; the recording uses 5, 8 and 12 seconds
  (`Hewn__Retry__BackoffSeconds`), and the e2e stack 2, 3 and 4.
- The scripted worker counts failures per project in memory, so use one worker: with two, each would fail the stage
  its own number of times.
- The toast appears only on a page that is open when the stage blocks; a page loaded later shows the callout.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [Journey 9 prompt](../../prompts/09-recover-a-failed-stage.md), [docs/specs/L2.md](../../specs/L2.md),
  [ADR 0014](../../adr/0014-a-retry-is-a-new-run-leasable-after-its-backoff.md)
- [Retry a failed stage](../../detailed-designs/pipeline/retry-failed-stage/README.md)
