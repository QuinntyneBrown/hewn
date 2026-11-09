# 01 · Build a new product, part four: the document stages

In part three, stage zero created the repository and installed the skills. In part four, five more stages do real work: the brief, the stack, the requirements, the detailed designs and the user journeys. Each one writes documents into the product repository, and each one checks its own work before it commits.

## What we built

One executor serves all five stages. It checks out the product repository, runs the stage's agent with the stage's skill, validates what the agent wrote, and commits.

Each stage has a definition: the Greenlit skill it runs, the files it may write, the task it hands the agent, and the validator that decides whether the output is good enough.

## How it fits together

The worker still holds no GitHub credential. It downloads the repository as an archive through the API, fenced by the lease, and commits through the same keyed mutation stage zero uses.

Nobody answers questions during a run. When a skill asks one, the agent answers it itself and appends the question, the answer and the rationale to the decision log. The executor copies each question and answer into the run log, so you can follow the agent's reasoning live.

Only the stage's own documents and the decision log are committed. A file the agent changes anywhere else is logged and dropped, and the API refuses the same paths anyway.

## The code that matters

After the agent finishes, the executor compares the working copy with the checkout. Changed files under the stage's outputs are committed; anything else is ignored with a warning.

The validators are plain functions that return every problem they find. The requirements validator checks that every L2 traces to a real L1, every L1 has an L2, every L2 has a Given, When, Then criterion, IDs are unique, and the words should, may and might appear only in quoted text.

For now a scripted agent stands in for the model. It writes valid documents from the direction and from what earlier stages wrote. The real agent arrives with run isolation, so no model ever runs unsandboxed on a worker.

## Tests first

Seventeen validator tests name each missing section, broken trace and uncovered requirement. Six executor tests cover the skill and tools, the decision log, a failed validation, ignored files, the stack choice, and a chain of stages building on each other. The backend gained fourteen tests for the archive and the path rules, and the Playwright pipeline now runs all five document stages for real.

## The screens

Here is the real app, with one worker. The Owner names the project and submits. Stage zero creates the repository. Then the document stages finish almost instantly, because the scripted agent has nothing to think about, while the stages still to come take a couple of seconds each. The direction completes, with every stage succeeded.

The same view on a phone, in the dark theme.

## Recap

Five stages now write and validate real documents, log every decision, and commit only their own files. Next, stages two and three: the designs and the design system, through Magic Patterns.
