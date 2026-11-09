# Preview designs and the design system

## Overview

Stages 2 and 3 produce HTML: exported mocks in `docs/mocks/` and design-system pages in `docs/design-system/`. Mission Control lets users look at them without leaving the project. The Designs tab lists every screen and state with a thumbnail and an "Open in Magic Patterns" link; the Design system tab lists the token and component pages.

Both tabs show the selected page in the same preview. Because the HTML came from a generated design, the preview treats it as untrusted: it is served from a separate origin inside a sandboxed iframe that cannot read Mission Control's cookies or storage. The user can switch the preview between XS (375), S (576), M (768), L (992) and XL (1200) widths and between Light and Dark, and the iframe resizes and switches theme to match.

Terms used in this design:

- **preview origin** — separate host, such as `mocks.hewn.dev`, that serves project HTML for previews
- **sandboxed iframe** — iframe with `sandbox="allow-scripts"` and no `allow-same-origin`

## Description

The slice spans two Angular pages, a shared preview component and the preview host.

- **`DesignsPage`** — route `/projects/:id/designs`. Reads `docs/mocks/manifest.json` through the API and lists screens and states, each with a thumbnail and an Open in Magic Patterns link to its `magic_patterns_url`.
- **`DesignSystemPage`** — route `/projects/:id/design-system`. Lists foundation and component pages from `docs/design-system/`.
- **`SandboxedPreview`** — shared component holding the iframe, the width segmented control (375, 576, 768, 992, 1200) and the theme control. Theme is passed as `?theme=light|dark` in the iframe URL.
- **`PreviewTokenService`** — API service that issues a short-lived signed URL on the preview origin for `{project, sha, path}`; the preview host serves only paths under `docs/mocks/` and `docs/design-system/`.
- **`MockPreviewHost`** — static host on the preview origin. It fetches the file at the given SHA from GitHub, caches it, and serves it with `Content-Security-Policy: sandbox allow-scripts` and no cookies.
- **`ThumbnailRenderer`** — renders a small PNG per screen and state after stage 2 and stores it next to the cached file.

## Requirements

The feature realizes the following level-2 (L2) requirements. Each L2 requirement refines the level-1 (L1) requirement cited beside it. The text is copied from `docs/specs/L2.md`.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-011` | `L1-005` | **Preview designs in Mission Control.**<br>1. Given a project with designs, when a user opens Designs, then a gallery lists each screen and state with a thumbnail and an "Open in Magic Patterns" link.<br>2. Given an exported mock is opened, when it renders, then it is served from a separate origin inside a sandboxed iframe that cannot read Mission Control's cookies or storage.<br>3. Given the preview, when the user picks XS (375), S (576), M (768), L (992) or XL (1200) and Light or Dark, then the iframe resizes and switches theme to match. |
| `L2-012` | `L1-006` | **Extract the design system.**<br>1. Given stage 3 runs with `extracting-design-systems` on the exported Magic Patterns mocks, when it completes, then `docs/design-system/` contains tokens for colour (light and dark), typography, spacing, radius, elevation and motion, plus one page per component.<br>2. Given the mocks, when stage 3 validates, then every colour value used in `docs/mocks/` matches a token, and any that doesn't is listed and fails the run.<br>3. Given Magic Patterns holds design-system settings for the project (such as theme or tokens), when stage 3 runs, then the extracted tokens match them, and any mismatch is listed in the run log.<br>4. Given a project with a design system, when a user opens Design system in Mission Control, then the token and component pages can be browsed in the same sandboxed preview as L2-011. |

L2-012 AC1 to AC3 are realized by [Extract the design system](../../stages/extract-design-system/README.md); this design realizes AC4.

## Diagrams

### System context

Users preview designs inside Hewn and jump to Magic Patterns to edit them; Hewn reads the exported HTML from GitHub.

![C4 system context for previewing designs and the design system](diagrams/c4-context.png)

### Containers

The preview host is a separate container on a separate origin, so project HTML never runs on Mission Control's origin.

![C4 container view for previewing designs and the design system](diagrams/c4-container.png)

### Components

Both pages reuse one `SandboxedPreview`, which gives the design system the same isolation as the mocks (L2-012 AC4).

![C4 component view for previewing designs and the design system](diagrams/c4-component.png)

### Class structure

`SandboxedPreview` holds width and theme as signals; its `src` comes from a signed URL that the preview host accepts only for the two allowed roots. The token lifetime is <TO SUPPLY>.

![Class diagram for previewing designs and the design system](diagrams/class-structure.png)

### Behaviour — preview a screen state

The gallery lists screens and states with thumbnails and Magic Patterns links (L2-011 AC1); the page loads from a separate origin in a sandbox (AC2); width and theme controls resize and re-theme it (AC3).

![Sequence diagram: preview a screen state](diagrams/sequence-preview.png)
