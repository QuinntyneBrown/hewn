# 04 · Limit spending

> **Runtime:** ~4:48 · **Audience:** Owners, Viewers, Hewn contributors and reviewers · **Prerequisites:** [03 · Monitor a direction](../03-monitor-a-direction/README.md)

**Video:** [04-limit-spending.mp4](04-limit-spending.mp4) · [Slides](slides.html) · **Audio:** [04-limit-spending.mp3](04-limit-spending.mp3) · [Transcript](script.md)

## Why this video exists

It is the video of journey 4: Hewn records every model call's tokens, model and cost against its run, stage,
direction and project, and shows spend live (L2-052). Every direction has a budget, defaulting to what an Owner
sets in Settings; at 80% a warning is pushed and shown on the project, and at 100% the direction pauses with
"Budget reached" after the current call (L2-053 AC1-AC3).

## Learning objectives

By the end, the viewer can:

- trace a model call from the worker's report to its cost, the `SpendUpdated` event and the header meter;
- explain how an unknown model is priced and why the worker never sends a cost;
- describe what Stop pauses, what it keeps, and why a direction can end one call over its budget.

## Key questions

| Question | What a strong answer includes |
|---|---|
| Who works out a call's cost? | The API, from the configured price table; the worker reports only model and tokens. |
| Why can't a retried report count twice? | Each call carries a call id, unique per run; the API ignores a repeat. |
| What happens at 100%? | The run, stage, direction and project turn Paused with "Budget reached", the lease is released and the checkpoint kept. |

## Code / assets on screen

| File | What to show |
|---|---|
| `worker/src/work-loop.ts` | Reporting a call under a fresh call id; Warn and Stop |
| `backend/src/Hewn.Application/Spend/PriceTable.cs` | Pricing a call; an unknown model at the highest rates |
| `backend/src/Hewn.Domain/Direction.cs` | `RecordSpend`: warn once at 80%, stop at 100% |
| `backend/src/Hewn.Application/Pipeline/PipelineOrchestrator.cs` | `OnBudgetReachedAsync` pausing everything |
| `frontend/projects/api/src/lib/projects/apply-event.ts` | `SpendUpdated` moving the meter |
| `worker/test/spend.spec.ts` | The run ending right after the call that reaches the budget |
| `screens/*.png`, `clips/*.mp4` | Mission Control with a real worker, captured by `clips/clips.mjs` |
| `sequence-meter-and-stop` | The spend-and-budgets design's diagram |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:20 | Introduction | What journey 4 is |
| 00:20-00:55 | Goal | Tokens, model and cost per call; the budget, 80% and 100% |
| 00:55-01:31 | Meter | Where usage is recorded and how the threshold check runs; the worker's report |
| 01:31-01:53 | Prices | The configured price table; unknown models at the highest rates |
| 01:53-02:23 | Budget | Warn once at 80%, stop at 100%; what Stop pauses and keeps |
| 02:23-02:56 | Page | The spend meter, the warning toast, Budget reached, Settings |
| 02:56-03:40 | Tests | 163 backend, 130 worker, 45 frontend, 45 e2e; the sequence race |
| 03:40-04:25 | Screens | Settings with one error, spend climbing to the pause, dark and phone, a Viewer |
| 04:25-04:48 | Recap | Three points and what comes next |

## Demo commands

```sh
pwsh eng/Start-E2eApi.ps1
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
node docs/videos/04-limit-spending/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/04-limit-spending
node tools/video-build/build-video.mjs docs/videos/04-limit-spending --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- The spend clip's worker uses the scripted executor with `modelCalls: 10, callTokens: 100_000`: every call is
  100,000 input and 10,000 output tokens on `claude-opus-5-5`, $0.60, so a $10 budget warns on call 14 and pauses on
  call 17.
- The default budget is shared by every test and clip on the e2e database; `clips.mjs` and the e2e specs put it
  back to $300 when they finish.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [Journey 4 prompt](../../prompts/04-limit-spending.md), [docs/specs/L2.md](../../specs/L2.md),
  [ADR 0010](../../adr/0010-spend-is-metered-per-call-against-a-configured-price-table.md)
- [Spend and budgets](../../detailed-designs/governance/spend-and-budgets/README.md)
