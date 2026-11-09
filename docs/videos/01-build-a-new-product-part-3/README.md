# 01 · Build a new product, part three: bootstrap the repository

> **Runtime:** ~3:23 · **Audience:** Hewn contributors and reviewers · **Prerequisites:** [part two](../01-build-a-new-product-part-2/README.md)

**Video:** [01-build-a-new-product-part-3.mp4](01-build-a-new-product-part-3.mp4) · [Slides](slides.html) · **Audio:** [01-build-a-new-product-part-3.mp3](01-build-a-new-product-part-3.mp3) · [Transcript](script.md)

## Why this video exists

It documents the third pull request of journey 1: stage 0 creates the product's private repository and
installs the Greenlit skills with a lock file (L2-007, L2-036 AC1 and AC3).

## Learning objectives

By the end, the viewer can:

- say when and how the repository is created, and when an existing one is adopted;
- explain why a resumed stage 0 cannot commit twice, and what it may write;
- read `.hewn/skills.lock` and say where each field comes from.

## Key questions

| Question | What a strong answer includes |
|---|---|
| Who talks to GitHub? | Only the API, with an App installation token; the worker calls the API. |
| What happens to a skill folder the repository already has? | It is left unchanged and logged as "kept existing"; it is not in the lock's list. |
| What stops stage 0 writing a workflow file? | `CommitPolicy` allows only the two skill folders and the lock; other paths get 400 `path_not_allowed`. |

## Code / assets on screen

| File | What to show |
|---|---|
| `backend/src/Hewn.Application/Pipeline/RepositoryProvisioner.cs` | Create or adopt |
| `backend/src/Hewn.Application/Pipeline/CommitPolicy.cs` | Stage 0's path allow list |
| `worker/src/executors/bootstrap-executor.ts` | Kept existing, copy, commit |
| `screens/*.png`, `clips/bootstrap.mp4` | The real app with a real worker, captured by `clips/clips.mjs` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:17 | Introduction | What part three adds |
| 00:17-00:50 | What we built | API and worker; no credential on the worker |
| 00:50-01:30 | Design | Idempotent creation; fenced, keyed commits; path rules |
| 01:30-02:05 | Code | The executor; the lock |
| 02:05-02:28 | Tests | Backend, worker and Playwright |
| 02:28-03:08 | Screens | The link appears live; desktop and phone |
| 03:08-03:23 | Recap | Three points and what comes next |

## Demo commands

```sh
pwsh eng/Start-E2eApi.ps1            # also builds the Greenlit fixture repository
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
node docs/videos/01-build-a-new-product-part-3/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/01-build-a-new-product-part-3
node tools/video-build/build-video.mjs docs/videos/01-build-a-new-product-part-3 --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- Workers need `git` on the path for stage 0.
- The fake GitHub lives in the API's memory; restarting the e2e API empties it.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [L2-007 and L2-036 in docs/specs/L2.md](../../specs/L2.md)
- [Bootstrap skills](../../detailed-designs/stages/bootstrap-skills/README.md) and [Connect to GitHub](../../detailed-designs/source-control/connect-to-github/README.md) designs
- [ADR 0006: commit mutation before the git proxy](../../adr/0006-commit-mutation-before-git-proxy.md)
