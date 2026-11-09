# 01 · Build a new product, part four: the document stages

> **Runtime:** ~3:32 · **Audience:** Hewn contributors and reviewers · **Prerequisites:** [part three](../01-build-a-new-product-part-3/README.md)

**Video:** [01-build-a-new-product-part-4.mp4](01-build-a-new-product-part-4.mp4) · [Slides](slides.html) · **Audio:** [01-build-a-new-product-part-4.mp3](01-build-a-new-product-part-4.mp3) · [Transcript](script.md)

## Why this video exists

It documents the fourth pull request of journey 1: stages 1, 4, 5, 7 and 8 write, validate and commit the
brief, stack decision, requirements, detailed designs and user journeys (L2-009, L2-013, L2-014, L2-016,
L2-017), recording every self-answered question (L2-054).

## Learning objectives

By the end, the viewer can:

- name each document stage's skill, outputs and validator;
- explain how the worker reads and writes the repository without a GitHub credential;
- say what happens to a file an agent changes outside its stage.

## Key questions

| Question | What a strong answer includes |
|---|---|
| What fails a stage 5 run? | A broken trace, an L1 without an L2, a missing Given/When/Then, a repeated ID, or should/may/might outside quotes; the failure lists every offending ID. |
| Where do the agent's decisions go? | `docs/decisions.md`, committed with the stage, and each question and answer in the run log. |
| Is a model running yet? | No: a scripted agent stands in until run isolation lands. |

## Code / assets on screen

| File | What to show |
|---|---|
| `worker/src/executors/document-executor.ts` | Stage definitions; commit only the stage's files |
| `worker/src/validators/document-validators.ts`, `worker/test/validators.spec.ts` | Every problem, named |
| `worker/src/agents/scripted-agent.ts` | The stand-in agent's brief |
| `screens/*.png`, `clips/documents.mp4` | The real app with a real worker, captured by `clips/clips.mjs` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:17 | Introduction | What part four adds |
| 00:17-00:40 | What we built | One executor; stage definitions |
| 00:40-01:25 | Design | Archive and commit through the API; decisions; only the stage's files |
| 01:25-02:15 | Code | The diff; validators; the scripted agent |
| 02:15-02:40 | Tests | Validators, executor, backend, Playwright |
| 02:40-03:15 | Screens | The direction runs to Complete; phone |
| 03:15-03:32 | Recap | Three points and what comes next |

## Demo commands

```sh
pwsh eng/Start-E2eApi.ps1
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
node docs/videos/01-build-a-new-product-part-4/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/01-build-a-new-product-part-4
node tools/video-build/build-video.mjs docs/videos/01-build-a-new-product-part-4 --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- Workers need `tar` on the path for the document stages.
- The document stages finish in milliseconds with the scripted agent; wait on a scripted stage when capturing.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [L2-009, L2-013, L2-014, L2-016, L2-017 and L2-054 in docs/specs/L2.md](../../specs/L2.md)
- [Produce stage documents](../../detailed-designs/stages/produce-stage-documents/README.md) design
