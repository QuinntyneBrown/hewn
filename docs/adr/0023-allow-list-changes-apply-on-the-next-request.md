# 0023. Allow-list changes apply on the next request, and new logins are confirmed with GitHub

- **Status:** Accepted
- **Date:** 2026-11-10
- **Requirements:** L2-038, L2-039

## Context

L2-038 AC5 lets an Owner add a GitHub login to the allow list as Owner or Viewer, or remove one. A session cookie
carries the login and role it signed in with, for 8 hours (ADR 0022). If only sign-in consulted the allow list, a
removed login would keep its access for up to 8 hours. The add-user mock's failed state ("GitHub couldn't confirm
the login exists") also implies the login is checked with GitHub before it is added.

## Decision

- **Every request checks the session against the allow list.** `OnValidatePrincipal` asks `IsSessionValidQuery`:
  the session wasn't signed out, and its login is still listed with the role it signed in with. Otherwise the
  cookie is rejected and the request is 401.
- **`AllowListAccess` holds logins and roles in memory**, like `RevokedSessions`, so the check costs no database
  read. A login it doesn't hold yet is read once from the database; adding and removing through Hewn keep it
  current.
- **A new login must exist on GitHub.** `IGitHubIdentity.FindLoginAsync` calls `GET /users/{login}`: a 404 is the
  field error "No GitHub account is called @x."; any other failure, such as a rate limit, is 502 `github_failed`
  and nothing is added.
- **An Owner can't remove themselves** (409 `cannot_remove_yourself`), so the list always keeps an Owner.
- Roles aren't edited in place; to change one, remove the login and add it again.

## Alternatives

- **Read the allow list from the database on each request.** Simple, but a database read per request, and SQLite
  locks under the hub's concurrent writes.
- **Short sessions instead of a per-request check.** A removed login keeps access until its session expires.
- **Add logins without asking GitHub.** A typo would sit on the list, and nobody could sign in with it.

## Consequences

- One API instance (as ADR 0022); a second would need the cache shared or invalidated.
- A login removed or re-roled directly in the database, outside Hewn, keeps its cached role until the API restarts.
- A removed user's open Mission Control reloads at sign-in with the expired message, and is refused if they sign in
  again.
