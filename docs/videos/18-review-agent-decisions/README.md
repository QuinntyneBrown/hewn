# 18 · Review agent decisions

> **Runtime:** ~4:51 · **Audience:** Owners, Viewers, Hewn contributors and reviewers · **Prerequisites:** [17 · Trace a requirement](../17-trace-a-requirement/README.md)

**Video:** [18-review-agent-decisions.mp4](18-review-agent-decisions.mp4) · [Slides](slides.html) · **Audio:** [18-review-agent-decisions.mp3](18-review-agent-decisions.mp3) · [Transcript](script.md)

## Why this video exists

This is the video for journey 18. A project's Decisions tab lists the questions agents answered for themselves,
newest first, each with its stage, answer, rationale and a link to the commit that recorded it in
`docs/decisions.md` (and its ADR), and a stage filter narrows the list (L2-054 AC2, AC3).

## Learning objectives

By the end, the viewer can:

- explain how Hewn knows which commit recorded a decision, without reading GitHub ([ADR 0020](../../adr/0020-decisions-are-listed-from-hewns-record.md));
- say what the worker reports with a decision, and why stage 10 now reports its decisions;
- use the stage filter and its link (`?stage=`);
- match a `docs/decisions.md` entry to its rendering on the tab.

## Key questions

| Question | What a strong answer includes |
|---|---|
| Which commit is a decision's? | The run's latest commit whose paths include `docs/decisions.md` when the worker reports the decision; workers always commit first. |
| Where does the list come from? | `run_decisions` in Hewn's database, newest first by the time each was reported; no GitHub call. |
| How is an ADR linked? | The worker reads the entry's `**ADR:**` link and reports `docs/adr/NNNN-slug.md` (validated); the tab shows "ADR NNNN" at the recording commit. |
| What does the filter do? | `?stage=N` asks the API for one stage; a stage with none says so and offers "Show all stages". |

## Code / assets on screen

| File | What to show |
|---|---|
| `backend/src/Hewn.Application/Pipeline/MonitorCommands.cs` | The recording commit, stored with each decision and its ADR |
| `worker/src/agents/decision-log.ts`, `worker/src/executors/increment-executor.ts` | The ADR read from the entry; stage 10 reporting after each commit |
| `backend/src/Hewn.Application/Projects/GetDecisions.cs`, `screens/answer.json` | Newest first, with the commit and ADR links |
| `screens/decisions.md`, `screens/stack-entry.png` | A `docs/decisions.md` entry beside its rendering |
| `frontend/projects/mission-control/src/app/pages/project/decisions.component.*` | The stage filter in the address |
| `backend/tests/Hewn.Api.Tests/Projects/DecisionsTests.cs`, `e2e/tests/pipeline/review-agent-decisions-live.spec.ts` | Red then green; a real build's decision followed to its commit |
| `sequence-answer-and-record`, `sequence-list`, `class-structure` | The record-decisions design's diagrams |
| `screens/*.png`, `clips/*.mp4` | Kiln Booking after a real build, captured by `clips/clips.mjs` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:33 | Introduction | What journey 18 is |
| 00:33-01:45 | Goal | The list and filter; recording and listing diagrams; the classes; ADR 0020 |
| 01:45-02:22 | Keeping the commit | The recording commit; the ADR; stage 10 reporting |
| 02:22-02:36 | The decisions API | Newest first, with links; the API's answer |
| 02:36-02:56 | The tab | An entry beside its rendering; the filter in the address |
| 02:56-03:53 | Tests | 244 backend, 145 worker, 3 view, 17 new e2e; the live build |
| 03:53-04:29 | Screens | Kiln Booking's decisions and filters; opening a commit; dark and phone; empty and error |
| 04:29-04:51 | Recap | Three points and what comes next |

## Demo commands

```sh
pwsh eng/Start-E2eApi.ps1                       # a fresh database, so the project names are free
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
node docs/videos/18-review-agent-decisions/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/18-review-agent-decisions
node tools/video-build/build-video.mjs docs/videos/18-review-agent-decisions --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- Project names must be unique, so rerunning the capture needs a fresh e2e API.
- The fake repositories don't exist on github.com, so the capture serves the commit page itself from the fake
  GitHub's record of that commit (`/api/fakes/github/{owner}/{name}/commits` and `.../contents/{path}?ref=`), and
  labels it as the e2e fake.
- The scripted agent's stack decision writes no ADR of its own, so the ADR link is shown with the mock's decisions
  in the behaviour and visual tests rather than in the clips.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [Journey 18 prompt](../../prompts/18-review-agent-decisions.md), [docs/specs/L2.md](../../specs/L2.md)
- [Record agent decisions](../../detailed-designs/pipeline/record-decisions/README.md)
- [ADR 0020](../../adr/0020-decisions-are-listed-from-hewns-record.md)
