# 12 · Review the backlog

This is journey twelve of Hewn, the software factory: review the backlog. After stage nine estimates a product, Hewn builds it one increment at a time. Owners and Viewers want to see that plan: what comes next, what is being built now, what has merged, and what was left out and why. This video walks through how it was built: the backlog endpoint, the Backlog tab, the deferred designs, blocked increments, live updates, and the tests.

## The goal

A user opens a project's Backlog and sees the increments in order, each with its status, its estimate, and a link to its pull request once one exists. Deferred designs appear apart from the active backlog, each with its reason. A blocked increment says why. And percent complete moves after every merge, without a reload.

## The flow

Here is the flow. The Backlog tab asks the API for the project's backlog. When an increment changes, the project page already hears the event, so the tab simply reads the backlog again.

## The endpoint

The increments table has existed since stage nine was built: the worker records the plan there, and stage ten reports each increment's progress. What was missing was a way to read it. The new backlog query takes the project's current direction, the same one Projects describes, and returns its increments in number order, with each pull request turned into a GitHub link.

Deferred designs live in the same table without a number, so they come back apart, with their reasons. The totals count merged increments and ideal days, and percent complete comes from the same reader the Projects list uses, so the two always agree.

## The Backlog tab

In Mission Control, the project header gained section tabs, Pipeline and Backlog, as the mocks show. The Backlog is a tab of the project page, so it shares the header, the controls and the live connection.

Each status reads with its own label and icon, never colour alone: Queued, In progress, Blocked and Merged. The pull request column shows the link once there is one, and "soon" while an increment is being built.

## Blocked increments

When an increment uses up its ten implement-and-test iterations, it is blocked, and Hewn moves on to the next increment that doesn't depend on it. The callout says exactly that: how many iterations it used, which tests still fail, and which increment Hewn moved on to, skipping anything that depends on it, directly or through another.

## Live updates

The project page already follows the project's events. Every backlog plan, increment change, stage change or direction change bumps a counter that the Backlog tab watches, and the tab reads the backlog again. It costs one small read per event, and the totals are always right.

## Driving it for real

To show deferred and blocked increments through the real pipeline, the scripted agent, which stands in for Claude in tests, learned two things. An idea's "Nice to have" sentence now goes into the brief, so stage nine's descoper defers that design, with the reason "Listed as nice-to-have in the brief". And a test can name an increment the agent never implements, so its tests stay red until it blocks. A third option slows each increment down, so a test can watch it change.

## Tests

The backend tests came first, and failed with not found. Now four tests cover the order, statuses, estimates and pull request links with the deferred designs, the totals moving with a merge, a blocked increment's iterations and failing tests, and the empty backlog before stage nine. The worker gained four tests for the scripted agent, and the frontend six for statuses, estimates, pull request links and the blocked callout.

All green, the backend has two hundred and six tests, the worker one hundred and forty four, and the frontend one hundred and ten. End to end, there are thirteen new tests: five for the page's states, three visual comparisons with the mocks, four accessibility checks, and one with a real worker, where the backlog fills and every increment goes from In progress to Merged without a reload. Matching the blocked callout to its mock also fixed the visual helper: it now moves a region onto the pixel grid before comparing it.

## The screens

Here is Kiln Booking's Backlog, open before stage nine has run. Then a worker starts. The backlog arrives in journey order, with review history deferred below, listed as nice-to-have in the brief. The first increment goes In progress, then Merged with its pull request, and the merged count and percent complete move with it. Then the next one.

When every increment has merged, the backlog reads two of two, at one hundred percent. It works in dark mode and on a phone.

And here is Parcel Post, whose main workflow increment never went green. It is blocked after ten iterations, and the callout names the test that still fails.

## Recap

Journey twelve is complete. The Backlog shows every increment in order, with its status, estimate and pull request. Deferred designs appear apart, with their reasons. A blocked increment says why. And the totals move with every merge, live. Next comes journey thirteen.
