# 20 · Sign in and sign out

> **Runtime:** ~4:40 · **Audience:** Owners, Viewers, Hewn contributors and reviewers · **Prerequisites:** [19 · Watch an increment demonstration](../19-watch-an-increment-demonstration/README.md)

**Video:** [20-sign-in-and-sign-out.mp4](20-sign-in-and-sign-out.mp4) · [Slides](slides.html) · **Audio:** [20-sign-in-and-sign-out.mp3](20-sign-in-and-sign-out.mp3) · [Transcript](script.md)

## Why this video exists

This is the video for journey 20. Mission Control signs in with GitHub, and only logins on the allow list get in
(L2-038 AC1, AC2). A session is an 8 hour HttpOnly, Secure, SameSite=Lax cookie that ends on sign-out, even if
replayed (AC3, AC4). The API now serves Mission Control's pages, each with a strict Content-Security-Policy and
`nosniff` (L2-043 AC2).

## Learning objectives

By the end, the viewer can:

- follow a sign-in from a signed-out page through GitHub and back, and name each way it can end;
- explain how sign-out makes a replayed cookie useless ([ADR 0022](../../adr/0022-the-api-serves-mission-control-and-ends-sessions-by-id.md));
- say what the app does when a session ends while it is open;
- read the page's CSP and say why one script hash is allowed.

## Key questions

| Question | What a strong answer includes |
|---|---|
| How is the GitHub callback protected? | A one-time state in a protected, 10 minute `hewn.oauth` cookie, compared in constant time; a forged or missing state goes to `/sign-in?error=github`. |
| What does a refused login see? | `/sign-in?error=denied&login=…`: "This account doesn't have access", who to ask, and no session cookie. |
| Why can't a signed-out cookie be replayed? | The cookie carries a `hewn:sid`; sign-out stores it in `revoked_sessions`, and `OnValidatePrincipal` refuses it from the in-memory set. |
| Why `'unsafe-hashes'`? | Angular's build loads its stylesheet with `onload="this.media='all'"`; the policy allows that handler by hash and no other inline script. |

## Code / assets on screen

| File | What to show |
|---|---|
| `backend/src/Hewn.Api/Controllers/AuthController.cs` | The callback's outcomes |
| `frontend/projects/mission-control/src/app/pages/sign-in/sign-in-view.ts` | The sign-in states from the address |
| `backend/src/Hewn.Api/Auth/AuthSetup.cs`, `frontend/…/core/session-expiry.ts` | Refusing revoked sessions; a 401 reloads at sign-in |
| `backend/src/Hewn.Api/MissionControl/MissionControlPages.cs`, `screens/headers.txt` | The headers and the policy; the API's answer |
| `backend/tests/Hewn.Api.Tests/Session/SignInWithGitHubTests.cs`, `e2e/tests/behavior/sign-in-and-sign-out.spec.ts` | Red then green; the GitHub round trip |
| `sequence-sign-in`, `sequence-sign-out` | The sign-in-and-access design's diagrams |
| `screens/*.png`, `clips/*.mp4` | The API serving the built app, captured by `clips/clips.mjs` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:25 | Introduction | What journey 20 is |
| 00:25-00:48 | Goal | L2-038 AC1-AC4 and L2-043 AC2 |
| 00:48-01:43 | Signing in | The sequence; the callback; the sign-in states |
| 01:43-02:28 | Signing out | The Magic Patterns control; revoked ids; ADR 0022; expiry while open |
| 02:28-03:05 | Page protections | Headers; the stylesheet hash; the API's answer |
| 03:05-03:46 | Tests | 261 backend, 4 view, 18 new e2e |
| 03:46-04:15 | Screens | Through GitHub and back, then Sign out; refused; failed and expired; dark and phone |
| 04:15-04:40 | Recap | Four points and what comes next |

## Demo commands

```sh
cd frontend && npx ng build mission-control && cd ..
Hewn__MissionControl__Root=$PWD/frontend/dist/mission-control/browser Hewn__Auth__PublicOrigin=http://localhost:5300 \
  pwsh eng/Start-E2eApi.ps1
node docs/videos/20-sign-in-and-sign-out/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/20-sign-in-and-sign-out
node tools/video-build/build-video.mjs docs/videos/20-sign-in-and-sign-out --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- The capture runs against the API on 5300, not `ng serve`, so the page carries the real headers; set
  `Hewn__Auth__PublicOrigin` to that origin, or GitHub's callback goes back to 4300.
- The e2e stack's GitHub is a fake authorize page that signs in as whatever login is typed.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [Journey 20 prompt](../../prompts/20-sign-in-and-sign-out.md), [docs/specs/L2.md](../../specs/L2.md)
- [Sign-in and access control](../../detailed-designs/security/sign-in-and-access/README.md),
  [Input validation and web protections](../../detailed-designs/security/web-protections/README.md)
- [ADR 0022](../../adr/0022-the-api-serves-mission-control-and-ends-sessions-by-id.md)
