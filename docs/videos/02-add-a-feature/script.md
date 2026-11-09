# 02 · Add a feature

This is journey two of Hewn, the software factory: add a feature. Once a product exists, an Owner describes a feature, and Hewn runs only the stages that feature needs. It keeps every requirement number and journey number the product already has. This video walks through how it was built, from the form to the stage plan, the recorded decision, and the documents it changes.

## The goal

Journey two is for Owners whose product is already running. They should not have to start over to add one thing. They pick a product, describe the feature in ten to twenty thousand characters, and set a budget.

A feature skips three stages every time: bootstrap, stack and scaffold. The repository, the stack and the solution already exist. If the agent decides the feature changes no screen, designs and design system are skipped too. The other stages run, limited to the new or changed scope.

## The architecture

The Hewn API owns the plan. A new endpoint adds a feature direction to a project, with stages zero, four and six already skipped. The lease now tells the worker what the direction asks for, so every agent session names the feature and works only on what changes.

One direction runs per project. A feature submitted while another direction is active waits in a queue. When the active direction completes, the orchestrator starts the oldest one waiting, first in, first out.

## The decision

Whether a feature changes the user interface is a judgement, and agents make judgements themselves. Stage one answers one fixed question in the decision log: does this feature change the user interface? The worker checks that the answer is there, commits it with the brief, and reports it to the API. With no change, the API marks designs and design system skipped before stage two would start.

## Keeping numbers

Requirement IDs and journey numbers appear in tests, pull request titles and videos, so a later direction must never change them. Before a stage's agent runs, the worker copies the numbered documents. Afterwards it checks that nothing was dropped, and that every new number comes after the highest existing one. An agent that renumbers a requirement fails the stage, and nothing is committed.

Stage two follows the same rule for designs: it keeps every design in the manifest, adds new ones, and exports them all again. Stage nine plans only the designs not yet built, so the feature gets its own short backlog.

## Tests

Every slice started with failing acceptance tests. The backend gained thirteen tests against the real API, and all thirteen failed first. The worker gained eleven tests against fake APIs. All green, the backend has one hundred and thirty three tests, and the worker one hundred and twenty.

Mission Control has twenty two unit tests. End to end, there are twelve behaviour tests, seven accessibility tests, three visual tests and six pipeline tests. Two of the pipeline tests run a real worker through a product and then a feature.

## The screens

Here is New direction. Choose feature for a product, and the form asks for a product, the feature and a budget. The plan on the right strikes through bootstrap, stack and scaffold.

A feature that is too short gets an inline error, the same as a new product. A product that is still running says so in the list, and the feature queues behind it. The project page names the waiting direction and when it starts.

Here is the real app with one worker. The Owner chooses feature for a product, picks Northwind Ops, describes a feature with no screen change, and submits. The skipped stages are struck through, and the rest run to complete.

When it finishes, the project page says what was skipped and why, quoting the recorded decision. It works in dark mode and on a phone, too.

## The documents

This is what the feature changed in the product's repository. These documents come from the scripted agent the test stack uses, so they are deliberately plain. In the requirements, L2 one to three are untouched, and the feature is L2 four, the next free number.

The user journeys are the same: journeys one to three are kept, and the feature becomes journey four.

And this is the recorded decision that skipped designs and design system. When an agent renumbers an existing requirement instead, the stage fails with the requirement it dropped.

## Recap

Journey two is complete. A feature runs only the stages it needs, decides for itself whether the screens change, queues behind an active direction, and keeps every number the product already has. Next comes journey three, watching a direction as it runs.
