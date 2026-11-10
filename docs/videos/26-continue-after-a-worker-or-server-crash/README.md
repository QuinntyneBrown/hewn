# 26 · Continue after a worker or server crash

> **Runtime:** ~5:01 · **Audience:** Owners, operators and Hewn contributors · **Prerequisites:** [25 · Inspect worker activity](../25-inspect-worker-activity/README.md)

**Video:** [26-continue-after-a-worker-or-server-crash.mp4](26-continue-after-a-worker-or-server-crash.mp4) · [Slides](slides.html) · **Audio:** [26-continue-after-a-worker-or-server-crash.mp3](26-continue-after-a-worker-or-server-crash.mp3) · [Transcript](script.md)

## Why this video exists

This is the video for journey 26 (L2-050, L2-026 AC3). A worker or the API can crash mid-run. This video shows how
Hewn loses nothing it acknowledged, resumes the run on another worker after its last checkpoint, and keeps a stale
worker from writing. The recording measured 67.7 s from killing a worker to the standby's resume (60 s without a
heartbeat, plus the next 10-second sweep). The API was down for 1.8 s while a run carried on
(`screens/records.json`).

## Learning objectives

By the end, the viewer can:

- explain why a GitHub write and a lease change take the same run lock;
- follow a crash and a resume in the run log;
- say what happens to a lease when the API restarts.

## Key questions

| Question | What a strong answer includes |
|---|---|
| How can a stale worker's write land? | The fence check passed, then the lease moved before GitHub answered. `RunWriteLock` now spans both. |
| Why no branch reconciler? | Workers write only through the API, one commit per call, keyed by `{run}/{step}`; a repeat returns the first SHA. |
| What does the Owner see? | "Lease expired: no heartbeat from … for 60 seconds; queued again after step N", then "Resumed by … after step N". |
| What does a restart do to a lease? | The worker's next heartbeat keeps it; if none comes, it expires 60 s after the last one and resumes elsewhere. |

## Code / assets on screen

| File | What to show |
|---|---|
| `backend/src/Hewn.Application/Pipeline/RunWriteLock.cs`, `LeaseService.cs` | The lock, `FenceForWriteAsync`, the grant and the expiry under the lock |
| `backend/src/Hewn.Application/Pipeline/RepositoryCommands.cs`, `WorkerCommands.cs` | The commit handler under the lock; the resume log line |
| `sequence-fence-stale-worker`, `sequence-expire-and-resume`, `c4-component` | The worker-loop design's diagrams |
| `backend/tests/Hewn.Api.Tests/Recovery/*.cs`, `e2e/tests/pipeline/continue-after-a-worker-crash.spec.ts` | Red then green |
| `eng/Start-E2eApi.ps1 -KeepDatabase` | Restart on the same database |
| `screens/*.png`, `clips/*.mp4` | Captured by `clips/clips.mjs` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:23 | Introduction | What journey 26 is |
| 00:23-00:52 | Goal | L2-050, L2-026 AC3 |
| 00:52-01:18 | What was already there | Epochs, the expiry sweep, idempotency keys |
| 01:18-02:05 | The gap: a write in flight | The run lock; the fence sequence |
| 02:05-03:02 | Killing a worker | Kill, expiry and resume; the resume sequence; Workers before and after |
| 03:02-03:28 | Restarting the API | The API killed and restarted mid-run |
| 03:28-04:34 | Tests | Fencing, restart and log tests; the pipeline test |
| 04:34-04:39 | Screens | Dark and phone |
| 04:39-05:01 | Recap | Three points and what comes next |

## Demo commands

```sh
pwsh eng/Start-E2eApi.ps1
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json && cd ..
node docs/videos/26-continue-after-a-worker-or-server-crash/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/26-continue-after-a-worker-or-server-crash
node tools/video-build/build-video.mjs docs/videos/26-continue-after-a-worker-or-server-crash --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- The clips script kills the API on port 5300 and starts it again with `-KeepDatabase`, detached; stop it when done.
- Record on a fresh stack, so Workers shows only the two workers in the story.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [Journey 26 prompt](../../prompts/26-continue-after-a-worker-or-server-crash.md), [docs/specs/L2.md](../../specs/L2.md)
- [Worker loop](../../detailed-designs/agent-runtime/worker-loop/README.md), [ADR 0027](../../adr/0027-github-writes-and-lease-changes-share-a-run-lock.md)
