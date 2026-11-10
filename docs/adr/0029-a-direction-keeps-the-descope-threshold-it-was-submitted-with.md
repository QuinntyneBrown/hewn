# 0029. A direction keeps the descope threshold it was submitted with

- **Status:** Accepted
- **Date:** 2026-11-10
- **Requirements:** L2-019

## Context

L2-019 AC1 has an Owner set the descope threshold in Settings (3 ideal days by default), and stage 9 splits or
defers designs above it. The Settings mock saves it with the default budget, under "Direction defaults", and its
success callout says "New directions start with a $350.00 budget and a 3-day descope threshold. Directions already
running keep theirs." Until now the API sent `HEWN_DESCOPE_THRESHOLD_DAYS` with every lease.

## Decision

- **Saved as a direction default.** `direction_defaults` holds the threshold beside the default budget, a whole
  number from 1 to 20, edited only by an Owner.
- **Fixed per direction at submission.** A product or feature direction records the threshold in force when it is
  submitted, as it does its budget. Each lease carries the direction's threshold, so changing the setting does not
  change the plan of a direction already running. Directions submitted before this change have none and use the
  current setting.

## Alternatives

- **Read the setting at each lease.** Simpler, but a direction submitted at 3 days could reach stage 9 after the
  Owner moved to 1 and be planned against a value nobody chose for it, contradicting the callout.

## Consequences

- A rerun of stage 9 for the same direction plans against the same threshold.
- `directions` gains a nullable `DescopeThresholdDays` column; a direction's threshold is not editable once
  submitted.
