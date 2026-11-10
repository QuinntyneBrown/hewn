# Videos

Narrated walkthroughs of each journey's implementation, built from a transcript, a slide deck and the real
app by `tools/video-audio` and `tools/video-build` (see the `creating-videos` skill and
[ADR 0004](../adr/0004-video-tooling.md)).

| # | Video | Runtime | Pull request |
|---|---|---|---|
| 01 · 1 | [Build a new product, part one: submit a direction](01-build-a-new-product-part-1/README.md) | ~4:27 | Journey 1, part 1 |
| 01 · 2 | [Build a new product, part two: run the pipeline](01-build-a-new-product-part-2/README.md) | ~3:41 | Journey 1, part 2 |
| 01 · 3 | [Build a new product, part three: bootstrap the repository](01-build-a-new-product-part-3/README.md) | ~3:23 | Journey 1, part 3 |
| 01 · 4 | [Build a new product, part four: the document stages](01-build-a-new-product-part-4/README.md) | ~3:32 | Journey 1, part 4 |
| 01 · 5 | [Build a new product, part five: designs and the design system](01-build-a-new-product-part-5/README.md) | ~3:26 | Journey 1, part 5 |
| 01 · 6 | [Build a new product, part six: the scaffold](01-build-a-new-product-part-6/README.md) | ~3:11 | Journey 1, part 6 |
| 01 · 7 | [Build a new product, part seven: estimates and descoping](01-build-a-new-product-part-7/README.md) | ~2:59 | Journey 1, part 7 |
| 01 · 8 | [Build a new product, part eight: increments](01-build-a-new-product-part-8/README.md) | ~3:06 | Journey 1, part 8 |
| 01 | [Build a new product](01-build-a-new-product/README.md) | ~7:19 | Journey 1, full |
| 02 | [Add a feature](02-add-a-feature/README.md) | ~5:07 | Journey 2 |
| 03 | [Monitor a direction](03-monitor-a-direction/README.md) | ~4:52 | Journey 3 |
| 04 | [Limit spending](04-limit-spending/README.md) | ~4:54 | Journey 4 |
| 05 | [Raise budget and resume](05-raise-budget-and-resume/README.md) | ~4:32 | Journey 5 |
| 06 | [Pause and resume a direction](06-pause-and-resume-a-direction/README.md) | ~4:54 | Journey 6 |
| 07 | [Cancel a direction](07-cancel-a-direction/README.md) | ~5:35 | Journey 7 |
| 08 | [Stop and restart all workers](08-stop-and-restart-all-workers/README.md) | ~5:08 | Journey 8 |
| 09 | [Recover a failed stage](09-recover-a-failed-stage/README.md) | ~5:28 | Journey 9 |
| 10 | [Queue further directions](10-queue-further-directions/README.md) | ~5:09 | Journey 10 |
| 11 | [Find a project](11-find-a-project/README.md) | ~6:14 | Journey 11 |
| 12 | [Review the backlog](12-review-the-backlog/README.md) | ~5:28 | Journey 12 |
| 13 | [Follow an increment to merge](13-follow-an-increment-to-merge/README.md) | ~5:53 | Journey 13 |
| 14 | [Preview product designs](14-preview-product-designs/README.md) | ~5:43 | Journey 14 |
| 15 | [Browse the design system](15-browse-the-design-system/README.md) | ~5:25 | Journey 15 |
| 16 | [Inspect versioned artifacts](16-inspect-versioned-artifacts/README.md) | ~4:17 | Journey 16 |
| 17 | [Trace a requirement](17-trace-a-requirement/README.md) | ~4:58 | Journey 17 |
| 18 | [Review agent decisions](18-review-agent-decisions/README.md) | ~4:51 | Journey 18 |
| 19 | [Watch an increment demonstration](19-watch-an-increment-demonstration/README.md) | ~4:54 | Journey 19 |
| 20 | [Sign in and sign out](20-sign-in-and-sign-out/README.md) | ~4:40 | Journey 20 |
| 21 | [Manage Owner and Viewer access](21-manage-owner-and-viewer-access/README.md) | ~4:07 | Journey 21 |
| 22 | [Connect a GitHub repository](22-connect-a-github-repository/README.md) | ~4:19 | Journey 22 |
| 23 | [Run workers locally or in the cloud](23-run-workers-locally-or-in-cloud/README.md) | ~5:06 | Journey 23 |
| 24 | [Manage worker tokens](24-manage-worker-tokens/README.md) | ~5:29 | Journey 24 |
| 25 | [Inspect worker activity](25-inspect-worker-activity/README.md) | ~4:39 | Journey 25 |
| 26 | [Continue after a worker or server crash](26-continue-after-a-worker-or-server-crash/README.md) | ~5:01 | Journey 26 |

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
