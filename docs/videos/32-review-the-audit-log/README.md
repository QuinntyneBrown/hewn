# 32 · Review the audit log

> **Runtime:** ~4:28 · **Audience:** Owners and Hewn contributors · **Prerequisites:** [31 · Delete a project](../31-delete-a-project/README.md)

**Video:** [32-review-the-audit-log.mp4](32-review-the-audit-log.mp4) · [Slides](slides.html) · **Audio:** [32-review-the-audit-log.mp3](32-review-the-audit-log.mp3) · [Transcript](script.md)

## Why this video exists

This is the video for journey 32 (L2-044 AC1, AC2). Each audited action (sign-in, direction submission, pause,
resume, cancel, stop all, start workers, worker token creation and revocation, merge) records who, what, when, the
target and the IP, in the same save as the action. Owners open Audit and filter by project and action; Viewers see
the forbidden state. In the recording, Stop all workers and Start workers were the two newest entries, Tidewater's
filter left its resume, pause and direction, and Stop all filtered to Tidewater explained that it is recorded against
All projects. PUT, PATCH, DELETE and POST on `/api/audit` and `/api/audit/1` each answered 404, and `GET /api/audit`
answered the Viewer 403 (`screens/records.json`). The IP in the recording is `::1`, the loopback address of the
local stack.

## Learning objectives

By the end, the viewer can:

- find who did something, and from where, with Audit's project and action filters;
- say what each audited action records as its target, and why a merge has no IP;
- explain why no API and no SQL statement can change an entry.

## Key questions

| Question | What a strong answer includes |
|---|---|
| What is recorded? | When, who (GitHub login), the action, the project and its name, the target and the client IP. |
| Who is a merge's actor? | Whoever submitted the direction (or requested the skills update); Hewn made the merge, so there's no IP. |
| Where does the IP come from? | The connection, after `X-Forwarded-For` from a proxy on the same machine only. |
| Why can't an entry change? | There's no endpoint (404), and SQLite triggers refuse UPDATE and DELETE ([ADR 0033](../../adr/0033-audit-entries-are-append-only-in-the-database.md)). |
| What happens when a project is deleted? | Its entries stay, with the project's name. |

## Code / assets on screen

| File | What to show |
|---|---|
| `backend/src/Hewn.Application/Pipeline/PauseAndResume.cs` | An audited handler records, then saves |
| `backend/src/Hewn.Application/Audit/AuditWriter.cs` | `Record` and `RecordMerge` |
| `.../Migrations/20261110182203_RecordAuditEntries.cs` | The append-only triggers |
| `sequence-write-and-read` | The audit-log design's redrawn diagram |
| `AuditLogTests.cs`, `e2e/tests/behavior/review-the-audit-log.spec.ts` | Red then green |
| `screens/*.png`, `clips/*.mp4` | Captured by `clips/clips.mjs` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:19 | Introduction | What journey 32 is |
| 00:19-00:44 | Goal | L2-044 AC1 and AC2 |
| 00:44-01:45 | Finding it | Stop all and Start workers, then Audit, its filters and Clear filters |
| 01:45-02:07 | Nothing edits it | Every edit answered 404; a Viewer's forbidden state |
| 02:07-03:04 | How it works | The handler, the writer, the triggers, paging, the sequence |
| 03:04-03:56 | Tests | Backend, behaviour, visual and accessibility |
| 03:56-04:05 | Screens | Dark and phone |
| 04:05-04:28 | Recap | Three points and what comes next |

## Demo commands

```sh
pwsh eng/Start-E2eApi.ps1
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json && cd ..
node docs/videos/32-review-the-audit-log/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/32-review-the-audit-log
node tools/video-build/build-video.mjs docs/videos/32-review-the-audit-log --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- Start a fresh e2e API before capturing, or Audit fills with other tests' entries.
- The clip is paced to the narration with `at(seconds)` in `clips.mjs`. If the script changes, re-time it from
  `.cache/32-review-the-audit-log/captions.srt`, or the build speeds the clip up.
- The setup (two directions, pause, resume, cancel, a worker token) goes through the API before recording; the token
  is never shown.
- On a phone the mock (and so the page) still shows the target under the action and "—" under a sign-in.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [Journey 32 prompt](../../prompts/32-review-the-audit-log.md), [docs/specs/L2.md](../../specs/L2.md)
- [Audit log design](../../detailed-designs/governance/audit-log/README.md), [ADR 0033](../../adr/0033-audit-entries-are-append-only-in-the-database.md)
