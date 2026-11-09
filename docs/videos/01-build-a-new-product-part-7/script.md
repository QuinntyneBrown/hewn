# 01 · Build a new product, part seven: estimates and descoping

Part six merged the scaffold. Part seven is stage nine, estimates. Hewn sizes every detailed design, defers what is too big or not needed yet, and plans the rest as a backlog of small increments, in an order that respects their dependencies.

## What we built

Stage nine runs in two halves. First the agent runs the estimating designs skill. It writes one table per subsystem, giving each design an estimate in ideal days, and it splits any design that is above the descope threshold.

Then deterministic code takes over. The descoper and the backlog planner write the estimates read me, a backlog file, and a deferred status line on every requirement that will not be built.

## How it fits together

A design is deferred for one of four reasons, in order. It is still above the threshold after the split attempt. The brief lists it as out of scope or nice to have. None of its requirements appears in any journey. Or it depends on a design that was already deferred. Each deferred design keeps its reason, and the reason is copied into the requirement.

The threshold defaults to three ideal days. The API sends it with every lease, so the worker never guesses it.

## The code that matters

Increments follow the journeys in order. Within a journey, each design is placed after the designs it depends on, and then the journey is cut into parts of at most the threshold. A dependency cycle fails the run and names the designs.

When the commit lands, the worker reports the backlog to a new stage nine only endpoint. The API replaces the direction's backlog in a new increments table and records a backlog planned event. It refuses any increment that depends on a later one.

## Tests first

The backend gained thirteen tests: the threshold in the lease, recording and replacing the backlog, the dependency rules, the stage nine only rule, and stage nine's commit paths. The worker gained eleven, covering each descope reason, the ordering and parts, the read me, the status lines, a cycle, and a missing estimate that fails before anything is committed.

## The screens

Here is the real app with one worker. The Owner submits, and stages zero to nine run for real. Stage nine estimates, plans three increments, and reports them, and then the scripted increments stage finishes the direction.

And this is the estimates read me for a pottery kiln example. Three increments, in order, and three deferred designs, each with its reason.

## Recap

Every design now has an estimate, oversized and unneeded work is deferred with a reason, and the backlog is ordered by journey and dependency. Next, stage ten builds those increments.
