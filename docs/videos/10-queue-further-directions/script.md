# 10 · Queue further directions

This is journey ten of Hewn, the software factory: queue further directions. An Owner doesn't stop having ideas while a direction runs. Hewn should take the next one straight away, hold it in line, and start it by itself when its turn comes, without letting any one Owner flood it. This video walks through how it was built: the queue, starting the next direction, the submission limit, the page, and the tests.

## The goal

An Owner submits further directions on a project while one is running. They queue, first in, first out, with one active direction per project, and different projects run in parallel. An Owner who submits more than ten directions in a minute gets a 429 for the extra ones, saying when they can submit again.

## The queue

Most of the queue has been there since journey two. A project's active direction is the one running, paused or blocked, or else its oldest queued one. Adding a feature direction checks for an active direction first: when there is one, the new direction stays queued behind it, and the handler only starts it when nothing else is active.

## Starting the next

When a direction completes, the orchestrator looks for the oldest queued direction other than the one that just ended, and starts it, instead of setting the project Idle. Cancelling a direction has taken the same path since journey seven. Each project has its own active direction, so a queue on one project never holds up another.

## The limit

What's new in this journey is the limit. A pipeline behavior runs ahead of validation for the two submit commands. Holding a lock for this Owner, it counts the directions they stored in the last sixty seconds, by the injected clock. At the limit, it works out when the oldest of them leaves the minute, and throws.

The API turns that into a 429 with the code rate limited, the limit, the seconds to wait, and a Retry After header. Counting stored directions, instead of using ASP.NET's own rate limiter, means a restart doesn't forget the count, refused and invalid requests don't use up the minute, and the tests can move the clock. ADR fifteen records that choice.

## The page

On New direction, the API library turns the 429 into a rate limited problem, and the page shows the warning callout from the mock: too many directions in a minute, how many were submitted, and when the Owner can submit again. Nothing they typed is lost, and Start direction stays disabled until the wait is over. It works in dark mode and on a phone.

## Tests

Each slice began with its tests failing. The backend gained four tests against the real API: the eleventh submission refused with the right wait and nothing created, the minute sliding on the test clock, refused and invalid requests not counting with each Owner limited separately, and the setting that changes the limit. The frontend gained four unit tests for the 429 and the callout's wording.

All green, the backend has one hundred and ninety eight tests, the worker one hundred and forty, and the frontend ninety seven unit tests. End to end, there are three new tests. One submits two feature directions on a running project and watches each start by itself, first in, first out, with a real worker. Another fills a second Owner's minute and checks the rate limited state, and a visual test compares that state with its mock. There are fifty six end to end tests in all.

## The screens

Here is Ledgerline, with its product direction running. The Owner opens New direction, chooses Feature for a product, picks Ledgerline, and adds a CSV export to the reconciliation report. Back on the project page, a callout says one direction is queued and names it. Then a second feature, emailing the reviewer a summary when a month is closed. Now two directions are queued, and the callout names the one that starts next.

The queue reads the same in dark mode and on a phone.

The product direction reaches its last stages. When it is Complete, the CSV export starts by itself as a feature direction, with its skipped stages struck through, and the callout counts the one still waiting. Nobody pressed anything.

And here is a second Owner who has already submitted ten directions in the last minute. The eleventh is refused: the callout says when they can submit again, and the form keeps everything they typed.

## Recap

Journey ten is complete. Further directions queue first in, first out, one active direction per project, and each starts by itself when the one before it is Complete or Cancelled. An Owner can submit ten directions a minute; the extra ones get a 429 saying when to try again, and the page keeps what they typed. Reordering or removing queued directions comes later. Next comes journey eleven: find a project.
