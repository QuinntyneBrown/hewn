# 22 · Connect a GitHub repository

> **Runtime:** ~4:19 · **Audience:** Owners, Hewn contributors and reviewers · **Prerequisites:** [21 · Manage Owner and Viewer access](../21-manage-owner-and-viewer-access/README.md)

**Video:** [22-connect-a-github-repository.mp4](22-connect-a-github-repository.mp4) · [Slides](slides.html) · **Audio:** [22-connect-a-github-repository.mp3](22-connect-a-github-repository.mp3) · [Transcript](script.md)

## Why this video exists

This is the video for journey 22. An Owner names an existing repository, which must be a GitHub URL Hewn can write
to (L2-001 AC4), or leaves it empty. In that case stage 0 creates a private repository named in kebab case
(L2-036 AC1), and stage 6 makes its default branch require the CI checks (AC2). Every call to GitHub uses an
installation token limited to the project's repository (AC3). The token that creates repositories now asks only to
administer them.

## Learning objectives

By the end, the viewer can:

- say why an existing repository is refused, and what the Owner sees;
- follow stage 0 from the lease to a private, tagged repository, and stage 6 to its protection;
- explain how each token is scoped, and why creating a repository needs a different one ([ADR 0024](../../adr/0024-installation-tokens-are-limited-to-one-repository.md)).

## Key questions

| Question | What a strong answer includes |
|---|---|
| Why is a repository refused? | It isn't a `https://github.com/{owner}/{repo}` URL, GitHub can't find it, or the App can't push to it. The field error says which. |
| What does stage 0 make? | `{owner}/{kebab-name}`, private, tagged `hewn` so a crashed attempt is adopted. |
| How is a token scoped? | `POST app/installations/{id}/access_tokens` with `repositories: [name]`. Creation instead asks for `permissions: {administration: write}`, then tags the new repository with a scoped token. |
| Who protects the branch? | The scaffold executor's `protect_branch` mutation; `ProtectDefaultBranchHandler` fences the lease and refuses it outside stage 6. |

## Code / assets on screen

| File | What to show |
|---|---|
| `backend/src/Hewn.Application/Projects/SubmitProductDirection.cs` | The write-access check at submit |
| `backend/src/Hewn.Infrastructure/GitHub/GitHubAppClient.cs`, `GitHubAppRepositories.cs` | Repository and account tokens; creating a repository |
| `backend/src/Hewn.Application/Pipeline/PullRequestCommands.cs` | Branch protection |
| `backend/tests/Hewn.Api.Tests/GitHub/InstallationTokenScopeTests.cs`, `e2e/tests/pipeline/run-direction.spec.ts` | Red then green; the fake GitHub's record |
| `sequence-provision` | The connect-to-GitHub design's diagram |
| `screens/*`, `clips/*.mp4` | Captured by `clips/clips.mjs` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:28 | Introduction | What journey 22 is |
| 00:28-00:56 | Goal | L2-001 AC4, L2-036 AC1-AC3 |
| 00:56-01:29 | An existing repository | The check; refused, then connected |
| 01:29-02:19 | A new repository | The sequence; stage 0 creates it; the fake GitHub's record |
| 02:19-02:58 | Scoped tokens | Repository tokens; the creation token before and now; ADR 0024 |
| 02:58-03:12 | Protection | The stage 6 mutation |
| 03:12-03:48 | Tests | Red then green; 279 backend; the run pipeline test |
| 03:48-03:53 | Screens | The repository error in dark mode and on a phone |
| 03:53-04:19 | Recap | Three points and what comes next |

## Demo commands

```sh
pwsh eng/Start-E2eApi.ps1        # a fresh stack: the capture names Kiln Scheduler and Handover Desk
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json && cd ..
node docs/videos/22-connect-a-github-repository/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/22-connect-a-github-repository
node tools/video-build/build-video.mjs docs/videos/22-connect-a-github-repository --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- The capture starts three real workers; with 150 ms steps, stage 6 has protected the branch within seconds, so
  `records.json` shows the checks even at its first read.
- `eng/Start-E2eApi.ps1` makes `northwind/handover` not writable and `northwind/missing` absent in the fake GitHub;
  any other repository is writable.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [Journey 22 prompt](../../prompts/22-connect-a-github-repository.md), [docs/specs/L2.md](../../specs/L2.md)
- [Connect to GitHub](../../detailed-designs/source-control/connect-to-github/README.md)
- [ADR 0024](../../adr/0024-installation-tokens-are-limited-to-one-repository.md)
