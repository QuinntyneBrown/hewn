# Worker tokens

## Overview

A worker proves who it is with a *worker token*. An Owner creates one on the Workers page, picks an expiry of 30 days, 90 days or 1 year, and copies the token from a dialog that shows it once. Hewn stores only a hash, so a lost token cannot be shown again; the Owner creates a new one.

A token stops working when it expires or when an Owner revokes it. Revoking a token whose worker is connected disconnects that worker within 10 seconds and releases its lease, so the run returns to the queue and resumes elsewhere from its checkpoint (L2-026).

Terms used in this design:

- **worker token** — bearer secret a worker presents when it connects
- **token hash** — SHA-256 of the token, the only form stored

## Description

The slice spans token issue and revocation in the API, the worker's credential check, the worker's own exit and the Workers page.

- **`WorkerToken`** (domain) — id `wtk_…`, the worker name and location the Owner chose, the hex SHA-256 of the token, who created it and when, `ExpiresAt` (30, 90 or 365 days on) and `RevokedAt`/`RevokedBy`. `IsValid(now)` is false once it has expired or been revoked. The `worker_tokens` table has a unique index on the hash.
- **`WorkerTokensController`** — `POST /api/worker-tokens {name, location, expiresInDays}` (Owner; 403 for a Viewer) answers 201 with the token once, under `Cache-Control: no-store`. A name outside 3–40 lowercase letters, digits or hyphens, a location other than Local or Cloud, or another expiry is a field error.
- **`WorkerTokenHash`** — makes `hwt_` + 32 random bytes (base64url) and hashes it. Neither the token nor its hash is ever logged or returned again; `GET /api/workers` carries the worker, not its token.
- **`WorkerTokenAuthenticationHandler`** — authenticates every worker request. An `hwt_` bearer token is looked up by hash and refused with 401 once expired or revoked; it adds the token id as a claim. The configured `HEWN_WORKER_TOKEN` still works as a development token, for a local stack and the e2e suite.
- **`RegisterWorkerHandler`** — a worker on an issued token is named and placed by the token, whatever it calls itself; its host and version are its own.
- **`WorkersController` `POST /api/workers/{id}/revoke`** (Owner) — `RevokeWorkerHandler` revokes the worker's token and every worker on it, saves, then halts and releases any run they lease ("Released: {name}'s token revoked by {login}; resumes from step N"), asks the worker to stop and tells Mission Control the workers changed. 404 for an unknown worker; 409 `configured_token` for one on the development token, which only the API's configuration can withdraw. `LeaseService` never leases to a revoked worker and Workers no longer lists one.
- **Worker** — any 401 throws `TokenRefusedError`. The work loop aborts the step in progress at once (the control poll is held open, so this is within seconds of Revoke rather than at the next heartbeat), ends the loop and exits with code 3, so a container restart policy doesn't hammer the API with a dead token.
- **`WorkerTokenDialog` and `RevokeWorkerDialog` (Angular)** — New worker token takes a name, Local or Cloud and an expiry, then shows the token once with Copy and the `docker run` command. Once it shows, only Done closes the dialog. Revoke confirms, and when the API doesn't confirm it says the token is still active. A Viewer sees neither control.

There is no SignalR hub for workers: they talk to the API over HTTP, and the held control poll is what carries a revocation to a running worker within the 10-second bound. Audit entries for create and revoke wait for the audit log (L2-044, journey 32).

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines the level-1 (L1) requirement cited beside it. The text is copied from `docs/specs/L2.md`.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-041` | `L1-019` | **Worker authentication.**<br>1. Given an Owner, when they create a worker token, then the token is shown once and only its hash is stored.<br>2. Given a token is revoked, when its worker is connected, then the worker is disconnected within 10 seconds and its lease is released.<br>3. Given an Owner creates a token, when they choose an expiry of 30 days, 90 days or 1 year, then the token stops working at that time. |

## Diagrams

### System context

Only an Owner issues or revokes tokens.

![C4 system context for issuing and revoking worker tokens](diagrams/c4-context.png)

### Containers

The Hewn API stores hashes only and checks the worker's token on every request.

![C4 container view for issuing and revoking worker tokens](diagrams/c4-container.png)

### Components

Revoking goes through `RevokeWorkerHandler`, which revokes the token, releases the lease and stops the worker.

![C4 component view for issuing and revoking worker tokens](diagrams/c4-component.png)

### Class structure

`WorkerToken.IsValid` is false after `ExpiresAt` or once `RevokedAt` is set.

![Class diagram for issuing and revoking worker tokens](diagrams/class-structure.png)

### Behaviour — create and revoke a token

The token is shown once and only its hash stored (L2-041 AC1), with a chosen expiry (AC3). Revoking releases the lease at once; the worker's held control poll is refused and it stops within 10 seconds (AC2).

![Sequence diagram: create and revoke a token](diagrams/sequence-create-and-revoke.png)
