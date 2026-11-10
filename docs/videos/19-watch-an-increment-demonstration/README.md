# 19 · Watch an increment demonstration

> **Runtime:** ~4:54 · **Audience:** Owners, Viewers, Hewn contributors and reviewers · **Prerequisites:** [18 · Review agent decisions](../18-review-agent-decisions/README.md)

**Video:** [19-watch-an-increment-demonstration.mp4](19-watch-an-increment-demonstration.mp4) · [Slides](slides.html) · **Audio:** [19-watch-an-increment-demonstration.mp3](19-watch-an-increment-demonstration.mp3) · [Transcript](script.md)

## Why this video exists

This is the video for journey 19. An increment's page plays the captioned walkthrough stage 10 recorded, served by
the Hewn API from the commit that recorded it, and the pull request links the same file (L2-023 AC2). When the
recording failed, the page says "Video failed: {reason}" and the increment still went on to its pull request (AC3).

## Learning objectives

By the end, the viewer can:

- explain how the API finds and serves a video from a private repository ([ADR 0021](../../adr/0021-increment-videos-are-served-through-the-api.md));
- say why the video endpoint answers byte ranges, and how the player draws captions;
- name what the page shows when there is no video: failed, Blocked, or not green yet;
- explain why the pull request's video link had to change.

## Key questions

| Question | What a strong answer includes |
|---|---|
| Which file is played? | `docs/videos/{slug}/{slug}.mp4` (and `.vtt`), read at the latest stage 10 commit whose paths include it; the branch is gone after the squash merge, the commit isn't. |
| Why through the API? | Product repositories are private; the API applies the session's rules (Viewers watch, anonymous is 401) and keeps GitHub tokens out of the browser. |
| How does seeking work? | The endpoint has range processing on, so the browser asks for the bytes it needs and gets 206 Partial Content. |
| What if there's no video? | The detail has no `videoUrl`; the endpoints answer 404 `no_video`; the page shows the reason, Blocked, or that it records once every test is green. |

## Code / assets on screen

| File | What to show |
|---|---|
| `backend/src/Hewn.Application/Increments/GetIncrementVideo.cs` | Finding the recording commit and reading the file at it |
| `backend/src/Hewn.Api/Controllers/ProjectsController.cs`, `screens/answer.json` | The endpoint with ranges; the increment's video links |
| `frontend/projects/mission-control/src/app/pages/increment/increment-video.component.*` | Captions drawn over the picture; the keyboard seek slider |
| `frontend/projects/mission-control/src/app/pages/increment/increment-view.ts` | What the page says without a video |
| `worker/src/executors/increment-executor.ts`, `screens/pull-request.json` | The PR body's link at the recording commit |
| `backend/tests/Hewn.Api.Tests/Increments/WatchIncrementVideoTests.cs`, `e2e/tests/pipeline/watch-an-increment-demonstration-live.spec.ts` | Red then green; a real build's walkthrough played |
| `sequence-play`, `c4-component` | The record-increment-video design's diagrams |
| `screens/*.png`, `clips/*.mp4` | Kiln Booking after a real build, captured by `clips/clips.mjs` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:32 | Introduction | What journey 19 is |
| 00:32-01:30 | Goal | The player and the failed state; the play sequence; ADR 0021 |
| 01:30-02:07 | Serving the video | The recording commit; ranges; the API's answer |
| 02:07-02:43 | The player | Captions over the picture; the seek slider; no video |
| 02:43-02:58 | The pull request link | Relative before, at the commit after |
| 02:58-03:48 | Tests | 248 backend, 145 worker, 4 view, 10 new e2e; the live build |
| 03:48-04:32 | Screens | Backlog to increment by keyboard: play, seek, captions; dark and phone; failed with its PR note; waiting |
| 04:32-04:54 | Recap | Four points and what comes next |

## Demo commands

```sh
pwsh eng/Start-E2eApi.ps1                       # a fresh database, so the project names are free
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
node docs/videos/19-watch-an-increment-demonstration/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/19-watch-an-increment-demonstration
node tools/video-build/build-video.mjs docs/videos/19-watch-an-increment-demonstration --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- Project names must be unique, so rerunning the capture needs a fresh e2e API.
- The scripted worker records a 3-second plain title card with one caption in place of a real walkthrough, so the
  clip's picture is blank apart from its caption.
- The scripted worker never fails a video, so the failed and waiting screens use the e2e mock increment, as the
  behaviour and visual tests do.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [Journey 19 prompt](../../prompts/19-watch-an-increment-demonstration.md), [docs/specs/L2.md](../../specs/L2.md)
- [Record the increment video](../../detailed-designs/increments/record-increment-video/README.md)
- [ADR 0021](../../adr/0021-increment-videos-are-served-through-the-api.md)
