# 01 · Build a new product, part five: designs and the design system

> **Runtime:** ~3:26 · **Audience:** Hewn contributors and reviewers · **Prerequisites:** [part four](../01-build-a-new-product-part-4/README.md)

**Video:** [01-build-a-new-product-part-5.mp4](01-build-a-new-product-part-5.mp4) · [Slides](slides.html) · **Audio:** [01-build-a-new-product-part-5.mp3](01-build-a-new-product-part-5.mp3) · [Transcript](script.md)

## Why this video exists

It documents the fifth pull request of journey 1: stage 2 designs every screen in Magic Patterns over MCP and
commits the export (L2-010 AC1-AC5), and stage 3 extracts the design system (L2-012 AC1-AC3).

## Learning objectives

By the end, the viewer can:

- say how the worker reaches Magic Patterns and what happens when it can't;
- describe the manifest and the export layout under `docs/mocks/`;
- list what fails a stage 2 or stage 3 run.

## Key questions

| Question | What a strong answer includes |
|---|---|
| What if Magic Patterns is down? | "Magic Patterns unavailable: {reason}" before the agent runs; no hand-written fallback. |
| How is "no horizontal scroll" checked? | Chromium loads each mock at 375, 768 and 1280 px and compares `scrollWidth` with `clientWidth`. |
| What does stage 3 do with a Magic Patterns token mismatch? | It logs it; colours in the mocks with no token fail the run. |

## Code / assets on screen

| File | What to show |
|---|---|
| `worker/src/magic-patterns/magic-patterns.ts` | MCP client; fixed failure reasons |
| `worker/src/validators/mock-validator.ts` | Coverage, states, parse, scroll at three widths |
| `worker/src/validators/design-system-validators.ts` | Token groups, colour coverage, mismatches |
| `screens/*.png`, `clips/designs.mp4` | The real app with a real worker and the fake Magic Patterns server, captured by `clips/clips.mjs` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:16 | Introduction | What part five adds |
| 00:16-00:45 | What we built | Two stage definitions; MCP |
| 00:45-01:25 | Design | No fallback; raw HTML states; manifest |
| 01:25-02:05 | Code | Mock validator; colour coverage |
| 02:05-02:30 | Tests | Fake server, Chromium, pipeline |
| 02:30-03:10 | Screens | The direction runs; exported mocks |
| 03:10-03:26 | Recap | Three points and what comes next |

## Demo commands

```sh
pwsh eng/Start-E2eApi.ps1
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
node docs/videos/01-build-a-new-product-part-5/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/01-build-a-new-product-part-5
node tools/video-build/build-video.mjs docs/videos/01-build-a-new-product-part-5 --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- Workers need Chromium (`npx playwright-core install chromium` in `worker/`) for the stage 2 validator.
- `startWorkers` also starts the fake Magic Patterns server on port 5310.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [L2-010 and L2-012 in docs/specs/L2.md](../../specs/L2.md)
- [Design screens](../../detailed-designs/stages/design-screens/README.md) and [Extract design system](../../detailed-designs/stages/extract-design-system/README.md) designs
- [ADR 0007: raw HTML states, direct Magic Patterns access](../../adr/0007-magic-patterns-designs-hold-raw-html-states.md)
