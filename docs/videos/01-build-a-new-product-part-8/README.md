# 01 · Build a new product, part eight: increments

> **Runtime:** ~3:06 · **Audience:** Hewn contributors and reviewers · **Prerequisites:** [part seven](../01-build-a-new-product-part-7/README.md)

**Video:** [01-build-a-new-product-part-8.mp4](01-build-a-new-product-part-8.mp4) · [Slides](slides.html) · **Audio:** [01-build-a-new-product-part-8.mp3](01-build-a-new-product-part-8.mp3) · [Transcript](script.md)

## Why this video exists

It documents the eighth pull request of journey 1. Stage 10 delivers each increment test first (L2-021),
implements until the stack's gate is green or blocks (L2-022), records a video (L2-023 AC1, AC3), opens a pull
request with the house title and body (L2-024 AC1-AC2), and merges automatically, rebasing when needed (L2-025).

## Learning objectives

By the end, the viewer can:

- list the steps every increment goes through and what blocks one;
- explain how the worker rebases without a Git credential;
- name the six pull request sections and where the test counts come from.

## Key questions

| Question | What a strong answer includes |
|---|---|
| Who decides an increment is done? | The fixed gate from the stack template, never the model. |
| What happens to increments after a blocked one? | Those depending on it are skipped; independent ones continue. |
| What if the video fails? | One retry, then "Video failed: reason" in Notes; the increment still merges. |

## Code / assets on screen

| File | What to show |
|---|---|
| `worker/src/executors/increment-executor.ts` | The per-increment flow, rebase and blocking |
| `worker/src/increments/*.ts` | Guard, gate, pull request template, video check, progress |
| `backend/src/Hewn.Application/Pipeline/IncrementCommands.cs` | The backlog cursor and progress reports |
| `screens/*.png`, `clips/increments.mp4` | The real app with a real worker, captured by `clips/clips.mjs` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:19 | Introduction | What part eight adds |
| 00:19-00:59 | What we built | The loop; the gate and blocking |
| 00:59-01:33 | Design | What stage 10 may write; rebasing |
| 01:33-02:08 | Code | The pull request; failures and progress |
| 02:08-02:30 | Tests | Backend, worker, e2e |
| 02:30-02:46 | Screens | The direction runs to completion |
| 02:46-03:06 | Recap | Three points and what comes next |

## Demo commands

```sh
pwsh eng/Start-E2eApi.ps1
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
node docs/videos/01-build-a-new-product-part-8/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/01-build-a-new-product-part-8
node tools/video-build/build-video.mjs docs/videos/01-build-a-new-product-part-8 --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- The e2e stack runs `HEWN_GATE=scripted`; the real gate installs packages and runs the scaffold's suites.
- The scripted agent's video needs ffmpeg; without it every increment notes "Video failed: ffmpeg is not installed".

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [L2-021 to L2-025 in docs/specs/L2.md](../../specs/L2.md)
- [Write the tests first](../../detailed-designs/increments/write-tests-first/README.md),
  [Implement until green](../../detailed-designs/increments/implement-until-green/README.md),
  [Record the increment video](../../detailed-designs/increments/record-increment-video/README.md),
  [Open and merge the pull request](../../detailed-designs/increments/open-and-merge-pull-request/README.md)
