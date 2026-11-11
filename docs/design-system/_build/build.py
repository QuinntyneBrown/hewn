#!/usr/bin/env python3
"""Generate docs/design-system/ from the data in this folder.

    python3 docs/design-system/_build/build.py

Writes tokens/tokens.css, tokens/contrast-pairs.json, foundations/*.html,
components/*.html, patterns/*.html, index.html and README.md. Then run:

    python3 .claude/skills/extracting-design-systems/scripts/tokens_to_json.py docs/design-system/tokens/tokens.css
    python3 .claude/skills/extracting-design-systems/scripts/check_contrast.py docs/design-system/tokens/tokens.css
    python3 .claude/skills/extracting-design-systems/scripts/check_design_system.py docs/design-system
"""
from __future__ import annotations

import importlib
import sys
from html import escape
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import write_tokens  # noqa: E402
from common import DS, EXTRACTED, NA, ROOT, section  # noqa: E402

# ---------------------------------------------------------------- catalog
FOUNDATIONS = [
    ("color", "Color", "Ramps, semantic roles, status colours, both themes, every contrast pair."),
    ("typography", "Typography", "Families, the type scale, weights, line heights, role shorthands, measure."),
    ("spacing", "Spacing", "The 4px scale, half steps for dense parts, inside vs between."),
    ("layout", "Layout", "Breakpoints, columns, gutters, margins, rails and page templates."),
    ("elevation", "Elevation", "Shadows, surface hierarchy, z-order, dark-theme elevation."),
    ("shape", "Shape", "Radii, border widths, inset rings."),
    ("motion", "Motion", "Durations, easings, loops, reduced motion."),
    ("iconography", "Iconography", "The 24-unit stroke icon set, sizes, status icons, labelling."),
    ("theming", "Theming", "How light and dark work, token tiers, adding a theme, tokens.json."),
    ("responsive", "Responsive", "Mobile-first rules and what each component does at each breakpoint."),
    ("accessibility", "Accessibility", "The WCAG 2.2 AA commitments and how they are tested."),
    ("content", "Content", "Voice, casing, verbs, numbers, money, time, error and empty formulas."),
]

# (slug, title, group, module, one-line summary)
COMPONENTS = [
    ("button", "Button", "Actions", "comp_actions", "Triggers an action. Primary, secondary, ghost, link, danger, outline, stone."),
    ("button-group", "Button group", "Actions", "comp_actions", "Segmented single-select controls and toolbars."),
    ("link", "Link", "Actions", "comp_actions", "Inline, quiet and external links."),
    ("menu", "Menu", "Actions", "comp_actions", "A menu button that opens a list of actions."),
    ("text-field", "Text field", "Inputs", "comp_inputs", "Single-line input: text, money prefix, search, secret with reveal."),
    ("textarea", "Textarea", "Inputs", "comp_inputs", "Multi-line input for directions and notes."),
    ("select", "Select", "Inputs", "comp_inputs", "Native select for one choice from a list."),
    ("checkbox", "Checkbox", "Inputs", "comp_inputs", "Independent on/off choices and groups."),
    ("radio-group", "Radio group", "Inputs", "comp_inputs", "One choice from a few, listed or as cards."),
    ("switch", "Switch", "Inputs", "comp_inputs", "A setting that takes effect immediately."),
    ("form-field", "Form field", "Inputs", "comp_inputs", "Label, control, hint, error and counter in one wrapper."),
    ("form-layout", "Form layout", "Inputs", "comp_inputs", "Columns, fieldsets, actions bar and error summary."),
    ("top-bar", "Top bar", "Navigation", "comp_nav", "Mobile header with menu button and connection state."),
    ("sidebar-nav", "Sidebar navigation", "Navigation", "comp_nav", "The app sidebar: primary nav, projects, connection, user."),
    ("tabs", "Tabs", "Navigation", "comp_nav", "Underline tabs for views of one object."),
    ("breadcrumb", "Breadcrumb", "Navigation", "comp_nav", "Where this page sits in the hierarchy."),
    ("pagination", "Pagination", "Navigation", "comp_nav", "Moves through long, ordered lists."),
    ("stepper", "Stepper", "Navigation", "comp_nav", "Pipeline stage list and progress steps."),
    ("skip-link", "Skip link", "Navigation", "comp_nav", "Jumps keyboard users past the navigation."),
    ("page-header", "Page header", "Navigation", "comp_nav", "Page title, description and page actions."),
    ("card", "Card", "Containers", "comp_containers", "A bordered surface grouping related content."),
    ("tile", "Dashboard tile", "Containers", "comp_containers", "Header + body panels on the dashboard grid."),
    ("dialog", "Dialog", "Containers", "comp_containers", "Modal confirmation and form dialogs; bottom sheet on phones."),
    ("drawer", "Drawer", "Containers", "comp_containers", "Edge panel for mobile navigation."),
    ("tooltip", "Tooltip", "Containers", "comp_containers", "Short description of a control on hover and focus."),
    ("divider", "Divider", "Containers", "comp_containers", "Hairline separators."),
    ("layout", "Layout primitives", "Containers", "comp_containers", "Container, grid, stack, cluster and split."),
    ("table", "Table", "Data display", "comp_data", "Tabular data: audit log, runs, matrix."),
    ("row-list", "Row list", "Data display", "comp_data", "Table-like lists that stack on phones: projects, backlog, workers."),
    ("list", "List", "Data display", "comp_data", "Simple, two-line and interactive lists: events, PRs, files, checks."),
    ("description-list", "Description list", "Data display", "comp_data", "Key-value pairs."),
    ("avatar", "Avatar", "Data display", "comp_data", "Initials for people."),
    ("badge", "Status and badge", "Data display", "comp_data", "Status words with icons, pills, counts and dots."),
    ("chip", "Chip", "Data display", "comp_data", "Filter, removable and static tags."),
    ("stat", "Stat", "Data display", "comp_data", "Live run, spend and KPI figures."),
    ("code-block", "Code block", "Data display", "comp_data", "Copyable codes, preformatted text, keys, secrets."),
    ("timeline", "Timeline", "Data display", "comp_data", "Increment timeline and decision log."),
    ("log-viewer", "Log viewer", "Data display", "comp_product", "Streaming worker log."),
    ("pipeline-strip", "Pipeline strip", "Data display", "comp_product", "Eleven-segment summary of a project's stages."),
    ("project-header", "Project header", "Data display", "comp_product", "Project name, repo, status, spend and tabs."),
    ("preview", "Preview", "Data display", "comp_product", "Increment video and design preview frames."),
    ("logo", "Logo", "Data display", "comp_product", "The Hewn mark and wordmark."),
    ("toast", "Toast", "Feedback", "comp_feedback", "Brief, non-blocking news about live events."),
    ("alert", "Alert", "Feedback", "comp_feedback", "Inline callouts and page-wide strips."),
    ("inline-message", "Inline message", "Feedback", "comp_feedback", "Field hints, errors and confirmations."),
    ("progress-bar", "Progress bar", "Feedback", "comp_feedback", "Meters for spend and completion."),
    ("spinner", "Spinner", "Feedback", "comp_feedback", "Indeterminate wait, inline with text."),
    ("skeleton", "Skeleton", "Feedback", "comp_feedback", "Placeholder shapes while content loads."),
    ("empty-state", "Empty state", "Feedback", "comp_feedback", "First-run, no results, forbidden and failed-to-load."),
    ("error-page", "Error page", "Feedback", "comp_feedback", "404 and 500 pages that keep the shell."),
]

PATTERNS = [
    ("forms", "Forms", "Layout, labels, validation timing, error summary, submit and destructive confirmation."),
    ("feedback", "Feedback and loading", "Which feedback for which action; skeleton vs spinner vs progress."),
    ("empty-and-error-states", "Empty and error states", "Copy formulas and when to use which."),
    ("navigation", "Navigation and page structure", "Shell, page header, project tabs, breadcrumbs, back."),
    ("dialogs-and-overlays", "Dialogs and overlays", "Dialog vs drawer vs menu vs tooltip vs page; mobile sheets."),
    ("data-tables-and-lists", "Data tables and lists", "Density, filtering, selection, row actions, responsive strategy."),
    ("notifications", "Notifications", "Toast vs strip vs callout; priority, stacking, dismissal."),
    ("content-and-tone", "Content and tone", "Voice, verbs, numbers, money and the microcopy library."),
]

COMPONENT_SECTIONS = [("overview", "Overview"), ("anatomy", "Anatomy"), ("variants", "Variants"), ("sizes", "Sizes"),
                      ("states", "States"), ("responsive", "Responsive behaviour"), ("theming", "Theming"),
                      ("accessibility", "Accessibility"), ("content", "Content"), ("do-dont", "Do and don't"),
                      ("tokens", "Tokens"), ("code", "Code"), ("sources", "Sources")]
PATTERN_SECTIONS = [("overview", "Overview"), ("when", "When to use"), ("structure", "Structure"), ("states", "States"),
                    ("responsive", "Responsive behaviour"), ("accessibility", "Accessibility"), ("content", "Content"),
                    ("do-dont", "Do and don't"), ("sources", "Sources")]

# Drift found in the mocks: (mock or file, issue, resolution)
DRIFT = [
    ("assets/tokens.css", "`--palette-ink-900` (#14181d) duplicates `--palette-slate-900`.", "Collapsed into `--palette-slate-900`."),
    ("assets/tokens.css", "`--radius-lg` equalled `--radius-md` (6px); `--radius-xs` 1px and `--radius-sm` 3px sat off the 2px grid.", "Radii are now 2 / 4 / 6 / 8 / 12px + full; overlays (dialog, drawer, toast) take lg, bottom sheets xl."),
    ("assets/tokens.css", "`--font-size-2xs` (11px) used for bar labels, stage live lines and flags is below the 12px floor.", "Removed; those parts use `--font-size-xs` (12px)."),
    ("assets/ui.css + 44 dialog/page mocks", "13px (`0.8125rem`) type in tile titles, file paths, code boxes and inline `style` attributes; 15px (`0.9375rem`) in decisions.", "Snapped to the scale: 14px (`--font-size-sm`) and 16px (`--font-size-md`)."),
    ("assets/tokens.css", "Light accent `#1f6fd1` fell to 4.22:1 as text on raised surfaces (Running status in dialogs, accent text on hover rows).", "`--palette-blue-600` darkened to `#1a62bf` (4.6:1 on raised, 5.6:1 on white)."),
    ("assets/tokens.css", "Dark accent text on the selected-item tint (`--palette-blue-900` #1b3a5c) was 4.08:1.", "Tint deepened to `#172f4c` (4.77:1)."),
    ("assets/tokens.css", "Dark `--color-accent-subtle-hover` equalled `--color-accent-subtle`, so hovering a selected item showed no change.", "New `--palette-blue-800` (#224a75) for the hover tint."),
    ("assets/tokens.css", "Light `--color-warning-solid` (amber-400) was 2.0:1 against white, below 1.4.11 for the paused segment, spend meter and warning dot.", "New `--palette-amber-600` (#a86e0a) for light warning fills."),
    ("assets/tokens.css", "Light `--color-border-strong` (#8b929a) and `--color-fg-subtle` (#646d77) were at or under 3:1 / 4.5:1 on the canvas and raised surfaces.", "Darkened to `#7d848c` and `#5f6872`; dark `--color-fg-subtle` lightened to `#8a949f` for log hover rows."),
    ("assets/ui.css", "Secondary buttons and segmented controls drew their edge with `--color-border-default` (1.3:1), so the control boundary failed 1.4.11.", "Control edges use `--color-border-strong`; hairlines between content stay `--color-border-default` (decorative)."),
    ("assets/ui.css", "Raw colours in the video player and design preview (`rgb(0 0 0 / 0.8)`, `rgb(0 0 0 / 0.7)`, white overlays) and components reading `--palette-*` primitives directly.", "Fixed `--color-preview-*` and `--color-bg-scrim*` semantic tokens; components read only semantic tokens."),
    ("assets/ui.css", "Raw loop timings (2s pulse, 1.4s shimmer, 1.2s cursor) and easings (`linear`, `ease-in-out`).", "`--duration-pulse` (2s) for every loop, `--duration-spin` for the spinner, `--ease-linear` / `--ease-standard`. Reduced motion sets loops to 0s."),
    ("assets/ui.css", "Off-grid nudges: 0.15rem icon offsets, 3px strip gaps, 0.2rem radio offset, 3.1rem stage indent, 0.6rem bar margin.", "Snapped to `--space-0-5`, `--space-0-5`, `--space-0-5`, `--space-12`, `--space-2-5`."),
    ("assets/ui.css", "Two extra breakpoints (40rem for dialogs and toasts, 39.99rem in mock chrome) and `max-width: 61.99rem` queries.", "Dialogs and toasts switch at `--layout-breakpoint-sm` (36rem); all queries are min-width (mobile first)."),
    ("assets/ui.css", "36px (`2.25rem`) heights on side-project links, small tabs, large segmented options and state links sat between control heights; state links were 36px on phones.", "Mapped to `--control-height-sm` / `-md` on desktop and `--target-comfortable` (44px) below lg."),
    ("dialogs/*/busy, pages/new-direction/submitting, pages/settings/submitting, pages/sign-in/loading, pages/new-direction/rate-limited", "Busy and blocked submit buttons set `disabled`, so focus is lost from the button the person just pressed.", "Loading is `aria-busy=\"true\"` + `aria-disabled=\"true\"`; the button keeps focus."),
    ("notifications/live-toast/danger", "A `role=\"alert\"` toast sits inside the `role=\"status\"` region, so screen readers announce it twice.", "Error toasts go in a separate `role=\"alert\"` region; the polite region holds the rest."),
    ("pages/designs/default, pages/new-direction/default, pages/design-system/default", "Segmented width and type pickers are links with `role=\"radio\"`; arrow keys do nothing and activation navigates.", "Segmented controls that navigate are links with `aria-current`; ones that choose are buttons with `aria-pressed` or real radios."),
    ("pages/dashboard/*", "Compact empty-state titles restyled inline with `style=\"font: var(--text-h3)\"` (59 mocks).", "`.empty--tight` sets the compact title size."),
    ("pages/settings/*, dialogs/add-user/*, dialogs/worker-token/*", "Fieldsets reset inline with `style=\"border:0; margin:0; padding:0\"`; dialog bodies set `gap: var(--space-5)` inline.", "`.fieldset` and `.stack--md` classes."),
    ("assets/ui.css", "`.dialog__footer` was not sticky in the bottom sheet, so long forms pushed the actions off screen on phones.", "Footer is sticky below sm, with safe-area padding."),
    # --- found while writing the component, pattern and foundation pages
    ("pages/project-pipeline/*", "Stage-detail tabs (Log, Runs, Artifacts, Decisions) are links with `role=\"tab\"` and `aria-selected` but no tabpanel, no `aria-controls`, no arrow keys, and they navigate.", "Real APG tabs (`<button role=\"tab\">`, tabpanels, automatic activation); project section links stay links with `aria-current=\"page\"`."),
    ("pages/project-pipeline/*, dialogs/raise-budget/*", "Increment steps mark the current step only with `.steps__label--now` and each step's state only by bar colour.", "`aria-current=\"step\"` on the current step and a visually hidden state word on every step."),
    ("all shell mocks", "The top-bar menu trigger is a link to `dialogs/mobile-nav`; the drawer's Close is a link that reloads the dashboard, so focus never returns.", "A `<button aria-haspopup=\"dialog\" aria-expanded aria-controls>`; Close is a button that returns focus to it."),
    ("dialogs/*", "The skip link sits outside the `inert` page and targets `#main` inside it.", "The skip link is inert with the page while a modal is open."),
    ("pages/{dashboard,projects,workers,settings,audit}/*", "Page-header descriptions are `.truncate`d and cut mid-sentence at 360px.", "Descriptions wrap; `.page-header > div:first-child { min-width: 0 }`."),
    ("pages/*/viewer, pages/settings/*", "Avatar initials are wrong or inconsistent: ama-osei shows QB; settings derives QU, AM, DE from the first two letters.", "Initials come from the signed-in person's name parts: QB, AO, DP."),
    ("sidebar in all shell mocks, notifications/live-toast/stacked", "42 buttons carry `style=\"width:100%; margin-top…\"`, 32 clusters override `gap` inline, a caption sets `text-align:right` inline.", "`.btn--block .mt-3`, `.cluster--sm`, `.cluster--end`."),
    ("pages/dashboard/*", "`.pstrip__seg--pend` has no rule; the strip's `aria-label` reads all 11 stage names; spend bars end on S while today is Monday; tile Open links do not name their tile and tiles repeat their h2 in `aria-label`.", "Pending is the unmodified segment; label grouped by status; bars end on today with each day's amount in the label; hidden tile name in Open links and `aria-labelledby` on tiles."),
    ("pages/dashboard/stopped, notifications/system-banner/warning", "The same workers-stopped condition is a danger strip in one and a warning strip in the other; a paused run stage is recoloured inline.", "Warning strip; `.run__stage--paused`."),
    ("notifications/connection-banner/warning, danger", "The top bar still says \"Connection: Live\" under a reconnecting or lost strip.", "The top bar label follows the connection state."),
    ("notifications/live-toast/*", "Every toast close button is labelled just \"Dismiss\".", "\"Dismiss: <toast title>\"."),
    ("pages/projects/*", "Row actions are `<span role=\"button\">` with the reason in a `title`; 54 `title` attributes stand in for tooltips across projects, designs and new-direction; filter counts read \"Running2\"; figures lose their label on phones.", "One menu per row; `.tooltip` with `aria-describedby`; hidden separator before counts; hidden prefixes (Spend, Heartbeat)."),
    ("pages/projects/viewer-empty, pages/projects/no-results vs archived", "\"7 projects\" above \"No projects yet\"; one mock says there are no archived projects while another lists Saltmarsh Survey.", "No count on an empty list; the two mocks use one data set."),
    ("pages/projects/*, pages/workers/*, pages/settings/*", "Times are written \"4s ago\", \"18m ago\" and \"08:02 AM\" while the rest of the product says \"12 s ago\", \"14 min ago\" and 24-hour time.", "\"4 s ago\", \"18 min ago\", \"2 h ago\"; 24-hour clock everywhere (foundations/content)."),
    ("pages/project-pipeline/budget-reached, dialogs/raise-budget/*", "\"Raise budget and resume\" vs \"Raise and resume\"; the callout has an inline budget input and its button opens a dialog asking again; the increment card links to `#`.", "\"Raise and resume\"; only the dialog asks; the card links to the increment."),
    ("pages/project-pipeline/*, pages/projects/default", "Spend `role=\"meter\"` has no `aria-valuetext` (read as \"184.2\"); completion bars use `role=\"meter\"`.", "`aria-valuetext=\"$184.20 of $400.00\"`; completion is `role=\"progressbar\"`."),
    ("pages/new-direction/*", "The error replaces the hint; the character count is a static hint; the repository placeholder and hint are swapped; the feature Product hint is not linked by `aria-describedby`.", "Hint stays under the error (`aria-describedby` = error, hint); live `.field__counter`; format in placeholder, behaviour in hint; hint linked."),
    ("pages/settings/*", "Theme radios are disabled while another section saves; radios have no `value`; the invalid summary omits the range; the threshold input is sized inline; `.secret` puts `aria-label` on a plain span.", "Radios stay enabled and carry values; summary matches the field error; `.input--narrow`; dots `aria-hidden` plus hidden \"Secret set, hidden\"."),
    ("all money fields", "The `$` prefix is `aria-hidden`, so no currency is announced.", "Hidden \"in US dollars\" in the label."),
    ("pages/decisions/*, pages/audit/*, pages/traceability/*", "Filter selects use `.input--sm`; the search label is reset with `style=\"display:block\"`.", "`.select--sm`; `.prefix--search` with `aria-label`."),
    ("pages/backlog/*, pages/workers/*, pages/project-pipeline/*, pages/increment/*", "Row and card title links are restyled inline (`color: inherit; text-decoration: none`, 11 increment cards) and lose their hover; the deferred list reuses `.file` with an inline grid; `.lg-row-end` is used but never defined.", "`.row__title`, `.card__title`, `.list--divided`; `.lg-row-end` defined."),
    ("GitHub and Magic Patterns links", "External links have no cue.", "`.link-external` plus hidden \"(opens in a new tab)\"."),
    ("pages/artifacts/default", "`.file__open` is hidden below sm, so phones cannot open a file.", "The path itself is the link."),
    ("pages/audit/*, dialogs/worker-token/success", "`.table-wrap` and `.pre` scroll but cannot be focused.", "`tabindex=\"0\" role=\"region\"` with a name."),
    ("pages/increment/*, pages/dashboard/*", "Timeline and event times are plain spans; the video-failed title and amounts are styled inline.", "`<time datetime>`; `.video__title` and an amount class."),
    ("dialogs/delete-project/failed", "The typed project name is cleared but Try again stays enabled, skipping the type-to-confirm check.", "Keep the typed name."),
    ("all callouts, pages/sign-in/expired", "Callout content sits in an unclassed div; title-less bodies reset margin inline.", "`.callout__body-wrap`."),
    ("pages/audit/forbidden, pages/new-direction/forbidden", "One uses plain `.empty`, the other a hand-built stack with inline styles.", "`.empty--forbidden` for both."),
    ("dialogs/mobile-nav (overlays.py)", "Description says the drawer is used below 1024 px.", "The switch is 992px (`--layout-breakpoint-lg`)."),
    ("tokens, assets/components.css", "Buttons, inputs and selects were 32 and 40 px at every width, under the 44 px touch target L2-046 AC4 asks for below 992 px.", "Below lg `--control-height-sm` and `-md` are 44 px and a tab is at least 44 px wide; from lg they stay 32 and 40 px (ADR 0034)."),
]


# ---------------------------------------------------------------- shell
def nav(prefix: str) -> str:
    def group(title, items, folder):
        lis = "".join(f'<li><a href="{prefix}{folder}/{slug}.html">{escape(name)}</a></li>' for slug, name, *_ in items)
        return f"<details open><summary>{title}</summary><ul>{lis}</ul></details>"
    return (f'<nav class="ds-nav" aria-label="Design system"><div class="ds-nav__brand"><a href="{prefix}index.html">Hewn DS</a>'
            '<button class="ds-theme-toggle" type="button" aria-pressed="false">☾ Dark</button></div>'
            + group("Foundations", FOUNDATIONS, "foundations") + group("Components", COMPONENTS, "components")
            + group("Patterns", PATTERNS, "patterns") + "</nav>")


def shell(depth: int, title: str, desc: str, header: str, body: str) -> str:
    pre = "../" * depth
    mocks = f"{pre}../mocks/index.html"
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{escape(title)} — {DS}</title>
<meta name="description" content="{escape(desc, quote=True)}">
<link rel="stylesheet" href="{pre}tokens/tokens.css">
<link rel="stylesheet" href="{pre}assets/components.css">
<link rel="stylesheet" href="{pre}assets/ds.css">
</head>
<body id="top">
<a class="skip-link" href="#main">Skip to content</a>
<div class="ds-shell">
  {nav("../" if depth else "")}
  <main id="main" class="ds-main">
    {header}
    {body}
    <footer class="ds-footer"><span>{DS} · extracted from <a href="{mocks}">docs/mocks</a> on {EXTRACTED}</span><a href="#top">Back to top</a></footer>
  </main>
</div>
<script src="{pre}assets/ds.js"></script>
</body>
</html>
"""


def header(kicker: str, h1: str, lead: str, pills: list[str], toc: list[tuple[str, str]]) -> str:
    pill_html = "".join(pills)
    toc_html = "".join(f'<li><a href="#{sid}">{escape(t)}</a></li>' for sid, t in toc)
    return (f'<header class="ds-header"><p class="ds-kicker">{escape(kicker)}</p><h1>{escape(h1)}</h1>'
            f'<p class="ds-lead">{lead}</p><div class="ds-meta">{pill_html}</div><ul class="ds-toc">{toc_html}</ul></header>')


def pill(text: str, ok: bool = False) -> str:
    return f'<span class="ds-pill{" ds-pill--ok" if ok else ""}">{text}</span>'


# ---------------------------------------------------------------- renderers
def a11y_body(a) -> str:
    from common import keys, pairs
    if isinstance(a, NA):
        return a
    return (f"<h3>Role and pattern</h3>{a['pattern']}<h3>Keyboard</h3>{keys(a['keys'])}"
            f"<h3>Focus</h3>{a['focus']}<h3>Labelling</h3>{a['labelling']}"
            f"<h3>Contrast</h3>{pairs(a['pairs'])}<h3>Motion</h3>{a['motion']}<h3>Touch</h3>{a['touch']}")


def render_component(slug, title, group, spec) -> str:
    from common import anatomy, class_table, dodont, pre, token_table, mock
    s = dict(spec)
    body = {
        "overview": s["overview"],
        "anatomy": s["anatomy"] if isinstance(s["anatomy"], (str, NA)) else anatomy(*s["anatomy"]),
        "variants": s["variants"], "sizes": s["sizes"], "states": s["states"], "responsive": s["responsive"],
        "theming": s["theming"], "accessibility": a11y_body(s["a11y"]), "content": s["content"],
        "do-dont": s["dodont"] if isinstance(s["dodont"], (str, NA)) else dodont(s["dodont"]),
        "tokens": s["tokens"] if isinstance(s["tokens"], (str, NA)) else token_table(s["tokens"]),
        "code": s["code"] if isinstance(s["code"], (str, NA)) else pre(s["code"]["snippet"]) + class_table(s["code"]["classes"]),
        "sources": s["sources"] if isinstance(s["sources"], (str, NA)) else (
            "<p>Extracted from these mocks:</p><ul>" + "".join(f"<li>{mock(p, n)}</li>" for p, n in s["sources"]["mocks"])
            + f"</ul><p>Drift fixed during extraction: {s['sources']['drift']}</p>"),
    }
    sections = "".join(section(sid, t, body[sid]) for sid, t in COMPONENT_SECTIONS)
    pills = [pill("WCAG 2.2 AA", True), pill(f"Status: {s.get('status', 'stable')}")] + [pill(x) for x in s.get("pills", [])]
    toc = [(sid, t.replace(" behaviour", "")) for sid, t in COMPONENT_SECTIONS]
    return shell(1, title, s.get("desc", s["lead"]), header(f"Component · {group}", title, s["lead"], pills, toc), sections)


def render_pattern(slug, title, spec) -> str:
    sections = "".join(section(sid, t, spec[sid]) for sid, t in PATTERN_SECTIONS)
    toc = [(sid, t.replace(" behaviour", "")) for sid, t in PATTERN_SECTIONS]
    return shell(1, title, spec.get("desc", spec["lead"]), header("Pattern", title, spec["lead"], [pill("WCAG 2.2 AA", True)], toc), sections)


def render_foundation(slug, title, spec) -> str:
    secs = spec["sections"]  # [(id, title, html)]
    sections = "".join(section(sid, t, html) for sid, t, html in secs)
    toc = [(sid, t) for sid, t, _ in secs]
    return shell(1, title, spec.get("desc", spec["lead"]), header("Foundation", title, spec["lead"], [pill("WCAG 2.2 AA", True)], toc), sections)


def load_specs(module_names):
    specs = {}
    for name in sorted(set(module_names)):
        try:
            mod = importlib.import_module(name)
        except ModuleNotFoundError as e:
            if e.name == name:
                print(f"  (module {name} not written yet)")
                continue
            raise
        specs.update(getattr(mod, "SPECS", {}))
    return specs


def write(rel: str, text: str):
    out = ROOT / rel
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text, encoding="utf-8")


def render_index(present_c, present_f, present_p) -> str:
    def cards(items, folder, present):
        return '<div class="ds-cards">' + "".join(
            f'<a class="ds-card" href="{folder}/{slug}.html"><b>{escape(name)}</b><span>{escape(desc)}</span></a>'
            for slug, name, *rest in items if slug in present for desc in [rest[-1]]) + "</div>"
    start = [("foundations/color", "Color", "Roles, ramps and contrast in both themes."), ("foundations/typography", "Typography", "Inter and JetBrains Mono on a 12–48px scale."),
             ("foundations/layout", "Layout", "Breakpoints, grid, sidebar and page templates."), ("components/button", "Button", "Seven variants, three sizes, every state."),
             ("components/form-field", "Form field", "Label, control, hint and error."), ("components/dialog", "Dialog", "Confirmations and forms; sheets on phones.")]
    start_html = '<div class="ds-cards">' + "".join(f'<a class="ds-card" href="{h}.html"><b>{n}</b><span>{d}</span></a>' for h, n, d in start) + "</div>"
    body = f"""
<section class="ds-section" id="start"><h2><a href="#start">Start here</a></h2>{start_html}</section>
<section class="ds-section" id="foundations"><h2><a href="#foundations">Foundations</a></h2>
<p>The decisions everything else is made of: {len(FOUNDATIONS)} pages, every token listed once.</p>{cards(FOUNDATIONS, "foundations", present_f)}</section>
<section class="ds-section" id="components"><h2><a href="#components">Components</a></h2>
<p>{len(COMPONENTS)} components, each with anatomy, variants, sizes, the full state matrix in both themes, responsive rules, accessibility, content rules, do and don't, tokens and code.</p>{cards(COMPONENTS, "components", present_c)}</section>
<section class="ds-section" id="patterns"><h2><a href="#patterns">Patterns</a></h2>
<p>How components combine for a job, with the rules that span them.</p>{cards(PATTERNS, "patterns", present_p)}</section>
<section class="ds-section" id="how"><h2><a href="#how">How to use</a></h2>
<ol>
<li>Link the two stylesheets, tokens first: <code>&lt;link rel="stylesheet" href="tokens/tokens.css"&gt;</code> then <code>assets/components.css</code>.</li>
<li>Write the markup shown on each component page; the class names and ARIA attributes are the API. Do not restyle a component in page CSS: override its component tokens (<code>--btn-bg</code>, <code>--field-border</code>, …) instead.</li>
<li>Theme with <code>data-theme="light|dark"</code> on <code>&lt;html&gt;</code>; with no attribute the OS preference wins.</li>
<li>Generate platform constants (Angular, Sass, native) from <a href="tokens/tokens.json">tokens/tokens.json</a> (W3C DTCG format; dark values under <code>$extensions</code>).</li>
<li>Every new colour pairing goes into <a href="tokens/contrast-pairs.json">tokens/contrast-pairs.json</a> and must pass <code>check_contrast.py</code>.</li>
</ol>
<p>Press <kbd>t</kbd> or use the toggle in the sidebar to switch theme; token values and contrast ratios on every page update live.</p>
</section>
<section class="ds-section" id="provenance"><h2><a href="#provenance">Provenance</a></h2>
<p>Extracted on {EXTRACTED} from the <a href="../mocks/index.html">Mission Control mocks</a> (29 screens, 154 states), which reproduce the Magic Patterns prototype. The pages are generated by <code>_build/build.py</code>; corrections made during extraction are listed in the README's drift log.</p>
</section>"""
    hdr = header("Hewn · Mission Control", "Hewn design system",
                 "The visual and interaction language of Hewn Mission Control, written down once: tokens, foundations, components and patterns, in light and dark, at WCAG 2.2 AA. Designers find every decision here; engineers copy the classes and tokens straight into the Angular app.",
                 [pill("WCAG 2.2 AA", True), pill(f"{len(COMPONENTS)} components"), pill("Light + dark")],
                 [("start", "Start here"), ("foundations", "Foundations"), ("components", "Components"), ("patterns", "Patterns"), ("how", "How to use"), ("provenance", "Provenance")])
    return shell(0, "Overview", "Hewn design system: tokens, foundations, components and patterns.", hdr, body)


def md(s: str) -> str:
    return s.replace("|", "\\|")


def render_readme(specs, verification: str) -> str:
    lines = [f"# Hewn design system", "",
             f"Extracted from [docs/mocks](../mocks/README.md) on {EXTRACTED}. Open [index.html](index.html) locally (no server or network needed).", "",
             "The pages are generated: edit `_build/*.py`, then run `python3 docs/design-system/_build/build.py` and the checks under [Verification](#verification).", "",
             "## Foundations", "", "| Page | Covers |", "|---|---|"]
    lines += [f"| [{n}](foundations/{s}.html) | {md(d)} |" for s, n, d in FOUNDATIONS]
    lines += ["", "## Components", "", "| Component | Variants | States | Source mocks |", "|---|---|---|---|"]
    for slug, name, group, _, desc in COMPONENTS:
        sp = specs.get(slug, {})
        srcs = sp.get("sources", {})
        mocks = ", ".join(f"[{p}](../mocks/{p}.html)" for p, _ in (srcs.get("mocks", [])[:3] if isinstance(srcs, dict) else []))
        lines.append(f"| [{name}](components/{slug}.html) | {md(sp.get('readme_variants', desc))} | {md(sp.get('readme_states', ''))} | {mocks} |")
    lines += ["", "## Patterns", "", "| Pattern | Covers |", "|---|---|"]
    lines += [f"| [{n}](patterns/{s}.html) | {md(d)} |" for s, n, d in PATTERNS]
    lines += ["", "## Tokens", "",
              "- [`tokens/tokens.css`](tokens/tokens.css): source of truth (generated from `_build/tokens.py`): primitives, semantic tokens, light and dark themes, reduced motion, more contrast, forced colours.",
              "- [`tokens/tokens.json`](tokens/tokens.json): W3C DTCG export for code generation; dark values under `$extensions`.",
              "- [`tokens/contrast-pairs.json`](tokens/contrast-pairs.json): every foreground/background pairing the components rely on, checked in both themes.",
              "- [`assets/components.css`](assets/components.css): the product stylesheet; `assets/ds.css` and `assets/ds.js` are documentation chrome only.", "",
              "## Drift found in the mocks", "", "| Mock | Issue | Resolution |", "|---|---|---|"]
    lines += [f"| {md(m)} | {md(i)} | {md(r)} |" for m, i, r in DRIFT]
    lines += ["", "## Verification", "", verification, ""]
    return "\n".join(lines)


VERIFICATION = (HERE / "verification.md")


def main():
    write_tokens.write(ROOT)
    specs = load_specs([m for *_, m, _ in COMPONENTS])
    present_c = set()
    for slug, title, group, module, _ in COMPONENTS:
        if slug in specs:
            write(f"components/{slug}.html", render_component(slug, title, group, specs[slug]))
            present_c.add(slug)
    fspecs = load_specs(["foundations_spec"])
    present_f = set()
    for slug, title, _ in FOUNDATIONS:
        if slug in fspecs:
            write(f"foundations/{slug}.html", render_foundation(slug, title, fspecs[slug]))
            present_f.add(slug)
    pspecs = load_specs(["patterns_spec"])
    present_p = set()
    for slug, title, _ in PATTERNS:
        if slug in pspecs:
            write(f"patterns/{slug}.html", render_pattern(slug, title, pspecs[slug]))
            present_p.add(slug)
    write("index.html", render_index(present_c, present_f, present_p))
    verification = VERIFICATION.read_text(encoding="utf-8") if VERIFICATION.exists() else "Not yet verified."
    write("README.md", render_readme(specs, verification))
    missing = [s for s, *_ in COMPONENTS if s not in present_c] + [s for s, *_ in FOUNDATIONS if s not in present_f] + [s for s, *_ in PATTERNS if s not in present_p]
    print(f"wrote {len(present_c)} components, {len(present_f)} foundations, {len(present_p)} patterns" + (f"; missing: {', '.join(missing)}" if missing else ""))


if __name__ == "__main__":
    main()
