# 01 · Build a new product, part one: submit a direction

This is the first slice of journey one in Hewn: an Owner submits a product direction, and Hewn creates the project, queues the direction and opens the project page. Everything after this moment runs without asking a person anything, so this is the one screen where a human gives direction.

## What we built

The slice runs top to bottom through the stack. In Mission Control, the New direction page takes a name, an idea, an optional stack, an optional GitHub repository and a budget. Behind it, `POST /api/projects` validates the submission, checks that Hewn can write to a named repository, and saves the project and its first direction in one unit of work.

There was no code in the repository yet, so this pull request also lays the foundations journey one needs: the .NET solution with its four layers, cookie sessions against the allow list, the event store, the Angular workspace, the Playwright suite, continuous integration, and the video tooling that made this video.

## How it fits together

Here is the sequence from the detailed design. The page posts the form. The controller checks the Owner policy and the anti-forgery token, then hands a command to MediatR. The validator applies the field rules, the handler probes GitHub, and only after the commit does the API answer with two oh one Created.

That commit also writes the first event for the project, `DirectionQueued`, with sequence number one. Every later change the project page shows will follow it with the next number.

## The code that matters

The handler is short on purpose. If a repository URL was given, it asks the GitHub probe whether Hewn can push there, and stops with a field error if not. Then the domain creates the project with its product direction, eleven stages, and stage zero Pending.

Field rules live in one validator. A name must be one to one hundred characters and unique, ignoring case. An idea must be ten to twenty thousand characters. Each rule carries two texts: the inline message under the field, and a shorter line for the error summary.

The controller stays thin. It requires the Owner policy, sends the command, and returns Created with the project's address. A Viewer never reaches the handler: the policy answers four oh three.

## Tests first

Every acceptance test file starts with the requirement it traces to. The backend tests run the real API on an in-memory SQLite database with a fake GitHub. Written before the endpoints existed, they failed with four oh four on every call.

Once the endpoints were in, they found two real bugs: a stage loop that read the instance list instead of the stage catalogue, and a stage number Entity Framework tried to generate. With both fixed, all twenty five backend tests pass, alongside fourteen Playwright tests for behaviour, accessibility and visual parity with the mocks.

## The screens

Here is the real app. The Owner types a short idea and submits; the inline error explains the allowed length. They finish the idea, submit again, and land on the project page with every stage Pending.

When something is wrong, the summary at the top names each problem and links to its field, and focus moves to it so a screen reader announces it straight away.

If the repository belongs to someone who has not installed Hewn's GitHub App, the error says so and offers the way out: install the app, or leave the field empty and let Hewn create a repository.

A Viewer who opens the page sees that they don't have permission, and the API refuses their post with four oh three, whatever the browser shows.

On a phone the same form stacks into one column, and the project page follows the system's dark theme.

## Recap

- One page, one endpoint, one unit of work: the project and its direction exist before the API answers.
- The foundations are in place for the next slice.
- Next, the pipeline itself: a worker leases the direction and runs stages zero to ten in order.
