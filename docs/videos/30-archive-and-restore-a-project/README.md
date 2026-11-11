# 30 · Archive and restore a project

> **Runtime:** ~4:24 · **Audience:** Owners, Viewers and Hewn contributors · **Prerequisites:** [29 · Update project skills](../29-update-project-skills/README.md)

**Video:** [30-archive-and-restore-a-project.mp4](30-archive-and-restore-a-project.mp4) · [Slides](slides.html) · **Audio:** [30-archive-and-restore-a-project.mp3](30-archive-and-restore-a-project.mp3) · [Transcript](script.md)

## Why this video exists

This is the video for journey 30 (L2-003 AC1, AC2). An Owner archives a project with no active direction. It leaves
the default list, appears under the Archived filter, and Restore brings it back with the status it had. While a
direction is active, Archive is disabled, and the API refuses with "Cancel the running direction first". In the
recording, Saltmarsh Survey was archived and restored, coming back as Cancelled. Tidewater's disabled control was
named "Archive Tidewater: cancel the running direction first" (`screens/records.json`).

## Learning objectives

By the end, the viewer can:

- archive a project, find it under Archived and restore it;
- say when archiving is refused, and what the Owner sees then;
- explain why archiving is a flag beside the project's status.

## Key questions

| Question | What a strong answer includes |
|---|---|
| What counts as an active direction? | Queued, Running, Paused or Blocked; a queued one would start while the project was archived. |
| What does the project's status become? | It keeps its status; `ArchivedAt` is set beside it ([ADR 0031](../../adr/0031-archiving-is-a-flag-beside-the-projects-status.md)). |
| Where do archived projects go? | Out of All, every status tab and their counts; `?status=archived` lists only them. |
| Can an archived project take a new direction? | No: 409 `project_archived`, "Restore the project first". |
| Who can archive? | Owners. Viewers see the Archived filter without actions, and the API answers them with 403. |

## Code / assets on screen

| File | What to show |
|---|---|
| `backend/src/Hewn.Application/Projects/ArchiveProject.cs` | The guard, the flag and the event |
| `Hewn.Domain/Project.cs`, `SubmitFeatureDirection.cs` | `HasActiveDirection`; no new direction while archived |
| `frontend/.../pages/projects/projects-list.ts` | The Archived filter and when archiving is offered |
| `sequence-archive-restore` | The archive-and-delete design's redrawn diagram |
| `ArchiveProjectTests.cs`, `e2e/tests/behavior/archive-and-restore-a-project.spec.ts` | Red then green |
| `screens/*.png`, `clips/*.mp4` | Captured by `clips/clips.mjs` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:20 | Introduction | What journey 30 is |
| 00:20-00:41 | Goal | L2-003 AC1 and AC2 |
| 00:41-01:11 | Archiving and restoring | Archive, Show archived, Restore |
| 01:11-01:37 | The refusal | Disabled while running; the API's answer |
| 01:37-02:30 | How it works | The handler, the guard, the list, the sequence |
| 02:30-03:53 | Tests | Backend, unit, behaviour, visual and accessibility |
| 03:53-04:01 | Screens | Viewer, dark and phone |
| 04:01-04:24 | Recap | Three points and what comes next |

## Demo commands

```sh
pwsh eng/Start-E2eApi.ps1
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json && cd ..
node docs/videos/30-archive-and-restore-a-project/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/30-archive-and-restore-a-project
node tools/video-build/build-video.mjs docs/videos/30-archive-and-restore-a-project --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- Start a fresh e2e API before capturing, or the Projects list fills with other tests' projects.
- The refusal toast comes from a stubbed 409. A real one needs a direction to start between the page loading and
  the click, which the live row update makes hard to catch; the backend test covers the real answer.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [Journey 30 prompt](../../prompts/30-archive-and-restore-a-project.md), [docs/specs/L2.md](../../specs/L2.md)
- [Archive and delete a project](../../detailed-designs/projects/archive-and-delete-project/README.md), [ADR 0031](../../adr/0031-archiving-is-a-flag-beside-the-projects-status.md)
