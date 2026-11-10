# 30 · Archive and restore a project

This is journey thirty of Hewn, the software factory: archive and restore a project. Over time the Projects list fills with projects that are finished or abandoned. This video shows an Owner archiving one to hide it, finding it again under the Archived filter, and restoring it.

## The goal

An Owner archives a project with no active direction. It leaves the default list, appears under the Archived filter, and can be restored. Archiving a project with an active direction is refused with "Cancel the running direction first". This is for Owners, who keep the list to the projects that matter now.

## Archiving and restoring

Here an Owner opens Projects. Each of their rows now ends with an Archive control. Saltmarsh Survey's direction was cancelled, so nothing is active, and its Archive is enabled. The Owner archives it. A toast says it's under Archived, where it can be restored, and the row leaves the list. Show archived opens the new Archived filter. Saltmarsh Survey is there, with the status Archived and a Restore button. The Owner restores it, and it's back in All with the status it had, Cancelled.

## The refusal

Tidewater's direction is still running. Its Archive control is disabled, and its name and tooltip say why: cancel the running direction first. Once the direction is cancelled, the control is enabled again. If a direction starts after the page loaded, the API refuses the archive itself, and the toast gives its reason: Tidewater wasn't archived. Cancel the running direction first.

## How it works

Archiving is a flag beside the project's status, as the new decision record explains. The project keeps its status, and the handler records when it was archived and by whom. Before that, it refuses any project with an active direction, with the code active direction and the same words the page shows. A queued direction counts as active, because it would start while the project was archived. An archived project also takes no new direction until it's restored.

Archive and restore each append an event, so every open Projects page gets the changed row live. The list filters on the client, as it already did for status. All, each status and their counts leave archived projects out, and the Archived filter shows only them.

This sequence shows the whole path, from the disabled control to the restore.

## Tests

The backend tests go through the real API. An idle project is archived and restored, and each step is recorded as an event. Archiving twice changes nothing. A project with an active direction is refused with a conflict, and nothing is recorded. An archived project takes no new direction. A Viewer is forbidden, and an unknown project isn't found. Before the endpoints existed, all four tests failed. All three hundred and twenty two backend tests pass.

In Mission Control, unit tests cover the Archived filter, the counts, when archiving is offered, and the refusal text. One more follows the archived mock: after a week, activity reads as a date. It failed first with twenty eight days ago.

End to end, a behaviour test archives an idle project, follows the toast to Archived, and restores it. Another checks the disabled control and the API's refusal, and a third the Viewer. Against the old page the first test failed, with no Archive button to find. Visual tests compare the Archived filter and the Archive controls with their mocks. That comparison found the Restore button overflowing its column, in the mock and the app alike, so the design system's column is now wide enough. An accessibility test checks every state.

## The screens

A Viewer sees the Archived filter, with no Restore. The archived list reads the same in dark mode, and on a phone.

## Recap

Journey thirty is complete. Owners archive a project with no active direction, and it moves under Archived. Restore brings it back with the status it had. And a project with an active direction is refused, with "Cancel the running direction first". Next comes journey thirty one.
