# 28 · Configure automatic descoping

> **Runtime:** ~4:21 · **Audience:** Owners, Viewers and Hewn contributors · **Prerequisites:** [27 · Reconnect Mission Control](../27-reconnect-mission-control/README.md)

**Video:** [28-configure-automatic-descoping.mp4](28-configure-automatic-descoping.mp4) · [Slides](slides.html) · **Audio:** [28-configure-automatic-descoping.mp3](28-configure-automatic-descoping.mp3) · [Transcript](script.md)

## Why this video exists

This is the video for journey 28 (L2-019 AC1). An Owner sets the descope threshold in Settings; each direction keeps
the threshold in force when it was submitted, and stage 9 splits and defers against it. In the recording, half a day
was refused, one day was saved, and a worker's stage 9 deferred all 3 designs (each estimated at 2 days) 2.8 s after
it started (`screens/records.json`).

## Learning objectives

By the end, the viewer can:

- set the threshold, and say which values Settings refuses;
- explain why a running direction keeps the threshold it was submitted with;
- trace the threshold from Settings to the stage 9 agent and the descoper.

## Key questions

| Question | What a strong answer includes |
|---|---|
| What values are allowed? | A whole number of ideal days from 1 to 20; 3 until an Owner saves one. |
| Does changing it affect a running direction? | No. A direction records the threshold at submission, as it does its budget ([ADR 0029](../../adr/0029-a-direction-keeps-the-descope-threshold-it-was-submitted-with.md)). |
| How does stage 9 learn it? | The lease carries it; the agent's task names the number of days to split against, and the descoper defers what is still above it. |
| Who can change it? | Owners. Viewers see it read-only, and the API answers their PUT with 403. |

## Code / assets on screen

| File | What to show |
|---|---|
| `backend/src/Hewn.Application/Spend/DirectionDefaultsCommands.cs`, `Hewn.Domain/Direction.cs` | Validation; the direction's threshold |
| `SubmitProductDirection.cs`, `WorkerCommands.cs` | Recording it at submission; the lease |
| `worker/src/executors/document-executor.ts`, `worker/src/estimates/backlog-planner.ts` | The agent's task; the descope rule |
| `sequence-set-threshold` | The estimate-and-plan-backlog design's new diagram |
| `DescopeThresholdTests.cs`, `estimate-stage.spec.ts`, `e2e/tests/**/*descop*.spec.ts` | Red then green |
| `screens/*.png`, `clips/*.mp4` | Captured by `clips/clips.mjs` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:26 | Introduction | What journey 28 is |
| 00:26-00:47 | Goal | L2-019 AC1 |
| 00:47-01:15 | Setting the threshold | Half a day refused; one day saved |
| 01:15-02:03 | Where it lives | Validation, per-direction threshold, the sequence |
| 02:03-02:42 | Stage 9 | The agent's task; every 2-day design deferred |
| 02:42-03:48 | Tests | Backend, worker, behaviour, pipeline and visual |
| 03:48-03:59 | Screens | Viewer, dark and phone |
| 03:59-04:21 | Recap | Three points and what comes next |

## Demo commands

```sh
pwsh eng/Start-E2eApi.ps1
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json && cd ..
node docs/videos/28-configure-automatic-descoping/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/28-configure-automatic-descoping
node tools/video-build/build-video.mjs docs/videos/28-configure-automatic-descoping --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- The capture script puts the threshold back to 3 when it finishes, so other suites on the shared stack see the
  default.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [Journey 28 prompt](../../prompts/28-configure-automatic-descoping.md), [docs/specs/L2.md](../../specs/L2.md)
- [Estimate and plan the backlog](../../detailed-designs/stages/estimate-and-plan-backlog/README.md), [ADR 0029](../../adr/0029-a-direction-keeps-the-descope-threshold-it-was-submitted-with.md)
