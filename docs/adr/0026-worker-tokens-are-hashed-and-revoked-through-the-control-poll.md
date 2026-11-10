# 0026. Worker tokens are hashed, name their worker, and are revoked through the control poll

- **Status:** Accepted
- **Date:** 2026-11-10
- **Requirements:** L2-041, L2-026

## Context

L2-041 asks that an Owner creates a worker token that is shown once and stored only as a hash (AC1), that revoking
it disconnects a connected worker within 10 seconds and releases its lease (AC2), and that it stops working at the
expiry the Owner chose: 30 days, 90 days or a year (AC3). The worker-tokens design names a `WorkerDisconnector`
that aborts the worker's SignalR connection. Workers have no SignalR connection: they talk to the API over HTTP,
and while a run executes they hold a control poll open (L2-029). Until now every worker shared one token set in the
API's configuration, `HEWN_WORKER_TOKEN`, which the local stack and the e2e suite rely on.

## Decision

- **A token is `hwt_` plus 32 random bytes, base64url.** The API stores its hex SHA-256 with a unique index and
  answers the create request with it once, under `Cache-Control: no-store`. No other response carries it, and it is
  never logged. The prefix makes a leaked token easy to recognise and lets the authentication handler tell an issued
  token from the configured one without a lookup.
- **The token names its worker.** The Owner gives the name and location when creating it; a worker that registers
  with the token takes both, whatever it calls itself. What Workers shows is what the Owner chose, and Revoke
  names the right machine.
- **Revoke is per worker, on its row.** `POST /api/workers/{id}/revoke` revokes the worker's token and every
  worker on it, then halts and releases any run they lease. That run waits at its checkpoint and goes to the next
  worker, as after Stop all workers. It also asks the worker to stop.
- **The control poll carries the revocation.** Every worker request is authenticated by hash, so the held control
  poll or the next heartbeat (every 10 seconds) is refused with 401. The worker then aborts the step it is running
  and exits with code 3, so a container restart policy doesn't loop on a dead token. Nothing needs to reach into a
  connection.
- **The configured token stays as a development token.** `HEWN_WORKER_TOKEN` still authenticates, so the local
  stack and the e2e suite need no Owner to create a token first. Revoking a worker on it is refused with 409
  `configured_token`; only the API's configuration can withdraw it.

## Alternatives

- **A SignalR hub for workers, as the design drew it.** That would add a second transport to every worker for one
  signal the control poll already carries within the bound.
- **Revoke tokens from a list of tokens.** Owners think in machines, not tokens, and a worker row is where they see
  one misbehave. A token list can come with the audit log.
- **Hash with a slow KDF (bcrypt, Argon2).** Tokens are 256 random bits, so they cannot be guessed offline, and a
  fast hash keeps per-request authentication cheap.

## Consequences

- Leaking the database leaks no usable token; leaking a token is undone by Revoke within 10 seconds.
- A worker that loses its token must be given a new one; there is no way to show it again.
- Create and revoke are not yet audited. They will be when the audit log arrives (L2-044, journey 32).
- A deployment that wants issued tokens only should leave `HEWN_WORKER_TOKEN` unset.
