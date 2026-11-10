# 25 · Inspect worker activity

This is journey twenty five of Hewn, the software factory: inspect worker activity. Workers is the page that shows every worker Hewn knows about. This video shows it starting empty, following workers live as they connect, lease work and go idle, and catching a worker the moment it goes offline.

## The goal

Anyone signed in, Owner or Viewer, opens Workers and sees each worker's location, version, status, current project and last heartbeat, updating live. A worker appears within two seconds of connecting. And every worker status change reaches the page as a live event within a second.

## Before any worker connects

On a fresh stack, Workers says there are no workers yet, and explains what a worker is. An Owner is offered New worker token right there, the first step to starting one. A Viewer can't create tokens, so the page tells them a worker appears here once an Owner starts one.

## Workers connect

Here Workers is open and empty. A worker starts on this machine, configured as Local, and its row appears without a reload. The first showed up in under a third of a second. A second worker, configured as Cloud, follows.

Each row shows the host and a short id, Local or Cloud, the version, the status with its icon and label, what it is working on, how long ago it was last heard from, and how long it has been connected.

## Leasing and going idle

Now a direction is submitted from another tab. One worker leases it at once: its status turns to Leased, with the project beside it, and the heartbeat keeps refreshing while the stage runs. When the direction is cancelled, the run stops, and the worker goes back to Idle, waiting for work. Workers is told when a stage starts or ends, so none of this waits for a refresh.

Leased workers are listed first, then idle ones, then offline ones, and within each group the longest connected first, as the mocks show them.

## Going offline

A worker is offline once sixty seconds pass without hearing from it. No request marks that moment: it just happens. So until now, the page only noticed at its next five second read.

Worker presence fixes that. Each sweep reads which workers are online, compares them with the last sweep, and tells Workers when they differ. The first sweep only takes note.

A background service runs the sweep every second. It reads one small table, so it costs almost nothing.

Here the Cloud worker has stopped. Sixty seconds after it was last heard from, its row turns Offline, with its lease released, six tenths of a second after the mark.

On the page, the shell already follows the workers group, and reads the list again whenever it is told. Heartbeat times still come from the five second read, and the page counts the seconds in between.

## Loading and errors

While Workers first loads, it shows placeholder rows. If the list can't be read, it says so, with the reason and a reminder that connected workers keep their leases and heartbeats, and Try again reads it again. A later failure keeps the rows already on screen.

The store keeps the last failure, and clears it on the next success. The page shows the error only while it has nothing else to show.

## Tests

On the backend, a new test follows the hub as a Viewer. Nothing is sent while nothing changes. Sixty seconds on, the worker is offline and Workers is told; when it asks for work again, Workers is told it is back. It failed first, as there was no presence sweep at all. The backend has two hundred and ninety five tests, all green.

In the front end, new unit tests cover the order and the error message, a hundred and thirty five in all. End to end, a live test stops a worker and checks the row turns Offline within a second and a half of the mark, without a reload. Others cover the empty, loading and error states, for an Owner and a Viewer; the page matches its five mocks, and has no accessibility violations.

## The screens

Workers reads the same in dark mode, and on a phone.

## Recap

Journey twenty five is complete. Workers starts with a helpful empty state, follows workers live as they connect, lease and go idle, and shows a worker offline within a second of the sixty second mark. Next comes journey twenty six.
