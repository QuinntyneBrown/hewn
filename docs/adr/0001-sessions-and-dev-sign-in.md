# 0001. Cookie sessions against the allow list, with a dev sign-in until GitHub OAuth

Date: 2026-11-08 · Status: Accepted · Requirements: L2-038, L2-039, L2-043

## Context

Journey 1 needs authenticated Owners and Viewers from its first slice: submitting a direction is an
Owner-only state change, and every endpoint requires authentication. GitHub OAuth sign-in is journey 20
and needs a registered OAuth app, which tests and local runs do not have.

## Decision

- Sessions are ASP.NET Core cookie authentication: `hewn.session`, `HttpOnly`, `Secure`, `SameSite=Lax`,
  absolute expiry of 8 hours with no sliding renewal. The role (`Owner` or `Viewer`) is a claim taken from
  the allow list at sign-in.
- The allow list lives in the `allow_list` table and is seeded from `HEWN_ALLOWED_GITHUB_USERS`
  (`login[:Role]`, Owner by default) by `hewn seed`, which is idempotent.
- `POST /api/auth/dev/sign-in` signs in an allow-listed login without GitHub. It exists only when
  `Hewn:Auth:DevSignIn` is `true` (tests, the e2e API and the local stack) and answers 404 otherwise.
  GitHub OAuth replaces it as the production path in journey 20; the session and allow list stay.
- Writes need the anti-forgery token: `GET /api/me` issues the `XSRF-TOKEN` cookie and Angular echoes it in
  `X-XSRF-TOKEN`. A global filter validates POST, PUT, PATCH and DELETE after authorization, so 401 and 403
  win over a missing token.

## Consequences

- Every later slice can rely on `ICurrentUser` and the `Owner` policy.
- The dev sign-in must never be enabled in a deployed environment; deployment configuration leaves it off.
