# Projects list

## Overview

The Projects page is the index of everything the factory is building. Each row is one project with its current stage, status, percent complete, spend to date and last activity, sorted newest activity first. A status filter narrows the list and survives a reload because it lives in the query string.

The list is live. When a project's status, stage, percent complete or spend changes, the row updates in place within 1 second through the real-time event stream designed in [Real-time events](../../mission-control/real-time-events/README.md). Owners also see the New product action and the per-row Archive and Delete actions designed in [Archive and delete a project](../archive-and-delete-project/README.md); Viewers see the same list without them.

Terms used in this design:

- **project status** — one of Running, Idle, Paused, Blocked, Cancelled or Complete, derived from the project's active direction
- **last activity** — time of the most recent event recorded for the project

## Description

The slice is a read model plus a live update path.

- **`ProjectsPage`** — Angular page at `/projects?status={filter}`. It renders the filter tabs (All, each status with a count, Archived), the rows, and the empty, loading, error and no-results states. The New product action renders only for Owners.
- **`ProjectsStore`** — Angular signal store holding the list. It loads once through `ProjectsApi`, then applies `ProjectChanged` events from `LiveEventsService` to the matching row without a reload.
- **`ProjectsApi`** — typed client for `GET /api/projects?status=`.
- **`ProjectsController`** — `GET /api/projects` returns `ProjectSummaryDto[]` for projects the caller can access, sorted by `LastActivityAt` descending.
- **`ProjectSummaryQuery`** — query handler that reads the `project_summaries` read model.
- **`ProjectSummaryProjector`** — updates the read model when stage, status, percent complete or spend events are persisted, and publishes `ProjectChanged` to the project's hub group.
- **`ProjectSummaryDto`** — row data: id, name, idea, stage, status, percent complete, spend, last activity, note.

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines the level-1 (L1) requirement cited beside it. The text is copied from `docs/specs/L2.md`.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-002` | `L1-001` | **Projects list.**<br>1. Given projects exist, when a user opens Projects, then each project shows its name, current stage, status (Running, Idle, Paused, Blocked, Cancelled, Complete), percent complete, spend to date and last activity time, sorted by last activity, newest first.<br>2. Given the user selects a status filter, when the list refreshes, then only projects with that status are shown, and the filter survives a page reload (query string).<br>3. Given no projects exist, when an Owner opens Projects, then an empty state is shown with a "New product" action. A Viewer sees the empty state without the action.<br>4. Given a project's status changes, when the list is open, then the row updates in place within 1 second without a reload (L2-031). |
| `L2-045` | `L1-020` | **Performance targets.**<br>1. Given a mid-tier phone on a 4G profile (Lighthouse mobile), when Mission Control's Projects page loads, then Largest Contentful Paint is 2.5 s or less, and the initial JavaScript is 500 KB gzipped or less.<br>2. Given 50 projects and 20 connected workers, when the read APIs are load-tested, then p95 response time is 300 ms or less.<br>3. Given 200 events per second across all projects, when clients are subscribed, then the latency target in L2-031 AC1 still holds. |

L2-045 AC1 and AC2 are listed because the Projects page is the page they measure. The page keeps its initial JavaScript within the 500 KB gzipped budget by lazy-loading every other route.

## Diagrams

### System context

Owners and Viewers both read the projects list from Hewn; nothing outside Hewn is involved.

![C4 system context for the projects list](diagrams/c4-context.png)

### Containers

Mission Control loads the list over HTTPS and then receives row updates over SignalR. The backplane carries hub messages between API instances.

![C4 container view for the projects list](diagrams/c4-container.png)

### Components

A projector keeps a denormalized summary table current and publishes `ProjectChanged`, so the list query stays a single indexed read.

![C4 component view for the projects list](diagrams/c4-component.png)

### Class structure

`ProjectsStore` holds `ProjectSummaryDto` rows and applies `ProjectChanged` events by project id; the projector produces those events from stage, spend and direction events.

![Class diagram for the projects list](diagrams/class-structure.png)

### Behaviour — load and filter the list

The filter is written to the query string before the request, so a reload restores it (L2-002 AC2). An Owner with no projects sees the empty state with New product; a Viewer sees it without (AC3).

![Sequence diagram: load and filter the list](diagrams/sequence-load-and-filter.png)

### Behaviour — update a row in place

A persisted status change reaches the open list within 1 second and changes only the affected row (L2-002 AC4, L2-031).

![Sequence diagram: update a row in place](diagrams/sequence-live-row-update.png)
