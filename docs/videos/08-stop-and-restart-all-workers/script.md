# 08 · Stop and restart all workers

This is journey eight of Hewn, the software factory: stop and restart all workers. Sometimes everything needs to pause at once: a bad model release, a spending scare, or maintenance on the build machines. An Owner needs one switch that halts every worker quickly, keeps every project's progress, and holds until they say go. This video walks through how it was built: the flow, the leasing switch, the halt, the worker, the page, and the tests.

## The goal

An Owner presses Stop all workers and confirms. Every worker halts its active run within ten seconds and leases no new work. A banner shows that workers are stopped, until the Owner presses Start workers, and each halted run then resumes from its last checkpoint. Viewers see the banner, never the controls, and the API answers four oh three.

## The flow

Here is the whole flow. Each worker holds its control request open while it works, as it did for Cancel. Stop all workers saves the leasing switch first, then halts every leased run, project by project. Each held request answers Halt, and the worker stops the step in progress. Start workers queues the halted runs again, then turns leasing back on, and the next lease carries on after the checkpoint.

## The leasing switch

The switch is one row in the database, so a restarted server stays stopped. The lease is granted in a single update, and that update now checks the switch too. Once Stop has saved it, no worker can be granted a run, and a run granted a moment before is found and halted.

## The halt

The stop command saves the switch, then halts each leased run under its project's lock. A halted run keeps its worker, its epoch and its checkpoint, but it no longer fences anything, so every write the worker tries is refused. The run log says who stopped the workers, and which step the run resumes from. Then the command wakes every held control request and waits, up to ten seconds, for each worker to hear. Any worker that doesn't is named in the answer.

On the API side, the control poll now answers Halt for a halted run, and records Run halted at step, in the log.

## The worker

In the worker, a Halt answer aborts the step in progress, exactly like Cancel. After Start workers, the same run is leased again with a new epoch, and the worker carries on from the step after its checkpoint.

## The page

Owners get Stop all workers at the foot of the sidebar. It opens a confirmation listing every online worker and what it is running. While Hewn waits, the button counts the workers it is stopping.

Once they have stopped, a banner on every page says who stopped them and when, and the sidebar offers Start workers. The new Workers page shows each worker holding at its checkpoint. If a worker doesn't answer, the dialog names it and offers Try again. It works in dark mode and on a phone, and a Viewer sees the banner with no controls.

## Tests

Each slice began with its tests failing. The backend gained five tests against the real API: stopping two running projects within ten seconds, starting them again from their checkpoints, the switch surviving a server restart, a worker that does not answer, and the Viewer. The worker gained a test that halts a run and resumes it after its checkpoint.

All green, the backend has one hundred and ninety tests, the worker one hundred and thirty nine, and the frontend eighty one unit tests. End to end, two new pipeline tests use real workers. One stops two running projects, checks the banner and the Workers page, and starts them again, checking that each run resumes at the step after its checkpoint. The other stops a silent worker, and checks what a Viewer sees. There are fifty two end to end tests in all.

## The screens

Here are two projects, Ledgerline and Tidewater, each leased by its own worker. The Owner presses Stop all workers, and the dialog lists both workers and their projects. Stop all workers. Stopping two workers, while each worker hears it. Then the banner appears, and both workers are holding at their checkpoints.

On Ledgerline's page, the log shows the halt, and the step it resumes from, under the same banner.

Now the Owner presses Start workers. The banner goes, the run is queued again, and it carries on where it left off.

And when the workers have gone silent, the dialog says they didn't confirm, names them, and offers Try again. A Viewer sees the banner, with no controls at all.

## Recap

Journey eight is complete. Stop all workers halts every active run within ten seconds, over the control request each worker already holds. The leasing switch is stored, so nothing is leased until Start workers, even after a restart. And every halted run resumes from its checkpoint. Next comes journey nine: recover a failed stage.
