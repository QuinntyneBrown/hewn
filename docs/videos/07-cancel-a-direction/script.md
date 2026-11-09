# 07 · Cancel a direction

This is journey seven of Hewn, the software factory: cancel a direction. Sometimes the work in progress is simply not wanted any more. An Owner needs to stop it quickly, keep what is already merged, and leave a clear mark on anything still open. This video walks through how it was built: the flow, the control poll, the cancel itself, the labelled pull requests, the page, and the tests.

## The goal

An Owner presses Cancel on a running or paused direction, and confirms in a dialog. The active run stops within ten seconds, and the direction is Cancelled. Open pull requests stay open, with the label hewn cancelled. If another direction is waiting in the queue, it starts. Viewers never see the control, and the API answers four oh three.

## The flow

Here is the whole flow. While a run executes, the worker holds a control request open to the API. When the Owner confirms, the API labels the open pull requests, cancels the run, the stage and the direction, and starts the next queued direction, all in one save. Then it wakes the held request. The worker hears Cancel, stops the step in progress, and the dialog closes.

## The control poll

Workers only ever call out to Hewn, so a Local worker needs no open port. To hear a cancel within seconds, the worker keeps one request open while it works, twenty seconds at a time. The API answers the moment the run is cancelled, or with nothing, and the worker asks again.

On the API side, the poll checks that this worker still holds this run. If the run is still leased, it waits for a signal, then looks again. A cancelled run is answered with Cancel, and the stop is recorded.

In the worker, the Cancel answer aborts the step in progress at once. No further step, checkpoint or result is reported.

## The cancel

The cancel command takes the project's lock. It sends a Direction cancelled event, writes Cancel requested by, into the run log, and labels the pull requests. Then the orchestrator cancels the run, its stage and the direction, and starts the next queued direction. Only after saving does it wake the worker, and wait up to ten seconds for it to hear. If the worker never answers, the direction is Cancelled anyway: its lease no longer lets it write anything.

## The labelled pull requests

Which pull requests are open? The mutation ledger already records every pull request a run opened. Each one that is not merged gets the hewn cancelled label through GitHub, and the run log shows the matching g h p r edit command. Merged work stays merged.

## The page

On the project page, Owners see Cancel beside Pause or Resume. It opens a confirmation dialog: Keep running, or Cancel direction. While Hewn waits for the worker, the button says Cancelling.

If the worker has stopped answering, the dialog names it, and offers Try again. The page behind says the worker hasn't confirmed the stop, and that Hewn refuses anything more from it. The cancelled page says who cancelled and when, how quickly the run stopped, and which pull request is open and labelled. It works in dark mode and on a phone.

## Tests

Each slice began with its tests failing. The backend gained seven tests against the real API: stopping a running direction within ten seconds, a worker that does not answer, a paused direction, the next queued direction, the labelled pull request, the Viewer, and the conflicts. The worker gained five tests against a fake API and a real HTTP server.

All green, the backend has one hundred and eighty five tests, the worker one hundred and thirty eight, and the frontend seventy one unit tests. End to end, three new pipeline tests cancel a real worker. One checks the stop within ten seconds and the labelled pull request in the fake GitHub, one checks that the queued direction starts, and one stops the worker first, to see the failed dialog. There are fifty end to end tests in all.

## The screens

Here is a direction running Detailed designs. Its Scaffold stage opened pull request number one, which is still open. The Owner presses Cancel, and the dialog asks to confirm. Cancel direction. Cancelling, while the worker hears it. Then the page shows Cancelled. The log reads Cancel requested, the label command for pull request one, and Run stopped. The callout says the run stopped within a second.

In the fake GitHub, pull request number one is still open, not merged, and carries the hewn cancelled label.

Now a second project, with a feature direction waiting in the queue. The Owner cancels the running direction, and the feature direction starts straight away, with its Idea stage running.

And when the worker has gone silent, the dialog says Cancel didn't reach the worker, names it, and offers Try again. A Viewer sees the cancelled direction, with no controls at all.

## Recap

Journey seven is complete. Cancel stops the active run within ten seconds, over a request the worker holds open. Open pull requests stay open, labelled hewn cancelled, and the next queued direction starts. And only Owners can do it. Next comes journey eight: stop and restart all workers.
