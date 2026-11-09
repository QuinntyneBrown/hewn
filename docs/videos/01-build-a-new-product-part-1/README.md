# 01 · Build a new product, part one: submit a direction

> **Runtime:** ~4:27 · **Audience:** Hewn contributors and reviewers · **Prerequisites:** none

**Video:** [01-build-a-new-product-part-1.mp4](01-build-a-new-product-part-1.mp4) · [Slides](slides.html) · **Audio:** [01-build-a-new-product-part-1.mp3](01-build-a-new-product-part-1.mp3) · [Transcript](script.md)

## Why this video exists

It documents the first pull request of journey 1: submitting a product direction (L2-001), and the
foundations the repository needed to make that possible.

## Learning objectives

By the end, the viewer can:

- describe what happens between pressing **Start direction** and seeing the project page;
- find the handler, validator, controller and acceptance tests for L2-001;
- explain how field errors reach the inline messages and the linked summary.

## Key questions

| Question | What a strong answer includes |
|---|---|
| When is a direction durable? | Before the API answers: project, direction and the `DirectionQueued` event commit together. |
| What can stop a submission? | Field rules (name, idea, repository URL, budget), an unwritable or missing repository, a Viewer's 403. |
| Why can a Viewer never submit? | The `Owner` policy on `POST /api/projects` returns 403 whatever the client shows. |

## Code / assets on screen

| File | What to show |
|---|---|
| `docs/detailed-designs/projects/submit-product-direction/diagrams/sequence-submit.png` | The submit sequence |
| `backend/src/Hewn.Application/Projects/SubmitProductDirection.cs` | The handler, the validator rules and the first event |
| `backend/src/Hewn.Api/Controllers/ProjectsController.cs` | The thin controller with the Owner policy |
| `backend/tests/Hewn.Api.Tests/Projects/SubmitProductDirectionTests.cs` | The acceptance test header |
| `screens/*.png`, `clips/submit.mp4` | The real app, captured by `clips/clips.mjs` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:21 | Introduction | What the slice is |
| 00:21-01:07 | What we built | The slice and the foundations |
| 01:07-01:41 | Design | Sequence diagram and the first event |
| 01:41-02:32 | Code | Handler, validator, controller |
| 02:32-03:11 | Tests | Red with 404, two bugs, green |
| 03:11-04:06 | Screens | Clip, invalid, repository, Viewer, phone and dark |
| 04:06-04:27 | Recap | Three points and what comes next |

## Demo commands

```sh
# Stack for captures: API on 5300 and Mission Control on 4300
pwsh eng/Start-E2eApi.ps1
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
# From the repo root
node docs/videos/01-build-a-new-product-part-1/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/01-build-a-new-product-part-1
node tools/video-build/build-video.mjs docs/videos/01-build-a-new-product-part-1 --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- Port 4200 may belong to another project's dev server; the e2e stack uses 4300 and 5300.
- Captures need the dev sign-in, which only the e2e and local stacks enable.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [L2-001 in docs/specs/L2.md](../../specs/L2.md)
- [Submit a product direction, detailed design](../../detailed-designs/projects/submit-product-direction/README.md)
