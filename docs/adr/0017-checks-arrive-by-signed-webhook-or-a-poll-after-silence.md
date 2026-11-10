# 0017. Checks arrive by signed webhook, the worker's reads, or a poll after 60 s of silence

- **Status:** Accepted
- **Date:** 2026-11-09
- **Requirements:** L2-024, L2-025, L2-031, L2-037

## Context

An increment's pull request merges once its required checks pass (L2-025 AC1), and Mission Control shows the link
and live check status within 1 second (L2-024 AC3). L2-037 asks that check results arrive by GitHub webhook, or by
polling every 60 seconds when webhooks aren't delivered, that each change emits an event, and that unsigned or
invalid webhook requests get 401 and are logged. Until journey 13 the worker read checks through the API to
decide the merge, and nothing was stored or shown.

## Decision

- **Store checks per increment** in `increment_checks` (increment, pull request, name, status, conclusion, start
  and finish). `CheckRecorder` upserts them under the project's lock and appends `CheckChanged` for each row that
  actually changed, saves, then broadcasts, like every other event.
- **Three intakes, one recorder.** The worker's check reads (it keeps polling to decide the merge), a signed
  `check_run` webhook, and `CheckPoller` all record. Each stamps `ChecksHeardAt` on the increment.
- **Verify the webhook before reading it.** HMAC-SHA256 of the raw body with `HEWN_GITHUB_WEBHOOK_SECRET`,
  compared in constant time against `X-Hub-Signature-256`. With no secret configured every request is refused.
  Refusals are 401 with code `webhook_signature_invalid` and a log line naming the delivery, event, IP and reason.
- **Poll only after silence.** Every 10 seconds the poller reads checks for in-progress increments with a pull
  request whose `ChecksHeardAt` (or opening) is over 60 seconds old.

## Alternatives considered

- **Webhook only**: a self-hosted Hewn behind a firewall gets no deliveries, and a dropped delivery would leave a
  check stale until the worker read it.
- **Poll every open PR every 60 s regardless**: GitHub rate limits spent on PRs whose webhooks already arrived.
- **Keep checks only in events**: the page would replay events to show the current state; a row per check is
  read in one query.

## Consequences

- A webhook delivery for a check on a PR Hewn doesn't track is accepted (202) and ignored.
- The increment page reads the pull request's body and size from GitHub on each load, so a GitHub outage shows as
  the page's error state while the stored checks are still current.
