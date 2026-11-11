# 0033. Audit entries are append-only in the database

- **Status:** Accepted
- **Date:** 2026-11-10
- **Requirements:** L2-044

## Context

L2-044 AC1 says audit entries cannot be edited through any API. The design asked for more: a database role with
INSERT and SELECT on `audit_entries` but no UPDATE or DELETE, so the entries hold even if Hewn's own code has a
defect. Hewn's database is SQLite, which has no roles or grants: whoever can open the file can change any table.
Journey 31 also added a handler that deletes a project's records.

## Decision

- No endpoint writes, edits or deletes an entry. Entries are added only by `AuditWriter`, inside the change the
  audited action saves, so an action and its entry are saved together or not at all.
- The `RecordAuditEntries` migration adds two triggers, `BEFORE UPDATE` and `BEFORE DELETE` on `audit_entries`, that
  abort with "audit entries are append-only".
- Each entry keeps the project's name beside its id, so deleting a project leaves its entries readable.

## Alternatives

- **Rely on the API alone.** A defect, such as a delete handler that sweeps every table keyed by project, could
  silently remove entries.
- **A separate audit database or file.** A second store to back up, migrate and keep in step with the first, for a
  guarantee the triggers already give.

## Consequences

- Removing old entries, if ever needed, takes a migration that drops the triggers, which is visible in review.
- Tests that clear tables must leave `audit_entries` alone; the audit tests check that UPDATE and DELETE fail.
