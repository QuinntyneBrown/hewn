# 36 · Diagnose platform health

> **Runtime:** ~6:46 · **Audience:** Operators and Hewn contributors · **Prerequisites:** [35 · Choose a theme](../35-choose-a-theme/README.md)

**Video:** [36-diagnose-platform-health.mp4](36-diagnose-platform-health.mp4) · [Slides](slides.html) · **Audio:** [36-diagnose-platform-health.mp3](36-diagnose-platform-health.mp3) · [Transcript](script.md)

## Why this video exists

This is the video for journey 36 (L2-049 AC1-AC3, L2-051 AC1-AC2). It has no Mission Control screens, because the
journey adds none. Everything on screen comes from a real API and scripted worker run with `-Observability`
against Jaeger and Prometheus from `eng/observability/compose.yaml`. `/health/live` and `/health/ready` are shown
with the SQLite file in place, moved away (ready 503, database Unhealthy) and back. One run's log lines from the
worker and the API carry the same IDs and trace ID. Jaeger shows the direction as one trace: the submit request,
each run queued, leased and run, a model call's tags, and 33 worker and 155 API spans. Then the `/metrics` scrape
(401 without the token) and Prometheus's view of it. The outputs are in `screens/records.json`.

The scripted worker's model calls are reported, not made, so their spans last only as long as the report.

## Learning objectives

By the end, the viewer can:

- say what `/health/live` and `/health/ready` check, and what each answers when the database is gone;
- follow a run from its log lines to its trace, and explain how the trace crosses the queue into the worker;
- name the exported metrics and how a scraper is let in.

## Key questions

| Question | What a strong answer includes |
|---|---|
| Why does live stay 200 with the database gone? | It runs no checks: a slow dependency must not make an orchestrator restart a working process. |
| How does ready know SQLite is gone? | A new unpooled connection in read-write mode, which never creates the file, then `SELECT 1` (ADR 0035). |
| How does the trace reach the worker? | The run stores the queuing request's traceparent; the lease returns the "Run queued" span's; the worker sends `traceparent` on every call. |
| Why is a direction one trace? | Each next stage is queued inside the previous stage's result request. |
| Who can scrape `/metrics`? | A caller with `HEWN_METRICS_TOKEN` as a bearer token; with none configured there is no endpoint (ADR 0036). |

## Code / assets on screen

| File | What to show |
|---|---|
| `backend/src/Hewn.Api/Health/HealthEndpoints.cs` | The database and backplane checks |
| `backend/src/Hewn.Api/Logging/JsonLogging.cs` | The JSON entry with trace IDs and scope fields |
| `backend/src/Hewn.Application/Pipeline/RunTracing.cs`, `worker/src/work-loop.ts`, `worker/src/http-api.ts` | The queued span, the run span, `traceparent` on calls |
| `backend/src/Hewn.Application/Common/HewnMetrics.cs` | Where each metric is recorded |
| `eng/observability/compose.yaml`, `eng/Start-Api.ps1` | The local stack and the `-Observability` switch |
| `sequence-trace-a-run`, `c4-component`, `sequence-health` | The observability design's redrawn diagrams |
| `Operations/*Tests.cs`, `worker/test/structured-log.spec.ts`, `worker/test/run-trace.spec.ts` | Red then green |
| `screens/*.png`, `clips/trace.mp4`, `screens/records.json` | Captured by `clips/clips.mjs` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:24 | Introduction | Jaeger and Prometheus |
| 00:24-01:01 | Goal | L2-051, L2-049 |
| 01:01-01:59 | Health | Up, database moved away, back; the two checks |
| 01:59-02:44 | Logs | One run's lines from both sides; the JSON logger |
| 02:44-03:49 | Traces | The trace in Jaeger; queued span, worker spans, sequence |
| 03:49-04:39 | Metrics | The scrape, Prometheus, the meter |
| 04:39-05:01 | Local stack | Compose, `-Observability`, components |
| 05:01-06:21 | Tests | Health, logs, trace, metrics; totals |
| 06:21-06:46 | Recap | Three points and what comes next |

## Demo commands

```sh
pwsh eng/Start-Observability.ps1
export HEWN_WORKER_TOKEN=local-worker-token-not-a-secret HEWN_ALLOWED_GITHUB_USERS=quinntynebrown:Owner Hewn__Fakes__Enabled=true
pwsh eng/Start-Api.ps1 -Database obs-video.db -DevSignIn -Observability > api.log
ConnectionStrings__Hewn=DataSource=backend/obs-video.db dotnet run --project backend/src/Hewn.Cli -- seed
HEWN_SCRIPTED_MODEL_CALLS=2 HEWN_SCRIPTED_LOG_LINES=3 HEWN_SCRIPTED_CALL_TOKENS=12000 pwsh eng/Start-Worker.ps1 -StepMs 600 -Observability > worker.log
HEWN_DB_FILE=backend/obs-video.db API_LOG=api.log WORKER_LOG=worker.log node docs/videos/36-diagnose-platform-health/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/36-diagnose-platform-health
node tools/video-build/build-video.mjs docs/videos/36-diagnose-platform-health --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- Colima shares only the home directory, so nothing in the Compose file is bind-mounted; Prometheus's config is inline.
- Jaeger draws the span list virtualized and deeply indented (each stage nests under the last one's result), so the
  clip shows the first stage and then the Trace Statistics view rather than scrolling.
- Project names are unique: each rerun of `clips.mjs` takes the next free "Seed Swap" name.
- The clip is paced to the narration with `at(seconds)`; re-time it from `.cache/36-diagnose-platform-health/captions.srt`
  if the script changes.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [Journey 36 prompt](../../prompts/36-diagnose-platform-health.md), [docs/specs/L2.md](../../specs/L2.md)
- [Observability and health checks design](../../detailed-designs/operations/observability-and-health/README.md)
- [ADR 0035](../../adr/0035-readiness-sends-through-the-backplane.md), [ADR 0036](../../adr/0036-telemetry-goes-to-otlp-and-a-token-guarded-scrape.md)
