# 06 · Pause and resume a direction

This is journey six of Hewn, the software factory: pause and resume a direction. Hewn runs without approval steps, so an Owner needs a safety control: stop after the work in hand, and carry on later without doing anything twice. This video walks through how it was built: the flow, the pause request, the checkpoint, the resume, the page, and the tests.

## The goal

An Owner presses Pause on a running direction. The current step finishes, the direction becomes Paused, and nothing new starts. Resume continues from the next step, and no completed step runs twice. Viewers never see the controls, and if they try the API, it answers four oh three.

## The flow

Here is the whole flow. Pause is recorded at once, but nothing stops yet. The worker finishes its step and reports the checkpoint, as it always does, and the checkpoint's answer tells it to stop there. Resume puts the same run back in the queue, and the next worker to lease it starts at the following step.

## The pause request

The pause command takes the project's lock and finds the direction's run. It records who asked, sends a Pause requested event, and writes Pause requested by, into the run log. If the run is still waiting for a worker, there is no step to wait for, so the direction pauses at once. Pressing Pause twice changes nothing.

## The checkpoint

This is the worker loop's checkpoint sequence. Every step ends with a checkpoint, recorded by the API. Now the API answers with a verdict: continue, or pause.

When a pause is waiting, the checkpoint that ends the step in progress is where it takes effect. The API writes Step finished, checkpoint, direction Paused, into the log, releases the lease, keeps the checkpoint, and pauses the run, the stage, the direction and the project, in one save.

In the worker, a pause verdict ends the run right there: no further step, and no result. Then the worker goes back to leasing other work.

## The resume

Resume queues the same run again, with its checkpoint, and sets the stage, the direction and the project back to Running. The next lease starts the run at the step after its checkpoint. A direction paused at its budget is not resumed this way: it answers with a conflict, because only Raise and resume continues it.

## The page

On the project page, Owners see Pause on a running direction. Once pressed, the button shows Pausing, while the step in progress finishes.

Paused, the header offers Resume, and the callout says who paused and when, and that nothing new starts until Resume. It works in dark mode and on a phone.

## Tests

Each slice began with its tests failing. The backend gained seven tests against the real API: the pause after the step, the resume from the next step, a run still waiting for a worker, a stage that ends while a pause is pending, the Viewer, the conflicts, and another project. The worker gained three tests against a fake API.

All green, the backend has one hundred and seventy eight tests, the worker one hundred and thirty three, and the frontend sixty four unit tests. End to end, a new pipeline test pauses a real worker mid step, checks that nothing runs while paused, checks the Viewer and the page's accessibility, then resumes, and checks that each step of the stage ran exactly once. There are forty seven end to end tests in all.

## The screens

Here is a direction running Bootstrap, in its second step. The Owner presses Pause. The button says Pausing, and the log says Pause requested. The step carries on to its last log line, then reports its checkpoint, and the direction is Paused.

Now Resume. The header turns back to Pause, and the log says Resumed by. The worker polls for work, leases the same run again with a new epoch, and carries on with its third step, Commit artifacts. Steps one and two do not run again. Bootstrap succeeds, and Idea begins, with its own steps and its own log.

Bootstrap's log tells the whole story. The pause request, the step that finished, the checkpoint, and the resume. No line of a completed step appears twice.

And a Viewer sees the pause, with no controls at all.

## Recap

Journey six is complete. Pause waits for the step in progress, then stops at its checkpoint. Resume carries on from the next step, and no completed step runs twice. And only Owners can do either. Next comes journey seven: cancel a direction.
