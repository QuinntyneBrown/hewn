# 13 · Follow an increment to merge

This is journey thirteen of Hewn, the software factory: follow an increment to merge. Stage ten builds a product one increment at a time, test first, and merges each one on its own. Owners and Viewers want to watch that happen: the failing tests, each attempt to make them pass, the pull request, its checks, and the merge. This video walks through how it was built: the progress the worker reports, stored checks, a signed webhook, a poller, the increment page, and the tests.

## The goal

A user opens an increment and sees red recorded before any implementation, or a flag when the tests passed first. They see each iteration against the cap of ten, and an increment that never goes green blocked with its failing tests, while Hewn moves on. Once the pull request is open, its link and its required checks show live, within a second. And when every check passes, it squash-merges, with no approval.

## The flow

Here is the flow. The worker opens the pull request through the API and reports it. Checks reach Hewn three ways: the worker's own reads, a signed webhook from GitHub, and a poller. Each change is stored, emits a check changed event, and the increment page reads the increment again.

## Progress from the worker

Stage ten already ran test first, then implement until green, then the video, the pull request and the merge. What it didn't do was say so as it went. Now the worker reports the test count with red, the iteration as each one starts, the iteration that went green, the video as recorded or failed with its reason, and the pull request number the moment it opens. The API stamps the time of each step on the increment, and redacts the failing tests and the video note before storing them.

## Stored checks

Required checks are now stored, one row per check, per pull request, per increment. The check recorder takes the project's lock, updates only what changed, and appends a check changed event for each change, under the project's next sequence, before broadcasting it. The worker's own check reads go through the same recorder, so the page sees what the worker sees.

## The webhook

GitHub can tell Hewn about a check as soon as it changes. The webhook is anonymous, so the signature is everything. Hewn computes the H-MAC SHA two fifty six of the raw body with the webhook secret, and compares it with GitHub's header in constant time. No secret configured, no header, a malformed one or a mismatch, and the answer is four oh one, logged with the delivery, the event, the address and the reason, never the body.

## The poller

Webhooks don't always arrive: a self-hosted Hewn may sit behind a firewall. So a poller looks every ten seconds for open pull requests that have been silent for sixty, and reads their checks. Any news, from a webhook, the worker or a poll, resets the clock, so a pull request with working webhooks is never polled.

## The increment page

In Mission Control, each Backlog title now opens its increment. The page follows the mock: a test first timeline on the left, and the pull request on the right. The timeline builds each step from what was stored. Red recorded shows the failing and passing counts. Tests that passed first are flagged, never hidden. And a blocked increment names its failing tests, and the increment Hewn moved on to.

The pull request card shows its title, size and state, then the required checks, each with its status and duration, read out as well as drawn, and announced as they change. Then the body, section by section. If GitHub can't be read, the page says so, with try again.

## Tests

The backend tests came first, and failed with not found and unauthorized. Now eight tests cover red, each iteration and green, tests that passed first, a blocked increment and the one Hewn moved on to, the pull request with its checks and the squash-merge, a signed webhook emitting check changed, unsigned and wrongly signed webhooks refused, the poller after sixty seconds of silence, and Viewers following an increment.

All green, the backend has two hundred and fourteen tests, the worker one hundred and forty four, and the frontend eight new view tests. End to end, there are nineteen new tests: seven for the page's states, six visual comparisons with the mocks, five accessibility checks, and one with a real worker. To make checks visible, the fake GitHub can now take a few seconds per check. The live test watches red, green, the checks turning green and the merge, all without a reload, then sends a signed and an unsigned webhook.

## The screens

Here is Kiln Booking's first increment, opened as stage ten takes it. The tests are written, and red is recorded. The implementation goes green after one iteration, the video is recorded, and the pull request opens. The three required checks turn green one by one, and the increment squash-merges, with its branch deleted.

The merged increment shows every step with its time. It works in dark mode and on a phone.

And here is Parcel Post, whose main workflow never went green. It is blocked after ten iterations, with its failing test, and the pull request was never opened.

## Recap

Journey thirteen is complete. Red is recorded before any implementation, or flagged. Each iteration shows against the cap, and a blocked increment lists what still fails. Required checks arrive by signed webhook or by poll, and turn green live. And the increment squash-merges on its own. Next comes journey fourteen.
