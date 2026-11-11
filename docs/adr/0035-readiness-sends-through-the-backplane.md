# 0035. Readiness sends a message through the backplane

- **Status:** Accepted
- **Date:** 2026-11-11
- **Requirements:** L2-051

## Context

L2-051 AC2 says `/health/ready` answers 200 only when the database and the SignalR backplane are reachable. Hewn
runs one API instance with SignalR's in-process lifetime manager; the real-time events design expects a scale-out
backplane (such as Redis) once there are several instances, but none is configured. The database is SQLite, where
"reachable" means the file can be opened. A pooled connection keeps working on a file that has been moved or
deleted, and SQLite creates a missing file unless told not to.

## Decision

- The **backplane check** sends one message to a group no client joins, through `IHubContext<MissionControlHub>`:
  the same lifetime manager that publishes project events. In-process it always succeeds. When a scale-out
  backplane replaces the lifetime manager, the check fails exactly when sending through it fails, with no change
  here.
- The **database check** opens a new connection outside the pool, in read-write mode that never creates the file,
  and runs `SELECT 1`. An in-memory database (the tests) is checked on the context's own connection.
- `/health/live` runs no checks, so a slow database can't make an orchestrator restart a working process.
- Both bodies name each check and its status only. A failure's exception is never written, since it can hold a
  connection string or a host name.

## Alternatives

- **Add a Redis backplane now.** It is infrastructure the product doesn't need with one instance, only so a check
  has something to check.
- **Report the backplane healthy unconditionally.** It would stay healthy after a scale-out backplane is added,
  until someone remembered to change it.
- **EF Core's `CanConnectAsync` for SQLite.** It reuses the pool and creates a missing file, so a database that has
  gone away still looks reachable.

## Consequences

- Each readiness probe opens and closes one SQLite connection and sends one SignalR message to an empty group.
- A scale-out backplane needs only to be registered as the lifetime manager for readiness to cover it.
