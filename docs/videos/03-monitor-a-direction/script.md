# 03 · Monitor a direction

This is journey three of Hewn, the software factory: monitor a direction. Once a direction is running, anyone who can see the project opens it and follows the work live, with no refresh. This video walks through how it was built: the live stages, the event flow, the log, the stage detail, and the tests.

## The goal

Journey three is for Owners and Viewers alike. The pipeline shows every stage with an icon and a text label for its status, never colour alone, and a duration. The running stage shows the step it is on and its latest log line. Selecting a stage shows its runs, its log, the files it committed, and the decisions its agent made.

The log follows new lines as they arrive. Scroll up, and it holds still and counts what you have missed. And screen reader users hear stage changes, at most once every five seconds.

## The event flow

Everything on the page comes from one stream. A change is stored with the next sequence number for its project, in the same save as the change itself. Then it is broadcast to the project's group on the SignalR hub. The client store applies each event once, in order, and fetches any it missed by sequence number.

Journey three adds three events: step started, log lines, and decision recorded.

## The worker

Before each step, the worker names it, so the running stage can show it. Log lines no longer go one request at a time. The worker batches them every quarter of a second, up to five hundred at once, and always sends what it has before a checkpoint or a result. Each batch becomes one event.

After a document stage commits, the worker reports the decisions it recorded, with their rationale. Hewn keeps a redacted copy for the Decisions tab, and ignores a decision a resumed step reports twice.

## The project page

The page loads the project once, then folds every event into it. A step started event sets the running stage's step. A log lines event sets its latest line. A stage changed event clears both, because the run has ended.

Selecting a stage loads its runs, artifacts and decisions, and reloads them when an event touches that stage. The tabs work from the keyboard, with the arrow keys, Home and End.

## The live log

The log loads every stored line in pages, then merges new lines by line number, so a line that arrives early is neither lost nor shown twice. While the user is at the bottom, the view follows. Scrolled up, it stays put and counts the new lines.

Above five hundred lines, the log renders only a window around the view, so no more than five hundred line elements are ever in the page. Each windowed line keeps to one row, so the spacers above and below are exact.

## Tests

The backend gained fourteen tests against the real API, and the worker six against a fake API. The backend and worker slices began with their tests failing. All green, the backend has one hundred and forty seven tests, and the worker one hundred and twenty six.

The frontend has thirty five unit tests. End to end, five new pipeline tests drive real workers: a stage turning over live, the log holding when scrolled up, a past stage's tabs, a six thousand line log, and the five second announcements. Accessibility checks now cover every tab, and a visual test compares the waiting state with its mock.

## The screens

Here is a direction starting with one worker. The running stage shows its step and its latest line, both updating live. Bootstrap turns Succeeded, and Idea starts straight away.

Here is the live log. It follows new lines. Scroll up, and it holds, with the count of new lines and a button to jump to the latest. One click, and it follows again.

Now a stage that has finished. Selecting Idea shows its log, its run with the worker that ran it, the files it committed, and the decisions its agent recorded, each with its rationale.

The same page works in dark mode and on a phone. And before any worker has picked up a direction, the page says it is waiting for one.

## Recap

Journey three is complete. Every stage change, step and log line reaches the page live, in order, from one numbered stream. The log follows, holds and stays light, however long it grows. And every stage shows its runs, files and decisions. Next comes journey four, limiting spending.
