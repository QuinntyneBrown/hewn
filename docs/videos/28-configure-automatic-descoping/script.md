# 28 · Configure automatic descoping

This is journey twenty eight of Hewn, the software factory: configure automatic descoping. Stage nine estimates every design in ideal days. Anything above the descope threshold is split, or deferred with a reason. Until now that threshold was fixed in the server's configuration. This video shows an Owner setting it in Settings, and stage nine planning against it.

## The goal

In Settings, an Owner sets the descope threshold in ideal days, three by default. Stage nine uses it: a design above the threshold is first split into designs at or below it, and descoped if it cannot be. Viewers see the value read-only. This is for Owners, who decide how big an increment may be.

## Setting the threshold

Here an Owner opens Settings, under Direction defaults, beside the default budget. They try half a day. Save defaults refuses it: the error summary links to the field, and the field says the threshold must be a whole number of days from one to twenty. The link puts the cursor back in the field. One day is accepted. The callout says new directions start with a one-day descope threshold, and that directions already running keep theirs.

## Where it lives

The threshold is saved beside the default budget, in the same direction defaults row, through the same Owner-only endpoint. The validator takes a whole number from one to twenty, with the mock's message and summary. A save that leaves it out keeps the one saved.

The callout's promise decides the design. A direction records the threshold in force when it is submitted, as it already does its budget. So changing the setting never changes the plan of a direction already running.

This sequence shows the whole path. The Owner saves. Later a direction is submitted and records the threshold. When stage nine is leased, the lease carries the direction's threshold, or the current setting for directions from before this change.

## Stage nine

Stage nine's agent was told to split designs above the descope threshold, but never told the number. Now its task names it: split any design above the threshold of n ideal days. What is still above it after the agent's split, the descoper defers, with its reason.

Here a new direction is submitted with the threshold at one day, and a worker runs it. The fake agent estimates every design at two days and splits none. When stage nine finishes, the Backlog shows each design deferred: estimated at two days, above the one-day threshold, and could not be split.

## Tests

The backend tests go through the real API. The threshold is three until an Owner saves one, and the next lease carries the saved value. Zero, twenty one and two and a half are refused. A Viewer gets forbidden. And a direction submitted before a change keeps the threshold it started with; that test failed first, with one where three was expected. All three hundred and six backend tests pass.

The worker test checks the agent's task names the leased threshold. It failed first, then passed with the other worker tests.

End to end, a behaviour test saves five days, and refuses half a day, twenty one and an empty field, each with its linked error. A Viewer sees the field read-only. Before the field existed, the first of these failed with nothing to find.

A pipeline test sets one day in Settings, starts a real worker, and waits for stage nine to defer every two-day design with the one-day reason. Visual tests compare the field with its mocks, by default, invalid and for a Viewer.

## The screens

The Viewer sees the threshold read-only, with a notice that an Owner manages the defaults. The field reads the same in dark mode, and on a phone.

## Recap

Journey twenty eight is complete. Owners set the descope threshold in Settings, a whole number of ideal days from one to twenty. Each direction keeps the threshold it was submitted with. And stage nine splits and defers against it. Next comes journey twenty nine.
