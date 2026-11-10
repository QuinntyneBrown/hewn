# 0018. Previews are served from a separate origin, signed and sandboxed

- **Status:** Accepted
- **Date:** 2026-11-10
- **Requirements:** L2-011, L2-012 AC4

## Context

Stage 2 exports each screen and state as HTML in the project's repository (`docs/mocks/`), and stage 3 adds the
design system's pages (`docs/design-system/`). Mission Control shows them (L2-011 AC1), but the HTML came from a
generated design, so it is untrusted: it must render from a separate origin inside a sandboxed iframe that can't
read Mission Control's cookies or storage (AC2). The preview also has to show the page at 375 to 1200 px and in
light or dark (AC3). The design named a preview host and a short-lived signed URL, and left the token's lifetime
`<TO SUPPLY>`.

## Decision

- **The API is the preview host, on another host name.** `GET /preview/{token}/{path}` is mapped only for the
  host in `Hewn:Preview:Origin` (`RequireHost`), such as `mocks.hewn.dev`, or `127.0.0.1:{port}` locally while
  Mission Control is on `localhost`. On Mission Control's own host the route doesn't exist (404). Cookies are kept
  per host, so the browser never sends Mission Control's session to it, and the endpoint neither reads nor sets one.
- **A signed token is the only credential.** `PreviewTokens` signs `{project}.{sha}.{expiry}` with HMAC-SHA256
  under a 32-byte key made at start-up. `GET /api/projects/{id}/designs`, which needs a session, hands out the URLs.
  A token covers one project's files at one commit, so a mock's relative links (its CSS or another state) work too.
  It lasts **60 minutes** (`Hewn:Preview:TokenMinutes`). A tampered or expired token gets 404.
- **Only two roots, at the signed commit.** Paths must sit under `docs/mocks/` or `docs/design-system/`, with no
  empty, `.` or `..` segments. The file is read from GitHub at the token's SHA and cached by project, SHA and path.
  It never changes, so the cache doesn't go stale.
- **Sandboxed twice.**
  - The iframe has `sandbox="allow-scripts"` and no `allow-same-origin`, so the page runs in an opaque origin.
    `document.cookie`, `localStorage` and `parent.document` all throw.
  - The response carries `Content-Security-Policy: sandbox allow-scripts`, so a preview URL opened on its own tab
    is sandboxed the same way. It also sends `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer`.
- **Width by layout, theme by query.**
  - The iframe is laid out at exactly the chosen width and scaled down to fit the frame, so the page's media
    queries see 375, 576, 768, 992 or 1200 px.
  - `?theme=light|dark` makes the host set `data-theme` on the page's `<html>`, which the exported mocks theme by.
- **Thumbnails are the page itself, small.** Each state's thumbnail is the same sandboxed preview, lazily loaded
  and scaled to the gallery's thumbnail, rather than a stored PNG.

## Alternatives considered

- **A separate static host process**: another deployable, with nothing to gain over a host-restricted route in the
  API, which already holds the GitHub credentials.
- **`srcdoc` with the HTML inlined**: the frame inherits nothing with the sandbox, but relative links break, and
  Mission Control would fetch and handle untrusted HTML itself.
- **Data Protection's time-limited protector**: it reads the wall clock rather than `TimeProvider`, so expiry can't
  be tested, and its keys persist for no benefit. A preview link is meant to die with the process.
- **Rendered PNG thumbnails** (the design's `ThumbnailRenderer`): a headless browser in the API or another worker
  step, and stored images to keep in step with each commit. A small live frame is always current.

## Consequences

- Restarting the API invalidates every preview link, and a page left open over an hour shows a 404 in its frame
  until it is reloaded.
- Production must give the preview origin its own host name, never a path on Mission Control's.
- A thumbnail costs a request and a render per state. The frames load lazily, and files come from the cache.
- A mock that themes only by `prefers-color-scheme` follows the viewer's system, not the Theme control. Chromium
  doesn't carry an iframe's `color-scheme` into a cross-origin page, so `data-theme` is the contract. Hewn's mocks
  and the fake Magic Patterns exports both honour it.
