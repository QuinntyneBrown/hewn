# 0005. Leases on SQLite: one conditional update, the epoch as a concurrency token

- **Status:** Accepted
- **Date:** 2026-11-09
- **Requirements:** L2-026 AC2-AC4, L2-050

## Context

The worker-loop design grants a lease with one conditional statement and protects every fenced write with
a run row lock (`SELECT … FOR UPDATE`, the `RunWriteLock`). SQLite, the only provider for now
([ADR 0002](0002-sqlite-first.md)), has no row locks. The design also has the API issue worker tokens from
the Workers page, which does not exist yet.

## Decision

- **Grant.** `LeaseService.TryLeaseAsync` picks the oldest queued run whose project holds no lease, then runs
  one `UPDATE … WHERE Id = @run AND Status = 'Queued' AND NOT EXISTS (leased run of the same project)` that
  sets the worker, raises `LeaseEpoch` and sets the expiry. Zero rows changed means another worker won; it
  tries the next candidate. SQLite serialises writers, so the statement is atomic.
- **Fence.** Every worker call that names a run carries the worker ID and epoch; the handler refuses a
  mismatch with 409 `lease_lost`. `LeaseEpoch` is an EF concurrency token, so a write whose read raced a
  re-grant or an expiry fails at `SaveChanges` and is refused the same way. This replaces the row lock for
  the writes that exist today (heartbeat, checkpoint, result).
- **Expiry.** `LeaseReaper` runs a single `UPDATE` that returns leases with no heartbeat for 60 seconds to
  the queue, keeping the checkpoint, at start-up and every 10 seconds.
- **Worker token.** Until the Workers page issues tokens, the API and workers share one `HEWN_WORKER_TOKEN`
  from the environment, checked by a dedicated authentication scheme with a constant-time comparison. Worker
  endpoints accept only that scheme; user endpoints never accept it.

## Consequences

- The behaviour the tests pin (one lease per project, epoch fencing, expiry) carries over unchanged to a
  server database, where the row lock can be added for the git and GitHub write broker when it arrives.
- A shared token cannot be revoked per worker. Issued, revocable tokens come with the Workers page.
