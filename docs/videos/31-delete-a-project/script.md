# 31 · Delete a project

This is journey thirty one of Hewn, the software factory: delete a project. Archiving hides a project and keeps everything. Sometimes an Owner wants Hewn's copy gone for good. This video shows an Owner deleting a project, and the repository it built staying exactly where it was.

## The goal

An Owner chooses Delete, types the project name exactly and confirms. Hewn's records, logs and stored artifacts for the project are removed, and the GitHub repository is left untouched. The dialog says so. Deleting a project with an active direction is refused with "Cancel the running direction first".

## Deleting

Here an Owner opens Projects. Beside Archive, each of their rows now has Delete. Harbor CRM's direction was cancelled, so its Delete is enabled. The dialog asks the Owner to type the name, and says what goes: its directions, runs, decisions, events and spend history. Under the field it says the GitHub repository is kept; only Hewn's record is deleted. The Owner types only part of the name and moves on. The field says to type Harbor CRM exactly, and Delete project stays disabled. With the whole name typed, Delete project is enabled. The Owner confirms. In about a third of a second the row leaves the list, and a toast says the repository is kept.

Hewn no longer knows the project: its page is not found. But the repository is still there on GitHub, with its README unchanged.

## The refusal

Tidewater's direction is still running. Its Delete is disabled, and its name and tooltip say why: cancel the running direction first. Pressing it opens nothing. If the API refuses for any reason, the dialog says so, and that nothing was removed.

## How it works

The handler checks the same guard as Archive first, so a project with an active direction is refused with a conflict. Then it compares the typed name with the project's, exactly, so case and spaces count. A mismatch is a field error with the dialog's own words.

Then it removes every row Hewn keeps for the project. That's the directions and their stages, runs, events, log lines, decisions, model calls, GitHub mutations, increments and their checks, and skills updates. All of it goes in one save, so a failure removes nothing. The design had planned a purge job, but these are small rows in one database. The new decision record explains why one save is simpler and safer. Nothing here calls GitHub.

Once saved, every open Projects page hears that the project was deleted, and drops its row.

The dialog enables Delete project only when the typed name matches. It shows the field error once the field is left with something else in it, as the invalid mock does.

This sequence shows the whole path, from the row to the toast.

## Tests

The backend tests go through the real API. A project that ran its first stage, with a log line, a decision, a model call and a commit, is deleted. Afterwards every one of its tables counts zero. Another project's records are untouched, and the repository still holds its README. A name that differs is refused and deletes nothing. So does an active direction. A Viewer is forbidden, and a Projects page hears the deletion live. Before the endpoint existed, all of them failed. All three hundred and twenty seven backend tests pass.

End to end, a behaviour test types part of the name, sees the error, types the rest and deletes. It then checks the project is gone and the repository's README is still there. Others cover Cancel, a failure and Try again, the refusal, and the Viewer. Against the old page the first test failed, with no Delete button to find. Visual tests compare the dialog's default, invalid, confirm, busy and failed states, and the Delete controls, with their mocks. An accessibility test checks each state, and that Escape returns focus to Delete.

## The screens

A failure keeps what was typed, so Try again works. The dialog reads the same in dark mode, and on a phone it becomes a bottom sheet.

## Recap

Journey thirty one is complete. Owners delete a project by typing its name exactly. Hewn's records go in one save, and the GitHub repository is kept. And a project with an active direction is refused, with "Cancel the running direction first". Next comes journey thirty two.
