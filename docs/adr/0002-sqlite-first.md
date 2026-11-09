# 0002. SQLite is the only database provider for now

Date: 2026-11-08 · Status: Accepted · Requirements: L2-050

## Context

The README names SQL Server or SQLite. Tests must run without a database server (in-memory SQLite), and the
local stack uses a SQLite file. Adding `Microsoft.EntityFrameworkCore.SqlServer` 10.0.14 pulls in
`System.Security.Cryptography.Pkcs` 9.0.11, which has known moderate and high severity advisories.

## Decision

`Hewn.Infrastructure` references only the SQLite provider. Migrations are generated for SQLite and applied
explicitly with `hewn migrate`; the API never migrates on startup. `DateTimeOffset` values are stored as UTC
ticks and money as `double`, because SQLite cannot order or compare `DateTimeOffset` or `decimal`.

## Consequences

The cloud deployment decision (journey 23) chooses the hosted database. If it is SQL Server, that work adds
the provider once a patched dependency is available, plus a second migrations set.
