# 09 · Recover a failed stage

This is journey nine of Hewn, the software factory: recover a failed stage. Runs fail. A skill's output doesn't validate, a service is down for a minute, or a check goes red. Most of those failures pass on a second try, so Hewn should retry on its own, give up cleanly when it really is stuck, and let an Owner start the stage again once it's fixed. This video walks through how it was built: the backoff, the retries, blocking, Retry stage, the page, and the tests.

## The goal

When a run fails, Hewn retries it automatically, up to three times, waiting thirty seconds, then two minutes, then ten minutes. When the third retry fails too, the stage is Failed and the direction Blocked. Mission Control hears about it with the reason and the last two hundred log lines, and every other project keeps running. Then an Owner presses Retry stage, and the failed stage runs again from its start, with its retry counter reset.

## The backoff

Here is the schedule. Attempt one fails, and Hewn waits thirty seconds. Attempt two fails, and it waits two minutes. Attempt three fails, and it waits ten minutes. When attempt four fails, the stage is Failed and the direction Blocked, until an Owner presses Retry stage.

## The retries

Each retry is a new run of the same stage. When a run fails below the limit, the orchestrator queues the next attempt straight away, with a not before time: now, plus the wait. The run log says which attempt failed, why, and when the next one comes, and a retry scheduled event carries the same.

The lease does the waiting. Its query skips any run whose time hasn't come, using the injected clock. Workers need no timers, a restart keeps the schedule, and other projects' runs are leased in the meantime.

The first test failed before any of this existed. It fails a run, moves the test clock to one second short of each wait, and checks that nothing can be leased, then one second on, that the next attempt can.

## Blocked

When attempt four fails, the stage is Failed, and the direction and the project are Blocked, holding the reason. A stage blocked event carries the reason and the run's last two hundred log lines. They were redacted when they were stored, so no secret leaves in the event.

## Retry stage

Retry stage is a new endpoint under the project, for Owners only. It refuses anything but a Blocked direction, with a conflict. It queues attempt one of the failed stage with no checkpoint, so it starts from the beginning, and the log records who asked.

## The page

On the project page, the stage's live line counts down to each retry, beside the reason. Once the stage blocks, the header shows Blocked, with Retry stage and Cancel, and the failed stage opens with a callout: the reason, the waits Hewn used, and that the last two hundred log lines are below. If the page is open when it happens, a danger toast says the project is blocked. It stays until it's dismissed, and offers Open log and Retry stage. It works in dark mode and on a phone, and a Viewer sees why it's blocked, with no Retry stage.

## Tests

Each slice began with its tests failing. The backend gained four tests against the real API: the three waits, blocking with the last two hundred lines while another project is leased, Retry stage from the start with the counter reset, and the refusals. The worker's scripted stages can now fail a set number of times, then pass.

All green, the backend has one hundred and ninety four tests, the worker one hundred and forty, and the frontend ninety three unit tests. End to end, a new pipeline test runs a real worker whose stage fails four times. It watches the countdown, the Blocked page and the toast, checks that a Viewer is refused, then presses Retry stage and sees the stage succeed. There are fifty three end to end tests in all.

## The screens

Here is Parcel Post. Bootstrap has passed, and Idea fails. The live line counts down to retry one of three, with the reason beside it. For this recording the waits are five, eight and twelve seconds, instead of thirty seconds, two minutes and ten minutes. Each retry is a fresh run on the same worker, so its log starts empty, and the countdown always shows when the next attempt begins. Retry two, retry three, and the third retry fails too. The project is Blocked, the callout explains why, the header offers Retry stage and Cancel, and the toast offers the way back.

The Runs tab lists all four attempts, each one failed.

Now the Owner presses Retry stage. Idea runs again from its start, passes this time, and the direction carries on to the next stage.

## Recap

Journey nine is complete. A failed run is retried three times, after thirty seconds, two minutes and ten minutes, and each retry is a new run that waits for its time. When the retries run out, the stage is Failed and the direction Blocked, with the reason and the last log lines, while other projects keep running. And Retry stage runs it again from the start. Next comes journey ten: queue further directions.
