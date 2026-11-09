# 11 · Find a project

This is journey eleven of Hewn, the software factory: find a project. Once Hewn is building several products at once, Owners and Viewers need one place to see them all: what each is doing, how far along it is, what it has cost, and which needs attention. This video walks through how it was built: the rows, the live updates, the page and its filter, the empty states, performance, and the tests.

## The goal

Projects lists every project with its name, current stage, status, percent complete, spend to date and last activity, newest first. A status filter narrows the list and survives a reload. Rows update in place within a second. With no projects, Owners are offered New product and Viewers are not. And the page has to load fast on a phone, with read APIs that stay quick under load.

## The flow

Here is the flow. The page puts the filter in the query string, loads the list once, and then joins the projects group on the hub, so each changed row arrives on its own.

## The rows

Each row is built on request by the project summary reader. It reads the projects with their directions, the leased runs for the current step, the increments for stage ten, and each project's latest stored event for its last activity. The row describes the current direction: the active one, or else the latest. Its stage is the first one not yet succeeded, and percent complete is the share of its planned stages that succeeded, with stage ten's merged increments counted as a fraction.

The list handler sorts those rows newest activity first. There is no separate summary table to keep in step: with fifty projects, reading on request answers in milliseconds. ADR sixteen records that choice.

## Live rows

For live updates, the hub gained a projects group. After events are stored and broadcast to each project's own group, the publisher reads every changed project's row and sends it to the projects group. Log lines and decisions never change a row, so they don't trigger a read. A brand new project arrives the same way, so the page simply adds it.

## The page

In the page, a live row replaces the project's old one, or is added if it's new, and the list is sorted again. The filter is read from the query string, so a reload keeps it, and each tab shows how many projects have that status. After a reconnect, the page loads the whole list again, in case it missed something.

## Performance

The requirement is a largest contentful paint of two and a half seconds or less on Lighthouse's mobile profile, a mid-tier phone on throttled 4G, with no more than five hundred kilobytes of initial JavaScript. The first measurement was about two point six seconds, because each request waited for the one before it. Angular preloads only ten files, and the build had eleven initial chunks, so one was found a round trip late. Start-up fetched the user, then the config, one after the other. And the list itself waited until the page was routed. Now the build merges its chunks into one initial file, and start-up fetches the user and the config together. When the app opens on Projects, the list is requested at the same moment, and the page takes that response when it loads.

Lighthouse now measures a largest contentful paint of one point four four seconds with a hundred and forty six projects, and one hundred and twenty five kilobytes of initial JavaScript. The load test makes sure there are fifty projects and twenty connected workers, then sends a thousand reads from twenty clients at once. The ninety fifth percentile is thirteen milliseconds, against a limit of three hundred.

## Tests

The backend tests came first, and failed: there was no stage, percent or activity in the list, and no projects group. Now four tests cover the columns and their order, percent complete, a blocked project's note, and a row arriving live. The frontend gained unit tests for sorting, live rows, the filter, the activity times and the early list request.

All green, the backend has two hundred and two tests, the worker one hundred and forty, and the frontend one hundred and four unit tests. End to end, there are eleven new tests: the list, the filter across a reload, both empty states, a row updating live with a real worker, three visual comparisons with the mocks, and four accessibility checks. The two performance tests run on their own, in CI too.

## The screens

Here is the list, with projects in every state: running, paused at an Owner's request, blocked with the stage that failed, idle at one hundred percent, and cancelled. Each row shows the stage, what it is doing, how far along it is, what it has cost, and when it last did something.

It works in dark mode and on a phone.

Now the filter. The Owner chooses Blocked, and only Parcel Post is left, with the filter in the address bar. A reload, and the filter is still there. Then Running, and back to All.

And here the list stays open while the workers run. Ledgerline and Tidewater move from stage to stage, their percentages climbing and their activity staying a few seconds old, all without a reload. Then an Owner submits Northwind Ops, and its row appears at the top.

With no projects at all, an Owner sees New product, and a Viewer sees the same empty state, explaining that projects appear here once an Owner gives Hewn a direction.

And here is the Lighthouse report for the production build.

## Recap

Journey eleven is complete. Projects lists every project with its stage, status, progress, spend and last activity, newest first. The filter lives in the address bar, rows change live, and the empty state fits the role. And the page meets its performance budgets, with the numbers checked in CI. Next comes journey twelve.
