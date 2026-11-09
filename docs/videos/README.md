# Videos

Narrated walkthroughs of each journey's implementation, built from a transcript, a slide deck and the real
app by `tools/video-audio` and `tools/video-build` (see the `creating-videos` skill and
[ADR 0004](../adr/0004-video-tooling.md)).

| # | Video | Runtime | Pull request |
|---|---|---|---|
| 01 · 1 | [Build a new product, part one: submit a direction](01-build-a-new-product-part-1/README.md) | ~4:27 | Journey 1, part 1 |
| 01 · 2 | [Build a new product, part two: run the pipeline](01-build-a-new-product-part-2/README.md) | ~3:41 | Journey 1, part 2 |

## Voice

Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0), run
locally through `kokoro-onnx`. Set-up, once:

```sh
python3.12 -m venv tools/video-audio/.venv
tools/video-audio/.venv/bin/pip install kokoro-onnx soundfile
mkdir -p tools/video-audio/.cache && cd tools/video-audio/.cache
curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
```

`generate-audio.mjs` uses that virtualenv automatically (`PYTHON` overrides it). Test a word with
`node tools/video-audio/generate-audio.mjs --say "Hewn" --out .cache/say.wav`; spoken replacements live in
`tools/video-audio/pronunciations.json`.

## Music

Every journey video mixes the credited Pixabay soca track under the narration with
`build-video.mjs --music docs/videos/assets/music/en-la-playa-soca.mp3` (about 20 dB under the voice, faded in,
3-second music-only tail). See [assets/music](assets/music/README.md).

## Screens and clips

Each video folder keeps its capture script in `clips/clips.mjs`. It drives the running app with Playwright
and reuses the e2e page objects, writing `screens/*.png` and `clips/*.mp4` (1408x792 for desktop clips).
