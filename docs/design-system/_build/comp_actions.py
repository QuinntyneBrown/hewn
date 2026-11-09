"""Component specs: Actions (button is the reference spec every other module imitates)."""
from common import (NA, anatomy, btn, code, dodont, ex, icon, icon_btn, kbd, matrix, mock, page, status, themes, ul)

SPECS = {}

# ============================================================== button (REFERENCE)
_V = [("Primary", "primary", "Start direction"), ("Secondary", "", "Pause"), ("Ghost", "ghost", "View all"),
      ("Outline accent", "outline-accent", "Resume"), ("Danger", "danger", "Stop all workers"), ("Link", "link", "Retry"),
      ("Stone", "stone", "Sign in with GitHub")]


def _state_row(label, variant, text):
    v = f" btn--{variant}" if variant else ""
    b = lambda extra="": f'<button class="btn{v}" type="button"{extra}>{text}</button>'
    busy = f'<button class="btn{v}" type="button" aria-busy="true" aria-disabled="true">{icon("loader")}{text}…</button>'
    return (label, [b(), b(' data-state="hover"'), b(' data-state="focus"'), b(' data-state="active"'), b(" disabled"), busy])


_STATE_NOTES = ul(["<b>Busy</b> sets <code>aria-busy=\"true\"</code> and <code>aria-disabled=\"true\"</code> (not <code>disabled</code>, so focus stays on the button), spins the leading icon and changes the verb to its progressive form: <i>Delete project</i> → <i>Deleting…</i>. Further clicks are ignored.",
     "<b>Disabled</b> uses the native attribute: not focusable, 50% opacity. Prefer leaving the button enabled and explaining on activation when the reason is not obvious; for Viewers, hide owner-only actions rather than disabling them."])
_PRESSED = ('<button class="btn btn--sm" type="button" aria-pressed="true">Follow log</button><button class="btn btn--sm" type="button" aria-pressed="false">Follow log</button><button class="btn" type="button" aria-expanded="true" aria-haspopup="menu">More ' + icon("chevron-right") + "</button>")
_ICONS_EX = btn("New direction", "primary", ic="plus") + btn("Open PR", ic="external", icon_after=True) + icon_btn("refresh", "Refresh workers", "") + icon_btn("menu", "Open navigation") + '<button class="btn btn--block" type="button" style="max-width: 16rem;">Block (full width)</button>'

SPECS["button"] = {
    "lead": "Buttons start, stop, approve and confirm work. One primary button per view says what the view is for.",
    "readme_variants": "primary, secondary, ghost, outline accent, danger, link, stone; icon, icon-only, block, touch",
    "readme_states": "default, hover, focus, active, disabled, busy, pressed, expanded",
    "pills": ["Native <code>&lt;button&gt;</code>"],
    "overview": f"""<p>Use a button when activating it changes something: it starts a direction, pauses or stops workers, raises a budget, deletes a project or opens a dialog. Use a {page('components/link')} when it only goes somewhere. Use a {page('components/menu')} when one trigger offers several actions, and a {page('components/button-group')} for a small set of mutually exclusive options.</p>
{ul(["<b>Primary</b>: the one action the view exists for (<i>Start direction</i>, <i>Save changes</i>). Never two per view.",
     "<b>Secondary</b> (no modifier): every other action that still matters (<i>Pause</i>, <i>Cancel</i>).",
     "<b>Ghost</b>: inside dense surfaces such as tile headers, rows and toolbars (<i>View all</i>, <i>Remove</i>).",
     "<b>Outline accent</b>: a positive action that should stand out without being the primary (<i>Resume</i> on a paused project).",
     "<b>Danger</b>: destructive actions, and only inside a confirmation dialog or after one (<i>Delete project</i>, <i>Stop all workers</i>).",
     "<b>Link</b>: a low-emphasis action inside text or a callout (<i>Retry</i>, <i>Show details</i>).",
     "<b>Stone</b>: the inverse, high-contrast button used once, on sign-in."])}""",
    "anatomy": (f'<button class="btn btn--primary btn--lg" type="button">{icon("plus")}New direction</button>',
                [(33, 22), (58, 22), (80, 74)],
                [("Leading icon (optional)", "16px (14px in small buttons), inherits the label colour, <code>aria-hidden</code>."),
                 ("Label", "A verb phrase in sentence case; it is the accessible name."),
                 ("Container", "Height <code>--control-height-*</code>, <code>--radius-md</code>, 1px inset ring, padding <code>--space-3/4/6</code>.")]),
    "variants": f"""<p>Variants change emphasis, not meaning. Pick by how much attention the action deserves on this view.</p>
{ex("".join(btn(t, v) for _, v, t in _V), "From highest to lowest emphasis; danger is reserved for destructive confirmations, stone for sign-in.")}
<h3>With icons, icon-only and block</h3>
{ex(_ICONS_EX,
    "Icon-only buttons carry <code>aria-label</code> and a " + page("components/tooltip", "tooltip") + "; the SVG is <code>aria-hidden</code>.")}""",
    "sizes": f"""<p>Medium is the default. Small lives in rows, tile headers, callouts and toolbars; large is for sign-in and empty-state calls to action.</p>
{ex(btn("Small · 32px", "primary", "sm") + btn("Medium · 40px", "primary") + btn("Large · 48px", "primary", "lg"), "Heights <code>--control-height-sm/md/lg</code>; padding <code>--space-3/4/6</code>; label <code>--font-size-xs/sm/md</code>.")}
<p><code>.btn--touch</code> on an icon-only button grows it to 44px (<code>--target-comfortable</code>) below lg, where it is the main target on a phone (the top bar's menu button).</p>""",
    "states": f"""<p>Every variant has the same six states. Pointer and focus states are forced here with <code>data-state</code>; real pages get them from <code>:hover</code>, <code>:focus-visible</code>, <code>:active</code>, <code>:disabled</code> and <code>aria-busy</code>.</p>
{matrix(["Default", "Hover", "Focus", "Active", "Disabled", "Busy"], [_state_row(l, v, t.split()[0]) for l, v, t in _V])}
<h3>Pressed and expanded</h3>
{ex(_PRESSED, "Toggle buttons use <code>aria-pressed</code>; menu buttons use <code>aria-expanded</code>. Both take the accent tint when on.")}
{themes("".join(btn(t, v) for _, v, t in _V[:5]))}
{_STATE_NOTES}""",
    "responsive": ul([
        "Below <code>--layout-breakpoint-sm</code> (576px) the page header stacks and its primary action sits under the title; on sign-in the stone button is full width (<code>.auth__btn</code>).",
        "In dialog footers buttons stack full width below sm with the primary on top (<code>column-reverse</code>), and sit in a row, primary last, from sm up.",
        "Icon-only buttons in the top bar and rows use <code>.btn--touch</code> or <code>.icon-action</code>, which are 44px below lg and 32–40px from lg.",
        "Labels never truncate or wrap; a label that wraps at 360px is too long. Shorten the verb phrase."]),
    "theming": f"""<p>The button reads semantic tokens through component tokens that each variant overrides: <code>--btn-bg</code>, <code>--btn-fg</code>, <code>--btn-ring</code>, <code>--btn-bg-hover</code>, <code>--btn-bg-active</code>, <code>--btn-height</code>, <code>--btn-pad</code>, <code>--btn-radius</code>. A theme changes semantic tokens; a re-skin overrides component tokens; neither edits the component CSS.</p>
<pre><code>/* A taller, rounder primary for a marketing surface, without touching .btn */
.promo .btn--primary {{ --btn-height: var(--control-height-lg); --btn-radius: var(--radius-full); }}</code></pre>
<p>In dark the accent lightens to <code>--palette-blue-400</code> and its label flips to near-black <code>--palette-blue-950</code>; the danger button becomes a deep red tint with a light red label and a red ring, so it reads as raised without glowing.</p>""",
    "a11y": {
        "pattern": "<p>Native <code>&lt;button type=\"button\"&gt;</code>, or <code>type=\"submit\"</code> in a form. A button that only navigates is an <code>&lt;a href&gt;</code> with the same classes. No ARIA role is needed; see the <a href=\"https://www.w3.org/WAI/ARIA/apg/patterns/button/\">APG button pattern</a> for toggle (<code>aria-pressed</code>) and menu (<code>aria-expanded</code>) buttons.</p>",
        "keys": [(kbd("Tab") + " / " + kbd("Shift", "Tab"), "Moves focus to and from the button in DOM order."),
                 (kbd("Enter") + ", " + kbd("Space"), "Activates. Space fires on key up, so moving away cancels a mis-press."),
                 (kbd("Esc"), "No effect on the button; inside a dialog it closes the dialog.")],
        "focus": "<p>The shared ring (2px <code>--color-focus-ring</code>, 2px offset) appears on <code>:focus-visible</code> only. The offset gap shows the surface behind, so the ring stays ≥ 3:1 against both the primary fill and the page. A busy button keeps focus.</p>",
        "labelling": "<p>The visible label is the name. Icon-only buttons set <code>aria-label</code> with the verb and object (<i>Refresh workers</i>, <i>Open navigation</i>) and show a tooltip. Busy buttons keep their name; the progressive label (<i>Deleting…</i>) is read when focus is on them, and the outcome is announced by a toast or the dialog closing.</p>",
        "pairs": [("Label on primary", "--color-fg-on-accent", "--color-accent", 4.5), ("Label on primary, hover", "--color-fg-on-accent", "--color-accent-hover", 4.5),
                  ("Label on danger", "--color-fg-on-danger", "--color-danger-solid", 4.5), ("Secondary edge on surface", "--color-border-strong", "--color-bg-surface", 3),
                  ("Secondary label on raised", "--color-fg-default", "--color-bg-surface-raised", 4.5), ("Ghost label", "--color-fg-muted", "--color-bg-surface", 4.5),
                  ("Stone label", "--color-fg-inverse", "--color-bg-inverse", 4.5), ("Focus ring on surface", "--color-focus-ring", "--color-bg-surface", 3)],
        "motion": "<p>Background and colour transition over <code>--duration-fast</code>; active scales to 98%. Under reduced motion the durations are zeroed in the tokens and the busy spinner stops (the icon and the progressive label still say it is working).</p>",
        "touch": "<p>Medium (40px) and large (48px) clear the 24px minimum; small (32px) is used only inside rows and headers with ≥ 8px between targets. Icon buttons that are a phone's main target grow to 44px.</p>",
    },
    "content": ul(["Verb first, sentence case: <i>Start direction</i>, <i>Raise budget</i>, <i>Stop all workers</i>, <i>Copy token</i>. Never <i>OK</i>, <i>Yes</i>, <i>Submit</i>.",
                   "Name the object when the context does not: <i>Delete project</i> in the dialog, <i>Remove</i> in a user row.",
                   "Destructive labels say what is lost: <i>Revoke wk-4e18</i>, not <i>Confirm</i>.",
                   "Busy labels use the progressive form with an ellipsis character: <i>Saving…</i>, <i>Stopping workers…</i>.",
                   "Keep to three words; numbers in labels are tabular: <i>Raise to $500</i>."]),
    "dodont": [
        (btn("Cancel") + btn("Start direction", "primary"), "One primary action, placed last, with the safe action beside it.",
         btn("Save", "primary") + btn("Save and start", "primary"), "Two primary buttons compete. Make one secondary or move it into a menu."),
        (icon_btn("refresh", "Refresh workers", ""), "Icon-only buttons have an <code>aria-label</code> and a tooltip.",
         btn("Delete project", "danger"), "A danger button on a page with no confirmation (Settings had one). Open the delete-project dialog instead and put the danger button there."),
    ],
    "tokens": [("Primary background", "--color-accent"), ("Primary background, hover", "--color-accent-hover"), ("Primary background, active", "--color-accent-active"),
               ("Primary label", "--color-fg-on-accent"), ("Secondary background / edge", "--color-bg-surface-raised / --color-border-strong"),
               ("Secondary and ghost hover", "--color-bg-subtle-hover / --color-bg-subtle"), ("Danger background / label / ring", "--color-danger-solid / --color-fg-on-danger / --color-danger-border"),
               ("Stone background / label", "--color-bg-inverse / --color-fg-inverse"), ("Focus ring", "--color-focus-ring"),
               ("Height sm / md / lg / touch", "--control-height-sm / --control-height-md / --control-height-lg / --target-comfortable"),
               ("Padding sm / md / lg", "--space-3 / --space-4 / --space-6"), ("Radius", "--radius-md"), ("Label", "--text-label"),
               ("Transition", "--duration-fast / --ease-standard")],
    "code": {"snippet": """<button class="btn btn--primary" type="button">
  <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">…</svg>New direction
</button>
<button class="btn btn--danger" type="button" aria-busy="true" aria-disabled="true">
  <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">…loader…</svg>Deleting…
</button>
<button class="btn btn--icon btn--ghost btn--touch" type="button" aria-label="Open navigation">…</button>""",
             "classes": [("<code>.btn</code>", "Base: secondary look, medium size."),
                         ("<code>.btn--primary</code> <code>--ghost</code> <code>--outline-accent</code> <code>--danger</code> <code>--link</code> <code>--stone</code>", "Variant."),
                         ("<code>.btn--sm</code> <code>.btn--lg</code>", "Size; omit for medium."),
                         ("<code>.btn--icon</code>", "Square icon-only button; requires <code>aria-label</code>."),
                         ("<code>.btn--touch</code>", "With <code>--icon</code>: 44px below lg."),
                         ("<code>.btn--block</code>", "Full width."),
                         ("<code>disabled</code>", "Native disabled; not focusable."),
                         ("<code>aria-busy=\"true\"</code> + <code>aria-disabled=\"true\"</code>", "Busy: spinning leading icon, clicks ignored, focus kept."),
                         ("<code>aria-pressed</code> / <code>aria-expanded</code>", "Toggle / menu button on-state (accent tint)."),
                         ("<code>data-state=\"hover|focus|active\"</code>", "Documentation only: forces a state in static pages.")]},
    "sources": {"mocks": [("pages/dashboard/default", "tile header ghost buttons"), ("pages/new-direction/default", "primary submit"),
                          ("dialogs/delete-project/busy", "danger busy"), ("pages/sign-in/default", "stone button"),
                          ("pages/project-pipeline/paused", "outline accent Resume"), ("notifications/system-banner/warning", "link button in a strip")],
                "drift": "secondary edges moved from <code>--color-border-default</code> (1.3:1) to <code>--color-border-strong</code>; busy buttons no longer use <code>disabled</code>; <code>.btn--lg</code> and active/pressed styles added (the mocks had none)."},
}


# ============================================================== shared helpers for the specs below
from common import table  # noqa: E402
from comp_inputs import _box, _themes, _uid  # noqa: E402

# ============================================================== button group
_WIDTHS = [("XS", "375 px"), ("S", "576 px"), ("M", "768 px"), ("L", "992 px"), ("XL", "1200 px")]
_SEG_WIDTH = ('<div class="segmented" role="group" aria-label="Preview width">'
              + "".join(f'<button class="segmented__opt" type="button" aria-pressed="{"true" if k == "L" else "false"}" title="{t}">{k}</button>' for k, t in _WIDTHS) + "</div>")
_SEG_THEME = ('<div class="segmented" role="group" aria-label="Preview theme">'
              f'<button class="segmented__opt" type="button" aria-pressed="true" aria-label="Light">{icon("sun", "icon--sm")}</button>'
              f'<button class="segmented__opt" type="button" aria-pressed="false" aria-label="Dark">{icon("moon", "icon--sm")}</button></div>')
_SEG_NAV = ('<div class="segmented segmented--lg" role="group" aria-label="Direction type">'
            '<a class="segmented__opt" href="#variants" aria-current="page">New product</a><a class="segmented__opt" href="#variants">Feature for a product</a></div>')
_TOOLBAR = ('<div class="toolbar" role="toolbar" aria-label="Design preview">'
            '<button class="btn btn--icon btn--ghost btn--sm" type="button" aria-label="Reload preview">' + icon("refresh", "icon--sm") + "</button>"
            '<button class="btn btn--icon btn--ghost btn--sm" type="button" aria-label="Full screen" tabindex="-1">' + icon("maximize", "icon--sm") + "</button>"
            '<button class="btn btn--icon btn--ghost btn--sm" type="button" aria-label="Open in Magic Patterns" tabindex="-1">' + icon("external", "icon--sm") + "</button></div>")


def _seg_cells(kind):
    def wrap(opt, lab):
        return f'<div style="min-width: 7rem;"><div class="segmented" role="group" aria-label="{lab}">{opt}</div></div>'
    out = []
    for col, extra in [("default", ""), ("hover", ' data-state="hover"'), ("focus", ' data-state="focus"'), ("active", ' data-state="active"'), ("selected", None), ("disabled", " disabled")]:
        lab = f"{kind} option, {col}"
        if kind == "Link":
            if col == "selected":
                out.append(wrap('<a class="segmented__opt" href="#states" aria-current="page">New product</a>', lab))
            elif col == "disabled":
                out.append('<span class="text-caption">Not applicable: a link that cannot be followed is plain text.</span>')
            else:
                out.append(wrap(f'<a class="segmented__opt" href="#states"{extra}>New product</a>', lab))
        else:
            inner = icon("moon", "icon--sm") if kind == "Icon" else "L"
            name = ' aria-label="Dark"' if kind == "Icon" else ' title="992 px"'
            pressed = "true" if col == "selected" else "false"
            ex_attr = "" if extra is None else extra
            out.append(wrap(f'<button class="segmented__opt" type="button" aria-pressed="{pressed}"{name}{ex_attr}>{inner}</button>', lab))
    return out


_SEG_MATRIX = matrix(["Default", "Hover", "Focus", "Active", "Selected", "Disabled"],
                     [("Button (chooses)", _seg_cells("Button")), ("Icon button", _seg_cells("Icon")), ("Link (navigates)", _seg_cells("Link"))])

SPECS["button-group"] = {
    "lead": "Button groups put a few related options in one control: a segmented choice of view, a pair of sibling pages, or a toolbar of tools.",
    "readme_variants": "segmented single-select (buttons), icon-only, navigating (links), toolbar",
    "readme_states": "default, hover, focus, active, selected (pressed / current), disabled",
    "pills": ["<code>role=\"group\"</code> / <code>role=\"toolbar\"</code>"],
    "overview": f"""<p>A segmented control switches between two to five mutually exclusive views of the same thing, in place: the width and theme of a design preview. The mocks also use it to switch between the two New direction forms, which are separate pages. Each job uses a different element:</p>
{ul(["<b>Chooses a view in place</b>: <code>&lt;button aria-pressed&gt;</code> options in a <code>role=&quot;group&quot;</code> with a label. Pressing one sets it to <code>true</code> and the others to <code>false</code>.",
     "<b>Goes to a sibling page</b>: <code>&lt;a href&gt;</code> options with <code>aria-current=&quot;page&quot;</code> on the current one (New product / Feature for a product).",
     "<b>Sets a form value that is submitted</b>: not a segmented control; use a " + page("components/radio-group", "radio group") + " (real radios, arrow keys) instead.",
     "<b>Toolbar</b> (<code>.toolbar</code>, <code>role=&quot;toolbar&quot;</code>): a row of independent tools for one surface, with one tab stop and arrow keys between tools."])}
<p>Never give links <code>role="radio"</code>: the mocks did, so arrow keys did nothing and activating an option navigated away from a control that claimed to be a radio group. With more than five options or long labels, use {page('components/tabs')} for views or a {page('components/select')} for values.</p>""",
    "anatomy": (_SEG_WIDTH.replace('class="segmented"', 'class="segmented segmented--lg"'),
                [(6, 4), (12, 70), (60, 18), (93, 70)],
                [("Container", "<code>.segmented</code>: <code>--color-bg-surface</code>, 1px inset <code>--color-border-strong</code>, <code>--radius-md</code>, padding <code>--space-0-5</code> (<code>--space-1</code> large)."),
                 ("Option", "<code>.segmented__opt</code>: 32px (40px large), <code>--radius-sm</code>, <code>--text-caption</code> medium in <code>--color-fg-muted</code>."),
                 ("Selected option", "Raised: <code>--color-bg-surface-raised</code>, its own <code>--color-border-strong</code> ring, <code>--color-fg-default</code>, medium weight."),
                 ("Group label", "<code>aria-label</code> on the group (<i>Preview width</i>); not visible, so the context must make the meaning obvious.")]),
    "variants": f"""{ex(_SEG_WIDTH + _SEG_THEME, "Choosing in place: preview width (text options with the pixel width as a tooltip) and preview theme (icon-only, named with <code>aria-label</code>).")}
{ex(_SEG_NAV, "Navigating: the two New direction forms are separate pages, so the options are links and the current one has <code>aria-current=&quot;page&quot;</code>.")}
{ex(_TOOLBAR, "Toolbar: the design preview's tools. One tab stop; arrow keys move between tools (roving <code>tabindex</code>).")}""",
    "sizes": f"""{ex(_SEG_WIDTH + _SEG_WIDTH.replace('class="segmented"', 'class="segmented segmented--lg"').replace('aria-label="Preview width"', 'aria-label="Preview width, large"'),
    "Medium: 32px options, <code>--text-caption</code>, for toolbars and preview headers. Large (<code>.segmented--lg</code>): 40px options, <code>--text-body-sm</code>, padding <code>--space-4</code>, for a page-level switch such as the direction type.")}""",
    "states": f"""<p>Pointer and focus states are forced with <code>data-state</code>; selected uses the real attribute (<code>aria-pressed</code> or <code>aria-current</code>).</p>
{_SEG_MATRIX}
{_themes(_SEG_WIDTH + _SEG_THEME + _SEG_NAV + _TOOLBAR, stack=False)}
{ul(["<b>Selected</b> is shown by a raised fill, a ring and a heavier weight together, so it does not depend on colour.",
     "<b>Active</b> has no separate style; the option becomes selected on release.",
     "<b>Disabled</b> options keep their place at 50% opacity, so the set does not reflow; say why in a tooltip or nearby text."])}""",
    "responsive": ul([
        "Options never wrap or truncate. At 360px the five width options (about 10rem) and the large direction-type pair (about 19rem) fit inside the 16px margins.",
        "Below sm, a group that would not fit becomes a " + page("components/select", "select") + " with the same label; the designs preview hides its width group below md, where the preview is already the phone width.",
        "Medium options are 32px tall at every breakpoint (above the 24px minimum, with no gap between options inside one control); large options are 40px.",
        "Toolbars sit in the header of the surface they act on and wrap to their own line below sm."]),
    "theming": "<p>No component tokens yet: the group reads <code>--color-bg-surface</code>, <code>--color-border-strong</code>, <code>--color-bg-subtle</code> (hover), <code>--color-bg-surface-raised</code> (selected) and <code>--color-fg-muted</code> / <code>--color-fg-default</code>. In dark, the selected option is the lighter raised surface on the darker group, so selection still reads as lifted.</p>",
    "a11y": {
        "pattern": "<p>Choosing groups are toggle buttons (<a href=\"https://www.w3.org/WAI/ARIA/apg/patterns/button/\">APG button pattern</a>, <code>aria-pressed</code>) in a labelled <code>role=\"group\"</code>; navigating groups are links with <code>aria-current</code>. Toolbars follow the <a href=\"https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/\">APG toolbar pattern</a>. If a choice must behave as one radio group (arrow keys move the selection), use real radios.</p>",
        "keys": [(kbd("Tab") + " / " + kbd("Shift", "Tab"), "Segmented: moves to each option in turn. Toolbar: moves into the toolbar (to the last-focused tool) and out."),
                 (kbd("Space") + " / " + kbd("Enter"), "Presses the focused option (buttons) or follows it (links, Enter only)."),
                 (kbd("←") + " " + kbd("→"), "Toolbar only: moves focus to the previous / next tool."),
                 (kbd("Home") + " / " + kbd("End"), "Toolbar only: first / last tool.")],
        "focus": "<p>The shared 2px ring with 2px offset on the focused option; it is drawn outside the group's edge so it is visible against both the group and the page. Pressing an option keeps focus on it.</p>",
        "labelling": "<p>The group has an <code>aria-label</code> naming the setting (<i>Preview width</i>); each option has a visible label or an <code>aria-label</code> (<i>Light</i>, <i>Dark</i>). A <code>title</code> (<i>992 px</i>) adds a tooltip but is not the name. Announced as <i>Preview width, group, L, toggle button, pressed</i>.</p>",
        "pairs": [("Group edge on surface", "--color-border-strong", "--color-bg-surface", 3), ("Selected ring on raised", "--color-border-strong", "--color-bg-surface-raised", 3),
                  ("Option label", "--color-fg-muted", "--color-bg-surface", 4.5), ("Option label, hover", "--color-fg-default", "--color-bg-subtle", 4.5),
                  ("Selected label", "--color-fg-default", "--color-bg-surface-raised", 4.5), ("Focus ring", "--color-focus-ring", "--color-bg-surface", 3)],
        "motion": "<p>Background and colour change over <code>--duration-fast</code>; the selected fill does not slide between options. Reduced motion zeroes the transition.</p>",
        "touch": "<p>Options are at least 32px tall and as wide as their label plus <code>--space-2</code> each side (never under 32px). The whole option is the target; no hover-only information except the width tooltip, which repeats nothing essential.</p>",
    },
    "content": ul(["Option labels are one or two words, parallel and in sentence case: <i>New product</i> / <i>Feature for a product</i>.",
                   "Abbreviations are fine when the set makes them obvious (<i>XS</i>–<i>XL</i>); put the full value in the tooltip.",
                   "Icon-only options need an unambiguous icon and an <code>aria-label</code>; use them only for well-known pairs such as light and dark.",
                   "The group label names the setting, not the action: <i>Preview width</i>, not <i>Change width</i>."]),
    "dodont": [
        (_SEG_WIDTH, "Choosing a preview width: buttons with <code>aria-pressed</code>.",
         '<div class="segmented" role="radiogroup" aria-label="Width">' + "".join(f'<a class="segmented__opt" role="radio" href="#do-dont" aria-checked="{"true" if k == "L" else "false"}">{k}</a>' for k, _ in _WIDTHS) + "</div>",
         "Designs and Design system used links with <code>role=\"radio\"</code>: no arrow keys, and activation navigated."),
        (_SEG_NAV, "Two sibling pages: links, with <code>aria-current</code> on the current one.",
         '<div class="segmented segmented--lg" role="radiogroup" aria-label="Direction type"><a class="segmented__opt" role="radio" href="#do-dont" aria-checked="true">New product</a><a class="segmented__opt" role="radio" href="#do-dont" aria-checked="false">Feature for a product</a></div>',
         "New direction announced a radio group, then loaded another page when an option was chosen."),
    ],
    "tokens": [("Container background / edge", "--color-bg-surface / --color-border-strong"), ("Option label / hover label", "--color-fg-muted / --color-fg-default"),
               ("Option hover", "--color-bg-subtle"), ("Selected background / ring", "--color-bg-surface-raised / --color-border-strong"),
               ("Option height md / lg", "--control-height-sm / --control-height-md"), ("Container padding md / lg", "--space-0-5 / --space-1"),
               ("Option padding md / lg", "--space-2 / --space-4"), ("Radius container / option", "--radius-md / --radius-sm"),
               ("Label md / lg", "--text-caption / --text-body-sm"), ("Toolbar edge / gap", "--color-border-default / --space-1"), ("Transition", "--duration-fast / --ease-standard")],
    "code": {"snippet": """<!-- chooses a view in place -->
<div class="segmented" role="group" aria-label="Preview width">
  <button class="segmented__opt" type="button" aria-pressed="false" title="375 px">XS</button>
  <button class="segmented__opt" type="button" aria-pressed="true" title="992 px">L</button>
</div>
<!-- goes to a sibling page -->
<div class="segmented segmented--lg" role="group" aria-label="Direction type">
  <a class="segmented__opt" href="/directions/new" aria-current="page">New product</a>
  <a class="segmented__opt" href="/directions/new/feature">Feature for a product</a>
</div>
<div class="toolbar" role="toolbar" aria-label="Design preview">…buttons, one with tabindex="0", the rest "-1"…</div>""",
             "classes": [("<code>.segmented</code>", "Group container."),
                         ("<code>.segmented--lg</code>", "40px options, body-sm labels."),
                         ("<code>.segmented__opt</code>", "Option; a <code>&lt;button&gt;</code> or <code>&lt;a&gt;</code>."),
                         ("<code>aria-pressed=\"true\"</code> / <code>aria-current=\"page\"</code>", "Selected option (button / link)."),
                         ("<code>disabled</code> / <code>aria-disabled=\"true\"</code>", "Disabled option."),
                         ("<code>.toolbar</code> + <code>role=\"toolbar\"</code>", "Toolbar container with roving tabindex."),
                         ("<code>data-state=\"hover|focus|active\"</code>", "Documentation only.")]},
    "sources": {"mocks": [("pages/designs/default", "width and theme groups"), ("pages/design-system/default", "width and theme groups"),
                          ("pages/new-direction/default", "direction type, large"), ("pages/new-direction/feature", "direction type, second option current")],
                "drift": "segmented controls were links with <code>role=\"radio\"</code> in Designs, Design system and New direction; choosing groups are now buttons with <code>aria-pressed</code> and navigating groups links with <code>aria-current</code>. The toolbar class existed in the kit but no mock used it."},
}

# ============================================================== link
_NEW_TAB = '<span class="visually-hidden"> (opens in a new tab)</span>'
_LINK_INLINE = ('<p class="text-sm max-measure">Hewn’s GitHub App can’t write to northwind/handover. '
                f'<a class="link-external" href="#variants">Install the app on that repository{_NEW_TAB}</a>, or leave this empty to create one.</p>')
_LINK_QUIET = ('<a class="quiet-link mono" href="#variants">' + icon("git-commit", "icon--sm") + '<span class="visually-hidden">Commit </span>a41c9e2</a>'
               '<a class="quiet-link mono" href="#variants">' + icon("git-pr", "icon--sm") + '<span class="visually-hidden">Pull request </span>#14</a>'
               '<a class="quiet-link" href="#variants">' + icon("github", "icon--sm") + 'hewn-builds/ledgerline</a>')
_LINK_ROW = '<div><a class="row__title" href="#variants">Parcel Post</a><span class="row__sub">Shared mailroom log for coworking spaces</span></div>'
_LINK_EXT = (f'<a class="link-external" href="#variants">View pull request #27 on GitHub{_NEW_TAB}</a>'
             f'<a class="link-external" href="#variants">Open in Magic Patterns{_NEW_TAB}</a>')


def _link_cells(cls, text):
    c = f' class="{cls}"' if cls else ""
    def a(extra):
        return f'<a{c} href="#states"{extra}>{text}</a>'
    return [a(""), a(' data-state="hover"'), a(' data-state="focus"'), a(' data-state="active"'), a("")]


_LINK_MATRIX = matrix(["Default", "Hover", "Focus", "Active", "Visited"],
                      [("Inline", _link_cells("", "Install the app")), ("Quiet", _link_cells("quiet-link", "hewn-builds/ledgerline")),
                       ("Quiet mono", _link_cells("quiet-link mono", icon("git-commit", "icon--sm") + '<span class="visually-hidden">Commit </span>a41c9e2')),
                       ("External", _link_cells("link-external", "Open in Magic Patterns" + _NEW_TAB))])

SPECS["link"] = {
    "lead": "Links take people somewhere: another page in Mission Control, a pull request or commit on GitHub, a design in Magic Patterns.",
    "readme_variants": "inline, quiet, quiet mono, external, row title",
    "readme_states": "default, hover, focus, active, visited",
    "pills": ["Native <code>&lt;a href&gt;</code>"],
    "overview": f"""<p>Use a link when activating it only navigates. If it changes something (retry a stage, raise a budget, open a dialog that acts) it is a {page('components/button')}, even when it looks like text (<code>.btn--link</code>). Links that look like buttons (<code>a.btn</code>) are fine for navigation calls to action such as <i>New direction</i>.</p>
{ul(["<b>Inline</b> (plain <code>&lt;a&gt;</code>): inside a sentence; <code>--color-fg-link</code>, always underlined.",
     "<b>Quiet</b> (<code>.quiet-link</code>): secondary references in dense rows and logs; subtle until hovered, then underlined.",
     "<b>Quiet mono</b> (<code>.quiet-link.mono</code>): commit SHAs and PR numbers, with a leading icon.",
     "<b>External</b> (<code>.link-external</code>): leaves Mission Control (GitHub, Magic Patterns). Adds ↗ and opens in a new tab, so the live dashboard keeps streaming.",
     "<b>Row title</b> (<code>.row__title</code>): the name that opens a row's object; see " + page("components/row-list", "row list") + "."])}""",
    "anatomy": (_box('<p class="text-sm">Hewn’s GitHub App can’t write to northwind/handover. <a class="link-external" href="#anatomy">Install the app on that repository' + _NEW_TAB + "</a>.</p>", "26rem"),
                [(28, 62), (54, 84), (93, 50)],
                [("Link text", "<code>--color-fg-link</code>; says where it goes."),
                 ("Underline", "<code>--border-width-hairline</code> thick, offset 0.15em; always on for inline links."),
                 ("External mark", "<code>.link-external::after</code> adds ↗; a visually hidden <i>(opens in a new tab)</i> says the same to screen readers.")]),
    "variants": f"""{ex(_LINK_INLINE, "Inline, in an error message from New direction.")}
{ex(_LINK_QUIET, "Quiet mono for a commit and a pull request (Decisions, Backlog), quiet for a repository. The visually hidden prefix makes <i>a41c9e2</i> read as <i>Commit a41c9e2</i>.")}
{ex(_LINK_EXT, "External: the ↗ and the hidden text tell people they are leaving Mission Control.")}
{ex(_LINK_ROW, "Row title: medium weight in the default text colour, accent and underlined on hover.")}""",
    "sizes": NA("Links take the size of the text they sit in; they have no sizes of their own. Standalone links in rows follow the row's type role."),
    "states": f"""{_LINK_MATRIX}
{_themes(_LINK_INLINE + '<div class="cluster mt-4">' + _LINK_QUIET + "</div>" + '<div class="cluster mt-4">' + _LINK_EXT + "</div>", stack=True)}
{ul(["<b>Visited</b> is deliberately the same as default: almost every link in Mission Control leads to a live page that changes, so “already seen” is not useful and would add a second link colour.",
     "<b>Active</b> has no separate style; navigation starts on release.",
     "<b>Current</b> (<code>aria-current=&quot;page&quot;</code>) is styled by the navigation components that use it: " + page("components/sidebar-nav", "sidebar") + ", " + page("components/tabs", "tabs") + ", " + page("components/breadcrumb", "breadcrumb") + ".",
     "There is no disabled link. If the destination is unavailable, render the text without <code>href</code> and say why."])}""",
    "responsive": ul([
        "Inline links wrap with their sentence at every breakpoint; long URLs and repository paths break with <code>overflow-wrap: anywhere</code> inside their container rather than widening the page.",
        "Quiet mono links never wrap (SHAs and PR numbers are short); in rows below lg they move under the title with the rest of the row's metadata.",
        "Standalone links in rows need a 24px target: quiet links in the Decisions list are only as tall as their caption text, so a <code>min-height: --target-min</code> is logged for components.css.",
        "On phones, external links still open a new tab; the browser's back button returns to the dashboard."]),
    "theming": "<p>Links read <code>--color-fg-link</code> and <code>--color-fg-link-hover</code>; quiet links read <code>--color-fg-subtle</code> and <code>--color-fg-default</code>. In dark the link colour is the light accent (<code>--palette-blue-400</code> via the semantic token), which keeps 4.5:1 on every surface. Underlines use <code>currentColor</code>, so they re-theme automatically and survive forced colours.</p>",
    "a11y": {
        "pattern": "<p>Native <code>&lt;a href&gt;</code>, per the <a href=\"https://www.w3.org/WAI/ARIA/apg/patterns/link/\">APG link pattern</a>. Never a <code>&lt;span&gt;</code> or <code>&lt;button&gt;</code> with a click handler for navigation, and never <code>href=\"#\"</code> for an action.</p>",
        "keys": [(kbd("Tab") + " / " + kbd("Shift", "Tab"), "Moves to and from the link."),
                 (kbd("Enter"), "Follows the link. Space scrolls the page; it does not activate links."),
                 (kbd("Ctrl", "Enter") + " / " + kbd("⌘", "Enter"), "Opens in a new tab (browser behaviour; never blocked).")],
        "focus": "<p>The shared ring (2px <code>--color-focus-ring</code>, 2px offset), drawn around the text box of the link. Inline links that wrap show the ring on each line fragment.</p>",
        "labelling": "<p>The link text is the name and must make sense alone (2.4.4): <i>View pull request #27 on GitHub</i>, not <i>here</i>. Short references get a visually hidden prefix (<i>Commit</i>, <i>Pull request</i>). Icon-only links (<code>.file__open</code>) carry an <code>aria-label</code> that names the target: <i>Open docs/brief.md on GitHub at e8812fa</i>. External links include <i>(opens in a new tab)</i> in their name.</p>",
        "pairs": [("Link on canvas", "--color-fg-link", "--color-bg-canvas", 4.5), ("Link on surface", "--color-fg-link", "--color-bg-surface", 4.5),
                  ("Link in dialogs", "--color-fg-link", "--color-bg-surface-raised", 4.5), ("Link, hover", "--color-fg-link-hover", "--color-bg-surface", 4.5),
                  ("Quiet link", "--color-fg-subtle", "--color-bg-surface", 4.5), ("Row title", "--color-fg-default", "--color-bg-surface", 4.5),
                  ("Focus ring", "--color-focus-ring", "--color-bg-canvas", 3)],
        "motion": "<p>No transitions; colour and underline change instantly on hover.</p>",
        "touch": "<p>Inline links in sentences are exempt from the 24px target rule; standalone links (rows, decision links, toolbars) are at least 24px tall with 8px between them. Nothing about a link is hover-only: the underline is always present on inline links.</p>",
    },
    "content": ul(["Link text names the destination: <i>Open log</i>, <i>View all</i>, <i>Install the app on that repository</i>.",
                   "Never <i>click here</i>, <i>here</i>, <i>more</i> or a bare URL.",
                   "External links name the place they go: <i>… on GitHub</i>, <i>Open in Magic Patterns</i>.",
                   "Identifiers keep their exact form in monospace: <i>a41c9e2</i>, <i>#14</i>, <i>hewn-builds/ledgerline</i>."]),
    "dodont": [
        ('<div class="stack stack--sm">' + _LINK_ROW + "</div>", "Row titles use <code>.row__title</code>, which has a hover and focus treatment.",
         '<div><a class="truncate" style="color: inherit; text-decoration: none;" href="#do-dont">Match a receipt by photo</a></div>',
         "Backlog, Workers and Runs restyled links inline (<code>color: inherit; text-decoration: none</code>): nothing marks them as links and hover does nothing."),
        (_LINK_EXT.split("</a>")[0] + "</a>", "External links show ↗ and say they open a new tab.",
         '<a class="quiet-link mono" href="#do-dont">' + icon("git-pr", "icon--sm") + " #14</a>",
         "Backlog's PR links leave Mission Control for GitHub with no cue, and read only as <i>#14</i>."),
        (btn("Add to allow list", "primary", ic="plus"), "An action is a <code>&lt;button type=\"submit\"&gt;</code>.",
         '<a class="btn btn--primary" href="#do-dont">' + icon("plus") + "Add to allow list</a>",
         "The dialog mocks used links for Add to allow list and Raise and resume, because static mocks can only navigate. Keyboard users expect Space to work on a button."),
    ],
    "tokens": [("Link", "--color-fg-link"), ("Link, hover", "--color-fg-link-hover"), ("Quiet link / hover", "--color-fg-subtle / --color-fg-default"),
               ("Underline thickness", "--border-width-hairline"), ("Quiet link icon gap", "--space-1-5"), ("Quiet mono type", "--text-code"),
               ("Row title type / colour", "--text-body / --color-fg-default"), ("Focus ring", "--color-focus-ring")],
    "code": {"snippet": """<a href="/projects/ledgerline/pipeline">Open pipeline</a>
<a class="quiet-link mono" href="https://github.com/hewn-builds/ledgerline/commit/a41c9e2">
  <svg class="icon icon--sm" aria-hidden="true">…</svg><span class="visually-hidden">Commit </span>a41c9e2
</a>
<a class="link-external" href="https://github.com/hewn-builds/ledgerline/pull/27" target="_blank" rel="noopener">
  View pull request #27 on GitHub<span class="visually-hidden"> (opens in a new tab)</span>
</a>""",
             "classes": [("<code>a</code>", "Inline link: link colour, hairline underline."),
                         ("<code>.quiet-link</code>", "Subtle until hover; inline-flex with an icon."),
                         ("<code>.quiet-link.mono</code>", "Monospace identifiers."),
                         ("<code>.link-external</code>", "Appends ↗; pair with <code>target=\"_blank\" rel=\"noopener\"</code> and hidden text."),
                         ("<code>.row__title</code>", "Row name link."),
                         ("<code>data-state=\"hover|focus\"</code>", "Documentation only.")]},
    "sources": {"mocks": [("pages/new-direction/repo-no-access", "error text that should carry an install link"), ("pages/decisions/default", "quiet mono commit links"),
                          ("pages/backlog/default", "PR links and inline-styled row links"), ("pages/workers/default", "inline-styled project links"),
                          ("pages/project-pipeline/runs", "inline-styled run links"), ("pages/artifacts/default", "icon-only GitHub links with full names")],
                "drift": "row links were restyled inline in Backlog (22), Workers (20) and Runs (18) mocks; external GitHub and Magic Patterns links had no ↗ or new-tab text (<code>.link-external</code> existed but was unused); quiet links had no minimum target height."},
}

# ============================================================== menu
_MI = lambda ic, text, extra="", cls="menu__item": f'<li role="none"><button class="{cls}" type="button" role="menuitem" tabindex="-1"{extra}>{icon(ic, "icon--sm")}{text}</button></li>'


def _menu(mid, label, items, open_=True, trig_cls="btn btn--sm"):
    trig = (f'<button class="{trig_cls}" type="button" id="{mid}-btn" aria-haspopup="menu" aria-expanded="{"true" if open_ else "false"}" aria-controls="{mid}">'
            f'{label}{icon("chevron-right", "icon--sm")}</button>')
    menu = f'<ul class="menu menu--static" role="menu" id="{mid}" aria-labelledby="{mid}-btn"{"" if open_ else " hidden"}>{items}</ul>'
    return f'<div class="menu-anchor">{trig}{menu}</div>'


_HARBOR_ITEMS = ('<li role="none"><a class="menu__item" role="menuitem" tabindex="-1" href="#variants">' + icon("route", "icon--sm") + "Open pipeline</a></li>"
                 + _MI("archive", "Archive") + '<li role="separator" class="menu__sep"></li>'
                 + _MI("trash", "Delete Harbor CRM…", cls="menu__item menu__item--danger"))
_LEDGER_ITEMS = ('<li role="none"><a class="menu__item" role="menuitem" tabindex="-1" href="#variants">' + icon("route", "icon--sm") + "Open pipeline</a></li>"
                 + _MI("pause", "Pause direction") + _MI("wallet", "Raise budget…") + '<li role="separator" class="menu__sep"></li>'
                 + _MI("archive", "Archive", ' aria-disabled="true" aria-describedby="mn-why"')
                 + _MI("trash", "Delete Ledgerline…", ' aria-disabled="true" aria-describedby="mn-why"', "menu__item menu__item--danger")
                 + '<li role="none" class="menu__label" id="mn-why">Cancel the running direction to archive or delete.</li>')
_LOG_ITEMS = ('<li role="none" class="menu__label">Log</li>'
              '<li role="none"><button class="menu__item" type="button" role="menuitemcheckbox" aria-checked="true" tabindex="-1">Follow new lines</button></li>'
              '<li role="none"><button class="menu__item" type="button" role="menuitemcheckbox" aria-checked="true" tabindex="-1">Show timestamps</button></li>'
              '<li role="none"><button class="menu__item" type="button" role="menuitemcheckbox" aria-checked="false" tabindex="-1">Wrap long lines</button></li>'
              '<li role="separator" class="menu__sep"></li>'
              '<li role="none"><button class="menu__item" type="button" role="menuitem" tabindex="-1">' + icon("arrow-down", "icon--sm") + 'Jump to latest<span class="menu__shortcut">End</span></button></li>'
              '<li role="none"><button class="menu__item" type="button" role="menuitem" tabindex="-1">' + icon("copy", "icon--sm") + "Copy visible lines</button></li>")
_MENU_HARBOR = _menu("mn-harbor", 'Actions<span class="visually-hidden"> for Harbor CRM</span>', _HARBOR_ITEMS)
_MENU_LEDGER = _menu("mn-ledger", 'Actions<span class="visually-hidden"> for Ledgerline</span>', _LEDGER_ITEMS)
_MENU_LOG = _menu("mn-log", "View", _LOG_ITEMS)


def _mi_cells(kind):
    def wrap(item, lab):
        return f'<ul class="menu menu--static" role="menu" aria-label="{lab}" style="min-width: 11rem;">{item}</ul>'
    out = []
    for col, extra in [("default", ""), ("hover", ' data-state="hover"'), ("focus", ' data-state="focus"'), ("disabled", ' aria-disabled="true"')]:
        lab = f"{kind}, {col}"
        if kind == "Danger item":
            out.append(wrap(_MI("trash", "Delete Harbor CRM…", extra, "menu__item menu__item--danger"), lab))
        elif kind == "Checkable item":
            out.append(wrap(f'<li role="none"><button class="menu__item" type="button" role="menuitemcheckbox" aria-checked="true" tabindex="-1"{extra}>Show timestamps</button></li>', lab))
        else:
            out.append(wrap(_MI("archive", "Archive", extra), lab))
    return out


_MENU_MATRIX = matrix(["Default", "Hover", "Focus", "Disabled"],
                      [("Item", _mi_cells("Item")), ("Danger item", _mi_cells("Danger item")), ("Checkable item, checked", _mi_cells("Checkable item"))])
_TRIGGERS = (_menu("mn-t1", 'Actions<span class="visually-hidden"> for Tidewater</span>', "", open_=False)
             + '<button class="btn btn--sm" type="button" aria-haspopup="menu" aria-expanded="true">Actions<span class="visually-hidden"> for Kiln Booking</span>' + icon("chevron-right", "icon--sm") + "</button>")

SPECS["menu"] = {
    "lead": "A menu button opens a short list of actions for one object, such as everything you can do to a project from its row.",
    "readme_variants": "with icons, with sections, danger item, checkable items, with shortcuts, disabled items with a reason",
    "readme_states": "trigger closed, open; item default, hover, focus, disabled, checked",
    "pills": ["APG menu button", "Core set: not yet in the mocks"],
    "overview": f"""<p>Use a menu when one object has three or more actions that do not all deserve a visible button, or when a row is too narrow for them on a phone. Menus hold actions (and view toggles), never navigation between pages: for that use the {page('components/sidebar-nav', 'sidebar')} or {page('components/tabs')}. One or two actions stay visible as buttons; destructive actions in a menu open a confirmation {page('components/dialog')}.</p>
<p>The mocks have not used a menu yet. The clearest place for it is the Projects list: each row carries two icon-only actions (Archive, Delete) that are disabled while a direction runs and explain themselves only in a <code>title</code>. One <i>Actions</i> menu per row would hold Open pipeline, Pause, Raise budget, Archive and Delete, with the reason shown inside the menu. Settings' user rows (Remove) and Workers' rows (Revoke) would follow once they gain a second action.</p>
{ul(["<b>With icons</b>: an <code>icon--sm</code> before each label, in <code>--color-fg-subtle</code>.",
     "<b>With sections</b>: <code>.menu__label</code> headings and <code>.menu__sep</code> separators group related items.",
     "<b>Danger item</b> (<code>.menu__item--danger</code>): last, after a separator, ending in … because a dialog follows.",
     "<b>Checkable items</b>: <code>role=&quot;menuitemcheckbox&quot;</code> with <code>aria-checked</code>; a ✓ marks the checked ones.",
     "<b>Shortcuts</b> (<code>.menu__shortcut</code>): only for keys the page really binds.",
     "<b>Disabled with a reason</b>: <code>aria-disabled</code> items stay focusable and point to a note at the end of the menu."])}""",
    "anatomy": (_MENU_HARBOR.replace("mn-harbor", "mn-anat"),
                [(29, 18), (67, 38), (31, 52), (67, 58), (67, 74)],
                [("Trigger", "A <code>.btn</code> with <code>aria-haspopup=\"menu\"</code> and <code>aria-expanded</code>; its name says whose actions they are."),
                 ("Panel", "<code>.menu</code>: <code>--color-bg-surface-raised</code>, hairline <code>--color-border-default</code>, <code>--shadow-3</code>, <code>--radius-md</code>, min 13rem, padding <code>--space-1</code>, <code>--z-dropdown</code>."),
                 ("Item icon", "<code>icon--sm</code>, <code>--color-fg-subtle</code>, decorative."),
                 ("Separator", "<code>.menu__sep</code>, hairline <code>--color-border-default</code>, <code>role=\"separator\"</code>."),
                 ("Danger item", "<code>--color-danger-strong</code> text, <code>--color-danger-icon</code> icon.")]),
    "variants": f"""{ex(_MENU_HARBOR, "Project row actions for Harbor CRM: a link item, an action, then the destructive item after a separator.")}
{ex(_MENU_LEDGER, "Ledgerline is running, so Archive and Delete are disabled and the menu says why.")}
{ex(_MENU_LOG, "A log view menu: checkable items under a section label, and a shortcut the log really binds.")}""",
    "sizes": NA("Menus have one size. Items are 40px tall below lg and 32px from lg (--control-height-md / -sm); the panel is at least 13rem wide and grows with its longest item."),
    "states": f"""<h3>Trigger</h3>
{ex(_TRIGGERS, "Closed (<code>aria-expanded=&quot;false&quot;</code>, menu <code>hidden</code>) and open (<code>aria-expanded=&quot;true&quot;</code>, accent tint from the button's expanded style).")}
<h3>Items</h3>
{_MENU_MATRIX}
{_themes(_MENU_HARBOR.replace("mn-harbor", "mn-th") + _MENU_LOG.replace("mn-log", "mn-th2"), stack=False)}
{ul(["<b>Hover and focus</b> look the same (<code>--color-bg-subtle-hover</code>); keyboard focus adds a 2px inset <code>--color-focus-ring</code> so it is visible without a pointer.",
     "<b>Disabled</b> items use <code>aria-disabled=&quot;true&quot;</code>, not <code>disabled</code>, so arrow keys still reach them and the reason is read.",
     "<b>Checked</b> items show ✓ in <code>--color-fg-accent</code> at the end; toggling keeps the menu open."])}""",
    "responsive": ul([
        "The panel is anchored to the trigger's end edge and opens below it; near the bottom of the viewport it opens above, and it never extends past the 16px page margin (max width is the viewport minus both margins).",
        "Below lg items are 40px tall, so each is a comfortable phone target; from lg they tighten to 32px.",
        "On phones, row menus replace the separate icon actions, so each row has one 44px trigger instead of two.",
        "The menu scrolls internally if it is taller than the space available; menus over seven items should be split or turned into a page."]),
    "theming": "<p>The panel reads <code>--color-bg-surface-raised</code>, <code>--color-border-default</code> and <code>--shadow-3</code>; items read <code>--color-fg-default</code>, <code>--color-fg-subtle</code> (icons and shortcuts), <code>--color-bg-subtle-hover</code>, <code>--color-danger-strong</code> and <code>--color-fg-accent</code>. In dark the panel is the lightest surface on the page and keeps a hairline edge, because shadows are weak on dark canvases.</p>",
    "a11y": {
        "pattern": "<p><a href=\"https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/\">APG menu button</a>: the trigger has <code>aria-haspopup=\"menu\"</code>, <code>aria-expanded</code> and <code>aria-controls</code>; the panel is <code>role=\"menu\"</code> labelled by the trigger; items are <code>menuitem</code> or <code>menuitemcheckbox</code> with <code>tabindex=\"-1\"</code> (focus is managed by script); list items are <code>role=\"none\"</code>.</p>",
        "keys": [(kbd("Enter") + ", " + kbd("Space") + ", " + kbd("↓") + " on the trigger", "Opens the menu and focuses the first item."),
                 (kbd("↑") + " on the trigger", "Opens the menu and focuses the last item."),
                 (kbd("↓") + " / " + kbd("↑"), "Next / previous item, wrapping; disabled items are included."),
                 (kbd("Home") + " / " + kbd("End"), "First / last item."),
                 ("Type a letter", "Moves to the next item starting with it."),
                 (kbd("Enter") + " / " + kbd("Space") + " on an item", "Activates it and closes the menu (checkable items toggle and stay open)."),
                 (kbd("Esc"), "Closes and returns focus to the trigger."),
                 (kbd("Tab"), "Closes the menu and moves focus to the next control after the trigger.")],
        "focus": "<p>Opening moves focus into the menu; closing returns it to the trigger. When an item opens a dialog (<i>Delete Harbor CRM…</i>), focus moves into the dialog and returns to the trigger when the dialog closes. Clicking outside closes the menu without moving focus.</p>",
        "labelling": "<p>The trigger's name says whose actions they are: <i>Actions for Harbor CRM</i> (visible <i>Actions</i> plus hidden text). The menu is labelled by the trigger. Disabled items reference their reason with <code>aria-describedby</code>. Item labels are verbs, with … when a dialog follows.</p>",
        "pairs": [("Item on panel", "--color-fg-default", "--color-bg-surface-raised", 4.5), ("Item, hover", "--color-fg-default", "--color-bg-subtle-hover", 4.5),
                  ("Icon, shortcut and section label", "--color-fg-subtle", "--color-bg-surface-raised", 4.5), ("Danger item", "--color-danger-strong", "--color-bg-surface-raised", 4.5),
                  ("Check mark", "--color-fg-accent", "--color-bg-surface-raised", 4.5), ("Focus ring on hovered item", "--color-focus-ring", "--color-bg-subtle", 3)],
        "motion": "<p>The panel rises in over <code>--duration-fast</code> with <code>--ease-enter</code> (<code>rise-in</code>); it closes instantly. Reduced motion removes the rise.</p>",
        "touch": "<p>Items are 40px below lg with no gaps, and the whole row is the target. The menu opens on tap, never on hover. Tapping outside or pressing the trigger again closes it.</p>",
    },
    "content": ul(["Items are verb phrases in sentence case: <i>Open pipeline</i>, <i>Pause direction</i>, <i>Raise budget…</i>.",
                   "End with … when the item opens a dialog that asks for more (<i>Delete Harbor CRM…</i>); not for items that act at once.",
                   "Name the object in destructive items so it is clear in the confirmation and the audit log.",
                   "Order: open/view first, routine actions next, destructive last after a separator.",
                   "Disabled items get one sentence saying how to enable them: <i>Cancel the running direction to archive or delete.</i>"]),
    "dodont": [
        (_menu("mn-dd1", 'Actions<span class="visually-hidden"> for Parcel Post</span>', _MI("archive", "Archive", ' aria-disabled="true" aria-describedby="mn-dd1-why"')
               + _MI("trash", "Delete Parcel Post…", ' aria-disabled="true" aria-describedby="mn-dd1-why"', "menu__item menu__item--danger")
               + '<li role="none" class="menu__label" id="mn-dd1-why">Cancel the running direction to archive or delete.</li>'),
         "One labelled trigger per row; disabled items stay reachable and the reason is on screen.",
         '<span class="cluster"><span class="icon-action" role="button" aria-disabled="true" tabindex="0" aria-label="Archive Parcel Post: cancel the running direction first" title="Cancel the running direction first">' + icon("archive", "icon--sm")
         + '</span><span class="icon-action" role="button" aria-disabled="true" tabindex="0" aria-label="Delete Parcel Post: cancel the running direction first" title="Cancel the running direction first">' + icon("trash", "icon--sm") + "</span></span>",
         "Projects showed two disabled icon spans per row whose reason lived in a tooltip that touch users never see."),
        (_menu("mn-dd2", 'Actions<span class="visually-hidden"> for Harbor CRM</span>', _MI("archive", "Archive") + '<li role="separator" class="menu__sep"></li>' + _MI("trash", "Delete Harbor CRM…", cls="menu__item menu__item--danger")),
         "The destructive item is last, set apart and opens the delete-project confirmation.",
         _menu("mn-dd3", 'Actions<span class="visually-hidden"> for Harbor CRM, wrong order</span>', _MI("trash", "Delete", cls="menu__item menu__item--danger") + _MI("archive", "Archive")),
         "Delete first, unnamed and acting immediately is one slip away from losing a project."),
    ],
    "tokens": [("Panel background / edge", "--color-bg-surface-raised / --color-border-default"), ("Panel shadow", "--shadow-3"), ("Panel radius / padding", "--radius-md / --space-1"),
               ("Item text / icon", "--color-fg-default / --color-fg-subtle"), ("Item hover and focus", "--color-bg-subtle-hover"), ("Item focus ring", "--color-focus-ring"),
               ("Item height below lg / from lg", "--control-height-md / --control-height-sm"), ("Item padding / gap", "--space-3 / --space-3"), ("Item radius", "--radius-sm"),
               ("Danger text / icon", "--color-danger-strong / --color-danger-icon"), ("Disabled text", "--color-fg-disabled"), ("Check mark", "--color-fg-accent"),
               ("Section label / shortcut", "--text-caption / --text-code"), ("Layer", "--z-dropdown"), ("Enter motion", "--duration-fast / --ease-enter")],
    "code": {"snippet": """<div class="menu-anchor">
  <button class="btn btn--sm" type="button" id="harbor-actions" aria-haspopup="menu" aria-expanded="false" aria-controls="harbor-menu">
    Actions<span class="visually-hidden"> for Harbor CRM</span>
  </button>
  <ul class="menu" role="menu" id="harbor-menu" aria-labelledby="harbor-actions" hidden>
    <li role="none"><a class="menu__item" role="menuitem" tabindex="-1" href="/projects/harbor-crm">Open pipeline</a></li>
    <li role="none"><button class="menu__item" type="button" role="menuitem" tabindex="-1">Archive</button></li>
    <li role="separator" class="menu__sep"></li>
    <li role="none"><button class="menu__item menu__item--danger" type="button" role="menuitem" tabindex="-1">Delete Harbor CRM…</button></li>
  </ul>
</div>""",
             "classes": [("<code>.menu-anchor</code>", "Positioning context around trigger and panel."),
                         ("<code>.menu</code> / <code>.menu--static</code>", "Floating panel / in-flow panel for documentation."),
                         ("<code>.menu__item</code>", "Item (<code>&lt;button&gt;</code> or <code>&lt;a&gt;</code>)."),
                         ("<code>.menu__item--danger</code>", "Destructive item."),
                         ("<code>.menu__label</code> / <code>.menu__sep</code>", "Section label / separator."),
                         ("<code>.menu__shortcut</code>", "Right-aligned key hint."),
                         ("<code>aria-checked</code> on <code>menuitemcheckbox</code>", "Shows ✓."),
                         ("<code>aria-disabled=\"true\"</code>", "Disabled but focusable item."),
                         ("<code>data-state=\"hover|focus\"</code>", "Documentation only.")]},
    "sources": {"mocks": [("pages/projects/default", "row Archive and Delete icon actions a menu would replace"), ("pages/projects/filtered", "the same actions on a blocked project"),
                          ("pages/settings/default", "user rows with a single Remove action"), ("pages/workers/default", "worker rows with a single Revoke action"),
                          ("dialogs/delete-project/default", "the confirmation a danger item opens")],
                "drift": "none in the mocks (no menu is used). The kit's menu styles were completed with focus rings, disabled, checkable and danger items, and the Projects row actions (spans with <code>role=\"button\"</code>) are recorded as the first place to adopt it."},
}
