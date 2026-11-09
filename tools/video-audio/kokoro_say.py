"""Synthesize one text to a 24 kHz mono WAV with Kokoro-82M (hexgrad/Kokoro-82M) through kokoro-onnx.
Usage: kokoro_say.py VOICE SPEED OUT.wav < text

Needs `pip install kokoro-onnx soundfile` and the model files kokoro-v1.0.onnx and voices-v1.0.bin
(github.com/thewh1teagle/kokoro-onnx releases) in KOKORO_MODEL_DIR, default tools/video-audio/.cache."""
import os
import sys
from pathlib import Path

import soundfile as sf
from kokoro_onnx import Kokoro

voice, speed, out = sys.argv[1], float(sys.argv[2]), sys.argv[3]
text = sys.stdin.read().strip()
models = Path(os.environ.get("KOKORO_MODEL_DIR", Path(__file__).parent / ".cache"))
kokoro = Kokoro(str(models / "kokoro-v1.0.onnx"), str(models / "voices-v1.0.bin"))
samples, rate = kokoro.create(text, voice=voice, speed=speed, lang="en-us")
sf.write(out, samples, rate)
