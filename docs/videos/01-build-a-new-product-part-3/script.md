# 01 · Build a new product, part three: bootstrap the repository

Part two ran every stage with a scripted stand-in. In part three, stage zero does real work. Hewn creates the product's private repository, then copies the Greenlit skills into it and records exactly what it copied, so every later stage can rely on the same skills.

## What we built

Two pieces share the job. When a worker first leases stage zero, the API creates the repository under the configured GitHub owner, named from the project in lowercase kebab case. Then the worker's bootstrap executor clones Greenlit, copies the skill folders, writes a lock file and commits.

The worker never holds a GitHub credential. It reads and writes the repository only through the API, which checks the lease on every call.

## How it fits together

Creation is idempotent. If an earlier attempt created the repository but crashed before recording it, the API finds a fresh repository carrying the hewn topic and adopts it. A name taken by anything else fails the stage with the reason, and the project shows Blocked.

The commit goes through a fenced mutation with an idempotency key made of the run and the step. A worker that resumes after a crash repeats the request and gets the first commit back, never a second one. Stage zero may write only the two skill folders and the lock file; any other path is refused.

## The code that matters

The bootstrap executor has two steps. The first clones the skills source named in the lease. The second asks the API which skill folders already exist, keeps those untouched and logs each one as kept existing, then commits everything else with the message Bootstrap skills from greenlit, at the short commit SHA.

The lock file records the source, the full commit SHA and the names of the skills it copied. If Greenlit can't be reached, the run fails with Greenlit unreachable, and nothing more.

## Tests first

The backend gained thirteen acceptance tests against an in-memory GitHub: creation, adoption, a taken name, the path rules, idempotency, a stale epoch, and redacted run logs. The worker gained six, against a real local git repository standing in for Greenlit. Playwright builds the same kind of fixture and runs stage zero for real.

## The screens

Here is the real app, with one worker running. The Owner names the project and submits. The page opens with every stage Pending. Moments later the worker leases stage zero, the API creates the repository, and its link appears in the header without a reload. Stage zero copies the skills and succeeds, and stage one starts straight after it. The remaining stages are still scripted for now.

The link sits beside the direction on desktop, and wraps neatly on a phone in the dark theme.

## Recap

Stage zero now creates the repository and installs the skills, with no credential on the worker and no repeated commits. Next, the document stages: idea, stack, requirements, detailed designs and user journeys.
