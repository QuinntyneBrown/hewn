# 14 · Preview product designs

> **Runtime:** ~5:43 · **Audience:** Owners, Viewers, Hewn contributors and reviewers · **Prerequisites:** [13 · Follow an increment to merge](../13-follow-an-increment-to-merge/README.md)

**Video:** [14-preview-product-designs.mp4](14-preview-product-designs.mp4) · [Slides](slides.html) · **Audio:** [14-preview-product-designs.mp3](14-preview-product-designs.mp3) · [Transcript](script.md)

## Why this video exists

This is the video for journey 14. A project's Designs tab lists every screen and state stage 2 exported, each with
a thumbnail and an Open in Magic Patterns link (L2-011 AC1). The chosen state renders from a separate origin inside
a sandboxed iframe that can't read Mission Control's cookies or storage (AC2). The preview resizes from XS (375)
to XL (1200) px and switches between Light and Dark (AC3).

## Learning objectives

By the end, the viewer can:

- say where the gallery's screens and states come from, and at which commit;
- explain what a preview token grants, how long it lasts, and what the preview host refuses;
- name the two layers of the sandbox, and why Mission Control's cookies never reach the preview;
- explain how the frame shows a page at exactly 375 to 1200 px, and how the theme reaches it.

## Key questions

| Question | What a strong answer includes |
|---|---|
| Where does the gallery come from? | `docs/mocks/manifest.json`, read from GitHub at the default branch's head by `GetDesignsHandler`; each state's path is `docs/mocks/{screen}/{state}.html`. |
| What is a preview token? | `{project}.{sha}.{expiry}` with an HMAC-SHA256 under a key made at start-up; it lasts 60 minutes and covers one commit. |
| What does the preview host serve? | Only `docs/mocks/` and `docs/design-system/` at the signed SHA. It answers only on the preview origin's host, with CSP `sandbox allow-scripts`, no cookies and `data-theme`. |
| Why can't a mock read Mission Control's data? | The iframe has `sandbox="allow-scripts"` and no `allow-same-origin`, so it runs in an opaque origin. Cookies are kept per host, so the session isn't sent. |
| How do XS to XL work? | The iframe is laid out at the chosen width and scaled to fit, so the page's media queries see the real width. |

## Code / assets on screen

| File | What to show |
|---|---|
| `backend/src/Hewn.Application/Designs/GetDesigns.cs` | The manifest at the head, a signed link per state, the 502 naming the commit |
| `backend/src/Hewn.Application/Designs/PreviewTokens.cs` | Signing and the constant-time check with the expiry |
| `backend/src/Hewn.Api/Designs/PreviewEndpoint.cs` | `RequireHost`, the CSP sandbox and the other headers |
| `backend/src/Hewn.Application/Designs/ServePreview.cs` | The two roots, the path checks, the file at the SHA |
| `frontend/projects/mission-control/src/app/pages/project/sandboxed-preview.component.ts` | The sandboxed iframe, the width and the scale |
| `backend/tests/Hewn.Api.Tests/Designs/PreviewDesignsTests.cs` | Tampered, expired and wrong-host requests refused |
| `e2e/tests/behavior/preview-product-designs.spec.ts`, `e2e/support/designed-files.ts` | The isolation probe, and XS to XL read from inside the frame |
| `sequence-preview`, `c4-component` | The preview-designs design's diagrams |
| `screens/*.png`, `clips/*.mp4` | Mission Control after a real worker ran stages 0 to 2, captured by `clips/clips.mjs` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:37 | Introduction | What journey 14 is |
| 00:37-01:26 | Goal | Gallery, sandbox, sizes and themes; the flow and component diagrams |
| 01:26-01:51 | Listing | The manifest at the head, signed links, the 502 |
| 01:51-02:12 | Signed links | The token and its check |
| 02:12-02:42 | Preview host | `RequireHost`, the CSP sandbox, the two roots |
| 02:42-03:09 | Sandbox | The iframe's sandbox and what the probe can't read |
| 03:09-03:25 | Size and theme | Laid out at the width, scaled to fit; the theme query |
| 03:25-04:28 | Tests | 222 backend, 144 worker, 5 view, 14 new e2e; the probe and the widths |
| 04:28-05:15 | Screens | Kiln Booking's designs, XS to XL and dark; dark mode and phone; the probe; empty and error |
| 05:15-05:43 | Recap | Three points and what comes next |

## Demo commands

```sh
pwsh eng/Start-E2eApi.ps1                       # a fresh database, so no other directions are queued
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
node docs/videos/14-preview-product-designs/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/14-preview-product-designs
node tools/video-build/build-video.mjs docs/videos/14-preview-product-designs --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- The preview origin is `127.0.0.1:5300` in e2e, while Mission Control is on `localhost:4300`. Open Mission Control
  on `localhost`, not `127.0.0.1`, or the two share a host.
- The fake Magic Patterns exports theme by `data-theme`, as the preview host sets it. A mock that themes only by
  `prefers-color-scheme` would follow the system theme instead.
- The capture cancels each project once it has what it needs, so no later run picks it up.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [Journey 14 prompt](../../prompts/14-preview-product-designs.md), [docs/specs/L2.md](../../specs/L2.md)
- [Preview designs and the design system](../../detailed-designs/mission-control/preview-designs/README.md)
- [ADR 0018](../../adr/0018-previews-are-served-from-a-signed-sandboxed-origin.md)
