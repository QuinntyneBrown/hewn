# 18 · Review agent decisions

This is journey eighteen of Hewn, the software factory: review agent decisions. Hewn has no approval steps, so when a skill would have asked you a question, the agent answers it itself and records the answer in the product's decisions file. Owners and Viewers want to read those answers afterwards, by stage, and see exactly which commit recorded each one. This video walks through how it was built: keeping each decision with its commit, the decisions API, the Decisions tab, and the tests.

## The goal

A user opens a project's Decisions and sees the questions agents answered for themselves, newest first. Each shows its stage, the question, the answer, the rationale and a link to the commit that recorded it, and an A D R link when the decision changed the architecture. A stage filter narrows the list.

## The flow

Here is how a decision is recorded. The stage's agent appends the entry to the decisions file, and writes an A D R for an architectural decision. The worker commits through the write broker first, and only then reports the decisions to the API. So the API stores each one with the run's latest commit of the decisions file.

Listing is then a database read. The tab asks for the project's decisions, optionally of one stage, and gets them newest first with their links. When a run reports another decision, the tab reads the list again.

The classes are few. Hewn already kept each reported decision for a stage's own Decisions tab, so it gained a commit and an A D R rather than a second table. That is recorded as A D R twenty.

## Keeping the commit

When decisions arrive, the handler finds the run's commits, newest first, and takes the first whose paths include the decisions file. Every decision is redacted, stored with that commit and its A D R, and sent as a DecisionRecorded event.

The worker reads each entry's A D R link and reports its path, which the API checks is a numbered file in the A D R folder.

Stage ten committed decisions too, but never reported them. Now every increment commit that writes the decisions file reports its new entries, once each, after the commit.

## The decisions API

The API lists the project's decisions newest first, of one stage when asked. Each gets its stage name, a link to its commit on GitHub, and its A D R, titled by number.

## The tab

Here is an entry in the decisions file, next to how the tab renders it: the date and stage, then the question, the answer, the rationale, and the commit that wrote it.

Choosing a stage puts it in the address, so a link opens the same filtered list, and a stage with no decisions offers every stage again.

## Tests

The backend tests came first, and failed with not found: there was no route. Six now cover the list newest first with stage, rationale, commit and A D R, the stage filter, a decision with no commit, a rejected A D R path, an empty project, and Viewers. The worker tests failed too, until the A D R was reported and stage ten reported its decisions.

End to end, a live test runs a real worker through a whole direction, opens Decisions, and follows the stack decision's link to the commit, which holds that decision in the decisions file.

All green, the backend has two hundred and forty four tests, the worker one hundred and forty five, and the frontend three new view tests. End to end, there are seventeen new tests: five for behaviour, one live pipeline run, six visual comparisons with the mocks, and five accessibility checks.

## The screens

Here is Kiln Booking, built end to end by a real worker. Its decisions run from the brief to the increments. Filtering by Stack, then Increments, narrows the list, and Scaffold has none, so every stage is one click away.

Opening the stack decision's commit shows the files it changed, and the decisions file at that commit, with the entry highlighted.

As a Viewer the list reads the same in dark mode, and on a phone.

A project with no decisions yet says so, and if the list can't load, it says why and offers to try again.

## Recap

Journey eighteen is complete. Every decision an agent records is listed newest first, with its rationale. Each links to the commit that wrote it, and to its A D R. And the stage filter narrows the list, right in the address. Next comes journey nineteen.
