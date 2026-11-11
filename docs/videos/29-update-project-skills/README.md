# 29 · Update project skills

> **Runtime:** ~4:24 · **Audience:** Owners, Viewers and Hewn contributors · **Prerequisites:** [28 · Configure automatic descoping](../28-configure-automatic-descoping/README.md)

**Video:** [29-update-project-skills.mp4](29-update-project-skills.mp4) · [Slides](slides.html) · **Audio:** [29-update-project-skills.mp3](29-update-project-skills.mp3) · [Transcript](script.md)

## Why this video exists

This is the video for journey 29 (L2-008 AC1, AC2). When Greenlit's default branch is ahead of a project's
`.hewn/skills.lock`, an Owner sees "Skills update available (n commits)". Update skills opens a pull request with the
new skill files and lock, and it merges once its checks pass. In the recording the lock was 3 commits behind. The pull
request opened 0.8 s after the click and merged 8.4 s after it, leaving the lock at Greenlit's head and no link
(`screens/records.json`).

## Learning objectives

By the end, the viewer can:

- say when the link appears, and to whom;
- explain what the pull request changes, and what it leaves alone;
- trace an update from the link to the merge, including a branch that fell behind and a failing check.

## Key questions

| Question | What a strong answer includes |
|---|---|
| Who sees the link? | Owners, while Greenlit is ahead of the lock and no update is open. Viewers never; the API answers their POST with 403. |
| What does the pull request change? | Greenlit's skill files at its head and the lock; folders the project kept at bootstrap stay its own. |
| Why not a worker run? | An update belongs to no direction or stage; the API opens it and a merger merges it ([ADR 0030](../../adr/0030-the-api-updates-a-projects-skills-itself.md)). |
| What if checks fail? | The pull request stays open and unmerged, and the update is offered again. |
| What if Greenlit can't be reached? | No update is offered; Update skills says why, and the project keeps its skills. |

## Code / assets on screen

| File | What to show |
|---|---|
| `frontend/.../pages/project/update-skills.ts`, `GetSkillsUpdate.cs` | When the link shows; the commits since the lock |
| `UpdateSkills.cs` | The branch, the pull request, the event |
| `SkillsUpdateMerger.cs` | Waiting, merging, a failed check, rebasing |
| `sequence-update` | The bootstrap-skills design's redrawn diagram |
| `UpdateSkillsTests.cs`, `MergeSkillsUpdateTests.cs`, `e2e/tests/behavior/update-project-skills.spec.ts` | Red then green |
| `screens/*.png`, `clips/*.mp4` | Captured by `clips/clips.mjs` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:25 | Introduction | What journey 29 is |
| 00:25-00:50 | Goal | L2-008 AC1 and AC2 |
| 00:50-01:38 | Updating the skills | The link, the dialog, the merge; Greenlit unreachable |
| 01:38-02:45 | How it works | The handlers, the merger, the sequence |
| 02:45-03:55 | Tests | Backend, behaviour, visual and accessibility |
| 03:55-04:03 | Screens | Viewer, dark and phone |
| 04:03-04:24 | Recap | Three points and what comes next |

## Demo commands

```sh
pwsh eng/Start-E2eApi.ps1
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json && cd ..
node docs/videos/29-update-project-skills/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/29-update-project-skills
node tools/video-build/build-video.mjs docs/videos/29-update-project-skills --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- The capture script commits to the e2e stack's local Greenlit (`backend/.e2e/greenlit`). Each run moves its head on,
  so the SHAs differ between recordings.
- `Hewn:Skills:FetchSeconds` is 0 on the e2e stack so each request sees new commits at once; the default is 60.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [Journey 29 prompt](../../prompts/29-update-project-skills.md), [docs/specs/L2.md](../../specs/L2.md)
- [Bootstrap skills](../../detailed-designs/stages/bootstrap-skills/README.md), [ADR 0030](../../adr/0030-the-api-updates-a-projects-skills-itself.md)
