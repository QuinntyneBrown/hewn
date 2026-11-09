# 07 · Cancel a direction

> **Runtime:** ~5:35 · **Audience:** Owners, Viewers, Hewn contributors and reviewers · **Prerequisites:** [06 · Pause and resume a direction](../06-pause-and-resume-a-direction/README.md)

**Video:** [07-cancel-a-direction.mp4](07-cancel-a-direction.mp4) · [Slides](slides.html) · **Audio:** [07-cancel-a-direction.mp3](07-cancel-a-direction.mp3) · [Transcript](script.md)

## Why this video exists

It is the video of journey 7: an Owner presses Cancel on a running or paused direction and confirms in a dialog. The
active run stops within 10 seconds, the direction is Cancelled, and open pull requests stay open labelled
`hewn:cancelled` (L2-029 AC3). The next queued direction starts (L2-004 AC4). Viewers see no control and the API
answers 403 (AC5).

## Learning objectives

By the end, the viewer can:

- trace Cancel from the dialog to the held control poll that stops the worker ([ADR 0012](../../adr/0012-cancel-reaches-the-worker-on-a-held-control-poll.md));
- explain why Cancel commits first and only then waits for the worker;
- find which pull requests get the `hewn:cancelled` label, and why merged work is untouched.

## Key questions

| Question | What a strong answer includes |
|---|---|
| How does a Local worker hear a cancel in seconds with no inbound port? | It holds `GET .../control` open while it works; the API answers the moment the run is cancelled. |
| What if the worker never answers? | The direction is Cancelled anyway and the run's writes are refused; the dialog names the worker and offers Try again. |
| Which pull requests are labelled? | Every one the direction's runs opened (from the mutation ledger) that is not merged. |

## Code / assets on screen

| File | What to show |
|---|---|
| `backend/src/Hewn.Application/Pipeline/CancelDirection.cs` | The cancel, the control poll and the labelling |
| `backend/src/Hewn.Application/Pipeline/PipelineOrchestrator.cs` | `OnCancelledAsync` and the next queued direction |
| `worker/src/work-loop.ts` | The worker aborting on Cancel |
| `backend/tests/Hewn.Api.Tests/Pipeline/CancelDirectionTests.cs`, `worker/test/cancel.spec.ts` | The first failing tests |
| `e2e/tests/pipeline/cancel-a-direction.spec.ts` | The stop within 10 seconds and the labelled pull request |
| `sequence-cancel` | The pause-resume-cancel-stop design's diagram |
| `screens/*.png`, `clips/*.mp4` | Mission Control with a real worker, captured by `clips/clips.mjs` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:25 | Introduction | What journey 7 is |
| 00:25-00:49 | Goal | Stop within 10 s; labelled PRs; the queue; Viewers |
| 00:49-01:14 | Flow | The cancel sequence |
| 01:14-01:56 | Control poll | Why a held poll; the API's side; the worker's |
| 01:56-02:25 | Cancel | The command and the orchestrator |
| 02:25-02:44 | Labels | Open pull requests from the mutation ledger |
| 02:44-03:20 | Page | The dialog, Cancelling…, the failed state, dark and phone |
| 03:20-04:12 | Tests | 185 backend, 138 worker, 71 frontend, 50 e2e |
| 04:12-05:10 | Screens | Cancel with an open PR, the fake GitHub, the queued direction, a silent worker, a Viewer |
| 05:10-05:35 | Recap | Three points and what comes next |

## Demo commands

```sh
pwsh eng/Start-E2eApi.ps1
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
node docs/videos/07-cancel-a-direction/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/07-cancel-a-direction
node tools/video-build/build-video.mjs docs/videos/07-cancel-a-direction --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- The scripted worker opens a pull request only when `HEWN_SCRIPTED_PULL_REQUEST_STAGE` is set (the clips use 6,
  Scaffold). With 1.5-second steps the cancel can land in the stage after Scaffold; the pull request stays open
  either way.
- The busy state lasts only as long as the worker takes to hear, usually well under a second, so the clip holds the
  request for 1.2 seconds with `page.route` before passing it on to the API unchanged.
- The failed state needs a worker that holds a lease and stops answering: the clip stops the worker process, and
  Cancel then waits the full 10 seconds.
- `/api/fakes/github/{owner}/{name}/pulls` exists only with `Hewn:Fakes:Enabled` (the e2e stack).

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [Journey 7 prompt](../../prompts/07-cancel-a-direction.md), [docs/specs/L2.md](../../specs/L2.md),
  [ADR 0012](../../adr/0012-cancel-reaches-the-worker-on-a-held-control-poll.md)
- [Pause, resume, cancel and stop all](../../detailed-designs/pipeline/pause-resume-cancel-stop/README.md),
  [Worker loop](../../detailed-designs/agent-runtime/worker-loop/README.md)
