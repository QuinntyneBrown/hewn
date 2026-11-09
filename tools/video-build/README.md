# video-build

`build-video.mjs` renders `slides.html` at 1920x1080 in headless Chromium, times each slide to its
`data-cue` from the narration manifest, burns in captions and encodes the MP4 with ffmpeg.

```sh
node tools/video-build/build-video.mjs docs/videos/NN-name --check         # resolve cues, print the schedule
node tools/video-build/build-video.mjs docs/videos/NN-name --slides-only   # PNGs in .cache/NN-name/slides/
node tools/video-build/build-video.mjs docs/videos/NN-name --music docs/videos/assets/music/en-la-playa-soca.mp3
```

`--music` mixes a track under the narration (faded in, `--music-db` default −20 dB, with a 3-second
music-only tail that fades out). Ported from Greenlit's `tools/video-build` (MIT) with the `--music` flag added.
