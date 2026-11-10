# Record the increment video

## Overview

Every green increment ends in a short video that shows it working. The video step uses the `creating-videos` skill to write a script, start the app, walk through the increment's journey in a headless browser, narrate it, and produce a captioned 1080p MP4 of 3 minutes or less. The MP4 and its script are saved under `docs/videos/{increment-slug}/`.

The pull request body links to the video, and Mission Control plays it on the increment page. A video failure does not stop the increment: the step is retried at most once, and if it still fails the increment goes on to its pull request with "Video failed: {reason}" in the PR Notes.

Terms used in this design:

- **walkthrough** — scripted path through the increment's journey in the running app

## Description

The slice is the Video step and the increment page's player.

- **`VideoStep (worker)`** — runs `StageAgent` with `creating-videos`, starts the app in the workspace, records with `BrowserRecorder`, and runs `VideoValidator`. It allows one retry.
- **`BrowserRecorder`** — headless browser plus ffmpeg capture at 1920×1080, with captions burned from the script.
- **`VideoValidator`** — checks resolution 1080p, captions present and duration of 3 minutes or less.
- **`GetIncrementVideoHandler (API)`** — finds the stage 10 commit that wrote `docs/videos/{slug}/{slug}.mp4` and reads the MP4 or its `.vtt` captions at that SHA; `GET /api/projects/{id}/increments/{n}/video` (byte ranges) and `.../video/captions` serve them (ADR 0021).
- **`IncrementVideoComponent` (`hw-increment-video`, Angular)** — plays the MP4 in the design system's video player: the current caption drawn over the picture, play and pause, the time, a keyboard seek slider, a captions toggle and full screen. Without a video the increment page shows "Video failed: {reason}", that a Blocked increment records none, or that the walkthrough records once every test is green.

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines the level-1 (L1) requirement cited beside it. The text is copied from `docs/specs/L2.md`.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-023` | `L1-013` | **Record the increment video.**<br>1. Given an increment passes its tests, when the video step runs with `creating-videos`, then a captioned 1080p MP4 of 3 minutes or less, walking through the increment's journey in the running app, is saved under `docs/videos/{increment-slug}/` along with its script.<br>2. Given the video, when the PR is opened, then the PR body links to it, and Mission Control plays it on the increment page.<br>3. Given video generation fails, when the step ends, then the increment continues to PR with "Video failed: {reason}" in the PR Notes, and the video step is not retried more than once. |

## Diagrams

### System context

Hewn records the walkthrough with a headless browser and stores the result in the project's repository.

![C4 system context for recording the increment video](diagrams/c4-context.png)

### Containers

The worker records; Mission Control plays the stored file on the increment page.

![C4 container view for recording the increment video](diagrams/c4-container.png)

### Components

Recording and validation are separate, so a too-long or caption-less video counts as a failure and uses the single retry.

![C4 component view for recording the increment video](diagrams/c4-component.png)

### Class structure

`VideoOutcome` carries either the saved path or the failure reason that the PR step copies into Notes.

![Class diagram for recording the increment video](diagrams/class-structure.png)

### Behaviour — record or fail the video

A valid video is saved with its script (L2-023 AC1) and linked from the PR (AC2). After one failed retry the increment continues with the failure in Notes (AC3).

![Sequence diagram: record or fail the video](diagrams/sequence-record.png)

## Decisions made while building the slice

- The agent runs `creating-videos`; the worker then checks `docs/videos/{slug}/` for `{slug}.mp4`, `{slug}.vtt`
  and `script.md`, and with `ffprobe` that the MP4 is 1920x1080 and at most 3 minutes.
- A failure is retried once (two attempts); after that the partial files are removed, the pull request's Notes
  say "Video failed: {reason}", and the increment continues (L2-023 AC3).
- The scripted agent records a 3-second title card with ffmpeg, so the e2e stack exercises the real check.
- The API serves the video and captions through Mission Control's session, read from GitHub at the recording commit
  (ADR 0021); the increment detail links them only when the video was Recorded, and the endpoints answer 404
  `no_video` otherwise.
- The PR body links the MP4 on GitHub at the commit that recorded it; a relative link would resolve under `/pull/N`.
- The player hides the browser's own caption rendering and draws the active cue in `.video__caption`, so the
  captions toggle and the design system's look apply; the seek slider moves 5 s per arrow key, with Home and End.
