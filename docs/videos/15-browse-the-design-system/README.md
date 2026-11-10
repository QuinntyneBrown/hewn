# 15 · Browse the design system

> **Runtime:** ~5:25 · **Audience:** Owners, Viewers, Hewn contributors and reviewers · **Prerequisites:** [14 · Preview product designs](../14-preview-product-designs/README.md)

**Video:** [15-browse-the-design-system.mp4](15-browse-the-design-system.mp4) · [Slides](slides.html) · **Audio:** [15-browse-the-design-system.mp3](15-browse-the-design-system.mp3) · [Transcript](script.md)

## Why this video exists

This is the video for journey 15. A project's Design system tab lists the token pages and component pages stage 3
wrote to `docs/design-system/`, and opens each in the same sandboxed, separate-origin preview as Designs, at XS to XL
and in Light or Dark (L2-012 AC4).

## Learning objectives

By the end, the viewer can:

- say how the API finds a project's design system, and at which commit it lists the pages;
- explain where the token counts beside a page's title come from;
- name what stage 3 now writes under `foundations/`, and how those pages follow the theme;
- explain how the pages are served from the preview origin, and what the host's response says.

## Key questions

| Question | What a strong answer includes |
|---|---|
| When does a project have a design system? | When `docs/design-system/tokens.json` exists at the default branch's head; stage 3's validator requires it. |
| Where does the page list come from? | The `.html` files directly under `foundations/` and `components/`, listed at the commit `tokens.json` was read at, with one token signed for that commit. |
| What does "38 tokens, light and dark" mean? | The count of DTCG leaves in the page's token group; a group with `light` and `dark` counts one theme. |
| How are the pages served? | By journey 14's preview host on `Hewn:Preview:Origin`: CSP `sandbox allow-scripts`, `nosniff`, `no-referrer`, no cookie, `<html data-theme>` from `?theme=`. |
| What if the tokens can't be read? | `502 github_failed`, "docs/design-system/ couldn’t be read at {sha7}", shown with Try again. |

## Code / assets on screen

| File | What to show |
|---|---|
| `backend/src/Hewn.Application/Designs/GetDesignSystem.cs` | `tokens.json` at the head, the folders at its commit, the order and the counts, the 502 |
| `worker/src/agents/scripted-agent.ts`, `worker/src/executors/document-executor.ts` | Token pages themed by `data-theme`; stage 3's task |
| `frontend/projects/mission-control/src/app/pages/project/design-system.component.html`, `design-system-view.ts` | The title with its count, the shared controls and preview; the caption |
| `screens/served.txt` | The preview host's response headers for a token page in dark |
| `backend/tests/Hewn.Api.Tests/Designs/DesignSystemTests.cs` | Both kinds of page in the same sandbox |
| `e2e/tests/behavior/browse-the-design-system.spec.ts` | Light then dark read inside the real frame, then a component page |
| `sequence-design-system`, `c4-component` | The preview-designs design's diagrams |
| `screens/*.png`, `clips/*.mp4` | Mission Control after a real worker ran stages 0 to 3, captured by `clips/clips.mjs` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:36 | Introduction | What journey 15 is |
| 00:36-01:39 | Goal | Token and component pages, the same preview; the flow and component diagrams |
| 01:39-02:19 | Listing | `tokens.json` at the head, the folders at its commit, the order and counts, the 502 |
| 02:19-02:41 | Token pages | What stage 3 now writes, themed by `data-theme` |
| 02:41-03:00 | The tab | Title and count, shared controls and preview, the caption |
| 03:00-03:21 | Preview origin | The host's response headers; an opaque origin on another host |
| 03:21-04:14 | Tests | 228 backend, 144 worker, 4 view, 12 new e2e; light to dark inside the frame |
| 04:14-04:55 | Screens | Kiln Booking's design system: tokens then Button, light and dark; dark mode and phone; empty and error |
| 04:55-05:25 | Recap | Three points and what comes next |

## Demo commands

```sh
pwsh eng/Start-E2eApi.ps1                       # a fresh database, so no other directions are queued
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
node docs/videos/15-browse-the-design-system/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/15-browse-the-design-system
node tools/video-build/build-video.mjs docs/videos/15-browse-the-design-system --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- The preview origin is `127.0.0.1:5300` in e2e, while Mission Control is on `localhost:4300`. Open Mission Control
  on `localhost`, not `127.0.0.1`, or the two share a host.
- The capture waits for a real worker to finish stage 3, which takes a minute or two with the scripted agent.
- The capture cancels each project once it has what it needs, so no later run picks it up.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [Journey 15 prompt](../../prompts/15-browse-the-design-system.md), [docs/specs/L2.md](../../specs/L2.md)
- [Preview designs and the design system](../../detailed-designs/mission-control/preview-designs/README.md)
- [Extract the design system](../../detailed-designs/stages/extract-design-system/README.md)
- [ADR 0018](../../adr/0018-previews-are-served-from-a-signed-sandboxed-origin.md)
