# 01 · Build a new product, part seven: estimates and descoping

> **Runtime:** ~2:59 · **Audience:** Hewn contributors and reviewers · **Prerequisites:** [part six](../01-build-a-new-product-part-6/README.md)

**Video:** [01-build-a-new-product-part-7.mp4](01-build-a-new-product-part-7.mp4) · [Slides](slides.html) · **Audio:** [01-build-a-new-product-part-7.mp3](01-build-a-new-product-part-7.mp3) · [Transcript](script.md)

## Why this video exists

It documents the seventh pull request of journey 1: stage 9 estimates every detailed design (L2-018 AC1), descopes
oversized and unneeded work with reasons and marks the requirements Deferred (L2-019 AC1-AC3), and plans a backlog
of increments that never precede their dependencies (L2-020 AC1).

## Learning objectives

By the end, the viewer can:

- name the four descope reasons and the order they apply in;
- explain how increments are ordered and split into parts;
- say where Hewn keeps the backlog and who may write it.

## Key questions

| Question | What a strong answer includes |
|---|---|
| Where does the threshold come from? | `HEWN_DESCOPE_THRESHOLD_DAYS` on the API (default 3), sent with every lease. |
| What happens to a design that depends on a deferred one? | It is deferred too, with "Depends on a deferred design: …". |
| Can stage 8 write the backlog? | No: `PUT /api/worker/runs/{id}/backlog` answers `mutation_not_allowed` outside stage 9. |

## Code / assets on screen

| File | What to show |
|---|---|
| `worker/src/estimates/backlog-planner.ts` | Descope rules, ordering, parts, README and status lines |
| `worker/src/executors/document-executor.ts` | The stage 9 definition and the backlog report after the commit |
| `backend/src/Hewn.Application/Pipeline/BacklogCommands.cs` | The stage 9 only backlog endpoint and its rules |
| `screens/*.png`, `clips/estimates.mp4` | The real app with a real worker, captured by `clips/clips.mjs` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:18 | Introduction | What part seven adds |
| 00:18-00:48 | What we built | The agent half; the planner half |
| 00:48-01:18 | Design | Descope rules; the threshold in the lease |
| 01:18-01:52 | Code | Ordering and parts; the backlog endpoint |
| 01:52-02:16 | Tests | Backend, worker, e2e |
| 02:16-02:41 | Screens | The direction runs; the estimates README |
| 02:41-02:59 | Recap | Three points and what comes next |

## Demo commands

```sh
pwsh eng/Start-E2eApi.ps1
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
node docs/videos/01-build-a-new-product-part-7/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/01-build-a-new-product-part-7
node tools/video-build/build-video.mjs docs/videos/01-build-a-new-product-part-7 --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- The scripted agent estimates every design at 2 days, so the e2e pipeline never descopes; the planner's own tests
  cover each descope reason.
- The estimates README on screen comes from a fixture with deliberate deferrals, not from the e2e run.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [L2-018, L2-019 and L2-020 in docs/specs/L2.md](../../specs/L2.md)
- [Estimate and plan the backlog](../../detailed-designs/stages/estimate-and-plan-backlog/README.md) design
