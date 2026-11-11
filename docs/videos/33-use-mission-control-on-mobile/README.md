# 33 · Use Mission Control on mobile

> **Runtime:** ~4:37 · **Audience:** Owners, Viewers and Hewn contributors · **Prerequisites:** [32 · Review the audit log](../32-review-the-audit-log/README.md)

**Video:** [33-use-mission-control-on-mobile.mp4](33-use-mission-control-on-mobile.mp4) · [Slides](slides.html) · **Audio:** [33-use-mission-control-on-mobile.mp3](33-use-mission-control-on-mobile.mp3) · [Transcript](script.md)

## Why this video exists

This is the video for journey 33 (L2-046 AC1-AC4). Below 992 px the sidebar becomes a menu drawer opened from the
top bar. The pipeline is a list on phones, a scrollable stepper above the stage detail at 576 and 768 px, and a
column beside the detail from 992 px. No page scrolls sideways from 320 to 2560 px. Every control is a 44 px touch
target below 992 px, and at least 24 px from there up ([ADR 0034](../../adr/0034-touch-targets-are-44-px-below-992-px.md)).
In the recording the drawer listed Dashboard, Projects, Workers, Audit and Settings, and focus went back to Open menu
after Escape. The project measured 0 px of sideways scroll and 0 small targets at 375, 768 and 1280 px
(`screens/records.json`). `screens/phone-before.png` was taken from the build before this journey, at 375 px.

## Learning objectives

By the end, the viewer can:

- reach every page from a phone or a tablet through the menu drawer;
- say which pipeline layout each width gets;
- explain why touch targets are 44 px only below 992 px.

## Key questions

| Question | What a strong answer includes |
|---|---|
| When does the drawer appear? | Below 992 px; from there a fixed sidebar replaces it, and an open drawer closes. |
| What closes the drawer? | Close, Escape, a tap on the backdrop, or navigating. Focus goes back to Open menu. |
| How does the pipeline change? | A list below 576 px, a stepper above the detail at 576 and 768 px, beside the detail from 992 px. |
| Why not 44 px everywhere? | Desktop controls are 32 and 40 px for a mouse; 24 px is the WCAG 2.2 minimum there. |
| Is there a breakpoint service? | No: CSS media queries do the layout; one `matchMedia` closes the drawer when the window widens. |

## Code / assets on screen

| File | What to show |
|---|---|
| `docs/specs/L2.md` | L2-046 AC4's touch-target wording |
| `docs/design-system/tokens/tokens.css` | 44 px control heights, restored at 62rem |
| `frontend/projects/mission-control/src/app/layout/shell.html`, `shell.ts` | One sidebar template, the drawer dialog, the media query |
| `c4-component`, `class-structure` | The responsive design's redrawn diagrams |
| `e2e/tests/behavior/use-mission-control-on-mobile.spec.ts` | The drawer, the width sweep, touch targets: red then green |
| `screens/*.png`, `clips/menu.mp4` | Captured by `clips/clips.mjs` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:20 | Introduction | What journey 33 is |
| 00:20-00:48 | Goal | L2-046 AC1-AC4 |
| 00:48-01:10 | Three widths | One project on a desktop, a tablet and a phone |
| 01:10-01:49 | On a phone | Before and after, the drawer clip, dark mode |
| 01:49-02:25 | Touch targets | The requirement change, ADR 0034 and the tokens |
| 02:25-03:10 | How it works | The template, the dialog, the media query, the diagrams |
| 03:10-04:09 | Tests | The drawer, the width sweep, touch targets |
| 04:09-04:37 | Recap | Three points and what comes next |

## Demo commands

```sh
pwsh eng/Start-E2eApi.ps1
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json && cd ..
node docs/videos/33-use-mission-control-on-mobile/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/33-use-mission-control-on-mobile
node tools/video-build/build-video.mjs docs/videos/33-use-mission-control-on-mobile --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- `Navigation.openMenu()` waits for finite animations only. Status spinners loop for ever, so waiting on every
  animation hangs.
- The clip is paced to the narration with `at(seconds)` in `clips.mjs`. If the script changes, re-time it from
  `.cache/33-use-mission-control-on-mobile/captions.srt`, or the build speeds the clip up.
- The mobile-nav mock lists "Active directions" in the drawer; the app's sidebar doesn't have them, so neither does
  the drawer.
- Tabs must not shrink (`flex: none`): squeezed to 44 px, their labels overlapped. The touch test now reports a
  control narrower than its label.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [Journey 33 prompt](../../prompts/33-use-mission-control-on-mobile.md), [docs/specs/L2.md](../../specs/L2.md)
- [Responsive and accessible UI design](../../detailed-designs/mission-control/responsive-accessible-ui/README.md), [ADR 0034](../../adr/0034-touch-targets-are-44-px-below-992-px.md)
