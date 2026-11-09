# 01 · Build a new product

> **Runtime:** ~7:19 · **Audience:** Owners, Hewn contributors and reviewers · **Prerequisites:** none; the [part videos](#the-parts) go deeper on each slice

**Video:** [01-build-a-new-product.mp4](01-build-a-new-product.mp4) · [Slides](slides.html) · **Audio:** [01-build-a-new-product.mp3](01-build-a-new-product.mp3) · [Transcript](script.md)

## Why this video exists

It is the full video of journey 1: an Owner submits a product direction (L2-001), and Hewn runs all eleven stages
(L2-004) with no approval step (L2-028) to a merged, tested product, recording every decision it made for itself
(L2-054). It covers L2-001, L2-004, L2-007, L2-009, L2-010, L2-012 to L2-025, L2-028, L2-036 and L2-054.

## Learning objectives

By the end, the viewer can:

- name the eleven stages and what each one writes into the product's repository;
- explain how workers write to GitHub without holding a credential, and how a stale worker is fenced;
- describe how one increment goes from red to green to an automatic merge;
- say where a decision an agent made for itself is recorded.

## Key questions

| Question | What a strong answer includes |
|---|---|
| Who answers a skill's questions? | The agent, from the direction and documents; each answer goes to `docs/decisions.md`. |
| What stops a stage writing outside its lane? | The API's commit policy, per stage branches and paths. |
| What proves no step waits for a human? | `e2e/tests/pipeline/no-approval.spec.ts`: it submits, then only watches. |

## Code / assets on screen

| File | What to show |
|---|---|
| `backend/src/Hewn.Application/Pipeline/CommitPolicy.cs` | Which paths each stage may write |
| `worker/src/executors/document-executor.ts` | Agent, validate, commit |
| `worker/src/estimates/backlog-planner.ts` | The descoping rules |
| `worker/src/executors/increment-executor.ts` | Iterate until the gate is green |
| `worker/src/agents/decision-log.ts` | The autonomy instructions |
| `e2e/tests/pipeline/no-approval.spec.ts` | The no-approval acceptance test |
| `screens/*.png`, `clips/journey.mp4` | Mission Control with a real worker, captured by `clips/clips.mjs` |
| `screens/artifact-*.png`, `artifacts/` | What the stages wrote, captured by `clips/artifacts.ts` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:25 | Introduction | What journey 1 is |
| 00:25-01:03 | Goal | The Owner and the eleven stages |
| 01:03-01:59 | Architecture | Containers, leases and fencing, the write broker |
| 01:59-03:15 | Stages | Bootstrap, documents, design, scaffold, estimates |
| 03:15-04:21 | Increments | Tests first, iterate, open and merge |
| 04:21-04:48 | Decisions | Nobody is asked; decisions and ADRs are logged |
| 04:48-05:29 | Tests | 120 backend, 109 worker, 19 e2e |
| 05:29-06:03 | Screens | Inline error, every stage to Complete, phone dark |
| 06:03-06:50 | Artifacts | Brief to estimates, one increment red to green, the decision log |
| 06:50-07:19 | Recap | Three points and what comes next |

## Demo commands

```sh
pwsh eng/Start-E2eApi.ps1
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
node docs/videos/01-build-a-new-product/clips/clips.mjs
cd worker && node ../docs/videos/01-build-a-new-product/clips/artifacts.ts && cd ..
node tools/video-audio/generate-audio.mjs docs/videos/01-build-a-new-product
node tools/video-build/build-video.mjs docs/videos/01-build-a-new-product --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- The artifacts come from the scripted agent and gate the e2e stack uses, so they are deliberately plain.
- `clips/artifacts.ts` exits explicitly; the fake Magic Patterns server's sockets would otherwise keep Node alive.

## The parts

[Part 1](../01-build-a-new-product-part-1/README.md) ·
[2](../01-build-a-new-product-part-2/README.md) ·
[3](../01-build-a-new-product-part-3/README.md) ·
[4](../01-build-a-new-product-part-4/README.md) ·
[5](../01-build-a-new-product-part-5/README.md) ·
[6](../01-build-a-new-product-part-6/README.md) ·
[7](../01-build-a-new-product-part-7/README.md) ·
[8](../01-build-a-new-product-part-8/README.md)

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [Journey 1 prompt](../../prompts/01-build-a-new-product.md), [docs/specs/L2.md](../../specs/L2.md)
- [Record decisions](../../detailed-designs/pipeline/record-decisions/README.md),
  [Run a direction](../../detailed-designs/pipeline/run-direction/README.md)
