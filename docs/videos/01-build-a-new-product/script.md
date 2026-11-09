# 01 · Build a new product

This is journey one of Hewn, the software factory: build a new product. An Owner types a product direction into Mission Control, and Hewn turns it into a working, tested product in a GitHub repository. It runs eleven stages and asks nobody anything along the way. This video walks through the whole implementation, from the form to the last merged pull request.

## The goal

Journey one is for Owners. They want a product, not a project to manage. Hewn takes a name, an idea, an optional stack and a budget, and from there it works alone: it writes the documents, designs the screens, scaffolds the code, plans the work and ships it in small increments.

The pipeline has eleven stages. Bootstrap, idea, designs, design system, stack, requirements, scaffold, detailed designs, user journeys, estimates and increments. Each stage runs on a worker, and each one ends in a commit to the product's repository.

## The architecture

Three parts work together. Mission Control is the Angular app the Owner watches. The Hewn API is a dot net service that owns the pipeline, the database and every GitHub credential. Workers are Node processes that lease one stage at a time and do the work.

A worker leases a run, sends heartbeats, and checkpoints after each step. Every request carries the lease's epoch, so a worker that lost its lease is fenced out and can never write after another worker took over.

Workers never hold a GitHub credential. Every write goes through the API's broker: commits, pull requests, merges and branch protection. Each is keyed by run and step, so a resumed worker gets the first result back instead of writing twice. And a commit policy decides, per stage, which branches and paths that stage may write.

## The stages

Stage zero creates or connects the repository, and copies in the Greenlit skills the agents follow, pinned in a lock file.

Stages one, four, five, seven and eight write documents. The agent writes the brief, the stack decision, the requirements, the detailed designs and the user journeys. Then a validator checks each document before anything is committed. If it fails, the run fails, and nothing reaches the repository.

Stages two and three design the product through Magic Patterns. Stage two creates one design per screen in four states, and exports the mocks. Stage three extracts a design system, with tokens and component pages, and checks that every colour the mocks use is a token.

Stage six generates the scaffold for the chosen stack. It merges it through a pull request once continuous integration passes, and then makes those checks required on the default branch.

Stage nine estimates every design in ideal days. It defers what is oversized, out of scope, or on no journey, each with a reason, and plans a backlog of increments in journey and dependency order.

## The increments

Stage ten delivers that backlog, one increment at a time. Each increment starts on a feature branch from the latest default branch. The first commit holds only acceptance tests, each tracing to the increment's requirements. A guard rejects anything else.

The new tests run once, and the failing result is recorded as red. Then the agent implements in iterations, and a fixed gate decides when it is done: backend tests, frontend lint and unit tests, and the end to end suite. After ten failing iterations, the increment is blocked, and work moves on to the next increment that does not depend on it.

When the gate is green, the agent records a short video, and Hewn opens a pull request. Its title names the journey and the requirements. Its body has six sections, with every test command and its counts. When the checks pass, Hewn squash merges it and deletes the branch. If the default branch moved, it rebases first. Then it marks the designs complete and updates the estimates before the next increment starts.

## Decisions

Skills are written for people, and they ask questions. Hewn never waits for an answer. Every agent session is told that nobody will reply, and it has no tool to ask. So the agent decides from the direction and the documents, and appends each decision to the decision log, with the date, stage, question, answer and rationale. A decision that changes the architecture also gets a numbered A D R.

## Tests

Everything was built test first, in nine pull requests. The backend has one hundred and twenty acceptance tests against the real API, with an in memory GitHub. The worker has one hundred and nine tests against fake APIs. The end to end suites drive Mission Control with real workers: eight behaviour tests, five accessibility tests, two visual tests and four pipeline tests.

The last pipeline test is the one that matters most. It submits a small direction and then only watches. It passes when every stage succeeds, no dialog ever appears, and every planned increment is merged by Hewn.

## The screens

Here is New direction. Submit it empty, and the errors appear inline, with a summary at the top.

Here is the real app with one worker. The Owner types a name and an idea that is too short, sees the error, fixes it, and submits. From there nobody touches anything. The stages advance from pending to succeeded, and the direction completes.

While it runs, the project page shows each stage's status in text and icon, never by colour alone. The phone layout works in dark mode, too.

## The artifacts

This is what the stages wrote into the product's repository. These come from the scripted agent the test stack uses, so they are deliberately plain. First, the brief and a mock from Magic Patterns.

Next, a design system component page and the stack decision record.

Then the requirements and a detailed design.

Then the user journeys and the estimates, with the roadmap of increments.

Here is one increment going from red to green. The acceptance test came first, with its trace header. The red run failed it, the first iteration made it pass, and the pull request was opened and merged automatically.

And this is the decision log, one entry per question an agent answered for itself.

## Recap

Journey one is complete. An Owner submits a direction, and Hewn runs all eleven stages to a merged, tested product, with no approval steps. Every write goes through the API's broker, every stage's output is checked, and every decision is recorded. Next come the journeys that let Owners watch and steer: budgets, pause and resume, and the backlog and increment pages.
