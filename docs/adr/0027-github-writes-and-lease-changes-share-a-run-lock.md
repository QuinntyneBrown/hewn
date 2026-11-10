# 0027. GitHub writes and lease changes share a run lock

- **Status:** Accepted
- **Date:** 2026-11-10
- **Requirements:** L2-050, L2-026

## Context

L2-050 AC3 asks that a resumed run continue from its last checkpoint with no completed step run twice, and the
worker-loop design adds that a stale worker cannot write. Every worker request is fenced: the API compares the
request's worker and epoch with the run's lease. But a GitHub write fenced its lease and then called GitHub, so in
between the lease could expire and be granted to another worker, and the old worker's write still landed. The
design called for a `RunWriteLock` as a row lock (`SELECT … FOR UPDATE`), which SQLite does not have
([ADR 0005](0005-leases-on-sqlite.md)). It also called for a git sidecar and a `CheckpointReconciler`, for workers
that push with git.

## Decision

- **An in-memory lock per run.** `RunWriteLock` keeps one semaphore per run, with a 30-second ceiling. A GitHub
  write takes it before its fence check and keeps it until the write is recorded. Granting a lease and expiring
  one take it for the run they change.
- **Expiry loads, logs and saves each run under the lock.** It replaces the single bulk update, so the Owner sees
  each expiry and each resume in the run log.
- **Idempotency keys instead of a reconciler.** Workers write to GitHub only through the API, one commit per
  call, keyed by run and step. A repeated step gets its first result back, and there is no partial branch state
  to repair.

## Consequences

- A stale worker's writes either finish before the reassignment or are refused after it; none interleave.
- An expiry can wait up to 30 seconds behind a slow GitHub call. A lease that a worker renews in that time is kept.
- The lock only works within one API process. Running more than one would need a database lock (PostgreSQL's
  `FOR UPDATE`) or a lease table update in the same transaction.
- If workers ever push with git, the sidecar and reconciler come back.
