# 06 · Pause and resume a direction

> **Runtime:** ~4:48 · **Audience:** Owners, Viewers, Hewn contributors and reviewers · **Prerequisites:** [05 · Raise budget and resume](../05-raise-budget-and-resume/README.md)

**Video:** [06-pause-and-resume-a-direction.mp4](06-pause-and-resume-a-direction.mp4) · [Slides](slides.html) · **Audio:** [06-pause-and-resume-a-direction.mp3](06-pause-and-resume-a-direction.mp3) · [Transcript](script.md)

## Why this video exists

It is the video of journey 6: an Owner presses Pause on a running direction; the current step finishes, the
direction becomes Paused and nothing new starts (L2-029 AC1). Resume continues from the next step (AC2) and no
completed step runs twice (L2-050 AC3). Viewers see no control and the API answers 403 (AC5).

## Learning objectives

By the end, the viewer can:

- trace Pause from the header to the request on the direction and the checkpoint that answers it;
- explain why the checkpoint call, not a control channel, carries the pause ([ADR 0011](../../adr/0011-pause-takes-effect-at-the-next-checkpoint.md));
- show from the run log and the step events that a resumed run starts at the next step.

## Key questions

| Question | What a strong answer includes |
|---|---|
| When does a pause take effect? | At the checkpoint that ends the step in progress; at once if the run is still waiting for a worker. |
| Why does no completed step run twice? | Resume queues the same run with its checkpoint; the next lease starts after it. |
| Can Resume continue a direction paused at its budget? | No: 409 `budget_reached`; only Raise and resume continues it. |

## Code / assets on screen

| File | What to show |
|---|---|
| `backend/src/Hewn.Application/Pipeline/PauseAndResume.cs` | The pause request: event, log line, an immediate pause for a queued run |
| `backend/src/Hewn.Application/Pipeline/WorkerCommands.cs` | The checkpoint answering Pause and pausing the run |
| `worker/src/work-loop.ts` | The worker ending the run on a Pause verdict |
| `backend/src/Hewn.Application/Pipeline/PipelineOrchestrator.cs` | `OnResumedAsync` re-queuing the run |
| `backend/tests/Hewn.Api.Tests/Pipeline/PauseAndResumeTests.cs`, `worker/test/pause.spec.ts` | The first failing tests |
| `e2e/tests/pipeline/pause-and-resume.spec.ts` | Each Bootstrap step started once |
| `sequence-pause-resume`, `sequence-checkpoint` | The pause-resume-cancel-stop and worker-loop designs' diagrams |
| `screens/*.png`, `clips/*.mp4` | Mission Control with a real worker, captured by `clips/clips.mjs` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:23 | Introduction | What journey 6 is |
| 00:23-00:43 | Goal | Pause after the step; resume at the next; Viewers |
| 00:43-01:03 | Flow | The pause-and-resume sequence |
| 01:03-01:25 | Pause | The pause request |
| 01:25-02:04 | Checkpoint | The worker-loop checkpoint sequence; the API's answer; the worker stopping |
| 02:04-02:26 | Resume | Re-queuing the run; a budget stop is not resumed |
| 02:26-02:46 | Page | Pausing…, the paused callout, dark and phone |
| 02:46-03:35 | Tests | 178 backend, 133 worker, 64 frontend, 47 e2e |
| 03:35-04:27 | Screens | Pause mid-step, Resume, Bootstrap's log, a Viewer |
| 04:27-04:48 | Recap | Three points and what comes next |

## Demo commands

```sh
pwsh eng/Start-E2eApi.ps1
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
node docs/videos/06-pause-and-resume-a-direction/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/06-pause-and-resume-a-direction
node tools/video-build/build-video.mjs docs/videos/06-pause-and-resume-a-direction --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- The worker uses the scripted executor with 5-second steps and 5 log lines, so the clip can press Pause during
  Run Bootstrap and watch it finish.
- Workers poll every 15 seconds, so a resumed run can wait up to 15 seconds for its lease.
- The scripted executor writes log lines only in its middle step, so the resumed step 3 shows in the stage's live
  step and the step events rather than in the log.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [Journey 6 prompt](../../prompts/06-pause-and-resume-a-direction.md), [docs/specs/L2.md](../../specs/L2.md),
  [ADR 0011](../../adr/0011-pause-takes-effect-at-the-next-checkpoint.md)
- [Pause, resume, cancel and stop all](../../detailed-designs/pipeline/pause-resume-cancel-stop/README.md),
  [Worker loop](../../detailed-designs/agent-runtime/worker-loop/README.md)
