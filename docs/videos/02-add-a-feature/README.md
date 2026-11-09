# 02 · Add a feature

> **Runtime:** ~5:07 · **Audience:** Owners, Hewn contributors and reviewers · **Prerequisites:** [01 · Build a new product](../01-build-a-new-product/README.md)

**Video:** [02-add-a-feature.mp4](02-add-a-feature.mp4) · [Slides](slides.html) · **Audio:** [02-add-a-feature.mp3](02-add-a-feature.mp3) · [Transcript](script.md)

## Why this video exists

It is the video of journey 2: an Owner adds a feature to a product that already exists (L2-005). The feature
direction skips Bootstrap, Stack and Scaffold, and also Designs and Design system when stage 1 records that the
user interface does not change (L2-054). It queues behind an active direction, and stages 2, 5 and 8 keep every
existing design, requirement ID and journey number (L2-010 AC6, L2-014, L2-017 AC3).

## Learning objectives

By the end, the viewer can:

- say which stages a feature direction skips, and what decides whether Designs and Design system run;
- explain what happens to a feature submitted while another direction is running;
- describe how Hewn stops a later direction renumbering requirements or journeys.

## Key questions

| Question | What a strong answer includes |
|---|---|
| Who decides whether the UI changes? | The stage 1 agent, recorded in `docs/decisions.md`; the worker reports it through `PUT /api/worker/runs/{id}/scope`. |
| When does a queued feature start? | When the active direction completes; the oldest queued direction starts first. |
| What happens if an agent renumbers L2-002? | The stage fails with "docs/specs/L2.md dropped L2-002" and nothing is committed. |

## Code / assets on screen

| File | What to show |
|---|---|
| `backend/src/Hewn.Application/Projects/SubmitFeatureDirection.cs` | Creating, queueing or starting the feature direction |
| `backend/src/Hewn.Application/Pipeline/PipelineOrchestrator.cs` | Starting the next queued direction |
| `backend/src/Hewn.Domain/Direction.cs` | Skipping stages 2 and 3 on no UI change |
| `worker/src/validators/document-validators.ts` | Kept and next-free numbers |
| `worker/src/estimates/backlog-planner.ts` | Planning only unbuilt designs |
| `backend/tests/Hewn.Api.Tests/Projects/FeatureDirectionTests.cs` | The feature runs stages 1, 2, 3, 5, 7, 8, 9 and 10 |
| `screens/feature-*.png`, `clips/feature.mp4` | Mission Control with a real worker, captured by `clips/clips.mjs` |
| `screens/diff-*.png`, `screens/decision-ui.png`, `screens/refusal.png` | The product's documents before and after, captured by `clips/artifacts.ts` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:24 | Introduction | What journey 2 is |
| 00:24-00:59 | Goal | The form and the feature plan |
| 00:59-01:32 | Architecture | The submit endpoint, the queue, starting the next direction |
| 01:32-01:58 | Decision | The UI question and skipping stages 2 and 3 |
| 01:58-02:40 | Numbers | Kept IDs and journeys, designs, the feature backlog |
| 02:40-03:17 | Tests | 133 backend, 120 worker, 28 e2e |
| 03:17-04:08 | Screens | Feature form, inline error, queue, a feature to Complete, dark and phone |
| 04:08-04:45 | Documents | L2.md and journeys.md before and after, the decision, a refused renumbering |
| 04:45-05:02 | Recap | Three points and what comes next |

## Demo commands

```sh
pwsh eng/Start-E2eApi.ps1
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
node docs/videos/02-add-a-feature/clips/clips.mjs
cd worker && node ../docs/videos/02-add-a-feature/clips/artifacts.ts && cd ..
node tools/video-audio/generate-audio.mjs docs/videos/02-add-a-feature
node tools/video-build/build-video.mjs docs/videos/02-add-a-feature --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- The documents come from the scripted agent the e2e stack uses, so they are deliberately plain.
- Scripted stages finish in well under a second, so `clips.mjs` captures the running page at whichever stage is
  current, not a named one.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [Journey 2 prompt](../../prompts/02-add-a-feature.md), [docs/specs/L2.md](../../specs/L2.md),
  [ADR 0008](../../adr/0008-feature-scope-is-a-recorded-decision.md)
- [Run a direction](../../detailed-designs/pipeline/run-direction/README.md),
  [Produce stage documents](../../detailed-designs/stages/produce-stage-documents/README.md),
  [Design screens](../../detailed-designs/stages/design-screens/README.md)
