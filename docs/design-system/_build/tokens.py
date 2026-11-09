"""Hewn design tokens: the data behind tokens/tokens.css and contrast-pairs.json.

Values were harvested from docs/mocks (assets/tokens.css, assets/ui.css and the
generated pages) and normalised; every correction is listed in DRIFT in
build.py and in README.md. Edit values here, then run build.py.
"""

# ---------------------------------------------------------------- primitives
PALETTE = {
    "slate": [("950", "#0f1216", "dark canvas"), ("900", "#14181d", "dark surface; light ink"), ("850", "#1c2229", "dark raised"),
              ("800", "#232a32", "dark hover"), ("700", "#2b333c", "dark line"), ("650", "#323b45", "dark grid"),
              ("500", "#6b7682", "dark control edge"), ("400", "#8a949f", "dark faint ink"), ("300", "#a3adb8", "dark muted ink")],
    "stone": [("50", "#ffffff", "light surface"), ("100", "#f6f5f2", "light canvas"), ("150", "#efede8", "light raised"),
              ("200", "#e8e6e1", "light hover; dark ink"), ("300", "#dedbd4", "light line"), ("500", "#7d848c", "light control edge"),
              ("600", "#5f6872", "light faint ink"), ("700", "#4d5660", "light muted ink")],
    "blue": [("50", "#e8f1fd", "light accent tint"), ("100", "#d4e5fb", "light accent tint, hover"), ("300", "#7cc4ff", "dark focus, link hover"),
             ("400", "#4c9aff", "dark accent"), ("450", "#6aacff", "dark accent hover"), ("600", "#1a62bf", "light accent"),
             ("700", "#1859aa", "light accent hover"), ("800", "#224a75", "dark accent tint, hover"), ("900", "#172f4c", "dark accent tint"),
             ("950", "#0b1320", "ink on dark accent")],
    "green": [("50", "#e5f4ec", "light success tint"), ("400", "#45c28f", "dark success"), ("700", "#1f7a52", "light success"),
              ("900", "#16362a", "dark success tint")],
    "amber": [("50", "#fbf1dc", "light warning tint"), ("200", "#ecd3a6", "dark warning text"), ("400", "#e8a845", "dark warning"),
              ("600", "#a86e0a", "light warning mark"), ("700", "#8a5a00", "light warning text"), ("900", "#3d2e14", "dark warning tint")],
    "red": [("50", "#fdecec", "light danger tint"), ("200", "#ffb3b6", "dark danger text"), ("250", "#ff9a9f", "dark danger label"),
            ("400", "#f2545b", "dark danger mark"), ("600", "#c4323b", "light danger"), ("700", "#a3262e", "light danger hover/text"),
            ("850", "#5a252b", "dark danger hover"), ("900", "#4a1f24", "dark danger tint")],
}

FONT = [
    ("--font-family-sans", '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'),
    ("--font-family-mono", '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'),
    ("--font-size-xs", "0.75rem"), ("--font-size-sm", "0.875rem"), ("--font-size-md", "1rem"), ("--font-size-lg", "1.125rem"),
    ("--font-size-xl", "1.25rem"), ("--font-size-2xl", "1.5rem"), ("--font-size-3xl", "2.25rem"), ("--font-size-4xl", "3rem"),
    ("--font-size-5xl", "3.75rem"),
    ("--font-weight-regular", "400"), ("--font-weight-medium", "500"), ("--font-weight-semibold", "600"), ("--font-weight-bold", "700"),
    ("--line-height-tight", "1.1"), ("--line-height-snug", "1.3"), ("--line-height-normal", "1.5"), ("--line-height-relaxed", "1.65"),
    ("--line-height-loose", "1.85"),
    ("--letter-spacing-wordmark", "-0.045em"), ("--letter-spacing-tight", "-0.02em"), ("--letter-spacing-normal", "0"),
    ("--letter-spacing-wide", "0.04em"),
]

def p(ramp, step):
    return f"var(--palette-{ramp}-{step})"

# ---------------------------------------------------------------- semantic colour: (token, light, dark, usage)
COLOR = [
    # backgrounds
    ("--color-bg-canvas", p("stone", 100), p("slate", 950), "Page background behind everything."),
    ("--color-bg-surface", p("stone", 50), p("slate", 900), "Cards, tiles, inputs, sidebar, top bar."),
    ("--color-bg-surface-raised", p("stone", 150), p("slate", 850), "Dialogs, toasts, current nav item, secondary buttons."),
    ("--color-bg-surface-sunken", p("stone", 100), p("slate", 950), "Wells: preview stage, code boxes, run line."),
    ("--color-bg-subtle", p("stone", 150), p("slate", 850), "Hover rows, read-only inputs, skeleton base."),
    ("--color-bg-subtle-hover", p("stone", 200), p("slate", 800), "Hovered secondary buttons and chips, skeleton sheen."),
    ("--color-bg-inverse", p("slate", 900), p("stone", 200), "Skip link, tooltip, the sign-in stone button."),
    ("--color-bg-backdrop", "rgb(20 24 29 / 0.5)", "rgb(0 0 0 / 0.6)", "Scrim behind dialogs and drawers."),
    ("--color-bg-log", p("stone", 100), p("slate", 950), "Log viewer box."),
    # foregrounds
    ("--color-fg-default", p("slate", 900), p("stone", 200), "Body text, titles, values."),
    ("--color-fg-muted", p("stone", 700), p("slate", 300), "Secondary text, descriptions, inactive nav."),
    ("--color-fg-subtle", p("stone", 600), p("slate", 400), "Metadata, timestamps, placeholders, counts."),
    ("--color-fg-disabled", p("stone", 500), p("slate", 500), "Disabled labels (exempt from contrast)."),
    ("--color-fg-inverse", p("stone", 200), p("slate", 900), "Text on --color-bg-inverse."),
    ("--color-fg-link", p("blue", 600), p("blue", 400), "Inline links."),
    ("--color-fg-link-hover", p("blue", 700), p("blue", 300), "Hovered links."),
    ("--color-fg-accent", p("blue", 600), p("blue", 400), "Running status, current-stage text, accent labels."),
    ("--color-fg-on-accent", p("stone", 50), p("blue", 950), "Label on the primary button and accent fills."),
    ("--color-fg-on-danger", p("stone", 50), p("red", 250), "Label on the danger button."),
    # borders
    ("--color-border-default", p("stone", 300), p("slate", 700), "Hairlines between rows, card edges (decorative)."),
    ("--color-border-strong", p("stone", 500), p("slate", 500), "Input and checkbox edges (1.4.11)."),
    ("--color-border-grid", p("stone", 300), p("slate", 650), "Dashboard edit grid, inactive spend bars."),
    ("--color-border-inverse", p("slate", 700), p("stone", 300), "Edges on inverse surfaces."),
    # accent
    ("--color-accent", p("blue", 600), p("blue", 400), "Primary button, selected tab underline, meters."),
    ("--color-accent-hover", p("blue", 700), p("blue", 450), "Hovered primary button."),
    ("--color-accent-active", p("blue", 700), p("blue", 300), "Pressed primary button."),
    ("--color-accent-subtle", p("blue", 50), p("blue", 900), "Selected list item, current design state."),
    ("--color-accent-subtle-hover", p("blue", 100), p("blue", 800), "Hovered selected item."),
    ("--color-focus-ring", p("blue", 600), p("blue", 300), "The one focus ring."),
    ("--color-brand-body", p("slate", 900), p("stone", 200), "The Hewn mark body and wordmark."),
    ("--color-brand-chip", p("blue", 600), p("blue", 400), "The chip in the Hewn mark."),
    # status
    ("--color-info-bg", p("blue", 50), p("blue", 900), "Info callout and strip."),
    ("--color-info-fg", p("blue", 700), p("blue", 300), "Info text."),
    ("--color-info-border", p("blue", 100), p("blue", 400), "Info edge (decorative)."),
    ("--color-info-icon", p("blue", 600), p("blue", 400), "Info icon."),
    ("--color-info-solid", p("blue", 600), p("blue", 400), "Info fills: running pipeline segment."),
    ("--color-success-bg", p("green", 50), p("green", 900), "Success callout and strip."),
    ("--color-success-fg", p("green", 700), p("green", 400), "Success text: Passed, Merged, Complete."),
    ("--color-success-border", p("green", 400), p("green", 400), "Success edge (decorative)."),
    ("--color-success-icon", p("green", 700), p("green", 400), "Success icon."),
    ("--color-success-solid", p("green", 700), p("green", 400), "Success fills: done segments, connected dot."),
    ("--color-warning-bg", p("amber", 50), p("amber", 900), "Warning callout and strip."),
    ("--color-warning-fg", p("amber", 700), p("amber", 200), "Warning text: Paused, Budget reached."),
    ("--color-warning-border", p("amber", 400), p("amber", 400), "Warning edge (decorative)."),
    ("--color-warning-icon", p("amber", 700), p("amber", 400), "Warning icon."),
    ("--color-warning-solid", p("amber", 600), p("amber", 400), "Warning fills: paused segment, spend over 80%."),
    ("--color-danger-bg", p("red", 50), p("red", 900), "Danger callout, strip, invalid summary."),
    ("--color-danger-fg", p("red", 700), p("red", 200), "Danger text inside danger surfaces."),
    ("--color-danger-border", p("red", 400), p("red", 400), "Danger edge; danger button ring."),
    ("--color-danger-icon", p("red", 600), p("red", 400), "Danger icon, invalid input ring, failed segment."),
    ("--color-danger-solid", p("red", 600), p("red", 900), "Danger button background."),
    ("--color-danger-solid-hover", p("red", 700), p("red", 850), "Hovered danger button."),
    ("--color-danger-strong", p("red", 700), p("red", 250), "Failed status and field errors on neutral surfaces."),
    # fixed preview colours: the product being built, drawn the same in both themes
    ("--color-preview-canvas", p("stone", 100), p("stone", 100), "Increment video and design preview: page (fixed light)."),
    ("--color-preview-surface", p("stone", 50), p("stone", 50), "Preview: sidebar and table surface."),
    ("--color-preview-line", p("stone", 300), p("stone", 300), "Preview: hairlines."),
    ("--color-preview-block", p("stone", 200), p("stone", 200), "Preview: placeholder blocks."),
    ("--color-preview-ink", p("slate", 900), p("slate", 900), "Preview: titles and text."),
    ("--color-preview-ink-muted", p("stone", 700), p("stone", 700), "Preview: secondary text."),
    ("--color-preview-accent", p("blue", 700), p("blue", 700), "Preview: accent text and focus outline."),
    ("--color-preview-accent-tint", p("blue", 100), p("blue", 100), "Preview: selected nav block."),
    ("--color-preview-ok", p("green", 700), p("green", 700), "Preview: success text."),
    ("--color-preview-highlight", p("amber", 50), p("amber", 50), "Preview: the row the video is narrating."),
    ("--color-preview-dark-canvas", p("slate", 900), p("slate", 900), "Dark preview frame: page."),
    ("--color-preview-dark-surface", p("slate", 950), p("slate", 950), "Dark preview frame: sidebar."),
    ("--color-preview-dark-line", p("slate", 700), p("slate", 700), "Dark preview frame: hairlines."),
    ("--color-preview-dark-block", p("slate", 650), p("slate", 650), "Dark preview frame: blocks."),
    ("--color-preview-dark-ink", p("stone", 200), p("stone", 200), "Dark preview frame: text."),
    ("--color-preview-dark-highlight", p("amber", 900), p("amber", 900), "Dark preview frame: narrated row."),
    ("--color-preview-mark-ok", p("green", 400), p("green", 400), "Preview: success cell."),
    ("--color-preview-mark-accent", p("blue", 400), p("blue", 400), "Preview: accent cell, video progress."),
    ("--color-bg-scrim", "rgb(0 0 0 / 0.75)", "rgb(0 0 0 / 0.75)", "Video captions and controls over footage."),
    ("--color-bg-scrim-hover", "rgb(255 255 255 / 0.15)", "rgb(255 255 255 / 0.15)", "Hovered control on a scrim."),
    ("--color-bg-scrim-track", "rgb(255 255 255 / 0.25)", "rgb(255 255 255 / 0.25)", "Video progress track."),
    ("--color-fg-on-scrim", p("stone", 50), p("stone", 50), "Text and icons on a scrim."),
]

# Tokens computed from other semantic colours. Declared in every theme block
# so they resolve against that theme (custom properties resolve where declared).
DERIVED = [
    ("--color-focus-ring-offset", "var(--color-bg-surface)", "Gap colour between control and ring."),
    ("--shadow-focus", "0 0 0 var(--focus-ring-offset) var(--color-focus-ring-offset), 0 0 0 calc(var(--focus-ring-offset) + var(--focus-ring-width)) var(--color-focus-ring)", "Ring drawn as a shadow where outline is clipped."),
]

TYPE_ROLES = [
    ("--text-display", "semibold", "4xl", "tight", "sans", "Sign-in headline (36px below sm)."),
    ("--text-h1", "semibold", "2xl", "snug", "sans", "Page title, one per page."),
    ("--text-h2", "semibold", "lg", "snug", "sans", "Section, dialog and empty-state titles."),
    ("--text-h3", "semibold", "sm", "snug", "sans", "Tile titles, settings group titles, compact empty-state titles."),
    ("--text-h4", "medium", "xs", "snug", "sans", "Column heads in the traceability matrix, sub-heads."),
    ("--text-body-lg", "regular", "md", "relaxed", "sans", "Sign-in lede and long-form prose."),
    ("--text-body", "regular", "md", "normal", "sans", "Default body text (16px)."),
    ("--text-body-sm", "regular", "sm", "normal", "sans", "Dense UI: rows, tables, nav, callouts."),
    ("--text-caption", "regular", "xs", "normal", "sans", "Metadata, hints, breadcrumbs, timestamps."),
    ("--text-label", "medium", "sm", "normal", "sans", "Buttons, field labels, status words."),
    ("--text-overline", "medium", "xs", "normal", "sans", "Sidebar section labels (sentence case, no caps)."),
    ("--text-code", "regular", "xs", "normal", "mono", "SHAs, paths, ids, inline code."),
    ("--text-log", "regular", "xs", "loose", "mono", "Log viewer lines."),
]

SPACE = [("0", "0"), ("0-5", "0.125rem"), ("1", "0.25rem"), ("1-5", "0.375rem"), ("2", "0.5rem"), ("2-5", "0.625rem"),
         ("3", "0.75rem"), ("4", "1rem"), ("5", "1.25rem"), ("6", "1.5rem"), ("8", "2rem"), ("10", "2.5rem"),
         ("12", "3rem"), ("16", "4rem"), ("20", "5rem"), ("24", "6rem")]

LAYOUT = [
    ("--layout-breakpoint-sm", "36rem", "576px: dialogs centre, page header goes horizontal, two-column forms."),
    ("--layout-breakpoint-md", "48rem", "768px: 8 columns, tables show md columns, traceability 2-up."),
    ("--layout-breakpoint-lg", "62rem", "992px: sidebar appears, top bar hides, 12 columns, row lists become tables."),
    ("--layout-breakpoint-xl", "75rem", "1200px: wide rails, traceability 4-up, project header goes horizontal."),
    ("--layout-breakpoint-2xl", "96rem", "1536px: content stops growing at the container max."),
    ("--layout-columns", "4", "Grid columns (4 / 8 / 12)."),
    ("--layout-gutter", "var(--space-4)", "Space between columns (16 / 24 / 32)."),
    ("--layout-margin", "var(--space-4)", "Viewport edge to content (16 / 16 / 32)."),
    ("--layout-container-max", "90rem", "Widest content area (1440px)."),
    ("--layout-measure", "65ch", "Longest line of prose."),
    ("--layout-form-max", "42rem", "Widest single-column form."),
    ("--layout-sidebar-width", "15rem", "App sidebar (240px)."),
    ("--layout-drawer-width", "18rem", "Mobile navigation drawer (288px)."),
    ("--layout-topbar-height", "3.5rem", "Mobile top bar (56px); also scroll-padding-top."),
    ("--layout-rail-nav", "15rem", "Settings section nav rail."),
    ("--layout-rail-pipeline", "20rem", "Pipeline stage list at xl (18rem at lg)."),
    ("--layout-rail-aside", "24rem", "Plan and help aside at xl (20rem at lg)."),
    ("--layout-dash-row", "3.75rem", "Dashboard grid row height (60px)."),
    ("--layout-dialog-width", "28rem", "Default dialog panel."),
    ("--layout-dialog-width-lg", "32rem", "Large dialog panel (forms with several fields)."),
    ("--layout-toast-width", "24rem", "Toast region from sm up."),
]

SHAPE = [
    ("--radius-xs", "2px", "Bars and segments: pipeline strip, spend bars, skeleton chips."),
    ("--radius-sm", "4px", "Small parts: segmented options, tile links, state links, codes."),
    ("--radius-md", "6px", "Controls and containers: buttons, inputs, callouts, cards, tiles."),
    ("--radius-lg", "8px", "Overlays: dialog panels, drawers, toasts."),
    ("--radius-xl", "12px", "Bottom sheets below sm (top corners only)."),
    ("--radius-full", "9999px", "Pills, dots, avatars, meters."),
    ("--border-width-hairline", "1px", "Every border and inset ring."),
    ("--border-width-thick", "2px", "Selected tab underline, current stage edge, invalid ring."),
]

SHADOW_LIGHT = [
    ("--shadow-color", "20 24 29", "RGB channels the shadows are tinted with."),
    ("--shadow-1", "0 1px 2px rgb(var(--shadow-color) / 0.08)", "Resting tiles."),
    ("--shadow-2", "0 2px 6px rgb(var(--shadow-color) / 0.1), 0 1px 2px rgb(var(--shadow-color) / 0.06)", "Tiles being edited, preview frames."),
    ("--shadow-3", "0 8px 24px rgb(var(--shadow-color) / 0.16)", "Toasts, menus, tooltips, the log jump pill."),
    ("--shadow-4", "0 20px 48px rgb(var(--shadow-color) / 0.22), 0 4px 12px rgb(var(--shadow-color) / 0.1)", "Dialogs and drawers."),
]
SHADOW_DARK = [
    ("--shadow-color", "0 0 0"),
    ("--shadow-1", "0 1px 2px rgb(var(--shadow-color) / 0.4)"),
    ("--shadow-2", "0 2px 6px rgb(var(--shadow-color) / 0.45), 0 1px 2px rgb(var(--shadow-color) / 0.3)"),
    ("--shadow-3", "0 8px 24px rgb(var(--shadow-color) / 0.55)"),
    ("--shadow-4", "0 20px 48px rgb(var(--shadow-color) / 0.6), 0 4px 12px rgb(var(--shadow-color) / 0.4)"),
]

MOTION = [
    ("--duration-instant", "0ms", "State flips with no transition."),
    ("--duration-fast", "120ms", "Hover and press: colour, background, scale."),
    ("--duration-base", "200ms", "Small moves: tab underline, chevrons."),
    ("--duration-slow", "240ms", "Dialog and drawer entrance."),
    ("--duration-deliberate", "500ms", "Large moves you should notice: toast timer bar reset."),
    ("--duration-pulse", "2s", "Looping pulse: running segment, log cursor, skeleton shimmer."),
    ("--duration-spin", "2.4s", "Spinner rotation (the prototype's slow spin)."),
    ("--delay-tooltip", "300ms", "Hover/focus time before a tooltip shows (hides with no delay)."),
    ("--ease-standard", "cubic-bezier(0.2, 0, 0, 1)", "Most transitions."),
    ("--ease-enter", "cubic-bezier(0.23, 1, 0.32, 1)", "Things arriving: dialogs, drawers, toasts (the prototype curve)."),
    ("--ease-exit", "cubic-bezier(0.3, 0, 1, 1)", "Things leaving."),
    ("--ease-linear", "linear", "Loops: spinner and shimmer."),
]

Z = [("--z-base", "0", "Page content."), ("--z-raised", "1", "Overlapping siblings: timeline icons."),
     ("--z-sticky", "100", "Sticky top bar and table heads."), ("--z-dropdown", "1000", "Menus."),
     ("--z-overlay", "1200", "Dialog backdrop."), ("--z-modal", "1300", "Dialogs and drawers."),
     ("--z-popover", "1400", "Popovers over dialogs."), ("--z-toast", "1500", "Toast region."),
     ("--z-tooltip", "1600", "Tooltips and the skip link.")]

INTERACTION = [
    ("--target-min", "1.5rem", "Smallest target (WCAG 2.5.8)."),
    ("--target-comfortable", "2.75rem", "Touch target below lg: nav links, tabs, icon buttons."),
    ("--focus-ring-width", "2px", "Focus ring thickness."),
    ("--focus-ring-offset", "2px", "Gap between control and ring."),
    ("--control-height-xs", "1.75rem", "Tile links, toast close (28px)."),
    ("--control-height-sm", "2rem", "Small buttons, compact inputs, segmented options (32px)."),
    ("--control-height-md", "2.5rem", "Default buttons, inputs, tabs, nav links (40px)."),
    ("--control-height-lg", "3rem", "Large buttons: sign-in (48px)."),
    ("--size-icon-xs", "0.75rem", "Breadcrumb chevrons, tiny status (12px)."),
    ("--size-icon-sm", "0.875rem", "Icons inside rows, small buttons and status (14px)."),
    ("--size-icon-md", "1rem", "Default icon (16px)."),
    ("--size-icon-lg", "1.25rem", "Nav and top bar icons (20px)."),
    ("--size-icon-xl", "1.75rem", "Empty and error state icons (28px)."),
]

# ---------------------------------------------------------------- contrast pairs (fg, bg, min, note[, themes])
PAIRS = []
def pair(fg, bg, mn, note, themes=None):
    d = {"fg": fg, "bg": bg, "min": mn, "note": note}
    if themes:
        d["themes"] = themes
    PAIRS.append(d)

for bg in ["canvas", "surface", "surface-raised", "surface-sunken", "subtle", "subtle-hover"]:
    pair("--color-fg-default", f"--color-bg-{bg}", 4.5, f"body text on {bg}")
for bg in ["canvas", "surface", "surface-raised", "subtle", "subtle-hover"]:
    pair("--color-fg-muted", f"--color-bg-{bg}", 4.5, f"secondary text on {bg}")
for bg in ["canvas", "surface", "surface-raised", "subtle"]:
    pair("--color-fg-subtle", f"--color-bg-{bg}", 4.5, f"metadata and placeholders on {bg}")
pair("--color-fg-subtle", "--color-bg-subtle-hover", 4.5, "metadata on hovered rows (log line hover, PR hover)")
pair("--color-fg-default", "--color-bg-log", 4.5, "log text")
pair("--color-fg-muted", "--color-bg-surface-sunken", 4.5, "preformatted text in .pre and run lines")
pair("--color-danger-strong", "--color-bg-surface-raised", 4.5, "field errors in dialogs, danger menu items")
pair("--color-fg-subtle", "--color-bg-log", 4.5, "log timestamps")
pair("--color-fg-inverse", "--color-bg-inverse", 4.5, "skip link, tooltip, stone button")
for bg in ["canvas", "surface", "surface-raised"]:
    pair("--color-fg-link", f"--color-bg-{bg}", 4.5, f"links on {bg}")
pair("--color-fg-link-hover", "--color-bg-surface", 4.5, "hovered links")
for bg in ["canvas", "surface", "surface-raised", "subtle", "accent-subtle"]:
    pair("--color-fg-accent", f"--color-bg-{bg}" if bg != "accent-subtle" else "--color-accent-subtle", 4.5, f"accent text (Running, current step) on {bg}")
pair("--color-fg-default", "--color-accent-subtle", 4.5, "text on selected item")
pair("--color-fg-default", "--color-accent-subtle-hover", 4.5, "text on hovered selected item")
pair("--color-fg-muted", "--color-accent-subtle", 4.5, "muted text on current row")
for bg in ["accent", "accent-hover", "accent-active"]:
    pair("--color-fg-on-accent", f"--color-{bg}", 4.5, f"primary label on {bg}")
pair("--color-accent", "--color-bg-surface", 3, "primary button, selected tab underline, meter fill vs surface")
pair("--color-accent", "--color-bg-canvas", 3, "primary button vs page")
pair("--color-accent", "--color-border-default", 3, "meter fill vs meter track")
for bg in ["surface", "canvas", "surface-raised"]:
    pair("--color-border-strong", f"--color-bg-{bg}", 3, f"input and radio edges on {bg}")
for bg in ["surface", "canvas", "surface-raised", "subtle"]:
    pair("--color-focus-ring", f"--color-bg-{bg}", 3, f"focus ring vs {bg}")
pair("--color-focus-ring", "--color-accent-subtle", 3, "focus ring on selected item")
pair("--color-fg-on-danger", "--color-danger-solid", 4.5, "danger button label")
pair("--color-fg-on-danger", "--color-danger-solid-hover", 4.5, "danger button label, hover")
pair("--color-danger-solid", "--color-bg-surface", 3, "danger button vs surface", ["light"])
pair("--color-danger-border", "--color-bg-surface-raised", 3, "danger button ring vs dialog", ["dark"])
pair("--color-danger-border", "--color-bg-surface", 3, "danger button ring vs surface", ["dark"])
for s in ["info", "success", "warning", "danger"]:
    pair(f"--color-{s}-fg", f"--color-{s}-bg", 4.5, f"{s} callout and strip text")
    pair(f"--color-{s}-icon", f"--color-{s}-bg", 3, f"{s} callout icon")
    pair(f"--color-{s}-icon", "--color-bg-surface", 3, f"{s} status icon on surface")
    pair(f"--color-{s}-icon", "--color-bg-canvas", 3, f"{s} status icon on page")
    if s != "danger":
        pair(f"--color-{s}-solid", "--color-bg-surface", 3, f"{s} fill (segment, dot, bar) vs surface")
    pair(f"--color-{s}-solid", "--color-border-default", 3, f"{s} fill vs meter/strip track") if s in ("success", "warning") else None
pair("--color-danger-icon", "--color-bg-surface", 3, "invalid input ring")
pair("--color-danger-strong", "--color-bg-surface", 4.5, "failed status, field error on surface")
pair("--color-danger-strong", "--color-bg-canvas", 4.5, "field error on page")
pair("--color-danger-strong", "--color-danger-bg", 4.5, "callout title in danger callout")
pair("--color-success-fg", "--color-bg-surface", 4.5, "Passed / Complete on surface")
pair("--color-success-fg", "--color-bg-canvas", 4.5, "Complete on page")
pair("--color-warning-fg", "--color-bg-surface", 4.5, "Paused / Budget reached on surface")
pair("--color-warning-fg", "--color-bg-canvas", 4.5, "Paused on page")
pair("--color-info-fg", "--color-bg-surface", 4.5, "info text on surface")
pair("--color-brand-body", "--color-bg-surface", 4.5, "wordmark on sidebar")
pair("--color-brand-chip", "--color-bg-surface", 3, "mark chip on sidebar")
pair("--color-fg-on-accent", "--color-accent", 4.5, "log jump pill label")
pair("--color-preview-ink", "--color-preview-canvas", 4.5, "preview text")
pair("--color-preview-ink-muted", "--color-preview-surface", 4.5, "preview secondary text")
pair("--color-preview-accent", "--color-preview-highlight", 4.5, "preview suggestion on narrated row")
pair("--color-preview-ok", "--color-preview-surface", 4.5, "preview success text")
pair("--color-preview-dark-ink", "--color-preview-dark-canvas", 4.5, "dark preview text")
pair("--color-fg-on-scrim", "--color-bg-scrim", 4.5, "captions and controls on scrim")
