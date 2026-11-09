# 10 · Queue further directions

> **Runtime:** ~5:09 · **Audience:** Owners, Viewers, Hewn contributors and reviewers · **Prerequisites:** [09 · Recover a failed stage](../09-recover-a-failed-stage/README.md)

**Video:** [10-queue-further-directions.mp4](10-queue-further-directions.mp4) · [Slides](slides.html) · **Audio:** [10-queue-further-directions.mp3](10-queue-further-directions.mp3) · [Transcript](script.md)

## Why this video exists

It is the video of journey 10: further directions submitted on a project with an active one queue, first in, first
out, with one active direction per project, and each starts by itself when the one before it is Complete or
Cancelled; other projects run in parallel (L2-004 AC4, L2-005 AC4). An Owner who submits more than 10 directions in
a minute gets 429 for the extra ones, and New direction says when they can submit again (L2-043 AC4).

## Learning objectives

By the end, the viewer can:

- say which direction is a project's active one, and what starts the next queued direction;
- explain why the limit counts stored directions instead of using ASP.NET's rate limiter ([ADR 0015](../../adr/0015-the-submission-limit-counts-stored-directions.md));
- show the queued callout and the rate-limited state, and what is kept when a submission is refused.

## Key questions

| Question | What a strong answer includes |
|---|---|
| What makes a direction wait? | Another direction on the same project is Running, Paused, Blocked or queued ahead of it. |
| What starts the next one? | The orchestrator, when the active direction is Complete or Cancelled, starts the oldest queued direction instead of setting the project Idle. |
| What counts against the limit? | Directions the Owner stored in the last 60 seconds; refused and invalid requests store nothing, so they don't count. |
| How does the Owner know when to try again? | `retryAfterSeconds` and `Retry-After`: when the oldest counted submission leaves the minute. |

## Code / assets on screen

| File | What to show |
|---|---|
| `backend/src/Hewn.Domain/Project.cs` | The active direction; a feature queues behind it |
| `backend/src/Hewn.Application/Pipeline/PipelineOrchestrator.cs` | Starting the next queued direction |
| `backend/src/Hewn.Application/Projects/DirectionSubmissionLimit.cs` | Counting the minute and refusing |
| `backend/src/Hewn.Api/Errors/ApplicationExceptionHandler.cs` | The 429 ProblemDetails and `Retry-After` |
| `frontend/projects/mission-control/src/app/pages/new-direction/new-direction.page.ts` | The rate-limited state |
| `backend/tests/Hewn.Api.Tests/Projects/DirectionRateLimitTests.cs` | The first failing tests; the minute sliding |
| `e2e/tests/pipeline/queue-further-directions.spec.ts` | First in, first out with a real worker |
| `sequence-queue-second-direction` | The run-direction design's queue diagram |
| `screens/*.png`, `clips/*.mp4` | Mission Control with a real scripted worker, captured by `clips/clips.mjs` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:25 | Introduction | What journey 10 is |
| 00:25-00:46 | Goal | First in, first out, one per project, the 429 |
| 00:46-01:08 | Queue | The queue diagram; the active direction |
| 01:08-01:32 | Next | The orchestrator starts the next queued direction |
| 01:32-02:17 | Limit | Counting the minute, the 429, the sliding test |
| 02:17-02:40 | Page | The rate-limited state, dark and phone |
| 02:40-03:39 | Tests | 198 backend, 140 worker, 97 frontend, 56 e2e |
| 03:39-04:38 | Screens | Two directions queue; the next starts by itself; the limit |
| 04:38-05:09 | Recap | Three points and what comes next |

## Demo commands

```sh
Hewn__RateLimit__DirectionsPerMinute=10 pwsh eng/Start-E2eApi.ps1
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
node docs/videos/10-queue-further-directions/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/10-queue-further-directions
node tools/video-build/build-video.mjs docs/videos/10-queue-further-directions --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- The e2e stack allows 30 directions a minute, because its suites submit many as one Owner. The recording sets
  the default of 10, so the rate-limited message matches the mock.
- The limit is per Owner and counts a whole minute: rerunning the capture within a minute starts with the
  second Owner's minute partly full.
- The capture cancels the directions the second Owner submitted, so no later run picks them up.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [Journey 10 prompt](../../prompts/10-queue-further-directions.md), [docs/specs/L2.md](../../specs/L2.md),
  [ADR 0015](../../adr/0015-the-submission-limit-counts-stored-directions.md)
- [Run a direction](../../detailed-designs/pipeline/run-direction/README.md),
  [Web protections](../../detailed-designs/security/web-protections/README.md)
