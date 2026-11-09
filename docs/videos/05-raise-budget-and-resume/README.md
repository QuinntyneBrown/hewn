# 05 · Raise budget and resume

> **Runtime:** ~4:32 · **Audience:** Owners, Viewers, Hewn contributors and reviewers · **Prerequisites:** [04 · Limit spending](../04-limit-spending/README.md)

**Video:** [05-raise-budget-and-resume.mp4](05-raise-budget-and-resume.mp4) · [Slides](slides.html) · **Audio:** [05-raise-budget-and-resume.mp3](05-raise-budget-and-resume.mp3) · [Transcript](script.md)

## Why this video exists

It is the video of journey 5: on a direction Paused with "Budget reached", an Owner enters a new budget above the
spend so far and presses Raise and resume; the budget is raised and the direction resumes from its next step in one
action (L2-053 AC3). A budget at or below the spend is refused inline, and Viewers see no control and get 403 from
the API (L2-029 AC5).

## Learning objectives

By the end, the viewer can:

- trace Raise and resume from the dialog to the one command, its checks and its single save;
- explain how the paused run resumes from its checkpoint, and what is re-armed;
- name every refusal: below the spend (400), a stale budget or a direction not paused at its budget (409), a
  Viewer (403), another project's direction (404).

## Key questions

| Question | What a strong answer includes |
|---|---|
| Why does the request carry the current budget? | So a second session showing an old budget gets 409 `budget_changed` instead of overwriting a raise. |
| Where does the direction resume? | The same run is queued again with its checkpoint; the next lease carries on after the last completed step. |
| Can the budget be raised while the direction stays paused? | No: `BudgetRaised` and the stage, direction and project turning Running are one save. |

## Code / assets on screen

| File | What to show |
|---|---|
| `backend/src/Hewn.Application/Spend/RaiseAndResume.cs` | The checks, then one save with `BudgetRaised` |
| `backend/src/Hewn.Application/Pipeline/PipelineOrchestrator.cs` | `OnBudgetRaisedAsync` resuming the run, stage, direction and project |
| `frontend/projects/mission-control/src/app/pages/project/raise-budget.dialog.ts` | Checking the amount, sending the budget it was opened with |
| `e2e/tests/pipeline/raise-and-resume.spec.ts` | The Viewer: no control, 403 from the API |
| `backend/tests/Hewn.Api.Tests/Spend/RaiseAndResumeTests.cs` | The first failing test |
| `screens/*.png`, `clips/*.mp4` | Mission Control with a real worker, captured by `clips/clips.mjs` |
| `sequence-raise-and-resume` | The spend-and-budgets design's diagram |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:21 | Introduction | What journey 5 is |
| 00:21-00:49 | Goal | Raise and resume in one action; refusals; Viewers |
| 00:49-01:41 | Command | The exchange; the checks; one save |
| 01:41-02:02 | Resume | The same run from its checkpoint; the warning re-armed |
| 02:02-02:29 | Dialog | CDK Dialog; the failed state; the phone sheet |
| 02:29-02:44 | Viewer | No control; 403 from the API |
| 02:44-03:27 | Tests | 170 backend, 130 worker, 53 frontend, 46 e2e |
| 03:27-04:05 | Screens | $10 refused, $20 resumes, spend climbs to the next pause; dark |
| 04:05-04:32 | Recap | Three points and what comes next |

## Demo commands

```sh
pwsh eng/Start-E2eApi.ps1
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
node docs/videos/05-raise-budget-and-resume/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/05-raise-budget-and-resume
node tools/video-build/build-video.mjs docs/videos/05-raise-budget-and-resume --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- The worker uses the scripted executor with `modelCalls: 10, callTokens: 100_000`: $0.60 a call, so a $10 budget
  pauses at $10.20 in Idea, and $20 pauses again at $20.40 in Designs.
- The failed-state screen comes from a second Owner session that opened the dialog before the clip raised the
  budget; its confirm then gets 409 `budget_changed`.
- The first time a dev server serves the dialog, Vite optimises `@angular/cdk/dialog` and reloads the page; run the
  capture again if it stopped there.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [Journey 5 prompt](../../prompts/05-raise-budget-and-resume.md), [docs/specs/L2.md](../../specs/L2.md)
- [Spend and budgets](../../detailed-designs/governance/spend-and-budgets/README.md)
