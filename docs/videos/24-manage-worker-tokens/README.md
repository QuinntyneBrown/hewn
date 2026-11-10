# 24 · Manage worker tokens

> **Runtime:** ~5:29 · **Audience:** Owners, operators, Hewn contributors and reviewers · **Prerequisites:** [23 · Run workers locally or in the cloud](../23-run-workers-locally-or-in-cloud/README.md)

**Video:** [24-manage-worker-tokens.mp4](24-manage-worker-tokens.mp4) · [Slides](slides.html) · **Audio:** [24-manage-worker-tokens.mp3](24-manage-worker-tokens.mp3) · [Transcript](script.md)

## Why this video exists

This is the video for journey 24. An Owner creates a worker token that is shown once while Hewn keeps only its
hash (L2-041 AC1). It expires in 30 days, 90 days or a year, as the Owner chose (AC3). Revoking it while its worker
is connected disconnects that worker within 10 seconds and releases its lease (AC2). The recording measured the
row leaving Workers in 35 ms, the container exiting with code 3 in under 0.3 s, and the run resuming on a standby
worker straight away (`screens/records.json`).

## Learning objectives

By the end, the viewer can:

- create a worker token, copy it and start a worker with it;
- say what Hewn stores for a token, and show that no API response carries it;
- revoke a worker and explain how the revocation reaches it while it is running a step
  ([ADR 0026](../../adr/0026-worker-tokens-are-hashed-and-revoked-through-the-control-poll.md));
- explain what the configured `HEWN_WORKER_TOKEN` is still for.

## Key questions

| Question | What a strong answer includes |
|---|---|
| What does Hewn store for a token? | Its hex SHA-256, with a unique index, plus the name, location, creator and expiry. The token is answered once, under `Cache-Control: no-store`. |
| Why `hwt_`? | It marks a leaked token for secret scanners, and tells an issued token from the configured one without a lookup. |
| How does a revocation reach a worker mid-step? | Its held control poll (or its next heartbeat) is refused with 401. The worker aborts the step and exits with code 3. |
| What happens to the run? | It is halted and released at its checkpoint, with a log line naming the worker, and the next worker leases it. |
| Can a Viewer do any of this? | No: neither control shows, and both endpoints answer 403. |

## Code / assets on screen

| File | What to show |
|---|---|
| `backend/src/Hewn.Application/Workers/WorkerTokens.cs` | `WorkerTokenHash`, create, revoke and release |
| `backend/src/Hewn.Api/Auth/WorkerTokenAuthentication.cs` | Lookup by hash; 401 for revoked or expired |
| `backend/src/Hewn.Application/Pipeline/WorkerCommands.cs` | A token names its worker |
| `worker/src/work-loop.ts`, `worker/src/main.ts` | The refused token aborts the step; exit code 3 |
| `sequence-create-and-revoke` | The worker-tokens design's diagram |
| `backend/tests/…/Workers/WorkerTokenTests.cs`, `worker/test/revoke.spec.ts`, `e2e/tests/pipeline/manage-worker-tokens.spec.ts` | Red then green |
| `screens/*.png`, `clips/*.mp4` | Captured by `clips/clips.mjs` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:19 | Introduction | What journey 24 is |
| 00:19-00:41 | Goal | L2-041 AC1-AC3 |
| 00:41-01:16 | Creating a token | The dialog; shown once; Copy; only Done closes it |
| 01:16-02:10 | What Hewn keeps | How a token is made; the stored row; the check by hash |
| 02:10-02:40 | A worker on the token | `docker run`; registers under the token's name; leases a direction |
| 02:40-03:40 | Revoking | Owner and Viewer; the confirmation; revoke and release; measured |
| 03:40-04:11 | The worker stops | 401 aborts the step; exit code 3; the sequence |
| 04:11-05:02 | Tests | 294 backend, 155 worker, 4 e2e, visual and a11y |
| 05:02-05:07 | Screens | Dark and phone |
| 05:07-05:29 | Recap | Three points and what comes next |

## Demo commands

```sh
docker build -t hewn-worker:dev worker
pwsh eng/Start-E2eApi.ps1
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json && cd ..
node docs/videos/24-manage-worker-tokens/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/24-manage-worker-tokens
node tools/video-build/build-video.mjs docs/videos/24-manage-worker-tokens --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- Record on a fresh e2e stack. A shared database has directions earlier tests left queued, and the Docker worker
  leases those before the clip's direction.
- The dialog's command uses the address Mission Control is served from. From inside Docker the e2e API is
  `host.docker.internal:5300`, which needs Docker Desktop, or `--add-host host.docker.internal:host-gateway` on
  Linux.

- The token on screen was issued by the throwaway e2e stack and revoked in the same recording; it never worked
  anywhere else.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [Journey 24 prompt](../../prompts/24-manage-worker-tokens.md), [docs/specs/L2.md](../../specs/L2.md)
- [Worker tokens](../../detailed-designs/security/worker-tokens/README.md)
- [ADR 0026](../../adr/0026-worker-tokens-are-hashed-and-revoked-through-the-control-poll.md)
