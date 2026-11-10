# 31 · Delete a project

> **Runtime:** ~4:52 · **Audience:** Owners and Hewn contributors · **Prerequisites:** [30 · Archive and restore a project](../30-archive-and-restore-a-project/README.md)

**Video:** [31-delete-a-project.mp4](31-delete-a-project.mp4) · [Slides](slides.html) · **Audio:** [31-delete-a-project.mp3](31-delete-a-project.mp3) · [Transcript](script.md)

## Why this video exists

This is the video for journey 31 (L2-003 AC2, AC3). An Owner chooses Delete, types the project name exactly and
confirms. Hewn's records, logs and stored artifacts for the project go, and the GitHub repository stays. While a
direction is active, Delete is disabled with "Cancel the running direction first". In the recording, typing "Harbor"
gave "Type Harbor CRM ee3d exactly to delete it." with Delete project disabled. With the whole name, the project was
deleted 349 ms after the click. Its page then answered 404, and the fake GitHub still held the README unchanged
(`screens/records.json`).

## Learning objectives

By the end, the viewer can:

- delete a project, and say what Hewn removes and what it keeps;
- say when deleting is refused, and what the Owner sees then;
- explain why the delete happens in one save rather than in a background job.

## Key questions

| Question | What a strong answer includes |
|---|---|
| What does Hewn remove? | Directions and stages, runs, events, log lines, decisions, model calls (spend), GitHub mutations, increments and checks, skills updates. |
| What does it keep? | The GitHub repository (no GitHub call is made), and workers, users and settings, which belong to no project. |
| What counts as "exactly"? | The name as stored: case and spaces count. Anything else is 400 `confirm_name`. |
| What if it fails partway? | Nothing is removed: everything goes in one save ([ADR 0032](../../adr/0032-a-project-is-deleted-in-one-save.md)). |
| Who can delete? | Owners. Viewers see no Delete, and the API answers them with 403. |

## Code / assets on screen

| File | What to show |
|---|---|
| `backend/src/Hewn.Application/Projects/DeleteProject.cs` | The guard, the name check, the one save and `ProjectDeleted` |
| `frontend/.../pages/projects/delete-project.dialog.ts` | When Delete project is enabled and the field error shows |
| `sequence-delete` | The archive-and-delete design's redrawn diagram |
| `DeleteProjectTests.cs`, `e2e/tests/behavior/delete-a-project.spec.ts` | Red then green |
| `screens/*.png`, `clips/*.mp4` | Captured by `clips/clips.mjs` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:21 | Introduction | What journey 31 is |
| 00:21-00:44 | Goal | L2-003 AC2 and AC3 |
| 00:44-01:40 | Deleting | The wrong name, the right one, the row gone, the repository kept |
| 01:40-01:57 | The refusal | Delete disabled while a direction runs |
| 01:57-03:06 | How it works | The guard, the one save, the dialog, the sequence |
| 03:06-04:20 | Tests | Backend, behaviour, visual and accessibility |
| 04:20-04:30 | Screens | Failed, dark and phone |
| 04:30-04:52 | Recap | Three points and what comes next |

## Demo commands

```sh
pwsh eng/Start-E2eApi.ps1
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json && cd ..
node docs/videos/31-delete-a-project/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/31-delete-a-project
node tools/video-build/build-video.mjs docs/videos/31-delete-a-project --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- Start a fresh e2e API before capturing, or the Projects list fills with other tests' projects.
- The clip is paced to the narration with waits in `clips.mjs`. If the script changes, re-time them from
  `.cache/31-delete-a-project/captions.srt`, or the build speeds the clip up.
- The README page is the fake GitHub's plain-text answer, labelled and enlarged by `clips.mjs` for the video.
- The failed screen comes from a stubbed 503; the backend test covers a real refusal.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [Journey 31 prompt](../../prompts/31-delete-a-project.md), [docs/specs/L2.md](../../specs/L2.md)
- [Archive and delete a project](../../detailed-designs/projects/archive-and-delete-project/README.md), [ADR 0032](../../adr/0032-a-project-is-deleted-in-one-save.md)
