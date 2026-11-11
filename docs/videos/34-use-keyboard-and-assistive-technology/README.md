# 34 · Use keyboard and assistive technology

> **Runtime:** ~4:51 · **Audience:** Owners, Viewers and Hewn contributors · **Prerequisites:** [33 · Use Mission Control on mobile](../33-use-mission-control-on-mobile/README.md)

**Video:** [34-use-keyboard-and-assistive-technology.mp4](34-use-keyboard-and-assistive-technology.mp4) · [Slides](slides.html) · **Audio:** [34-use-keyboard-and-assistive-technology.mp3](34-use-keyboard-and-assistive-technology.mp3) · [Transcript](script.md)

## Why this video exists

This is the video for journey 34 (L2-047 AC1-AC4). A direction is submitted, a stage and its tabs chosen, and the
direction cancelled with the keyboard alone, with the focus ring at every stop; Escape closed the cancel dialog and
focus went back to Cancel (`screens/records.json`, `focusAfterEscape`). The shell's one polite live region announces
stage changes, at most once every 5 seconds per project: in the recording it said Stage 0, 1, 3, 5 and 7, each
5.0 s after the last, the latest change winning (`said`). axe-core found 0 violations in each of the 10 scans shown
(`axe`). 60 ms after Open menu, 25 animations were running without the preference and none with reduced motion
(`motion`).

**The screen reader clip is not a VoiceOver or NVDA recording.** Recording one needs a person at the machine with
the screen reader on and system audio captured. The clip shows, in a caption added for the recording only
(`aria-hidden`), the exact text the live region gives a screen reader each time it changes.

## Learning objectives

By the end, the viewer can:

- complete a direction from the keyboard alone, and say what Escape does in a dialog;
- explain how stage changes are announced, and why at most once every 5 seconds per project;
- say what the accessibility tests check and how they would catch a lost focus ring.

## Key questions

| Question | What a strong answer includes |
|---|---|
| Where are stage changes announced? | One polite `role="status"` region in the shell, fed by the project page and by Projects. |
| What happens to changes within 5 seconds? | They wait; only the latest is said when the project's 5 seconds are up. Other projects aren't held back. |
| What counts as a focus indicator? | An outline, or the `--color-focus-ring` inset shadow fields use, read once its transition finishes. |
| What is a keyboard trap to the sweep? | Tab landing on a stop it has seen before, other than the first. |
| What does reduced motion change? | The motion tokens drop to 0.01 ms; nothing runs longer than 1 ms (the CDK backdrop keeps a 1 ms fade). |

## Code / assets on screen

| File | What to show |
|---|---|
| `frontend/projects/mission-control/src/app/core/status-announcer.ts` | The per-project throttle |
| `.../layout/shell.html`, `.../pages/projects/projects.page.ts` | The region, and Projects feeding it |
| `class-structure`, `sequence-theme-and-announce` | The responsive and accessible design's redrawn diagrams |
| `status-announcer.spec.ts`, `e2e/tests/pipeline/announce-stage-changes.spec.ts` | Red then green |
| `e2e/pages/keyboard.ts`, `e2e/tests/behavior/use-keyboard-and-assistive-technology.spec.ts` | The sweep |
| `screens/*.png`, `clips/*.mp4` | Captured by `clips/clips.mjs` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:25 | Introduction | What journey 34 is |
| 00:25-00:51 | Goal | L2-047 AC1-AC4 |
| 00:51-01:29 | By keyboard | The keyboard-only clip |
| 01:29-01:58 | Screen reader | The live region on a running project |
| 01:58-02:20 | Axe | The scans and their results |
| 02:20-02:36 | Reduced motion | The drawer with and without the preference |
| 02:36-03:23 | How it works | The announcer, the region, the diagrams |
| 03:23-04:22 | Tests | Unit, pipeline, keyboard sweep, Settings loading |
| 04:22-04:51 | Recap | Three points and what comes next |

## Demo commands

```sh
pwsh eng/Start-E2eApi.ps1
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json && cd ..
node docs/videos/34-use-keyboard-and-assistive-technology/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/34-use-keyboard-and-assistive-technology
node tools/video-build/build-video.mjs docs/videos/34-use-keyboard-and-assistive-technology --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- `clips.mjs` drains the queue with fast workers before the announcement clip, or its worker leases older work.
- `e2e/support/queue.ts` imports `./workers` without an extension, which Node can't load, so `clips.mjs` has its own
  drain.
- The keyboard clip is paced to the narration with `at(seconds)`. If the script changes, re-time it from
  `.cache/34-use-keyboard-and-assistive-technology/captions.srt`.
- Submitting many directions in a minute trips the rate limit; wait a minute between runs.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [Journey 34 prompt](../../prompts/34-use-keyboard-and-assistive-technology.md), [docs/specs/L2.md](../../specs/L2.md)
- [Responsive and accessible UI design](../../detailed-designs/mission-control/responsive-accessible-ui/README.md)
