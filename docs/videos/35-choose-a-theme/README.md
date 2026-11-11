# 35 · Choose a theme

> **Runtime:** ~4:17 · **Audience:** Owners, Viewers and Hewn contributors · **Prerequisites:** [34 · Use keyboard and assistive technology](../34-use-keyboard-and-assistive-technology/README.md)

**Video:** [35-choose-a-theme.mp4](35-choose-a-theme.mp4) · [Slides](slides.html) · **Audio:** [35-choose-a-theme.mp3](35-choose-a-theme.mp3) · [Transcript](script.md)

## Why this video exists

This is the video for journey 35 (L2-048 AC1-AC2). In Settings' new Appearance section, the Owner picks Dark,
reloads, picks Light, reloads, and picks System, with the OS set to light throughout. With System chosen, the
OS preference switches four times and the page follows each time without a reload; the caption showing the OS
setting is added for the recording only (`aria-hidden`). On a phone, a Viewer chooses Dark and Settings, Projects,
the menu drawer and a project page follow. axe-core found 0 violations on Projects, New direction, Workers, Audit
and Settings in light and in dark (`screens/records.json`, `axe`).

## Learning objectives

By the end, the viewer can:

- choose a theme in Settings, and say where the choice is kept and who can make it;
- explain how the design tokens switch theme and why System follows the OS live;
- say how the tests prove the choice survives a reload and that contrast holds in both themes.

## Key questions

| Question | What a strong answer includes |
|---|---|
| Where is the choice kept? | `localStorage['hewn.theme']` on this device: `light`, `dark` or `system`. Not on the server. |
| What does System do? | Removes `data-theme` from `<html>`, so the `prefers-color-scheme` media query decides, live. |
| Why the script in `index.html`? | It applies a saved Light or Dark before the first paint, so a reload never flashes the other theme. |
| Can a Viewer choose? | Yes: the theme is per device, so Appearance is never read-only. |
| How is contrast checked? | axe-core on every page, in light and in dark, and on a saved choice against the OS. |

## Code / assets on screen

| File | What to show |
|---|---|
| `docs/design-system/tokens/tokens.css` | The light root, the `[data-theme="dark"]` block and the dark media query |
| `frontend/projects/mission-control/src/app/core/theme.ts` | `applyTheme` and `ThemeService` |
| `frontend/projects/mission-control/src/index.html`, `.../settings/settings.page.html` | The early script and the radios |
| `class-structure`, `sequence-theme-and-announce` | The responsive and accessible design's redrawn diagrams |
| `theme.spec.ts`, `e2e/tests/behavior/choose-a-theme.spec.ts`, `e2e/tests/a11y/both-themes.a11y.spec.ts` | Red then green |
| `screens/*.png`, `clips/*.mp4` | Captured by `clips/clips.mjs` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:23 | Introduction | Projects in light and dark |
| 00:23-00:41 | Goal | L2-048 AC1-AC2 |
| 00:41-01:04 | Choosing | Dark, reload, Light, reload, System |
| 01:04-01:21 | The OS | System following the OS live |
| 01:21-01:32 | Phone | A Viewer's phone in dark |
| 01:32-02:39 | How it works | Tokens, the service, the early script, the diagrams |
| 02:39-03:50 | Tests | Unit, behaviour, contrast in both themes, visual |
| 03:50-04:17 | Recap | Three points and what comes next |

## Demo commands

```sh
pwsh eng/Start-E2eApi.ps1
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json && cd ..
node docs/videos/35-choose-a-theme/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/35-choose-a-theme
node tools/video-build/build-video.mjs docs/videos/35-choose-a-theme --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- `Theme.settle()` waits only for animations that end; the spinners on Projects never do.
- Projects is served the mock's seven projects, so it looks as its mock does rather than showing the shared e2e
  database's test rows.
- The clips are paced to the narration with `at(seconds)`. If the script changes, re-time them from
  `.cache/35-choose-a-theme/captions.srt`.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [Journey 35 prompt](../../prompts/35-choose-a-theme.md), [docs/specs/L2.md](../../specs/L2.md)
- [Responsive and accessible UI design](../../detailed-designs/mission-control/responsive-accessible-ui/README.md)
