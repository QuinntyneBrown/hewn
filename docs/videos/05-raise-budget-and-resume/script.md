# 05 · Raise budget and resume

This is journey five of Hewn, the software factory: raise the budget and resume. In journey four, a direction stopped itself at its budget. Now an Owner can give it more and send it on its way, in one action. This video walks through how it was built: the command, the resume, the dialog, the Viewer, and the tests.

## The goal

On a direction paused with Budget reached, an Owner presses Raise and resume, enters a new budget above the spend so far, and confirms. The budget is raised, and the direction resumes from its next step, in one action.

A budget at or below the spend is refused inline, before anything changes. And Viewers never see the control. If they try the API anyway, it answers four oh three.

## The command

Here is the whole exchange. The dialog posts the new budget, together with the budget the Owner was looking at. The API answers with a conflict, a validation error, or the resumed direction.

The command first takes the project's lock, because model calls add to the same spend. If the budget is not the one the Owner saw, another session got there first, and the answer is a conflict. If the direction is not paused at its budget, that is a conflict too. And a new budget at or below the spend is refused, with a message for the field.

Then, in one save, it records a Budget raised event with who raised it, hands the paused run to the pipeline, and publishes everything together. There is no moment where the budget is raised but the direction is still paused.

## The resume

Resuming reuses the run that paused. It goes back to the queue with its checkpoint, so the next worker to lease it carries on from the step after the last one it completed. The warning at eighty percent is re-armed for the new budget. And the stage, the direction and the project turn Running, each with its own event.

## The dialog

The Raise budget dialog is built on the CDK dialog. It checks the amount before sending anything, sends the budget it was opened with, and closes with the result. A refusal from the API shows on the field.

If another session raised the budget first, the dialog says the budget was not changed, and why. On a phone, the same dialog rises from the bottom of the screen.

## The Viewer

A Viewer sees the same pause, with what was spent, but no amount and no button. The end to end test signs in as a Viewer, checks that the control is absent, then posts to the API directly, and gets four oh three.

## Tests

Each slice began with its tests failing. The backend gained seven tests against the real API: the raise and resume, two budgets at or below the spend, the Viewer, a stale budget, a direction that is not paused, and another project's direction. All green, the backend has one hundred and seventy tests, and the worker one hundred and thirty, unchanged.

The frontend has fifty three unit tests. End to end, a new pipeline test drives a real worker to the budget, refuses an amount, checks the Viewer and the dialog's accessibility, then raises the budget and watches the run carry on, for forty six end to end tests in all.

## The screens

Here is a direction with a ten dollar budget, paused at ten dollars twenty. The Owner types ten, and presses Raise budget and resume. Ten is not more than what was spent, so the dialog says so, on the field. Twenty is. The dialog closes, the direction is Running again, and the run picks up where it stopped. Spend climbs past ten dollars, live, the warning returns at eighty percent of the new budget, and the next stage begins.

When spend reaches the new budget, the direction pauses again, with a fresh suggestion of one hundred dollars more. The same page works in dark mode and on a phone.

## Recap

Journey five is complete. An Owner raises a reached budget and resumes in one action. The direction carries on from its checkpoint, with spend and the warning starting again. And a budget at or below the spend, a stale budget, or a Viewer, are all refused. Next comes journey six: pause and resume a direction, at any time.
