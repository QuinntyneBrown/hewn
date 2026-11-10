# 0028. Mission Control runs its own reconnect schedule

- **Status:** Accepted
- **Date:** 2026-11-10
- **Requirements:** L2-032, L2-031

## Context

L2-032 asks that when the live connection drops, Mission Control shows "Reconnecting…" and retries after 0, 2,
10 and 30 seconds, then every 30 seconds. On reconnect it catches up from its last sequence number, and the banner
goes once catch-up finishes. The mocks add Connection lost, with Retry now, and a Reconnected notice that counts
what was caught up. The client used SignalR's `withAutomaticReconnect([0, 1, 2, 5, 10, 15 s])`, which stops after
its last delay and has no way to try early. Catch-up by sequence number already worked; nothing showed the
connection's state.

## Decision

- **`Reconnector` owns the schedule.** The hub connection is built without automatic reconnect. On `onclose`, and
  when the first start fails, `Reconnector` calls `start()` after 0, 2, 10 and 30 seconds, then every 30 seconds
  until it succeeds. Retry now tries at once.
- **Live means caught up.** An attempt succeeds only once every open subscription has joined its group again and
  caught up, so the banner goes when catch-up finishes (AC3), not when the socket opens.
- **The status is part of `ProjectEvents`.** It reports connecting, live, reconnecting or offline, with the next
  attempt's time, plus a count of what each reconnect caught up and the last sequence applied. The shell turns
  these into the strip and the sidebar's state.

## Consequences

- A long outage never leaves the page silently stale; it keeps trying every 30 seconds.
- `onreconnected` callbacks are gone: subscriptions rejoin through a registry they leave when they close.
- Faking the clock in e2e drives the schedule, since it uses `setTimeout` and `Date.now()`.
