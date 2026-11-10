# 16 · Inspect versioned artifacts

> **Runtime:** ~4:17 · **Audience:** Owners, Viewers, Hewn contributors and reviewers · **Prerequisites:** [13 · Follow an increment to merge](../13-follow-an-increment-to-merge/README.md)

**Video:** [16-inspect-versioned-artifacts.mp4](16-inspect-versioned-artifacts.mp4) · [Slides](slides.html) · **Audio:** [16-inspect-versioned-artifacts.mp3](16-inspect-versioned-artifacts.mp3) · [Transcript](script.md)

## Why this video exists

This is the video for journey 16. A project's Artifacts tab lists each stage's artifacts, newest stage first, with
path, version (short commit SHA), time and a link that opens the file on GitHub at that commit (L2-034 AC1, AC2).

## Learning objectives

By the end, the viewer can:

- say where an artifact's version comes from, and why there is no separate artifacts table;
- name the commits the Artifacts tab leaves out, and why;
- explain how a stage's many files fold into folders that link to GitHub as trees;
- say how the tab stays current while stages run.

## Key questions

| Question | What a strong answer includes |
|---|---|
| What is an artifact's version? | The SHA of the latest commit a succeeded run of that stage made to the default branch with that path, as the GitHub broker recorded it. |
| What is left out? | Commits of runs that did not succeed, commits to `hewn/scaffold` or `feature/*` branches, and `docs/decisions.md`, which has its own tab. |
| Why do some rows end in `/`? | Files in a subfolder of the stage's output folder (`CommitPolicy`) fold into that subfolder, linked as `tree/{sha}/…`. |
| How does the tab update? | It reads `GET /api/projects/{id}/artifacts` again on each `StageChanged` event, keeping the list on screen. |

## Code / assets on screen

| File | What to show |
|---|---|
| `backend/src/Hewn.Application/Projects/GetArtifacts.cs` | Succeeded runs' commits, the branch and decision-log rules, folding |
| `screens/answer.json` | The API's answer for stage 1's brief |
| `frontend/projects/mission-control/src/app/pages/project/artifacts.component.html`, `artifacts-view.ts` | The row; the commit time |
| `backend/tests/Hewn.Api.Tests/Pipeline/VersionedArtifactsTests.cs` | A retry's commit is the version |
| `e2e/tests/pipeline/inspect-versioned-artifacts-live.spec.ts` | The brief appears live with its SHA and link |
| `sequence-record-and-index`, `sequence-view-artifacts` | The artifacts-and-traceability design's diagrams |
| `screens/*.png`, `clips/live.mp4` | Mission Control while a real worker runs, captured by `clips/clips.mjs` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:28 | Introduction | What journey 16 is |
| 00:28-01:08 | Goal | Rows per stage; the record and view diagrams |
| 01:08-01:58 | Rules | Succeeded runs, the default branch, the decision log, folding; the answer |
| 01:58-02:24 | The tab | The row, the commit time, the link's name, live refresh |
| 02:24-03:16 | Tests | 232 backend, 3 view, 11 new e2e; the live run |
| 03:16-03:48 | Screens | Kiln Booking filling in live; Viewer in dark and on a phone; empty and error |
| 03:48-04:17 | Recap | Three points and what comes next |

## Demo commands

```sh
pwsh eng/Start-E2eApi.ps1                       # a fresh database, so the project names are free
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
node docs/videos/16-inspect-versioned-artifacts/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/16-inspect-versioned-artifacts
node tools/video-build/build-video.mjs docs/videos/16-inspect-versioned-artifacts --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- Project names must be unique, so rerunning the capture needs a fresh e2e API (restart `Start-E2eApi.ps1`).
- The real stage executors finish in about a second against the fakes, so the clip shows the empty tab filling in
  at once rather than stage by stage.
- The error screen stubs `/api/projects/{id}/artifacts` only; a pattern that also matches the page's own
  `/projects/{id}/artifacts` URL replaces the app with JSON.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [Journey 16 prompt](../../prompts/16-inspect-versioned-artifacts.md), [docs/specs/L2.md](../../specs/L2.md)
- [Artifacts and traceability](../../detailed-designs/mission-control/artifacts-and-traceability/README.md)
