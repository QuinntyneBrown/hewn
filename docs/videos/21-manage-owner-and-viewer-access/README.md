# 21 · Manage Owner and Viewer access

> **Runtime:** ~4:07 · **Audience:** Owners, Viewers, Hewn contributors and reviewers · **Prerequisites:** [20 · Sign in and sign out](../20-sign-in-and-sign-out/README.md)

**Video:** [21-manage-owner-and-viewer-access.mp4](21-manage-owner-and-viewer-access.mp4) · [Slides](slides.html) · **Audio:** [21-manage-owner-and-viewer-access.mp3](21-manage-owner-and-viewer-access.mp3) · [Transcript](script.md)

## Why this video exists

This is the video for journey 21. In Settings, "Who can sign in" lists each GitHub login with its role and last
sign-in. An Owner adds a login as Owner or Viewer, once GitHub confirms it exists, and removes any login but their own.
Viewers see the list read-only (L2-038 AC5). A removed login is signed out on its next request. A Viewer gets 403 from
every state-changing endpoint (L2-039 AC1), and a project the user can't see is not found (AC2).

## Learning objectives

By the end, the viewer can:

- add and remove a login, and say what the dialog shows when it can't;
- explain why a removed login's session ends at once ([ADR 0023](../../adr/0023-allow-list-changes-apply-on-the-next-request.md));
- say what keeps a Viewer read-only beyond the hidden buttons;
- name the two tests that make every new endpoint follow the rules.

## Key questions

| Question | What a strong answer includes |
|---|---|
| What happens when GitHub can't confirm a login? | 502 `github_failed`, nothing added; the dialog says "@x wasn't added" and why. |
| How does removing a login end its session? | Every request asks `IsSessionValidQuery`: not signed out, and still listed with the same role. `AllowListAccess` holds roles in memory, so it costs no database read. |
| Can an Owner lock everyone out? | No: removing yourself is 409 `cannot_remove_yourself`, and your row has no Remove. |
| What stops a new endpoint skipping the rules? | `ViewerAuthorizationTests` sends every state-changing route as a Viewer (403); `ProjectVisibilityTests` asks every project route for an unseen project (404 `not_found`). |

## Code / assets on screen

| File | What to show |
|---|---|
| `backend/src/Hewn.Application/Auth/AllowList.cs` | Adding, removing, and checking a session |
| `frontend/…/pages/settings/allow-list.ts`, `frontend/…/layout/shell.ts` | Remove for Owners only; Audit hidden from Viewers |
| `screens/answers.json` | What the API answered a Viewer, a removed login and an unseen project |
| `backend/tests/Hewn.Api.Tests/Session/ManageAllowListTests.cs`, `ViewerAuthorizationTests.cs` | Red then green; every change as a Viewer |
| `sequence-manage-allow-list` | The sign-in-and-access design's diagram |
| `screens/*.png`, `clips/*.mp4` | Captured by `clips/clips.mjs` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:25 | Introduction | What journey 21 is |
| 00:25-00:46 | Goal | L2-038 AC5, L2-039 AC1 and AC2 |
| 00:46-01:41 | The allow list | The sequence; adding; checking sessions; ADR 0023 |
| 01:41-02:08 | Viewers read only | Owner-only controls; what the API answers |
| 02:08-02:20 | Not found | The page and the API's 404 |
| 02:20-03:11 | Tests | Red first; every endpoint; 276 backend, 3 view, 15 new e2e |
| 03:11-03:42 | Screens | Add a Viewer; she signs in read-only; remove her; dialog states; dark and phone |
| 03:42-04:07 | Recap | Three points and what comes next |

## Demo commands

```sh
pwsh eng/Start-E2eApi.ps1        # a fresh stack: the capture adds nadia-k
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json && cd ..
node docs/videos/21-manage-owner-and-viewer-access/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/21-manage-owner-and-viewer-access
node tools/video-build/build-video.mjs docs/videos/21-manage-owner-and-viewer-access --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- Start the API fresh before capturing: nadia-k must not be on the list yet, or adding her is an inline error.
- The fake GitHub treats `missing-*` as no such account and `rate-limited` as GitHub failing.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [Journey 21 prompt](../../prompts/21-manage-owner-and-viewer-access.md), [docs/specs/L2.md](../../specs/L2.md)
- [Sign-in and access control](../../detailed-designs/security/sign-in-and-access/README.md)
- [ADR 0023](../../adr/0023-allow-list-changes-apply-on-the-next-request.md)
