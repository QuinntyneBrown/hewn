# 0021. Increment videos are served through the Hewn API from the commit that recorded them

- **Status:** Accepted
- **Date:** 2026-11-10
- **Requirements:** L2-023

## Context

Stage 10 records each increment's captioned walkthrough to `docs/videos/{slug}/` in the product repository and
links it from the pull request (L2-023 AC1, AC2). Mission Control must play it on the increment page. Product
repositories are private, so the browser can't fetch the file from GitHub itself, and the record-increment-video
design left open whether to hand out signed raw URLs or proxy through the API. The increment's branch is deleted
after the squash merge, but its commits stay reachable by SHA, and Hewn keeps every commit a run makes, with its
paths and SHA, in the run's GitHub mutations.

## Decision

- **Proxy through the API.** `GET /api/projects/{id}/increments/{n}/video` answers the MP4, with byte ranges so the
  player can seek, and `.../video/captions` answers the WebVTT track. Both use the session cookie and the usual
  rules: anonymous is 401, an unknown project or increment is 404.
- **Read at the recording commit.** The API finds the latest stage 10 commit whose paths include
  `docs/videos/{slug}/{slug}.mp4` (or `.vtt`) and reads the file at that SHA, through the blob API for files over
  1 MB. The same file is on the default branch after the merge, but the commit is known before the merge, too.
- **Linked only when Recorded.** The increment detail carries `videoUrl` and `captionsUrl` when the video was
  Recorded, else null; the endpoints answer 404 `no_video` without one. `NotFoundException` now takes a code.
- **The pull request body links the MP4 on GitHub at that commit**, since a relative link in a PR body resolves
  under `/pull/N` and breaks.

## Alternatives

- **Signed raw URLs from GitHub.** Short-lived download URLs expire while the page is open, would need refreshing
  for seeking, and put a GitHub token in a URL the browser can see.
- **Copy the video into Hewn's storage.** Duplicates up to a few hundred MB per increment and needs its own
  retention.

## Consequences

- Each play reads from GitHub; responses are cached privately for 5 minutes, and a ranged request reads the whole
  file once per request. Videos are at most 3 minutes at 1080p, so this is acceptable for now.
- A video rewritten outside Hewn after the increment isn't shown; the page plays what the increment recorded.
