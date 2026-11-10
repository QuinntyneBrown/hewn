# 0022. The API serves Mission Control with its protections, and ends sessions by id

- **Status:** Accepted
- **Date:** 2026-11-10
- **Requirements:** L2-038, L2-043

## Context

L2-038 asks that unauthenticated pages redirect to sign-in (AC1) and that a session end at 8 hours or on sign-out,
so a replayed cookie is refused (AC3). L2-043 AC2 asks that every page carry a Content-Security-Policy without
unsafe-inline scripts, `frame-ancestors 'self'` and `X-Content-Type-Options: nosniff`. Until now Mission Control
was only served by `ng serve` in development, so neither the redirect nor the headers had a server to live in. A
cookie session is self-contained: signing out clears it in the browser, but a copy of it stays valid until it
expires. The sign-in design named an ASP.NET Core GitHub OAuth handler; Hewn has no other OAuth providers and
tests need to run sign-in without GitHub.

## Decision

- **The API serves the built app.** `Hewn:MissionControl:Root` points at the Angular build. Its files and
  `/sign-in` need no session; any other page without one redirects to `/sign-in?returnUrl=`. Unknown `/api`,
  `/hubs`, `/preview` and `/health` paths stay 404, never the app.
- **Headers on every response.** `nosniff` everywhere; HTML that sets no policy of its own (previews do) gets
  `default-src 'self'`, `script-src 'self'`, `style-src 'self' 'unsafe-inline'`, `img-src` for GitHub avatars,
  `frame-src` for the preview origin, `frame-ancestors 'self'`, `base-uri`, `form-action 'self'`, `object-src
  'none'` and `Referrer-Policy: same-origin`.
- **One script hash.** Angular's build inlines `onload="this.media='all'"` to load its stylesheet without blocking.
  `script-src` allows exactly that handler by hash with `'unsafe-hashes'`, not `'unsafe-inline'`.
- **A small OAuth flow of our own.** `GET /api/auth/github` sends the browser to GitHub with a one-time state in a
  protected `hewn.oauth` cookie; the callback checks it, exchanges the code through `IGitHubIdentity` (30 s
  timeout), checks the allow list and signs in. Failures, refusals and cancels return to `/sign-in` with a reason
  the page shows. Tests and the e2e stack swap in a fake identity and a fake authorize page.
- **Sessions carry an id, and sign-out revokes it.** The cookie holds a `hewn:sid` claim. Sign-out writes it to
  `revoked_sessions` with its expiry, and every request checks it against `RevokedSessions`, an in-memory set loaded
  once from the database, so the check costs no database read.

## Alternatives

- **Serve the app from a CDN or static host.** The redirect and headers would move into that host's config, out of
  reach of the API's tests, and the session check would happen only after the app loads.
- **A nonce for the stylesheet handler.** Needs the index rewritten per request; the build's handler never
  changes, so a hash is enough.
- **The ASP.NET Core GitHub OAuth handler.** Its correlation and ticket handling are hard to drive from tests
  without GitHub, and its error paths don't map to the sign-in page's states.
- **Short sessions with refresh.** Shrinks the window for a stolen cookie but adds a refresh flow and still leaves a
  window; L2-038 asks for 8 hours.

## Consequences

- The revoked set lives in each API process. Hewn runs one API instance; a second would need the set shared or the
  database read per request.
- Revoked rows can be pruned once past their expiry; nothing prunes them yet.
- A change to Angular's stylesheet loader changes the hash, and the page's styles fail to apply; the e2e and
  visual tests catch it only if they run against the API, not `ng serve`.
