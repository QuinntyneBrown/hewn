# 08 · Stop and restart all workers

> **Runtime:** ~5:08 · **Audience:** Owners, Viewers, Hewn contributors and reviewers · **Prerequisites:** [07 · Cancel a direction](../07-cancel-a-direction/README.md)

**Video:** [08-stop-and-restart-all-workers.mp4](08-stop-and-restart-all-workers.mp4) · [Slides](slides.html) · **Audio:** [08-stop-and-restart-all-workers.mp3](08-stop-and-restart-all-workers.mp3) · [Transcript](script.md)

## Why this video exists

It is the video of journey 8: an Owner presses Stop all workers and confirms. Every worker halts its active run
within 10 seconds and leases no new work until the Owner presses Start workers, and each halted run then resumes
from its last checkpoint (L2-029 AC4). A banner shows on every page while workers are stopped. Viewers see no
control and the API answers 403 (AC5).

## Learning objectives

By the end, the viewer can:

- trace Stop all workers from the dialog to the `Halt` answer on each worker's control poll ([ADR 0013](../../adr/0013-stop-all-workers-halts-runs-on-the-control-poll.md));
- explain why the leasing switch is stored and checked in the lease's own `UPDATE`;
- show how a halted run resumes from its checkpoint after Start workers.

## Key questions

| Question | What a strong answer includes |
|---|---|
| How can no run be leased after Stop? | The switch is saved first, and the grant's single `UPDATE` checks it; a lease granted just before is found and halted. |
| What survives a restart? | The switch is a database row, so a restarted API stays stopped until Start workers. |
| What does a halted run keep? | Its worker and epoch (so the poll can answer `Halt`) and its checkpoint; its writes are refused at once. |
| What if a worker never answers? | Stop names it after 10 seconds; leasing is off, so it can't pick up new work; Try again waits for it again. |

## Code / assets on screen

| File | What to show |
|---|---|
| `backend/src/Hewn.Application/Workers/StopAndStartWorkers.cs` | Stop and Start |
| `backend/src/Hewn.Application/Pipeline/LeaseService.cs` | The switch checked in the lease's `UPDATE` |
| `backend/src/Hewn.Domain/Run.cs` | `Halt()` |
| `backend/src/Hewn.Application/Pipeline/CancelDirection.cs` | The control poll answering `Halt` |
| `worker/src/work-loop.ts` | The worker aborting on Halt |
| `backend/tests/Hewn.Api.Tests/Workers/StopAllWorkersTests.cs`, `worker/test/halt.spec.ts` | The first failing tests |
| `e2e/tests/pipeline/stop-and-restart-all-workers.spec.ts` | Two projects halted within 10 seconds and resumed |
| `sequence-stop-all` | The pause-resume-cancel-stop design's diagram |
| `screens/*.png`, `clips/*.mp4` | Mission Control with two real workers, captured by `clips/clips.mjs` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:27 | Introduction | What journey 8 is |
| 00:27-00:51 | Goal | Halt within 10 s; nothing leased; resume; Viewers |
| 00:51-01:18 | Flow | The stop-all sequence |
| 01:18-01:37 | Switch | The stored switch and the lease's `UPDATE`; the restart test |
| 01:37-02:13 | Halt | The stop command, `Run.Halt`, the poll answering Halt |
| 02:13-02:28 | Worker | Aborting on Halt; Start workers queuing the runs again |
| 02:28-03:04 | Page | The dialog, Stopping…, the banner, the failed state, dark and phone |
| 03:04-03:55 | Tests | 190 backend, 139 worker, 81 frontend, 52 e2e |
| 03:55-04:40 | Screens | Stopping two projects, the halted log, Start workers, a silent worker, a Viewer |
| 04:40-05:08 | Recap | Three points and what comes next |

## Demo commands

```sh
pwsh eng/Start-E2eApi.ps1
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
node docs/videos/08-stop-and-restart-all-workers/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/08-stop-and-restart-all-workers
node tools/video-build/build-video.mjs docs/videos/08-stop-and-restart-all-workers --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- Leasing is global. The capture script and the e2e tests always press Start workers at the end; a run that dies
  part-way leaves the stack stopped, so post `/api/workers/start` as an Owner before anything else.
- Workers count as online for 60 seconds after their last heartbeat, so the queue-draining workers would appear in
  the dialog; the capture waits 65 seconds after draining.
- The busy state lasts only as long as the workers take to hear, so the clip holds the request for 1.2 seconds with
  `page.route` before passing it on unchanged.
- The halt lands wherever the run is, often step 1 of a stage; the log says which step it resumes from.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [Journey 8 prompt](../../prompts/08-stop-and-restart-all-workers.md), [docs/specs/L2.md](../../specs/L2.md),
  [ADR 0013](../../adr/0013-stop-all-workers-halts-runs-on-the-control-poll.md)
- [Pause, resume, cancel and stop all](../../detailed-designs/pipeline/pause-resume-cancel-stop/README.md),
  [Worker loop](../../detailed-designs/agent-runtime/worker-loop/README.md)
