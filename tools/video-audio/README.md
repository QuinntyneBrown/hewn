# video-audio

`generate-audio.mjs` turns `docs/videos/NN-name/script.md` into `NN-name.mp3` and a timing manifest in
`.cache/NN-name/manifest.json`. Hewn's journey videos use the `kokoro` engine (the default here): Kokoro-82M
from Hugging Face through `kokoro-onnx`, run locally by `kokoro_say.py`. `--dry-run` validates and estimates;
`--spoken` prints what the narrator says; `--say "text" --out file.wav` is the pronunciation test.
`pronunciations.json` holds spoken replacements. Set-up and voice notes are in `docs/videos/README.md`.

Ported from Greenlit's `tools/video-audio` (MIT); the Kokoro runner uses `kokoro-onnx` instead of `kokoro`.
