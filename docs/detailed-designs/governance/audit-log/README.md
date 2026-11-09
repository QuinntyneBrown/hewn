# Audit log

## Overview

Because Hewn acts without approvals, the record of what humans did to it matters. Every sign-in, direction submission, pause, resume, cancel, stop all, start workers, worker token creation or revocation, and merge writes an *audit entry* recording who did it, what, when and from which IP address. Merges are performed by Hewn itself, so their actor is the system with the direction that caused them.

Entries are append-only: no API edits or deletes them. Owners open the Audit page to list entries newest first and filter them by project and action.

Terms used in this design:

- **audit entry** — immutable record of one security-relevant action
- **actor** — GitHub login of the user, or `hewn` for system actions such as merges

## Description

The slice is an append-only table, a writer called from each audited handler, and a read-only page.

- **`AuditWriter`** — `WriteAsync(action, actor, projectId?, detail)` inserts an entry in the same transaction as the audited change. The client IP comes from `HttpContext.Connection.RemoteIpAddress` after forwarded-header processing.
- **`AuditAction`** — enumeration: SignIn, SubmitDirection, Pause, Resume, Cancel, StopAll, StartWorkers, CreateWorkerToken, RevokeWorkerToken, Merge.
- **`audit_entries table`** — append-only; the application's database role has INSERT and SELECT on it but no UPDATE or DELETE, so immutability holds even against a code defect.
- **`AuditController`** — `GET /api/audit?project=&action=&before=`, Owner policy, newest first with cursor paging. There is no write endpoint.
- **`AuditPage (Angular)`** — table of time, actor, action, project, detail and IP with project and action filters.

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines the level-1 (L1) requirement cited beside it. The text is copied from `docs/specs/L2.md`.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-044` | `L1-019` | **Audit log.**<br>1. Given a sign-in, direction submission, pause, resume, cancel, stop all, start workers, token creation or revocation, or merge, when it happens, then an audit entry records who did it, what, when and from which IP. Entries cannot be edited through any API.<br>2. Given an Owner, when they open Audit, then entries are listed newest first and can be filtered by project and action. |

## Diagrams

### System context

Only Owners read the audit log.

![C4 system context for the audit log](diagrams/c4-context.png)

### Containers

Entries live in the Hewn database under a role that can insert and read but not change them.

![C4 container view for the audit log](diagrams/c4-container.png)

### Components

Each audited handler calls one writer inside its own transaction, so an action and its audit entry commit together.

![C4 component view for the audit log](diagrams/c4-component.png)

### Class structure

`AuditEntry` has no mutators, and `AuditController` exposes reads only.

![Class diagram for the audit log](diagrams/class-structure.png)

### Behaviour — write and read entries

Audited actions record who, what, when and IP, and cannot be edited (L2-044 AC1). Owners list them newest first with filters (AC2).

![Sequence diagram: write and read entries](diagrams/sequence-write-and-read.png)
