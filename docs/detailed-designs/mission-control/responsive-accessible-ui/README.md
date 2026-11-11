# Responsive, accessible and themed UI

## Overview

Every Mission Control page shares one shell and one set of rules for layout, accessibility, theme and performance. This design describes that baseline rather than one screen.

Layout follows three bands. Below 576 px (XS) content is one column, navigation collapses into a menu, and the pipeline is a vertical list. From 576 px (S) to 991 px (M) the project page shows the pipeline as a horizontal, scrollable stepper above the stage detail. From 992 px (L and XL) navigation is a fixed sidebar and the pipeline sits beside the stage detail. From 320 to 2560 px there is no horizontal page scroll. Touch targets are at least 44×44 px below 992 px, where a finger is the likely pointer, and at least 24×24 px from 992 px.

Every page in every state passes axe-core with no serious or critical violations, works by keyboard alone with a visible focus indicator and no traps, announces stage status changes through a polite live region at most once every 5 seconds per project, and disables animation when the user prefers reduced motion. With no saved choice the theme follows the operating system; a choice of Light, Dark or System is kept across reloads, and text contrast is at least 4.5:1 in both themes.

Terms used in this design:

- **breakpoint** — viewport width at which layout changes: 576, 768, 992 and 1200 px
- **live region** — element with `aria-live="polite"` whose text changes are read by screen readers
- **design tokens** — CSS custom properties from `docs/design-system/` for colour, type, spacing, radius, elevation and motion

## Description

The slice is a set of shared Angular building blocks plus the tests that hold every page to them.

- **`AppShell`** — layout component. The sidebar's content is one template, shown in the fixed sidebar from 992 px. Below 992 px the top bar shows Open menu, the wordmark and the connection dot, and Open menu shows the same template in a menu drawer, a CDK Dialog labelled "Menu". Focus starts on Close menu, stays in the drawer, and returns to Open menu. The drawer closes on Escape, on Close menu, on a tap beside it, on navigating, and when the window widens to 992 px.
- **Layout bands** — CSS media queries in the design system on the token breakpoints (36, 48, 62 and 75 rem) set the columns, the pipeline (a list, then a stepper, then a column beside the detail) and control sizes. The shell's one `matchMedia('(min-width: 62rem)')` closes the drawer; nothing else needs to know the band.
- **`StatusAnnouncer`** — single polite live region. It queues stage status messages per project and emits at most one per project every 5 seconds.
- **`ThemeService`** — reads `localStorage['hewn.theme']` (`light`, `dark` or `system`), applies `data-theme` on `<html>`, and follows `prefers-color-scheme` when the value is `system` or absent.
- **`Design tokens`** — `tokens.css` with light and dark values; motion tokens resolve to `0ms` under `prefers-reduced-motion: reduce`.
- **`AccessibilitySuite`** — Playwright e2e suite that visits every route in every mocked state and runs axe-core, and a keyboard walk that tabs through each page and checks for focus visibility and traps.
- **`PerformanceBudget`** — Angular build budget of 500 KB gzipped initial JavaScript with every route lazy-loaded, a Lighthouse mobile run on Projects in CI (LCP 2.5 s or less), a read-API load test at 50 projects and 20 workers (p95 300 ms or less), and an event load test at 200 events per second (p95 1 s or less).

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines the level-1 (L1) requirement cited beside it. The text is copied from `docs/specs/L2.md`.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-046` | `L1-021` | **Responsive layout.**<br>1. Given XS (<576 px), when any page renders, then content is one column, navigation collapses into a menu, and the pipeline is a vertical list.<br>2. Given S (≥576 px) and M (≥768 px), when the project page renders, then the pipeline is a horizontal, scrollable stepper above the stage detail.<br>3. Given L (≥992 px) and XL (≥1200 px), when any page renders, then navigation is a fixed sidebar, and the project page shows the pipeline and the stage detail side by side.<br>4. Given any width from 320 to 2560 px, when any page renders, then there is no horizontal page scroll, and touch targets are at least 44×44 px below 992 px and at least 24×24 px from 992 px. |
| `L2-047` | `L1-021` | **Accessibility.**<br>1. Given every page in every state, when axe-core runs in the e2e suite, then there are no serious or critical violations.<br>2. Given a keyboard-only user, when they use any feature, then everything can be reached and used with a visible focus indicator and no keyboard traps.<br>3. Given stage status changes, when they occur, then they are announced through a polite live region, at most once every 5 seconds per project.<br>4. Given the user prefers reduced motion, when animations would play, then they are disabled. |
| `L2-048` | `L1-021` | **Light and dark themes.**<br>1. Given no saved choice, when Mission Control loads, then it follows the operating system's colour scheme.<br>2. Given the user picks Light, Dark or System, when they reload, then their choice is kept, and text contrast meets 4.5:1 in both themes. |
| `L2-045` | `L1-020` | **Performance targets.**<br>1. Given a mid-tier phone on a 4G profile (Lighthouse mobile), when Mission Control's Projects page loads, then Largest Contentful Paint is 2.5 s or less, and the initial JavaScript is 500 KB gzipped or less.<br>2. Given 50 projects and 20 connected workers, when the read APIs are load-tested, then p95 response time is 300 ms or less.<br>3. Given 200 events per second across all projects, when clients are subscribed, then the latency target in L2-031 AC1 still holds. |

## Diagrams

### System context

The baseline applies to every user and every page; no external system is involved.

![C4 system context for the responsive, accessible and themed UI](diagrams/c4-context.png)

### Containers

All of it runs in Mission Control; the Hewn API only feeds the status events that the announcer reads out.

![C4 container view for the responsive, accessible and themed UI](diagrams/c4-container.png)

### Components

Status announcements come from the same live events as the screen, throttled per project by `StatusAnnouncer`.

![C4 component view for the responsive, accessible and themed UI](diagrams/c4-component.png)

### Class structure

`ThemeService` exposes the choice as a signal that `AppShell` reads, and `AppShell` opens its menu template in a CDK Dialog below 992 px; `StatusAnnouncer` keeps one pending message per project.

![Class diagram for the responsive, accessible and themed UI](diagrams/class-structure.png)

### Behaviour — apply theme and announce status

The theme follows the OS until chosen, then persists (L2-048 AC1, AC2). Status changes are announced politely at most once per 5 seconds per project (L2-047 AC3).

![Sequence diagram: apply theme and announce status](diagrams/sequence-theme-and-announce.png)

## Decisions made while building mobile layouts (journey 33)

- **Touch targets** ([ADR 0034](../../../adr/0034-touch-targets-are-44-px-below-992-px.md)). Below 992 px the
  design system's small and medium control heights are 44 px, and tabs are at least 44 px wide; from 992 px they are
  32 and 40 px, above WCAG 2.5.8's 24 px. L2-046 AC4 now says so. The mocks read the same tokens, so they changed with
  the app and no mock was edited.
- **No breakpoint service.** Every layout change is CSS on the token breakpoints, so the band never reaches
  TypeScript. The drawer is the sidebar's own template, so the two can't drift apart.
- **What was already there.** The pipeline's three layouts and every page's reflow came with the design system in
  earlier journeys; the new acceptance tests (`use-mission-control-on-mobile.spec.ts`) hold them, and found nothing
  wider than the viewport in 91 page and width pairs. What was missing below 992 px was any way to navigate.
- **The drawer's container is the drawer.** The app's CDK dialog container usually covers the viewport; the menu's is
  sized to the drawer (`drawer-pane`), so a tap beside the drawer reaches the backdrop and closes it.
