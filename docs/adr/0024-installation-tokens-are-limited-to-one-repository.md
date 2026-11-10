# 0024. Installation tokens are limited to one repository; creating one only administers

- **Status:** Accepted
- **Date:** 2026-11-10
- **Requirements:** L2-036, L2-001

## Context

L2-036 AC3 says every call Hewn makes to GitHub uses a GitHub App installation token limited to the project's
repository. Every call already did, except repository creation (AC1). A repository that doesn't exist yet can't be
named in a token, so creation asked for an installation token with no restriction at all. That token could do
anything the App may do, on every repository it is installed on. The connect-to-GitHub design also left the App's
permission set `<TO SUPPLY>`.

## Decision

- **Every operation on a project's repository** exchanges the App's JWT for a token with
  `repositories: [name]`. This covers checking write access at submit (L2-001 AC4), commits, pull requests, checks,
  protection and reads.
- **Creating a repository** uses an account token that asks only for `permissions: {administration: write}`. That
  token is used for `POST orgs/{owner}/repos` and nothing else. Tagging the new repository `hewn` uses a token
  limited to it.
- **The App's permissions:**
  - Repository Administration (write): to create repositories and set branch protection.
  - Contents (write).
  - Pull requests (write).
  - Checks and Commit statuses (read).
  - Metadata (read).
  - It is installed on the configured owner, which must be an organization: an installation token can't create a
    repository under a personal account.
- **Tokens never leave the API.** Workers send mutations; the API holds every token.

## Alternatives

- **Narrow each repository token to the permissions its call needs.** This is tighter, but it means a permission
  map per call, for little gain once the token is limited to one repository.
- **Create repositories with a user's OAuth token.** This would allow personal accounts, but it ties creation to
  one person's sign-in and scopes.
- **Cache tokens for their hour.** This means fewer exchanges, but a cache holding secrets. It is deferred until
  the rate limit calls for it.

## Consequences

- A leaked creation token could create or administer repositories under the owner, but couldn't read or write any
  repository's contents. A leaked repository token reaches one repository for at most an hour.
- Each operation costs one extra request to exchange a token.
- The real `GitHubAppRepositories` is checked against a stub GitHub that records each exchange. It is unverified
  against live GitHub until the App is registered.
