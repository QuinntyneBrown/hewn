# 17 · Trace a requirement

> **Runtime:** ~4:58 · **Audience:** Owners, Viewers, Hewn contributors and reviewers · **Prerequisites:** [16 · Inspect versioned artifacts](../16-inspect-versioned-artifacts/README.md)

**Video:** [17-trace-a-requirement.mp4](17-trace-a-requirement.mp4) · [Slides](slides.html) · **Audio:** [17-trace-a-requirement.mp3](17-trace-a-requirement.mp3) · [Transcript](script.md)

## Why this video exists

This is the video for journey 17. A project's Traceability tab shows, for any L2, its L1, the designs that cover it,
the journeys it appears in, the test files whose `Traces to:` header names it and the pull requests whose titles
name it, and marks an L2 with no test "No acceptance test" unless it is Deferred (L2-035).

## Learning objectives

By the end, the viewer can:

- say where the trace comes from, and why there is no index ([ADR 0019](../../adr/0019-traces-are-read-from-the-head-on-request.md));
- name what counts as a design, journey, test or pull request naming an L2;
- explain when an L2 is marked No acceptance test;
- say what happens when `docs/specs/L2.md` can't be parsed.

## Key questions

| Question | What a strong answer includes |
|---|---|
| Where is the trace read from? | One archive of the default branch at its head and one list of pull requests, on each request; the answer names the short SHA. |
| What names an L2? | Its ID matched whole in a design README, a `## N.` journey section, a `Traces to:` comment in a file's first 20 lines (outside `docs/` and Hewn's folders), or a pull request title. |
| When is it "No acceptance test"? | No test file's header names it, and it has no `**Status:** Deferred (…)` line. |
| What if L2.md is malformed? | `502 github_failed`, "docs/specs/L2.md couldn’t be parsed at {sha7} (unexpected heading on line N)"; nothing is written. |

## Code / assets on screen

| File | What to show |
|---|---|
| `backend/src/Hewn.Application/Projects/GetTraceability.cs` | The archive and pull requests; the L2 heading rule; whole-ID matching; test headers |
| `screens/answer.json` | The API's answer for Kiln Booking's first L2 |
| `frontend/projects/mission-control/src/app/pages/project/traceability.component.html` | Deferred, or the No acceptance test pill |
| `backend/tests/Hewn.Api.Tests/Projects/TraceabilityTests.cs` | No acceptance test unless Deferred |
| `e2e/tests/pipeline/trace-a-requirement-live.spec.ts` | A real build's L2-001 traced end to end |
| `sequence-view-trace`, `c4-component` | The artifacts-and-traceability design's diagrams |
| `screens/*.png`, `clips/*.mp4` | Kiln Booking after a real build, and a seeded Ledgerline, captured by `clips/clips.mjs` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:28 | Introduction | What journey 17 is |
| 00:28-01:26 | Goal | The trace and its marker; the flow and component diagrams; ADR 0019 |
| 01:26-01:56 | Reading the head | One archive and its commit; the L2 heading rule and its error |
| 01:56-02:27 | What names a requirement | Whole-ID matching; No acceptance test; test headers |
| 02:27-02:52 | The tab | Search, Deferred flags, `?l2=`, four columns, the pill |
| 02:52-03:47 | Tests | 238 backend, 4 view, 18 new e2e; the live build |
| 03:47-04:31 | Screens | Kiln Booking built for real; Ledgerline's gaps and search; dark and phone; empty and error |
| 04:31-04:58 | Recap | Three points and what comes next |

## Demo commands

```sh
pwsh eng/Start-E2eApi.ps1                       # a fresh database, so the project names are free
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
node docs/videos/17-trace-a-requirement/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/17-trace-a-requirement
node tools/video-build/build-video.mjs docs/videos/17-trace-a-requirement --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- Project names (and the seeded repository names) must be unique, so rerunning the capture needs a fresh e2e API.
- The capture imports `e2e/support/traced-files.ts` under plain Node, so that module must stay import-free.
- A real build marks nothing No acceptance test, because stage 10 commits a test for every increment; the gaps come
  from the seeded Ledgerline repository.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [Journey 17 prompt](../../prompts/17-trace-a-requirement.md), [docs/specs/L2.md](../../specs/L2.md)
- [Artifacts and traceability](../../detailed-designs/mission-control/artifacts-and-traceability/README.md)
- [ADR 0019](../../adr/0019-traces-are-read-from-the-head-on-request.md)
