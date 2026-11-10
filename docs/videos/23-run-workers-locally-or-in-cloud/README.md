# 23 · Run workers locally or in the cloud

> **Runtime:** ~5:06 · **Audience:** Owners, operators, Hewn contributors and reviewers · **Prerequisites:** [22 · Connect a GitHub repository](../22-connect-a-github-repository/README.md)

**Video:** [23-run-workers-locally-or-in-cloud.mp4](23-run-workers-locally-or-in-cloud.mp4) · [Slides](slides.html) · **Audio:** [23-run-workers-locally-or-in-cloud.mp3](23-run-workers-locally-or-in-cloud.mp3) · [Transcript](script.md)

## Why this video exists

This is the video for journey 23. One worker image runs on a developer machine with Docker or in the cloud, and
configuration is the only difference (L2-027 AC1). A worker appears in Workers within 2 seconds (L2-026 AC1). An
idle worker is pushed new work at once and heartbeats while it runs (AC2, AC5). Each run has its own egress proxy,
tool gates and command sandbox, and every blocked request or denied tool is logged (L2-042 AC1-AC3).

## Learning objectives

By the end, the viewer can:

- start a Local and a Cloud worker from the same image;
- explain how a held lease request lets the API push work to an idle worker;
- name the hosts a run may reach and what happens to any other request;
- explain how a stage's tool allow list is enforced, and where its refusals show up
  ([ADR 0025](../../adr/0025-runs-are-isolated-in-the-worker-by-a-proxy-and-tool-gates.md)).

## Key questions

| Question | What a strong answer includes |
|---|---|
| What differs between a Local and a Cloud worker? | Only environment variables: `HEWN_LOCATION`, `HEWN_API_URL`, `HEWN_WORKER_TOKEN`, `HEWN_WORKER_NAME`. It is the same image, and it opens no port. |
| How is an idle worker pushed work? | `POST /api/worker/lease?waitSeconds=20` is held for up to 30 s. Every stored event pulses `WorkSignal`, so a queued run is leased at once. |
| Why isn't GitHub on the egress allow list? | A run downloads and commits through the Hewn API, which holds every GitHub credential. Nothing in a run needs GitHub. |
| What stops a command ignoring `HTTPS_PROXY`? | Under `HEWN_SANDBOX=docker`, its container is on an internal network whose only peer is the worker's proxy. |

## Code / assets on screen

| File | What to show |
|---|---|
| `worker/Dockerfile` | The one image |
| `backend/src/Hewn.Application/Pipeline/WorkerCommands.cs`, `frontend/…/layout/shell.ts` | `WorkersChanged` on register; the shell reads Workers again |
| `backend/src/Hewn.Application/Pipeline/WorkSignal.cs` | The held lease |
| `worker/src/isolation/*.ts`, `worker/src/work-loop.ts` | Proxy, tool gate, sandbox, started per run |
| `sequence-register-and-lease`, `sequence-contain-a-run` | The worker-loop and agent-isolation designs' diagrams |
| `backend/tests/…/Workers/WorkersLiveTests.cs`, `worker/test/isolation.spec.ts`, `e2e/tests/pipeline/run-workers-locally-or-in-cloud.spec.ts` | Red then green |
| `screens/*.png`, `clips/*.mp4` | Captured by `clips/clips.mjs` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:22 | Introduction | What journey 23 is |
| 00:22-00:45 | Goal | L2-026, L2-027, L2-042 |
| 00:45-01:30 | One image | The Dockerfile; two `docker run`s; Workers updates live |
| 01:30-01:55 | Showing up at once | `WorkersChanged` |
| 01:55-02:45 | The work loop | The sequence; the held lease; a run leased and heartbeating |
| 02:45-04:00 | Isolation | Proxy, tool gate, sandbox; the sequence; the refusals in the log |
| 04:00-04:45 | Tests | 282 backend, 152 worker, 3 new e2e |
| 04:45-04:52 | Screens | Dark and phone |
| 04:52-05:06 | Recap | Three points and what comes next |

## Demo commands

```sh
docker build -t hewn-worker:dev worker
pwsh eng/Start-E2eApi.ps1
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json && cd ..
node docs/videos/23-run-workers-locally-or-in-cloud/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/23-run-workers-locally-or-in-cloud
node tools/video-build/build-video.mjs docs/videos/23-run-workers-locally-or-in-cloud --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- A container reaches the e2e API at `host.docker.internal:5300`. That needs Docker Desktop, or
  `--add-host host.docker.internal:host-gateway` on Linux.
- The e2e database is shared, so Workers also lists offline workers from earlier test runs. A Docker worker may
  lease a direction an earlier test left queued.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [Journey 23 prompt](../../prompts/23-run-workers-locally-or-in-cloud.md), [docs/specs/L2.md](../../specs/L2.md)
- [Worker loop](../../detailed-designs/agent-runtime/worker-loop/README.md),
  [Agent isolation](../../detailed-designs/agent-runtime/agent-isolation/README.md)
- [ADR 0025](../../adr/0025-runs-are-isolated-in-the-worker-by-a-proxy-and-tool-gates.md)
