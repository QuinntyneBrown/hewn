# 0015. The direction submission limit counts stored directions

- **Status:** Accepted
- **Date:** 2026-11-09
- **Requirements:** L2-043, L2-004, L2-005

## Context

L2-043 AC4 asks that an Owner who submits more than 10 directions in a minute gets 429 for the extra requests. The
web-protections design names a `DirectionSubmissionRateLimiter`: ASP.NET Core's fixed-window limiter, 10 permits a
minute partitioned by user. The rate-limited mock says "You’ve submitted 10 in the last minute. You can submit
again in 42 seconds; nothing you typed is lost."

## Decision

- **Count what was stored.** A MediatR behavior, `DirectionSubmissionLimit`, runs for the two submit commands
  (both marked `IDirectionSubmission`). It counts the directions the Owner submitted in the last 60 seconds by the
  injected clock. At the limit it throws `TooManyRequestsException`, which the API maps to 429 ProblemDetails
  `{code: "rate_limited", limit, retryAfterSeconds}` with a `Retry-After` header. `retryAfterSeconds` is when the
  oldest counted submission leaves the minute.
- **It runs before validation**, so an Owner over the limit gets 429 even for an invalid form. Anti-forgery, an
  ASP.NET filter, still runs first, so the order is headers, anti-forgery, the limit, then validation; the design
  put the limiter ahead of anti-forgery. A refused or invalid request stores nothing, so it does not count.
- **One submission per Owner at a time.** A per-login lock around counting and storing stops two simultaneous
  requests from both being the tenth.
- **The limit is configuration:** `Hewn:RateLimit:DirectionsPerMinute`, default 10. The backend tests prove 10
  on the test clock. The e2e stack allows 30, because its suites submit many directions as one Owner within a
  minute, and its rate-limit test uses a second Owner, `grace`.

## Alternatives considered

- **ASP.NET Core's rate limiter**: it keeps its counts in memory, so a restart forgets them. It counts requests, so
  refused or invalid submissions would use up the Owner's minute. It runs on its own clock, so the tests could not
  move time, and a fixed window allows up to 20 in a minute across a window edge.
- **Count `DirectionQueued` events**: the same answer as counting directions, with an extra join.

## Consequences

- The limit holds across restarts and across API instances that share the database. The per-login lock is per
  process, so two instances could each let one extra submission through at the same moment.
- Mission Control shows the refusal in New direction's rate-limited state and keeps the form as typed.
