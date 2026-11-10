# 27 · Reconnect Mission Control

This is journey twenty seven of Hewn, the software factory: reconnect Mission Control. Networks drop. This video shows Mission Control noticing, saying so, retrying on a fixed schedule, and catching up every event it missed, once each, so the screen ends up as a fresh load would show it.

## The goal

When the live connection drops, Mission Control shows Reconnecting, and retries after zero, two, ten and thirty seconds, then every thirty seconds. On reconnect it fetches every event after its last sequence number and applies each once. When catch-up finishes, the banner goes. This is for everyone watching Mission Control, Owners and Viewers alike.

## What was there, and what was missing

Catch-up already worked. Every event carries a per-project sequence number, one more than the last, and on reconnect the client asked for everything after the last one it had applied. But nothing on screen said the connection had dropped, and SignalR's automatic reconnect tried six times in thirty three seconds, then gave up for good.

## Dropping the connection

Here a project is running, and its log is live. The network drops. A strip appears above the page: Reconnecting, the next attempt in two seconds, and the sequence number that missed events will catch up from. The sidebar says Reconnecting too, with a dot that pulses, so the state is never colour alone.

The worker keeps going, but nothing new reaches the page. At the attempt twelve seconds in, the connection is back. The strip says what it caught up: twelve missed events, numbers ten to twenty one. The pipeline jumps ahead to where the worker is, and five seconds later the strip is gone.

## The schedule

A small class, the reconnector, owns the schedule. It waits zero, two, ten and thirty seconds, then thirty seconds for as long as it takes. After the four scheduled attempts, the connection counts as lost.

Each attempt starts the connection, then every open subscription joins its group again and catches up. Only then does the status turn live, so the banner goes when catch-up finishes, not when the socket opens.

Here, on a fake clock, the schedule runs out. The strip turns to Connection lost: retrying every thirty seconds, agents keep working and nothing is lost. Retry now tries at once. When the network is back, it reconnects, and says nothing was missed.

The banner's text is one small function of the status, the time, and what was caught up.

## The first connection

When the first connection is slow, the strip says Mission Control is connecting, and live updates start in a moment. A quick connection shows nothing at all.

## Tests

The reconnector's unit tests use fake timers. Attempts land at zero, two, twelve, forty two, seventy two and a hundred and two seconds. Retry now tries at once and keeps the schedule. Banner text has its own tests. The front end has a hundred and sixty five unit tests in all.

End to end, a page object routes the hub's connection through Playwright, so a test can cut it and refuse every attempt. A behaviour test steps the clock through the schedule, Retry now and the Reconnected notice.

A pipeline test cuts the connection while a worker logs. Nothing arrives while it is down. After the reconnect, the pipeline and the log match a fresh page load exactly. Against the old Mission Control, both tests failed: there was no banner to find. Visual tests match the connecting and lost strips to their mocks, and an accessibility test checks every state.

## The screens

The strip reads the same in dark mode, and on a phone.

## Recap

Journey twenty seven is complete. Mission Control says when its live connection drops, retries on L2-032's schedule for as long as it takes, catches up every missed event once, and clears the banner when it is done. Next comes journey twenty eight.
