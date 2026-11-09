# 0004. Journey videos: Greenlit's tooling, Kokoro narration, music under the voice

Date: 2026-11-08 · Status: Accepted

## Context

Every journey pull request carries a narrated walkthrough video. Greenlit (same owner, MIT) already has a
tested audio generator and video builder that implement the `creating-videos` skill.

## Decision

- `tools/video-audio` and `tools/video-build` are ported from Greenlit. Hewn defaults the audio engine to
  Kokoro-82M (`hexgrad/Kokoro-82M`, Apache-2.0) run locally through `kokoro-onnx`, voice `af_heart`. The
  virtualenv (`tools/video-audio/.venv`) and model files (`tools/video-audio/.cache`) are not committed.
- `build-video.mjs --music <file>` mixes a background track about 20 dB under the narration (`--music-db`),
  faded in, with a 3-second music-only tail.
- The background track is _En La Playa – Trinidad and Tobago Soca_ by JuliusH from Pixabay Music (Pixabay
  Content License), reused from Greenlit and credited in `docs/videos/assets/music/README.md` and each video.
- Hewn has its own `docs/videos/assets/slides.css` and `slides.js` for explainer decks; the render contract
  (`?render=1&slide=N`, `?audit=1`, `data-clips`) is the same as Greenlit's.

## Consequences

Building a video needs Node, Python 3.10 or later, ffmpeg with libx264 and libass, and Chromium (Playwright's
bundled one is found automatically).
