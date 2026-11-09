# 01 · Build a new product, part eight: increments

Part seven planned the backlog. Part eight is stage ten, increments. Hewn now builds each increment test first, implements it until a fixed gate is green, records a video, opens a pull request, and squash-merges it once its checks pass, with no human approval.

## What we built

Stage ten asks the API for the next runnable increment, again and again, until none is left. Each increment gets a feature branch from the latest default branch. The first commit holds only acceptance tests, each tracing to the increment's requirements, and the red run is recorded.

Then the agent implements in iterations. Each iteration ends with the gate: backend tests, frontend lint and unit tests, and the end to end suite. After ten failing iterations, the increment is blocked with its failing tests, and work moves on to the next increment that does not depend on it.

## How it fits together

The worker still holds no GitHub credential. Stage ten may commit code only to feature branches, and only progress to the default branch. It may open and merge only its own pull requests, and never touch branch protection.

If the default branch moved, the merge is refused as branch behind. The worker replays its changes onto a fresh checkout, the agent resolves any file both sides changed, and the API moves the branch onto the new head. After three tries, the increment is blocked.

## The code that matters

The pull request is titled after the journey, with its requirement IDs. Its body has six sections: what, design and decisions, API, tests with each command's pass counts, deferred, and notes, and it ends with the Hewn attribution line.

A failed check counts as a failed iteration. A video that fails twice is noted in the pull request and never holds the increment back. After each merge, the merged designs are marked complete and the estimates are committed before the next increment starts.

## Tests first

The backend gained twenty tests: the backlog cursor, blocking, red and early green, the branch and path rules, merging with branch deletion, and branch behind. The worker gained twenty one, covering the guard, the gate, the pull request body, the video check, progress, and every executor path, from block to rebase to conflict.

## The screens

Here is the real app with one worker. The Owner submits. Stages zero to nine run, then stage ten takes each increment through its tests, iterations, video, pull request and merge, and the direction completes.

## Recap

Each increment now ships test first, through a green gate and a merged pull request, and the project's progress updates after every merge. Next, the last part of journey one: recorded decisions and the no approval end to end test.
