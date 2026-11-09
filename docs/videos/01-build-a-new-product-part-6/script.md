# 01 · Build a new product, part six: the scaffold

Part five designed the screens and extracted the design system. Part six is stage six, the scaffold. Hewn generates a working solution for the chosen stack, merges it through a pull request once continuous integration passes, and then makes those checks required on the default branch.

## What we built

Stage six has no agent. It reads the stack decision from stage four and picks a stack template. The default template is a dot net ten API with xUnit tests, an Angular twenty-one workspace with linting and unit tests, an empty Playwright suite, and a GitHub Actions workflow with three jobs: backend, frontend and end to end.

The executor has four steps: generate the scaffold, open the pull request, wait for checks, then merge and protect.

## How it fits together

The worker still holds no GitHub credential. The API gained three mutations: open a pull request, merge it, and protect the default branch, plus an endpoint that reads the pull request's checks. Only stage six may use them, and only for its own branch, hewn slash scaffold. Every other stage is refused.

Every write is keyed by run and step. After a resume, the later steps ask to open the pull request again with the same key, and get the first one back, so nothing is ever opened twice.

## The code that matters

The check waiter reads the pull request's checks until every template check has completed. Anything other than success fails the run, naming the failed checks, and nothing is merged. After the merge, branch protection requires the same three checks, so no later change merges without them.

The template writes files rather than running generators, so it is fast and deterministic. To prove it really builds, a new CI job in Hewn generates the scaffold on every change and runs the scaffold's own CI commands.

## Tests first

The backend gained eight tests: the branch and path rules, opening twice with one key, a failing check, merging and protecting. The worker gained six, covering the steps, a failed or unfinished CI run, and a stack with no template. And the generated scaffold built, linted and passed its own tests, both locally and in CI.

## The screens

Here is the real app, with one worker and the fake GitHub, which runs each workflow job instantly. The Owner submits. The stages run as before, and stage six commits the scaffold to its branch, opens the pull request, sees CI pass, merges, and protects the branch, all in a couple of seconds. Then the direction completes.

And this is the scaffold's own Angular app, built from the generated files.

## Recap

Stage six now merges a real, tested scaffold through a pull request, and the default branch requires its checks from then on. Next, stage nine: estimates and automatic descoping.
