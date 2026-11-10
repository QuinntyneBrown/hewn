# 27 · Reconnect Mission Control

> **Runtime:** ~4:13 · **Audience:** Owners, Viewers and Hewn contributors · **Prerequisites:** [26 · Continue after a worker or server crash](../26-continue-after-a-worker-or-server-crash/README.md)

**Video:** [27-reconnect-mission-control.mp4](27-reconnect-mission-control.mp4) · [Slides](slides.html) · **Audio:** [27-reconnect-mission-control.mp3](27-reconnect-mission-control.mp3) · [Transcript](script.md)

## Why this video exists

This is the video for journey 27 (L2-032, L2-031 AC2). When the live connection drops, Mission Control says so and
retries on a fixed schedule. On reconnect it catches up every missed event once, so the screen matches a fresh load.
The recording measured a reconnect 12.4 s after the drop, at the attempt due at 12 s; it caught up 12 events, #10 to
#21 (`screens/records.json`).

## Learning objectives

By the end, the viewer can:

- name the retry schedule and when the connection counts as lost;
- read each state of the connection strip and the sidebar;
- explain why the banner goes only once catch-up finishes.

## Key questions

| Question | What a strong answer includes |
|---|---|
| Why not SignalR's automatic reconnect? | It takes a fixed list of delays and then gives up; L2-032 wants retries every 30 s for as long as it takes, plus Retry now. |
| When does Reconnecting become Connection lost? | After the 0, 2, 10 and 30-second attempts fail; it then retries every 30 s. |
| When is the connection live again? | Once every open subscription has rejoined and caught up, not when the socket opens. |
| How do the tests cut the connection? | `LiveConnection` routes negotiate and the WebSocket through Playwright, closes the socket and refuses attempts. |

## Code / assets on screen

| File | What to show |
|---|---|
| `frontend/projects/api/src/lib/live/reconnector.ts`, `project-events.ts` | The schedule; reconnect and catch-up |
| `frontend/projects/mission-control/src/app/layout/connection-banner.ts`, `shell.html` | The strip's text and the sidebar state |
| `c4-component`, `sequence-reconnect` | The real-time-events design's diagrams |
| `reconnector.spec.ts`, `e2e/pages/live-connection.ts`, `e2e/tests/**/reconnect-*.spec.ts` | Red then green |
| `screens/*.png`, `clips/*.mp4` | Captured by `clips/clips.mjs` |

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:20 | Introduction | What journey 27 is |
| 00:20-00:44 | Goal | L2-032, L2-031 AC2 |
| 00:44-01:06 | What was there | Catch-up by sequence; no banner; a reconnect that gave up |
| 01:06-01:46 | Dropping the connection | Reconnecting, frozen log, Reconnected and caught up |
| 01:46-02:37 | The schedule | Reconnector, reconnect, the sequence, Connection lost and Retry now |
| 02:37-02:48 | The first connection | Connecting… |
| 02:48-03:45 | Tests | Unit, behaviour, pipeline, visual and a11y |
| 03:45-03:50 | Screens | Dark and phone |
| 03:50-04:13 | Recap | Three points and what comes next |

## Demo commands

```sh
pwsh eng/Start-E2eApi.ps1
cd frontend && npx ng serve mission-control --port 4300 --proxy-config proxy.e2e.conf.json && cd ..
node docs/videos/27-reconnect-mission-control/clips/clips.mjs
node tools/video-audio/generate-audio.mjs docs/videos/27-reconnect-mission-control
node tools/video-build/build-video.mjs docs/videos/27-reconnect-mission-control --music docs/videos/assets/music/en-la-playa-soca.mp3
```

## Pitfalls

- The Connection lost clip fakes the page's clock; step it one attempt at a time, as each attempt fails over the
  network before the next is scheduled.

## Music

_En La Playa – Trinidad and Tobago Soca_ by JuliusH,
[pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662](https://pixabay.com/music/world-en-la-playa-trinidad-and-tobago-soca-4662/),
under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Mixed about 20 dB under the
narration. Voice: Kokoro-82M `af_heart` ([hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), Apache-2.0).

## References

- [Journey 27 prompt](../../prompts/27-reconnect-mission-control.md), [docs/specs/L2.md](../../specs/L2.md)
- [Real-time events](../../detailed-designs/mission-control/real-time-events/README.md), [ADR 0028](../../adr/0028-mission-control-runs-its-own-reconnect-schedule.md)
