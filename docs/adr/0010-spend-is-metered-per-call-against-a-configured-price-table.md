# 0010. Spend is metered per model call against a configured price table, and the budget stops the run after the call that reaches it

- **Status:** Accepted
- **Date:** 2026-11-09
- **Requirements:** L2-052, L2-053, L2-028

## Context

Hewn runs without anyone approving each model call (L2-028), so it must know what every call cost and stop itself at
a limit. L2-052 asks for each call's tokens, model and cost against its run, stage, direction and project, with spend
shown live. L2-053 asks for a budget on every direction, a warning at 80% and a pause with "Budget reached" at 100%
after the current call. The design left the price table's source open. The worker has no real model client yet:
the Claude Agent SDK agent lands with run isolation.

## Decision

- **The worker reports each call; the API prices it.** `POST /api/worker/runs/{id}/model-calls
  {workerId, epoch, callId, model, inputTokens, outputTokens}` is fenced by the lease like any other worker write.
  The worker never sends a cost. A random `callId` per call, unique per run, makes a retried report count once.
- **Prices are configuration.** `SpendOptions.Prices` holds USD per million input and output tokens per model,
  defaulting to Anthropic's published prices for the current models (`claude-fable-5-1` $10/$50, `claude-opus-5-5`
  $4/$20, `claude-sonnet-5-5` $2/$10, `claude-haiku-5-5` $0.10/$0.50) and overridable per model through
  `Hewn:Prices:{model}:InputPerMillionUsd` and `OutputPerMillionUsd`. Updating a price is a configuration change and
  a restart; recorded calls keep the cost they were recorded with.
- **An unknown model is priced at the table's highest rates**, so a new or misspelt model id can only make spend look
  higher, never let a direction run past its budget.
- **Money is rounded to 6 decimal places** (a millionth of a dollar), because SQLite stores decimals as doubles. A
  call's cost and a direction's running spend are both rounded on write.
- **One handler records the call and judges the budget**, in the same unit of work: insert into `model_calls`, add to
  `Direction.SpendUsd`, append `SpendUpdated`, then the verdict. `Continue`; `Warn` the first time spend is at or
  above 80% (`BudgetWarning`, once per direction); `Stop` at or above 100%. A call that jumps straight past 100% also
  marks the warning sent.
- **Stop pauses the run with its checkpoint.** The orchestrator sets the run, its stage, the direction (reason
  "Budget reached") and the project to Paused and releases the lease. The run keeps its checkpoint, so Raise and
  resume (journey 5) continues from the last completed step. The worker gets `Stop` as the answer to the call that
  reached the budget and ends the run without another call, checkpoint or result; a late write gets 409 `lease_lost`.
- **The default budget lives in a one-row `direction_defaults` table**, saved by an Owner through
  `PUT /api/settings/direction-defaults` ($10 to $10,000). Until it is saved, `HEWN_DEFAULT_BUDGET_USD` (default
  $300) applies. A direction submitted without a budget takes the default; directions already running keep theirs.

## Alternatives considered

- **The worker computes cost**: one fewer lookup on the API, but every worker would need the price table, and a
  compromised or outdated worker could under-report.
- **Fetch prices from an API at run time**: Anthropic publishes prices on its pricing page, not through an API; a
  scraped table would fail closed or open unpredictably.
- **Reject unknown models**: safe, but a worker on a newer model would fail every stage until Hewn is reconfigured.
- **Check the budget before each call** (reserve, then settle): stops before overspending, but needs a token estimate
  per call. L2-053 accepts finishing the current call, so the check runs after it.

## Consequences

- A direction can end slightly over budget, by at most one call's cost; the callout says so ("Spend hit $x of $y
  after the current model call").
- Changing a price never rewrites history; spend reports always add the costs as recorded.
- Until the Agent SDK agent lands, only the scripted executor makes (simulated) model calls, through
  `HEWN_SCRIPTED_MODEL_CALLS` and `HEWN_SCRIPTED_CALL_TOKENS`.
