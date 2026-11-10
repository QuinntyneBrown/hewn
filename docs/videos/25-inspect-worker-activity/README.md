# 25 · Inspect worker activity

> **Runtime:** ~4:39 · **Audience:** Owners, Viewers, operators and Hewn contributors · **Prerequisites:** [24 · Manage worker tokens](../24-manage-worker-tokens/README.md)

**Video:** [25-inspect-worker-activity.mp4](25-inspect-worker-activity.mp4) · [Slides](slides.html) · **Audio:** [25-inspect-worker-activity.mp3](25-inspect-worker-activity.mp3) · [Transcript](script.md)

## Why this video exists

This is the video for journey 25. Workers shows each worker's location, version, status, current project and last
heartbeat, updating live (L2-026 AC1), and a worker's status change reaches the page as an event within a second
(L2-031 AC1). Going Offline is the one change no request marks, so a presence sweep now reports it. The recording
measured a new worker on the page 0.28 s after it started, and the Offline row 0.61 s after the 60-second mark
(`screens/records.json`).

## Learning objectives

By the end, the viewer can:

- read every column of a Workers row;
- say which changes send `WorkersChanged`, and why going Offline needs a sweep;
- recognise Workers' loading, empty and error states, and what an Owner and a Viewer each see when it is empty.

## Key questions

| Question | What a strong answer includes |
|---|---|
| What tells Workers to read the list again? | `WorkersChanged` on the hub's `workers` group: on register and revoke, when a stage starts or ends, and from `WorkerPresence` when the online set changes. |
| Why a sweep for Offline? | Offline means 60 s without hearing from the worker; nothing happens at that moment, so the API looks every second. |
| Where do heartbeat times come from? | The 5-second read; the page counts the seconds in between. |
| What does a failed read show? | "Workers couldn't load" with the reason and Try again, only while nothing has been read; later failures keep the rows. |

## Code / assets on screen

| File | What to show |
|---|---|
| `backend/src/Hewn.Application/Workers/WorkerPresence.cs`, `backend/src/Hewn.Api/Pipeline/WorkerPresenceWatcher.cs` | The sweep and its 1-second timer |
| `backend/src/Hewn.Api/Hubs/SignalRProjectEventPublisher.cs`, `frontend/…/layout/shell.ts` | `WorkersChanged` on stage changes; the shell reads the list again |
| `frontend/…/pages/workers/workers.page.html`, `workers-text.ts`, `core/workers-store.ts` | The states, the order, the failure |
| `c4-component` | The worker-loop design's components, with the watcher |
| `backend/tests/…/Workers/WorkersLiveTests.cs`, `e2e/tests/pipeline/inspect-worker-activity-live.spec.ts` | Red then green |
| `screens/*.png`, `clips/*.mp4` | Captured by `clips/clips.mjs` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:21 | Introduction | What journey 25 is |
| 00:21-00:42 | Goal | L2-026 AC1, L2-031 AC1 |
| 00:42-01:01 | Before any worker connects | Empty state for an Owner and a Viewer |
| 01:01-01:31 | Workers connect | Two workers appear live; the columns |
| 01:31-02:04 | Leasing and going idle | Leased with its project, then Idle; the order |
| 02:04-03:01 | Going offline | The sweep, the watcher, the Offline row, the shell |
| 03:01-03:28 | Loading and errors | Placeholder and error states; the store |
| 03:28-04:14 | Tests | 295 backend, 135 frontend, live, states, visual and a11y |
| 04:14-04:19 | Screens | Dark and phone |
| 04:19-04:39 | Recap | Three points and what comes next |

## Demo commands

```sh
pwsh eng/Start-E2eApi.ps1
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json && cd ..
node docs/videos/25-inspect-worker-activity/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/25-inspect-worker-activity
node tools/video-build/build-video.mjs docs/videos/25-inspect-worker-activity --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- Record on a freshly started e2e API: the empty state only shows before any worker has registered.
- The offline clip waits for the 60-second mark; the script records only its last 8 seconds or so.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [Journey 25 prompt](../../prompts/25-inspect-worker-activity.md), [docs/specs/L2.md](../../specs/L2.md)
- [Worker loop](../../detailed-designs/agent-runtime/worker-loop/README.md)
