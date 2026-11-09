# 01 · Build a new product, part six: the scaffold

> **Runtime:** ~3:11 · **Audience:** Hewn contributors and reviewers · **Prerequisites:** [part five](../01-build-a-new-product-part-5/README.md)

**Video:** [01-build-a-new-product-part-6.mp4](01-build-a-new-product-part-6.mp4) · [Slides](slides.html) · **Audio:** [01-build-a-new-product-part-6.mp3](01-build-a-new-product-part-6.mp3) · [Transcript](script.md)

## Why this video exists

It documents the sixth pull request of journey 1: stage 6 generates the scaffold for the chosen stack, merges it
through a pull request once CI passes (L2-015) and requires the CI checks on the default branch (L2-036 AC2).

## Learning objectives

By the end, the viewer can:

- list what the default template generates and which checks it makes required;
- explain how stage 6 survives a resume without opening a second pull request;
- say how Hewn proves the template builds.

## Key questions

| Question | What a strong answer includes |
|---|---|
| What if CI fails on the scaffold? | The run fails naming the failed checks; nothing is merged or protected. |
| Which branch does stage 6 write? | Only `hewn/scaffold`; the API refuses anything else, and refuses pull requests to every other stage. |
| How do we know the scaffold builds? | The `Scaffold template` CI job generates it and runs its own CI commands on every change. |

## Code / assets on screen

| File | What to show |
|---|---|
| `worker/src/scaffold/dotnet-angular-template.ts` | The default template |
| `worker/src/executors/scaffold-executor.ts` | Steps, keys and the check waiter |
| `backend/src/Hewn.Application/Pipeline/PullRequestCommands.cs` | Stage 6 only mutations |
| `screens/*.png`, `clips/scaffold.mp4` | The real app with a real worker, captured by `clips/clips.mjs`; `scaffold-app.png` is the generated frontend after `npm run build` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:15 | Introduction | What part six adds |
| 00:15-00:45 | What we built | Template; four steps |
| 00:45-01:20 | Design | Stage 6 only mutations; keys |
| 01:20-02:00 | Code | Check waiter; the template CI job |
| 02:00-02:22 | Tests | Backend, worker, scaffold CI |
| 02:22-02:58 | Screens | The direction runs; the generated app |
| 02:58-03:11 | Recap | Three points and what comes next |

## Demo commands

```sh
pwsh eng/Start-E2eApi.ps1
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json
node docs/videos/01-build-a-new-product-part-6/clips/clips.mjs
node worker/src/scaffold/generate-cli.ts /tmp/scaffold   # then build it like its CI does
node tools/video-audio/generate-audio.mjs docs/videos/01-build-a-new-product-part-6
node tools/video-build/build-video.mjs docs/videos/01-build-a-new-product-part-6 --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- The fake GitHub reports one passing check per workflow job instantly; use `FailCheck` in tests to fail one.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [L2-015 and L2-036 in docs/specs/L2.md](../../specs/L2.md)
- [Scaffold the solution](../../detailed-designs/stages/scaffold-solution/README.md) design
