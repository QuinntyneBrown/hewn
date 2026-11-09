# 01 · Build a new product, part two: run the pipeline

> **Runtime:** ~3:41 · **Audience:** Hewn contributors and reviewers · **Prerequisites:** [part one](../01-build-a-new-product-part-1/README.md)

**Video:** [01-build-a-new-product-part-2.mp4](01-build-a-new-product-part-2.mp4) · [Slides](slides.html) · **Audio:** [01-build-a-new-product-part-2.mp3](01-build-a-new-product-part-2.mp3) · [Transcript](script.md)

## Why this video exists

It documents the second pull request of journey 1: a worker carries a product direction through stages 0 to
10 in order, and Mission Control follows it live to Complete (L2-004 AC1-AC3).

## Learning objectives

By the end, the viewer can:

- explain how a lease keeps one worker per project and fences a stale one by epoch;
- follow a run from lease to heartbeat, checkpoints and result in `worker/src/work-loop.ts`;
- describe how the project page catches up by sequence number and then streams events.

## Key questions

| Question | What a strong answer includes |
|---|---|
| When does the next stage start? | Only after the worker reports the current run Succeeded; the orchestrator queues it in the same commit. |
| What happens when a worker goes silent? | After 60 s without a heartbeat the run returns to the queue with its checkpoint; the old epoch gets 409 `lease_lost`. |
| How does a reloaded page avoid gaps? | It reads the snapshot's `lastSequence`, joins the hub, and fetches `/events?after=` before streaming. |

## Code / assets on screen

| File | What to show |
|---|---|
| `docs/detailed-designs/pipeline/run-direction/diagrams/sequence-advance.png` | The advance sequence |
| `backend/src/Hewn.Application/Pipeline/LeaseService.cs` | The conditional update that grants a lease |
| `worker/src/work-loop.ts` | Steps after the checkpoint, heartbeat, abort on a lost lease |
| `frontend/projects/mission-control/src/app/pages/project/project.page.ts` | Snapshot plus folded events |
| `screens/*.png`, `clips/pipeline.mp4` | The real app with scripted workers, captured by `clips/clips.mjs` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:18 | Introduction | What part two adds |
| 00:18-00:52 | What we built | API, worker, Mission Control; the scripted executor |
| 00:52-01:33 | Design | Advance sequence; one conditional update per lease |
| 01:33-02:01 | Code | Work loop; live page |
| 02:01-02:32 | Tests | Backend, worker and Playwright |
| 02:32-03:28 | Screens | Live run to Complete, current step, phone and dark |
| 03:28-03:41 | Recap | Three points and what comes next |

## Demo commands

```sh
pwsh eng/Start-E2eApi.ps1
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
# From the repo root (the script starts scripted workers itself)
node docs/videos/01-build-a-new-product-part-2/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/01-build-a-new-product-part-2
node tools/video-build/build-video.mjs docs/videos/01-build-a-new-product-part-2 --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- A dev server started before a new npm dependency serves a stale bundle; restart it.
- Workers lease the oldest queued run first, so leftovers from earlier test runs go before a new demo.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [L2-004 and L2-026 in docs/specs/L2.md](../../specs/L2.md)
- [Run a direction](../../detailed-designs/pipeline/run-direction/README.md) and [Worker loop](../../detailed-designs/agent-runtime/worker-loop/README.md) designs
- [ADR 0005: leases on SQLite](../../adr/0005-leases-on-sqlite.md)
