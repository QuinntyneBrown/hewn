# 13 · Follow an increment to merge

> **Runtime:** ~5:53 · **Audience:** Owners, Viewers, Hewn contributors and reviewers · **Prerequisites:** [12 · Review the backlog](../12-review-the-backlog/README.md)

**Video:** [13-follow-an-increment-to-merge.mp4](13-follow-an-increment-to-merge.mp4) · [Slides](slides.html) · **Audio:** [13-follow-an-increment-to-merge.mp3](13-follow-an-increment-to-merge.mp3) · [Transcript](script.md)

## Why this video exists

It is the video of journey 13: an increment's page shows red recorded before implementation, or tests that passed
first flagged (L2-021 AC3); each iteration against the cap, and Blocked after ten with its failing tests while
Hewn moves on (L2-022 AC2); the pull request link and live required checks (L2-024 AC3); and the squash-merge
when every check passes, a failed check counting as a failed iteration (L2-025). Checks reach Hewn by a signed
webhook or a poll after 60 seconds of silence, and unsigned or invalid webhooks get 401 and are logged (L2-037).

## Learning objectives

By the end, the viewer can:

- say what the worker reports at each step of stage 10, and where the API stores it;
- explain the three ways a check reaches Hewn and why each goes through one recorder;
- describe how the webhook signature is verified, and what a refusal logs;
- follow a real increment from red to merge in Mission Control, and find a blocked one's failing tests.

## Key questions

| Question | What a strong answer includes |
|---|---|
| How does the page know the iteration? | The worker reports `{InProgress, iterations}` as each iteration starts; `IncrementChanged` makes the page read the increment again. |
| Where do checks live? | `increment_checks`, one row per check per pull request; `CheckRecorder` appends `CheckChanged` only for a row that changed. |
| What makes a webhook valid? | `X-Hub-Signature-256` equal to `sha256=` and the hex HMAC-SHA256 of the raw body with `HEWN_GITHUB_WEBHOOK_SECRET`, compared in constant time. |
| When does the poller read a pull request? | When it is in progress and nothing (webhook, worker read or poll) has reported its checks for 60 seconds. |
| What does a blocked increment show? | Blocked after 10 iterations, "k of m failing: …", and the increment Hewn moved on to, or that every one left depends on it. |

## Code / assets on screen

| File | What to show |
|---|---|
| `worker/src/executors/increment-executor.ts` | Red with the test count, each iteration, the video, the pull request number |
| `backend/src/Hewn.Application/Pipeline/CheckRecorder.cs` | Changed checks only, `CheckChanged`, save then publish |
| `backend/src/Hewn.Application/Pipeline/WebhookSignature.cs` | The signature checks and the constant-time compare |
| `backend/src/Hewn.Api/Controllers/GitHubWebhookController.cs` | 401 `webhook_signature_invalid`, and what is logged |
| `frontend/projects/mission-control/src/app/pages/increment/increment-view.ts` | Red recorded, green first, Blocked |
| `frontend/projects/mission-control/src/app/pages/increment/increment.page.html`, `increment.page.ts` | The live checks list; reading again after each event |
| `backend/tests/Hewn.Api.Tests/Increments/FollowAnIncrementTests.cs` | The first failing test |
| `e2e/tests/pipeline/follow-an-increment-live.spec.ts` | Checks turning green live; signed and unsigned webhooks |
| `sequence-open-checks-merge`, `sequence-poll-when-silent` | The open-and-merge design's diagrams |
| `screens/*.png`, `clips/*.mp4` | Mission Control with real workers running the stage executors, captured by `clips/clips.mjs` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:28 | Introduction | What journey 13 is |
| 00:28-01:14 | Goal | Red, iterations, Blocked, live checks, merge; the flow diagram |
| 01:14-01:47 | Progress | What the worker reports at each step |
| 01:47-02:11 | Checks | Stored checks and `CheckChanged` |
| 02:11-02:40 | Webhook | The signature and the 401 |
| 02:40-03:01 | Poller | 60 seconds of silence |
| 03:01-03:46 | Increment page | Timeline, Blocked, checks and body |
| 03:46-04:47 | Tests | 214 backend, 144 worker, 8 view, 19 new e2e |
| 04:47-05:26 | Screens | Kiln Booking live to merge; dark and phone; Parcel Post blocked |
| 05:27-05:53 | Recap | Four points and what comes next |

## Demo commands

```sh
pwsh eng/Start-E2eApi.ps1                       # a fresh database, so no other directions are queued
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
node docs/videos/13-follow-an-increment-to-merge/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/13-follow-an-increment-to-merge
node tools/video-build/build-video.mjs docs/videos/13-follow-an-increment-to-merge --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- The fake CI finishes checks at once unless paced: the capture sets `PUT /api/fakes/github/check-seconds` to 3
  and back to 0 when it is done.
- The capture uses the real stage executors against the fakes, which report no model usage, so spend reads $0.00.
- The video step's note is the folder the worker recorded into, `docs/videos/{slug}/`.
- Parcel Post's blocked direction is cancelled at the end, so no later run picks it up.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [Journey 13 prompt](../../prompts/13-follow-an-increment-to-merge.md), [docs/specs/L2.md](../../specs/L2.md)
- [Write tests first](../../detailed-designs/increments/write-tests-first/README.md),
  [Implement until green](../../detailed-designs/increments/implement-until-green/README.md),
  [Open and merge the pull request](../../detailed-designs/increments/open-and-merge-pull-request/README.md)
- [ADR 0017](../../adr/0017-checks-arrive-by-signed-webhook-or-a-poll-after-silence.md)
