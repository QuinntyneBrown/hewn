# 04 · Limit spending

This is journey four of Hewn, the software factory: limit spending. Hewn runs without anyone approving each model call, so it has to know what every call costs, and stop itself at a limit. This video walks through how it was built: the meter, the price table, the budget rule, the page, and the tests.

## The goal

Every model call records its input and output tokens, its model and its cost, against its run, stage, direction and project. Spend shows on the project and updates live.

Every direction has a budget. It starts at the default an Owner sets in Settings, and can be changed when submitting. At eighty percent, a warning is pushed and shown on the project. At one hundred percent, the direction pauses with the reason Budget reached, after the current model call. This is a safety stop, not an approval.

## The meter

Here is where usage is recorded, and how the threshold check runs. The worker reports each call the moment it returns, with its model and its tokens, but never a cost. The API prices the call, adds it to the direction, and answers with a verdict: continue, warn, or stop.

In the worker, every call gets a fresh call identifier, so a retried report counts once. A warn verdict writes a line into the run log. A stop verdict ends the run straight away: no further call, no checkpoint, and no result.

## The price table

Prices are configuration: dollars per million input and output tokens for each model, defaulting to Anthropic's published prices. A model that is not in the table is priced at the table's highest rates, so an unknown model can only make the budget stop sooner, never later. Costs are kept to a millionth of a dollar.

## The budget rule

Recording the call and judging the budget happen in one handler, in one save. The first time spend reaches eighty percent, the direction is marked warned, and a budget warning event goes out, once. At one hundred percent, the verdict is stop.

Stop pauses the run, its stage, the direction and the project, and releases the lease. The run keeps its checkpoint, so raising the budget in journey five can resume from the last completed step.

## The page

The project header shows the direction's spend of its budget, as a meter with the amounts in text. Each spend updated event moves it, live. When the budget warning arrives, the meter turns to warning, and a toast says how close the direction is to pausing. The toast waits while you hover or focus it, and the meter keeps the news after the toast has gone.

A paused direction shows Paused, Budget reached, with what it spent. And Settings has the default budget, which Owners save and Viewers read.

## Tests

The backend and worker slices began with their tests failing. The backend gained sixteen tests against the real API, and the worker four against a fake API. One backend test covers a race this journey uncovered: a log batch and a model call arriving at once, both claiming the same event number. Now a project's writes take turns. All green, the backend has one hundred and sixty three tests, and the worker one hundred and thirty.

The frontend has forty five unit tests. End to end, a new pipeline test drives a real worker through the warning and the pause, and new behaviour, accessibility and visual tests cover Settings, for forty five end to end tests in all.

## The screens

Here is Settings. An Owner types a default of five dollars, and is told what to fix, with a link to the field. Three hundred and fifty saves, and new directions start with it.

Now a direction with a ten dollar budget, and a worker that reports a model call every few lines. Each call costs sixty cents. Spend climbs in the header as each call is recorded, through the first stage and into the second. At eighty percent, the warning toast arrives, the meter turns, and the warning is written into the run log as well. A few calls later, the direction pauses, with Budget reached, and nothing more runs.

The same page works in dark mode and on a phone. And a Viewer sees the defaults, read only.

## Recap

Journey four is complete. Every model call is recorded and priced by Hewn, not the worker. Spend climbs live, with a warning at eighty percent. And at one hundred percent, the direction stops itself after the current call. Next comes journey five: raise the budget and resume.
