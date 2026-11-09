# Hewn Mission Control mocks

Static HTML mocks for every Mission Control page, dialog and notification in every state. They reproduce the
[Magic Patterns design](https://www.magicpatterns.com/os/c9upyFcFm8ZTUr3n843kZW/nnp7cA6QUJvTQVHAsYuTNL)
(prototype *Mission Control*: Sign In, Dashboard, Projects, New Direction, Project Pipeline, Backlog, Increment,
Designs, Decisions, Artifacts, Traceability, Workers, Audit Log, plus Logo & Mark) on one shared token file and
one component kit. The Magic Patterns frames cover the default state of each screen; the other states, the
dialogs, the notifications, Settings and the error pages are derived from them using the same components.

## How to open

- Open [index.html](index.html) straight from disk. No server, network fonts or CDN are needed.
- `?theme=dark` or `?theme=light` forces a theme (otherwise the OS setting wins). The mock bar's ☾ button, or the `t` key, toggles it.
- `?chrome=0` hides the mock bar and annotation notes, for clean screenshots.
- Each file is `pages|dialogs|notifications/<screen>/<state>.html`. The mock bar links its sibling states.
- Dialogs are drawn over their page, with the page `inert`. Below 640 px they become bottom sheets. Toasts and banners are drawn on their page.

## Cast and catalog

"Today" is Monday 9 November 2026, about 14:31. Every mock uses the same people, projects and numbers.

| Who | Role | Notes |
|---|---|---|
| quinntynebrown | Owner | Signed in on every Owner mock; IP 24.114.38.91 |
| ama-osei | Viewer | Every `viewer` state |
| devon-park | Viewer | On the allow list but never signed in; also the denied sign-in |

| Project | Status | Stage | Complete | Spend | Notes |
|---|---|---|---|---|---|
| Ledgerline | Running | 10 · Increments | 62% | $184.20 of $400 | Increment 7 of 12, *Reconcile a card statement*, PR #28 |
| Tidewater | Running | 3 · Design system | 18% | $41.80 of $300 | Extracting tokens from 46 mocks |
| Parcel Post | Blocked | 5 · Requirements | 24% | $58.10 of $300 | Failed after 3 retries (L2-014 has no criteria) |
| Kiln Booking | Paused | 10 · Increments | 81% | $250.00 of $250 | Budget reached |
| Northwind Ops | Idle | Feature direction | 100% | $612.45 of $800 | CSV export for the shift report |
| Field Notes | Complete | 10 | 100% | $341.90 of $400 | |
| Harbor CRM | Cancelled | 7 · Detailed designs | 38% | $96.30 of $300 | PR #9 labelled `hewn:cancelled` |
| Saltmarsh Survey | Archived | 10 | 100% | $288.15 | Only under the Archived filter |

Workers: `wk-7f3a` quinn-mbp.local (Local, leased to Ledgerline), `wk-c21e` hewn-cloud-eus-01 (Cloud, Tidewater),
`wk-90bd` hewn-cloud-eus-02 (Cloud, idle), `wk-4e18` build-box-02 (Local, offline). Event sequence is at #48,213.
Spend today is $86.40, this week $512.70.

## Regenerating

The HTML is generated, so the shell, header and copy stay identical across all files. Edit the generator, not the output:

```sh
python3 docs/mocks/_build/build.py                       # writes pages/, dialogs/, notifications/, manifest.json
python3 .claude/skills/writing-html-mocks/scripts/check_mocks.py docs/mocks --write
python3 .claude/skills/writing-html-mocks/scripts/screenshot_mocks.py docs/mocks \
  --viewport 375x800 --viewport 768x1024 --viewport 1280x800   # L2-010 widths; PNGs to docs/mocks/.cache/ (never commit)
```

- `_build/common.py`: icons, the Hewn mark, the app shell, the project header, the cast data, and the document and mock-bar wrappers.
- `_build/pages.py`: one function per page, one branch per state.
- `_build/overlays.py`: dialogs and notifications.
- Styles now come from the design system: every mock links `../design-system/tokens/tokens.css` and `../design-system/assets/components.css` (set in `_build/common.py`). `assets/mock.css` is the mock bar only.
- `assets/tokens.css` and `assets/ui.css` are the original kit the design system was extracted from (8 November 2026). They are no longer linked; keep them as the extraction baseline or delete them. Corrections made during extraction are in [the design system's drift log](../design-system/README.md#drift-found-in-the-mocks).

## Open questions and assumptions

- **Design system (the project tab) is not in the Magic Patterns prototype.** It is designed from L2-012 AC4 on the Designs page's preview. `manifest.json` records `magic_patterns_url` for every screen that is a prototype frame and `null` with a note for the derived ones.
- **Settings is not in the Magic Patterns prototype.** It is designed here from L2-038 (allow list), L2-040 (secrets), L2-048 (theme) and L2-053 (budgets), using the prototype's components. It should go back into Magic Patterns as a frame.
- **The light theme is derived.** Magic Patterns only defines dark. Light keeps the same hues on a stone canvas and passes AA.
- **The Owner is "Owner", the second role is "Viewer"**, matching AGENTS.md. Viewers can change their own theme and nothing else (no dashboard layout editing either).
- **Sign-out is a sign-in state** (`signed-out`), not its own page.
- **Dashboard layout editing is desktop-only** (≥ 992 px). Below that the tiles stack and the Edit button is hidden.
- **The design preview** is shown as a schematic, because the real preview is a sandboxed iframe on a separate origin (L2-011), which a mock opened from disk can't reproduce.
- **Delete is typed-confirmation** and is only offered on projects that are not Running, Paused or Blocked. Archive is the soft alternative.
- **Stop all halts runs** within 10 s (L2-029 AC4); each run resumes from its last checkpoint when workers start again.
- **A feature direction on an unfinished product** queues behind the active direction (L2-005 AC4); the form says so per product.
- **The stop-all banner** persists until workers are started again. Stopping also has its own system-banner state.

## Coverage

<!-- coverage:start -->

Legend: ✅ mock exists · ➖ not applicable (reason in manifest) · ❌ missing

### Pages

| Screen | default | loading | empty | error | denied | expired | signed-out | partial | edit | reconnecting | stopped | viewer | filtered | no-results | archived | viewer-empty | feature | invalid | repo-no-access | submitting | rate-limited | forbidden | blocked | budget-reached | paused | cancelled | complete | past-stage | feature-direction | runs | queued-direction | log-scrolled | offline | blocked-increment | implementing | merged | video-failed | green-first | xs-dark | no-test | deferred | success | Requirements |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Sign in (`sign-in`) | [✅](pages/sign-in/default.html) | [✅](pages/sign-in/loading.html) | ➖ | [✅](pages/sign-in/error.html) | [✅](pages/sign-in/denied.html) | [✅](pages/sign-in/expired.html) | [✅](pages/sign-in/signed-out.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-038`, `L2-046`, `L2-047`, `L2-048` |
| Dashboard (`dashboard`) | [✅](pages/dashboard/default.html) | [✅](pages/dashboard/loading.html) | [✅](pages/dashboard/empty.html) | [✅](pages/dashboard/error.html) |  |  |  | [✅](pages/dashboard/partial.html) | [✅](pages/dashboard/edit.html) | [✅](pages/dashboard/reconnecting.html) | [✅](pages/dashboard/stopped.html) | [✅](pages/dashboard/viewer.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-030`, `L2-031`, `L2-032`, `L2-029`, `L2-052`, `L2-046` |
| Projects (`projects`) | [✅](pages/projects/default.html) | [✅](pages/projects/loading.html) | [✅](pages/projects/empty.html) | [✅](pages/projects/error.html) |  |  |  |  |  |  |  | [✅](pages/projects/viewer.html) | [✅](pages/projects/filtered.html) | [✅](pages/projects/no-results.html) | [✅](pages/projects/archived.html) | [✅](pages/projects/viewer-empty.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-001`, `L2-002`, `L2-003`, `L2-039` |
| New direction (`new-direction`) | [✅](pages/new-direction/default.html) | [✅](pages/new-direction/loading.html) | ➖ | [✅](pages/new-direction/error.html) |  |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/new-direction/feature.html) | [✅](pages/new-direction/invalid.html) | [✅](pages/new-direction/repo-no-access.html) | [✅](pages/new-direction/submitting.html) | [✅](pages/new-direction/rate-limited.html) | [✅](pages/new-direction/forbidden.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-001`, `L2-005`, `L2-009`, `L2-053`, `L2-028`, `L2-043` |
| Project pipeline (`project-pipeline`) | [✅](pages/project-pipeline/default.html) | [✅](pages/project-pipeline/loading.html) | [✅](pages/project-pipeline/empty.html) | [✅](pages/project-pipeline/error.html) |  |  |  |  |  |  |  | [✅](pages/project-pipeline/viewer.html) |  |  |  |  |  |  |  |  |  |  | [✅](pages/project-pipeline/blocked.html) | [✅](pages/project-pipeline/budget-reached.html) | [✅](pages/project-pipeline/paused.html) | [✅](pages/project-pipeline/cancelled.html) | [✅](pages/project-pipeline/complete.html) | [✅](pages/project-pipeline/past-stage.html) | [✅](pages/project-pipeline/feature-direction.html) | [✅](pages/project-pipeline/runs.html) | [✅](pages/project-pipeline/queued-direction.html) | [✅](pages/project-pipeline/log-scrolled.html) | [✅](pages/project-pipeline/offline.html) |  |  |  |  |  |  |  |  |  | `L2-004`, `L2-005`, `L2-006`, `L2-008`, `L2-029`, `L2-030`, `L2-033`, `L2-053` |
| Backlog (`backlog`) | [✅](pages/backlog/default.html) | [✅](pages/backlog/loading.html) | [✅](pages/backlog/empty.html) | [✅](pages/backlog/error.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/backlog/blocked-increment.html) |  |  |  |  |  |  |  |  | `L2-018`, `L2-019`, `L2-020` |
| Increment (`increment`) | [✅](pages/increment/default.html) | [✅](pages/increment/loading.html) | ➖ | [✅](pages/increment/error.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/increment/blocked.html) |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/increment/implementing.html) | [✅](pages/increment/merged.html) | [✅](pages/increment/video-failed.html) | [✅](pages/increment/green-first.html) |  |  |  |  | `L2-021`, `L2-022`, `L2-023`, `L2-024`, `L2-025` |
| Designs (`designs`) | [✅](pages/designs/default.html) | [✅](pages/designs/loading.html) | [✅](pages/designs/empty.html) | [✅](pages/designs/error.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/designs/xs-dark.html) |  |  |  | `L2-010`, `L2-011` |
| Design system (`design-system`) | [✅](pages/design-system/default.html) | [✅](pages/design-system/loading.html) | [✅](pages/design-system/empty.html) | [✅](pages/design-system/error.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-012`, `L2-011` |
| Decisions (`decisions`) | [✅](pages/decisions/default.html) | [✅](pages/decisions/loading.html) | [✅](pages/decisions/empty.html) | [✅](pages/decisions/error.html) |  |  |  |  |  |  |  |  | [✅](pages/decisions/filtered.html) | [✅](pages/decisions/no-results.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-054`, `L2-028` |
| Artifacts (`artifacts`) | [✅](pages/artifacts/default.html) | [✅](pages/artifacts/loading.html) | [✅](pages/artifacts/empty.html) | [✅](pages/artifacts/error.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-034` |
| Traceability (`traceability`) | [✅](pages/traceability/default.html) | [✅](pages/traceability/loading.html) | [✅](pages/traceability/empty.html) | [✅](pages/traceability/error.html) |  |  |  |  |  |  |  |  |  | [✅](pages/traceability/no-results.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/traceability/no-test.html) | [✅](pages/traceability/deferred.html) |  | `L2-035`, `L2-014` |
| Workers (`workers`) | [✅](pages/workers/default.html) | [✅](pages/workers/loading.html) | [✅](pages/workers/empty.html) | [✅](pages/workers/error.html) |  |  |  |  |  |  | [✅](pages/workers/stopped.html) | [✅](pages/workers/viewer.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-026`, `L2-027`, `L2-041`, `L2-029` |
| Audit (`audit`) | [✅](pages/audit/default.html) | [✅](pages/audit/loading.html) | [✅](pages/audit/empty.html) | [✅](pages/audit/error.html) |  |  |  |  |  |  |  |  |  | [✅](pages/audit/no-results.html) |  |  |  |  |  |  |  | [✅](pages/audit/forbidden.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-044`, `L2-039` |
| Settings (`settings`) | [✅](pages/settings/default.html) | [✅](pages/settings/loading.html) | ➖ | [✅](pages/settings/error.html) |  |  |  |  |  |  |  | [✅](pages/settings/viewer.html) |  |  |  |  |  | [✅](pages/settings/invalid.html) |  | [✅](pages/settings/submitting.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/settings/success.html) | `L2-038`, `L2-040`, `L2-048`, `L2-053`, `L2-019` |
| Not found (`not-found`) | [✅](pages/not-found/default.html) | ➖ | ➖ | ➖ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-039` |
| Server error (`server-error`) | [✅](pages/server-error/default.html) | ➖ | ➖ | ➖ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | `L2-049` |

### Dialogs

| Screen | default | busy | invalid | failed | confirm | success | Requirements |
|---|---|---|---|---|---|---|---|
| Stop all workers (`stop-workers`) | [✅](dialogs/stop-workers/default.html) | [✅](dialogs/stop-workers/busy.html) | ➖ | [✅](dialogs/stop-workers/failed.html) |  |  | `L2-029` |
| Cancel direction (`cancel-direction`) | [✅](dialogs/cancel-direction/default.html) | [✅](dialogs/cancel-direction/busy.html) | ➖ | [✅](dialogs/cancel-direction/failed.html) |  |  | `L2-029` |
| Delete project (`delete-project`) | [✅](dialogs/delete-project/default.html) | [✅](dialogs/delete-project/busy.html) | [✅](dialogs/delete-project/invalid.html) | [✅](dialogs/delete-project/failed.html) | [✅](dialogs/delete-project/confirm.html) |  | `L2-003` |
| Raise budget (`raise-budget`) | [✅](dialogs/raise-budget/default.html) | [✅](dialogs/raise-budget/busy.html) | [✅](dialogs/raise-budget/invalid.html) | [✅](dialogs/raise-budget/failed.html) |  |  | `L2-053` |
| New worker token (`worker-token`) | [✅](dialogs/worker-token/default.html) | [✅](dialogs/worker-token/busy.html) | [✅](dialogs/worker-token/invalid.html) | [✅](dialogs/worker-token/failed.html) |  | [✅](dialogs/worker-token/success.html) | `L2-041`, `L2-040` |
| Revoke worker (`revoke-worker`) | [✅](dialogs/revoke-worker/default.html) | [✅](dialogs/revoke-worker/busy.html) | ➖ | [✅](dialogs/revoke-worker/failed.html) |  |  | `L2-041` |
| Update skills (`update-skills`) | [✅](dialogs/update-skills/default.html) | [✅](dialogs/update-skills/busy.html) | ➖ | [✅](dialogs/update-skills/failed.html) |  |  | `L2-008` |
| Add a GitHub login (`add-user`) | [✅](dialogs/add-user/default.html) | [✅](dialogs/add-user/busy.html) | [✅](dialogs/add-user/invalid.html) | [✅](dialogs/add-user/failed.html) |  |  | `L2-038`, `L2-039` |
| Navigation drawer (`mobile-nav`) | [✅](dialogs/mobile-nav/default.html) | ➖ | ➖ |  |  |  | `L2-046` |

### Notifications

| Screen | info | success | warning | danger | stacked | with-action | Requirements |
|---|---|---|---|---|---|---|---|
| Live event toast (`live-toast`) | [✅](notifications/live-toast/info.html) | [✅](notifications/live-toast/success.html) | [✅](notifications/live-toast/warning.html) | [✅](notifications/live-toast/danger.html) | [✅](notifications/live-toast/stacked.html) | [✅](notifications/live-toast/with-action.html) | `L2-031`, `L2-047` |
| Connection banner (`connection-banner`) | [✅](notifications/connection-banner/info.html) | [✅](notifications/connection-banner/success.html) | [✅](notifications/connection-banner/warning.html) | [✅](notifications/connection-banner/danger.html) |  |  | `L2-032` |
| System banner (`system-banner`) | [✅](notifications/system-banner/info.html) | [✅](notifications/system-banner/success.html) | [✅](notifications/system-banner/warning.html) | [✅](notifications/system-banner/danger.html) |  |  | `L2-008`, `L2-029`, `L2-036` |

<!-- coverage:end -->
