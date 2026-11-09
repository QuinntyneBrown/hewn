"""Foundation pages: color, typography, spacing, layout, elevation, shape, motion,
iconography, theming, responsive, accessibility, content.

Every custom property in tokens/tokens.css appears in a data-token cell on exactly
one of these pages; the tables are generated from tokens.py so they cannot drift.
"""
import json

import tokens as T
from common import (ICONS, NA, ROOT, STATUS, btn, code, ex, icon, icon_btn, kbd, mock, page, pairs, status, table,
                    themes, token_table, ul, value_cell, swatch_cell)

SPECS = {}


# ================================================================ shared helpers
def _px(rem):
    """'0.875rem' -> '14px'."""
    if rem.endswith("rem"):
        v = float(rem[:-3]) * 16
        return (str(int(v)) if v == int(v) else str(v)) + "px"
    return rem


def _val(tok, theme=None):
    return value_cell(tok, theme)


def _plain_table(rows, head=("Token", "Value", "Use")):
    """rows = [(token, note)] for theme-independent tokens; value is resolved live."""
    return table(list(head), [[code(t), _val(t), n] for t, n in rows])


def _themed_table(rows):
    """rows = [(token, note)] for tokens whose value changes per theme (shadows)."""
    return table(["Token", "Light", "Dark", "Use"], [[code(t), _val(t, "light"), _val(t, "dark"), n] for t, n in rows])


def _demo_box(label, style):
    return f'<div style="{style}">{label}</div>'


# ================================================================ COLOR
_PALETTE_ROWS = [(f"--palette-{ramp}-{step}", note) for ramp, steps in T.PALETTE.items() for step, _hex, note in steps]

_C = {t: (light, dark, use) for t, light, dark, use in T.COLOR}
_DERIVED_COLOR = [(n, use) for n, _v, use in T.DERIVED if n.startswith("--color-")]


def _group(pred):
    return [t for t, *_ in T.COLOR if pred(t)]


_PREVIEW = _group(lambda t: t.startswith("--color-preview-") or t.startswith("--color-bg-scrim") or t == "--color-fg-on-scrim")
_STATUS_TOKS = _group(lambda t: t.split("-")[3] in ("info", "success", "warning", "danger") if t.count("-") >= 4 else False)
_BG = _group(lambda t: t.startswith("--color-bg-") and t not in _PREVIEW)
_FG = _group(lambda t: t.startswith("--color-fg-") and t not in _PREVIEW)
_BORDER = _group(lambda t: t.startswith("--color-border-"))
_ACCENT = _group(lambda t: t.startswith(("--color-accent", "--color-focus", "--color-brand")))
_ALL_GROUPED = set(_PREVIEW + _STATUS_TOKS + _BG + _FG + _BORDER + _ACCENT)
assert _ALL_GROUPED == set(_C), sorted(set(_C) - _ALL_GROUPED)

# chip background for foreground roles that only make sense on their own fill
_FG_ON = {"--color-fg-inverse": "--color-bg-inverse", "--color-fg-on-accent": "--color-accent",
          "--color-fg-on-danger": "--color-danger-solid", "--color-fg-on-scrim": "--color-bg-scrim"}


def _swatch(tok, show_value=True):
    if tok.startswith("--color-fg-") or tok in ("--color-brand-body",):
        bg = _FG_ON.get(tok, "--color-bg-surface")
        chip = f'<div class="ds-swatch__chip" style="--swatch: var({bg}); color: var({tok}); font: var(--text-h2);">Aa</div>'
    elif tok.startswith("--color-border-"):
        chip = f'<div class="ds-swatch__chip" style="--swatch: var(--color-bg-surface); box-shadow: inset 0 0 0 var(--border-width-thick) var({tok});"></div>'
    else:
        chip = f'<div class="ds-swatch__chip" style="--swatch: var({tok});"></div>'
    val = f'<span class="ds-swatch__value" data-token="{tok}"></span>' if show_value else ""
    return f'<div class="ds-swatch">{chip}<div class="ds-swatch__body"><span class="ds-swatch__name">{tok}</span>{val}</div></div>'


def _swatches_both(toks):
    grid = lambda: '<div class="ds-swatches">' + "".join(_swatch(t) for t in toks) + "</div>"
    return f'<div class="ds-themes"><div data-theme="light">{grid()}</div><div data-theme="dark">{grid()}</div></div>'


def _ramp(name, steps):
    spans = "".join(f'<span style="--swatch: var(--palette-{name}-{s});" data-step="{s}" title="--palette-{name}-{s}"></span>' for s, _h, _n in steps)
    return f'<h3>{name.capitalize()}</h3><div class="ds-ramp" role="img" aria-label="{name} ramp, {len(steps)} steps">{spans}</div>'


def _palette_table(rows):
    body = [[code(t), f'<span class="ds-swatch-cell"><i data-token="{t}" data-swatch></i><span data-token="{t}"></span></span>', n] for t, n in rows]
    return table(["Token", "Value", "Where it ends up"], body)


def _role_rows(toks):
    return [(_C[t][2] if t in _C else dict(_DERIVED_COLOR)[t], t) for t in toks]


def _load_pairs():
    path = ROOT / "tokens" / "contrast-pairs.json"
    try:
        return json.loads(path.read_text(encoding="utf-8"))["pairs"]
    except (OSError, ValueError, KeyError):
        return T.PAIRS


_PAIRS = _load_pairs()


def _cap(s):
    return s[:1].upper() + s[1:]


def _restricted_pairs(items):
    rows = []
    for p in items:
        cells = []
        for th in ("light", "dark"):
            if th in p["themes"]:
                cells.append(f'<span class="ds-pair" data-theme="{th}"><span>Aa</span><span class="ds-pair__ratio" data-contrast="{p["fg"]}|{p["bg"]}" data-min="{p["min"]}"></span></span>')
            else:
                cells.append(f"Not used in {th}")
        rows.append(f'<tr><td>{_cap(p["note"])}</td><td>{code(p["fg"])} on {code(p["bg"])}</td><td>{cells[0]}</td><td>{cells[1]}</td><td>{p["min"]}:1</td></tr>')
    return ('<div class="ds-table-wrap"><table class="ds-table"><thead><tr><th scope="col">Pair</th><th scope="col">Tokens</th>'
            '<th scope="col">Light</th><th scope="col">Dark</th><th scope="col">Minimum</th></tr></thead><tbody>' + "".join(rows) + "</tbody></table></div>")


_TEXT_PAIRS = [(_cap(p["note"]), p["fg"], p["bg"], p["min"]) for p in _PAIRS if "themes" not in p and p["min"] >= 4.5]
_UI_PAIRS = [(_cap(p["note"]), p["fg"], p["bg"], p["min"]) for p in _PAIRS if "themes" not in p and p["min"] < 4.5]
_ONE_THEME_PAIRS = [p for p in _PAIRS if "themes" in p]

_CALLOUTS = "".join(
    f'<div class="callout callout--{tone}">{icon(ic)}<div class="callout__body-wrap"><p class="callout__title">{t}</p><p class="callout__body">{b}</p></div></div>'
    for tone, ic, t, b in [("info", "info", "Tidewater started stage 3", "Design system · extracting tokens from 46 mocks"),
                           ("ok", "check-circle", "Ledgerline #27 merged", "Split a transaction · 62% complete"),
                           ("warn", "alert-triangle", "Kiln Booking at 80% of budget", "$200.00 of $250.00. It pauses at $250.00."),
                           ("danger", "x-circle", "Parcel Post is blocked", "Requirements failed after 3 retries.")])
_STATUS_WORDS = '<div class="cluster">' + "".join(status(w) for w in ["Running", "Succeeded", "Paused", "Failed", "Queued", "Idle"]) + "</div>"
_PSTRIP = ('<div class="pstrip" role="img" aria-label="Pipeline: 3 done, 1 running, 1 paused, 1 failed, 4 pending">'
           + "".join(f'<span class="pstrip__seg{(" pstrip__seg--" + m) if m else ""}"></span>' for m in ["ok", "ok", "ok", "run", "paused", "fail", "", "", "", ""]) + "</div>")

_PREVIEW_SPECIMEN = ('<div class="mini-app" style="max-width: 20rem;" aria-hidden="true"><div class="mini-app__side"></div><div class="mini-app__main">'
                     '<div class="mini-app__bar mini-app__bar--title"></div><div class="mini-app__row"><span class="mini-app__cell mini-app__cell--ok"></span><span class="mini-app__bar"></span></div>'
                     '<div class="mini-app__row mini-app__row--focus"><span class="mini-app__cell mini-app__cell--accent"></span><span class="mini-app__bar mini-app__bar--accent"></span></div></div></div>')

_BRAND_CSS = """/* 1. tokens.py: add the brand's primitives to PALETTE (they become --palette-teal-*) */
/* 2. tokens.py: add a theme block that overrides SEMANTIC colour tokens only */
[data-theme="harbor"] {
  --color-accent: var(--palette-teal-600);
  --color-accent-hover: var(--palette-teal-700);
  --color-accent-active: var(--palette-teal-700);
  --color-accent-subtle: var(--palette-teal-50);
  --color-accent-subtle-hover: var(--palette-teal-100);
  --color-fg-accent: var(--palette-teal-700);
  --color-fg-link: var(--palette-teal-700);
  --color-focus-ring: var(--palette-teal-600);
  --color-brand-chip: var(--palette-teal-600);
  color-scheme: light;
}
/* 3. contrast-pairs.json is checked per theme: add "harbor" and run check_contrast.py */"""

SPECS["color"] = {
    "lead": "Colour says where you are, what is happening and what needs you. Every colour is a semantic role with a light and a dark value; components never read a raw hue.",
    "desc": "Hewn colour: palette ramps, semantic roles in light and dark, status colours, fixed preview colours and every contrast pair with live ratios.",
    "sections": [
        ("overview", "Overview", f"""<p>Hewn's colour is two tiers. <b>Primitives</b> (<code>--palette-*</code>) are the {len(_PALETTE_ROWS)} raw values in six ramps: slate (the dark theme), stone (the light theme), and blue, green, amber and red for accent and status. <b>Semantic roles</b> (<code>--color-*</code>, {len(T.COLOR) + len(_DERIVED_COLOR)} tokens) give each value a job: a page background, a secondary text colour, the edge of an input. Components and pages read roles only; themes swap the primitive behind each role.</p>
{ul(["<b>Dark is the prototype's palette.</b> The Magic Patterns frames were drawn dark; every dark value comes from them.",
     "<b>Light is derived from the same roles</b> on a warm stone canvas with slate ink, then tuned until every pair below passes WCAG 2.2 AA.",
     "<b>Blue is the only accent.</b> It means interactive or live: the primary button, the selected tab, Running, the current stage, the focus ring.",
     "<b>Status is never colour alone.</b> Green, amber and red always travel with an icon and a word (<i>Succeeded</i>, <i>Paused</i>, <i>Failed</i>)."])}
<p>Press <kbd>t</kbd> to switch theme: every value and ratio on this page is read live from <code>tokens.css</code>.</p>"""),
        ("palette", "Palette ramps", "<p>Primitives are named by ramp and lightness step (50 lightest, 950 darkest). Steps are sparse on purpose: a step exists only because a role needs it. Do not use these in component or page CSS.</p>"
         + "".join(_ramp(n, s) for n, s in T.PALETTE.items())
         + "<p>Two ramps were corrected during extraction: the duplicate ink step was folded into <code>--palette-slate-900</code>, and <code>--palette-blue-600</code> was darkened so Running text passes on raised surfaces. <code>--palette-blue-800</code> and <code>--palette-amber-600</code> were added for the dark selected-hover tint and light warning fills (see the drift log in the README).</p>"
         + _palette_table(_PALETTE_ROWS)),
        ("roles", "Semantic roles", f"""<p>Roles in both themes side by side. Surfaces step up in order (canvas → surface → raised); in dark each step is lighter, because shadows are hard to see on a dark page.</p>
<h3>Backgrounds</h3>{_swatches_both(_BG)}{token_table(_role_rows(_BG))}
<h3>Foregrounds</h3><p>Shown on the surface they normally sit on; the <code>on-</code> and inverse roles on their own fill.</p>{_swatches_both(_FG)}{token_table(_role_rows(_FG))}
<h3>Borders</h3><p><code>--color-border-default</code> is a decorative hairline between rows and around cards (exempt from 1.4.11). Anything that marks the edge of a control (inputs, checkboxes, secondary buttons, segmented controls) uses <code>--color-border-strong</code>, which is ≥ 3:1.</p>{_swatches_both(_BORDER)}{token_table(_role_rows(_BORDER))}
<h3>Accent, focus and brand</h3><p><code>--color-focus-ring-offset</code> is derived (<code>var(--color-bg-surface)</code>) and declared in every theme block so it resolves against that theme; it paints the gap between a control and its ring.</p>{_swatches_both(_ACCENT + [n for n, _ in _DERIVED_COLOR])}{token_table(_role_rows(_ACCENT + [n for n, _ in _DERIVED_COLOR]))}"""),
        ("status", "Status colours", f"""<p>Four statuses, five roles each: <code>-bg</code> (callout and strip fill), <code>-fg</code> (text on that fill and status words on surfaces), <code>-border</code> (decorative edge), <code>-icon</code> (the icon, ≥ 3:1) and <code>-solid</code> (fills that carry meaning: pipeline segments, dots, meters). Danger adds <code>-solid-hover</code> for the danger button and <code>-strong</code> for Failed and field errors on neutral surfaces.</p>
{themes(_CALLOUTS + _STATUS_WORDS + _PSTRIP, stack=True)}
<p>Mapping in the product: <b>info</b> = blue, live and neutral news (Running uses <code>--color-fg-accent</code>); <b>success</b> = green, Succeeded, Merged, Complete, connected; <b>warning</b> = amber, Paused, Budget reached, reconnecting, spend over 80%; <b>danger</b> = red, Failed, Blocked, Offline, invalid fields, destructive actions. Queued, Skipped, Cancelled and Archived are muted grey: they need no attention.</p>
{token_table(_role_rows(_STATUS_TOKS))}"""),
        ("preview", "Fixed preview colours", f"""<p>The increment video and the design preview draw <em>the product being built</em>, not Mission Control, so they keep their colours when Mission Control changes theme. These tokens have the same value in both themes; the video's captions and controls sit on a fixed scrim. They replace the raw colours the mocks' video player and design preview used.</p>
{ex(_PREVIEW_SPECIMEN, "The schematic preview reads only <code>--color-preview-*</code>, so it looks the same in light and dark.", False)}
{_swatches_both(_PREVIEW)}
{token_table(_role_rows(_PREVIEW))}"""),
        ("contrast", "Contrast pairs", f"""<p>Every foreground/background pairing a component relies on is declared in <a href="../tokens/contrast-pairs.json">tokens/contrast-pairs.json</a> ({len(_PAIRS)} pairs) and checked in both themes by <code>check_contrast.py</code>. The tables below are generated from that file; ratios are computed live in your browser, in both fixed themes.</p>
<h3>Text (4.5:1, SC 1.4.3)</h3>{pairs(_TEXT_PAIRS)}
<h3>Controls, icons, fills and focus (3:1, SC 1.4.11 and 2.4.11)</h3>{pairs(_UI_PAIRS)}
<h3>Pairs that exist in one theme only</h3><p>The danger button is drawn differently per theme: a solid red fill in light, a deep red tint with a red ring in dark. Each theme checks the edge that actually draws the button.</p>{_restricted_pairs(_ONE_THEME_PAIRS)}"""),
        ("brand-theme", "Adding a brand theme", f"""<p>A brand theme (a white-label Hewn, a customer's accent) is one more <code>[data-theme]</code> block that overrides semantic colour roles. It never edits a component and never renames a token.</p>
<pre><code>{_BRAND_CSS.replace("&", "&amp;").replace("<", "&lt;")}</code></pre>
{ul(["Override the accent family as a set: <code>--color-accent</code>, <code>-hover</code>, <code>-active</code>, <code>-subtle</code>, <code>-subtle-hover</code>, <code>--color-fg-accent</code>, <code>--color-fg-link</code>, <code>--color-fg-link-hover</code>, <code>--color-fg-on-accent</code>, <code>--color-focus-ring</code>, <code>--color-brand-chip</code>.",
     "Keep status hues. A brand that is itself green or red must still leave success green and danger red; pick a different accent step if they collide.",
     "A dark variant is a second block (<code>[data-theme=&quot;harbor-dark&quot;]</code>) with <code>color-scheme: dark</code>; copy the dark block and change the same roles.",
     "Run <code>check_contrast.py</code>; aim for ≥ 4.8:1 on text and ≥ 3.3:1 on edges so small rendering differences cannot fail AA.",
     "Do not touch <code>--color-preview-*</code>: the preview shows the customer's product, not the brand of the tool."])}
<p>See {page('foundations/theming', 'Theming')} for how theme blocks, the OS preference and islands interact.</p>"""),
        ("usage", "Usage", ul([
            "Read roles, never primitives: <code>color: var(--color-fg-muted)</code>, not <code>var(--palette-stone-700)</code>. A component that needs a new colour gets a new role (and a contrast pair), not a palette reference.",
            "Text goes on the surface it was checked on. <code>--color-fg-subtle</code> passes on canvas, surface, raised, subtle and subtle-hover; it is not checked on the accent tint, so muted text on a selected row is <code>--color-fg-muted</code>.",
            "One accent. Blue marks what is interactive or live; it is not decoration. Do not colour headings, icons or borders blue to add interest.",
            "Status fills (<code>-solid</code>) are for marks that carry meaning (a pipeline segment, a meter, a dot). Status backgrounds (<code>-bg</code>) are for callouts and strips. Never put body text on a <code>-solid</code> fill.",
            "Danger red is for failure and destruction. A destructive button appears only in a confirmation dialog; Failed and Blocked use <code>--color-danger-strong</code> text with the x-circle icon.",
            "Disabled text (<code>--color-fg-disabled</code>) is exempt from contrast and is used only on genuinely disabled controls, never for de-emphasis.",
            "Scrims (<code>--color-bg-backdrop</code>, <code>--color-bg-scrim</code>) carry alpha: they are the only translucent colours in the system."])),
        ("accessibility", "Accessibility", ul([
            "<b>1.4.3 Contrast (minimum):</b> every text pair above is ≥ 4.5:1 in both themes, including captions and placeholders; there is no large-text exemption in use.",
            "<b>1.4.11 Non-text contrast:</b> control edges, meaningful icons, fills and the focus ring are ≥ 3:1 against what is next to them. Decorative hairlines are exempt and documented as such.",
            "<b>1.4.1 Use of colour:</b> status is icon + word + colour; links in text are underlined; the invalid field has an icon and a message as well as a red ring.",
            "<b>More contrast</b> (<code>prefers-contrast: more</code>): hairlines become <code>--color-border-strong</code> and subtle text becomes <code>--color-fg-muted</code>, in every theme.",
            "<b>Forced colours</b> (<code>forced-colors: active</code>): the focus ring becomes <code>Highlight</code> and borders <code>CanvasText</code>, so edges survive Windows High Contrast."])),
        ("tokens", "Tokens", f"""<p>Every colour token, primitive and semantic. Semantic values show light and dark side by side regardless of the page theme.</p>
<h3>Semantic</h3>{token_table([(_C[t][2], t) for t, *_ in T.COLOR] + [(u, n) for n, u in _DERIVED_COLOR])}
<h3>Primitives</h3>{_palette_table(_PALETTE_ROWS)}"""),
    ],
}


# ================================================================ TYPOGRAPHY
_F = dict(T.FONT)
_FAMILIES = [n for n, _ in T.FONT if n.startswith("--font-family-")]
_SIZES = [n for n, _ in T.FONT if n.startswith("--font-size-")]
_WEIGHTS = [n for n, _ in T.FONT if n.startswith("--font-weight-")]
_LH = [n for n, _ in T.FONT if n.startswith("--line-height-")]
_LS = [n for n, _ in T.FONT if n.startswith("--letter-spacing-")]

_SIZE_USE = {
    "--font-size-xs": ("Captions, hints, timestamps, code, log lines, small buttons, column heads.", "Updated 14 min ago · 9 Nov 2026, 14:31:07"),
    "--font-size-sm": ("Dense UI: rows, tables, nav, callouts, labels, tile titles.", "Increment 7 of 12 · Reconcile a card statement"),
    "--font-size-md": ("Body text and inputs (never smaller, so iOS does not zoom).", "Once you submit, Hewn runs to merged code without asking you anything."),
    "--font-size-lg": ("Section, dialog and empty-state titles; the small wordmark.", "Raise Kiln Booking’s budget"),
    "--font-size-xl": ("Stage titles and the sidebar wordmark.", "Stage 10 · Increments"),
    "--font-size-2xl": ("Page titles (one per page).", "Ledgerline"),
    "--font-size-3xl": ("Sign-in headline below sm.", "Give it a direction."),
    "--font-size-4xl": ("Sign-in headline from sm (the display role).", "Get back merged code."),
    "--font-size-5xl": ("Reserved. No component uses it yet; do not reach for it in product UI.", "Hewn"),
}
_WEIGHT_USE = {"--font-weight-regular": "Body, captions, code, field values.", "--font-weight-medium": "Labels, buttons, status words, nav, h4.",
               "--font-weight-semibold": "Headings h1–h3 and the display line.", "--font-weight-bold": "The wordmark only."}
_LH_USE = {"--line-height-tight": "Display (sign-in headline).", "--line-height-snug": "Headings h1–h4.",
           "--line-height-normal": "Body, labels, captions, code.", "--line-height-relaxed": "Long prose: sign-in lede, callout bodies, decision reasons, textareas.",
           "--line-height-loose": "Log lines and monospaced metadata, so long rows stay scannable."}
_LS_USE = {"--letter-spacing-wordmark": "The Hewn wordmark only.", "--letter-spacing-tight": "Page titles, sign-in headline, run names.",
           "--letter-spacing-normal": "Everything else (the default; stated so a component can reset it).", "--letter-spacing-wide": "Revealed secrets and tokens, so similar characters separate."}
_FAMILY_USE = {"--font-family-sans": "Every UI string.", "--font-family-mono": "SHAs, paths, ids, worker names, tokens, logs, code."}

_ROLE_SAMPLES = {"--text-display": "Give it a direction.", "--text-h1": "Ledgerline", "--text-h2": "Stop all workers?", "--text-h3": "Live run",
                 "--text-h4": "Acceptance tests", "--text-body-lg": "Mission Control is where you give Hewn direction and watch every stage.",
                 "--text-body": "The direction resumes from checkpoint 4c1e0b2 as soon as the new budget is saved.",
                 "--text-body-sm": "Requirements failed after 3 retries. Other projects keep running.", "--text-caption": "Last sign-in: Today, 10:15",
                 "--text-label": "Start direction", "--text-overline": "Projects", "--text-code": "wk-7f3a · 5a1fe37 · docs/specs/L2.md",
                 "--text-log": "14:06:14  error  L2-014 has no Given/When/Then acceptance criterion"}


def _spec(meta, sample, style):
    return f'<div class="ds-specimen"><div class="ds-specimen__meta">{meta}</div><div style="{style} overflow-wrap: anywhere;">{sample}</div></div>'


_SIZE_SPECIMENS = "".join(_spec(f"{n} · {_px(_F[n])}", _SIZE_USE[n][1], f"font-size: var({n}); line-height: var(--line-height-snug);") for n in _SIZES)
_WEIGHT_SPECIMENS = "".join(_spec(f"{n} · {_F[n]}", "Kiln Booking is paused", f"font-size: var(--font-size-lg); font-weight: var({n});") for n in _WEIGHTS)
_LH_SPECIMENS = "".join(_spec(f"{n} · {_F[n]}", "Stage 2 designs every screen and state in Magic Patterns and exports them to docs/mocks/. Ledgerline hasn’t reached it yet.",
                              f"font-size: var(--font-size-sm); line-height: var({n}); max-width: 28rem;") for n in _LH)
_LS_SPECIMENS = "".join(_spec(f"{n} · {_F[n]}", "hewn" if n.endswith("wordmark") else ("hwk_7f3a·Il1O0" if n.endswith("wide") else "Ledgerline"),
                              f"font-size: var(--font-size-xl); font-weight: var(--font-weight-semibold); letter-spacing: var({n});") for n in _LS)
_FAMILY_SPECIMENS = (_spec("--font-family-sans · Inter", "Give it a direction. Get back merged code. 0123456789 $184.20", "font-family: var(--font-family-sans); font-size: var(--font-size-lg);")
                     + _spec("--font-family-mono · JetBrains Mono", "wk-7f3a 5a1fe37 docs/specs/L2.md 0O 1lI", "font-family: var(--font-family-mono); font-size: var(--font-size-md);"))
_ROLE_SPECIMENS = "".join(_spec(f"{n} · {w} {_px(_F['--font-size-' + s])}/{_F['--line-height-' + lh]} {fam}", _ROLE_SAMPLES[n], f"font: var({n});")
                          for n, w, s, lh, fam, _u in T.TYPE_ROLES)

SPECS["typography"] = {
    "lead": "Two families, nine sizes and thirteen role shorthands. Body text is 16px, nothing is smaller than 12px, and every size is in rem so it follows the reader's zoom.",
    "desc": "Hewn typography: Inter and JetBrains Mono, the 12–60px scale, weights, line heights, letter spacing and the --text-* role shorthands.",
    "sections": [
        ("overview", "Overview", ul([
            "<b>Inter</b> for every UI string; <b>JetBrains Mono</b> for anything a person might copy or compare character by character: SHAs, paths, worker ids, tokens, log lines. Both fall back to the system stack, so the mocks work offline with no web fonts.",
            "Components set type with one <b>role shorthand</b> (<code>font: var(--text-label)</code>), not four separate properties. A role is weight + size + line height + family.",
            "The scale has a floor of <b>12px</b>. The mocks' 11px <code>--font-size-2xs</code> (bar labels, stage live lines, flags) was removed, and 13px and 15px one-offs in tile titles, file paths and decisions were snapped to 14px and 16px.",
            "Sentence case everywhere; no all-caps labels. The sidebar's section labels are an overline <em>role</em> (12px medium), not uppercase text."])),
        ("families", "Families", ex(_FAMILY_SPECIMENS, "Mono separates 0/O and 1/l/I, which matters in tokens and SHAs.", False, "ds-example__canvas--stack")
         + _plain_table([(n, _FAMILY_USE[n]) for n in _FAMILIES])),
        ("scale", "Type scale", "<p>Nine steps. The dense UI lives at 12–16px; 18–24px is for titles; 36px and up is the sign-in display line only. Samples are real copy from the mocks.</p>"
         + ex(_SIZE_SPECIMENS, "Sizes in rem; pixel values at the default 16px root.", False, "ds-example__canvas--stack")
         + table(["Token", "Value", "px", "Use"], [[code(n), _val(n), _px(_F[n]), _SIZE_USE[n][0]] for n in _SIZES])),
        ("weights", "Weights", ex(_WEIGHT_SPECIMENS, "Four weights; bold is reserved for the wordmark.", False, "ds-example__canvas--stack")
         + _plain_table([(n, _WEIGHT_USE[n]) for n in _WEIGHTS])),
        ("line-height", "Line height", ex(_LH_SPECIMENS, "Headings tighten; prose and logs loosen.", False, "ds-example__canvas--stack")
         + _plain_table([(n, _LH_USE[n]) for n in _LH])),
        ("letter-spacing", "Letter spacing", ex(_LS_SPECIMENS, "Tracking is a role decision, not a per-component tweak.", False, "ds-example__canvas--stack")
         + _plain_table([(n, _LS_USE[n]) for n in _LS])),
        ("roles", "Role shorthands", "<p>Each <code>--text-*</code> token is a complete <code>font</code> shorthand. Use the role that matches the element's job; override one property only when the role says so (the sign-in headline swaps its size below sm).</p>"
         + ex(_ROLE_SPECIMENS, "Every role, set with <code>font: var(--text-…)</code>.", False, "ds-example__canvas--stack")
         + table(["Token", "Weight · size / line height · family", "Use"],
                 [[code(n), f"{w} · {s} / {lh} · {fam}", u] for n, w, s, lh, fam, u in T.TYPE_ROLES])),
        ("measure", "Measure and responsive type", ul([
            "Prose stops at <code>--layout-measure</code> (65ch) via <code>.max-measure</code>; descriptions under titles stop at 40rem; empty-state text at 28rem. See " + page("foundations/layout", "Layout") + ".",
            "Type does not scale with the viewport. The one responsive change is the sign-in headline: <code>--font-size-3xl</code> (36px) below sm, <code>--font-size-4xl</code> (48px) from <code>--layout-breakpoint-sm</code>.",
            "The increment video's in-frame headings use <code>clamp(var(--font-size-xs), 1.6vw, var(--font-size-lg))</code> because they draw a scaled-down app inside a frame; that is the only viewport-relative size.",
            "Numbers that change in place (spend, percentages, counts, durations) use <code>font-variant-numeric: tabular-nums</code> (<code>.tabular</code>) so they do not jitter.",
            "Titles that might wrap use <code>text-wrap: balance</code>; long ids and paths truncate with an ellipsis (<code>.truncate</code>) and show in full in a tooltip or on the detail page."])),
        ("usage", "Usage", ul([
            "One <code>h1</code> per page (<code>--text-h1</code>), the page or project name. Headings go in order; do not pick a heading level for its size.",
            "Body copy is <code>--text-body</code> (16px). Dense rows, tables and callouts are <code>--text-body-sm</code> (14px). Metadata is <code>--text-caption</code> (12px) in <code>--color-fg-subtle</code>.",
            "Labels, buttons and status words are <code>--text-label</code>: medium weight carries emphasis, colour does not.",
            "Anything copyable or comparable is mono: <code>5a1fe37</code>, <code>wk-4e18</code>, <code>docs/specs/L2.md</code>, <code>hewn:cancelled</code>.",
            "Do not write a raw <code>font-size</code> in pixels. If a size is missing from the scale, the design is wrong or the scale needs a step; ask, then add it to <code>tokens.py</code>."])),
        ("accessibility", "Accessibility", ul([
            "<b>1.4.4 Resize text:</b> every size is rem, so a 200% browser font size doubles the type; layouts reflow rather than clip.",
            "<b>1.4.12 Text spacing:</b> nothing has a fixed height around text; rows and controls use <code>min-height</code>, so 1.5× line height, 2× paragraph spacing, 0.12em letter spacing and 0.16em word spacing do not clip.",
            "<b>Minimum size:</b> 12px for any text, 16px for anything a person reads at length and for input values (so mobile browsers do not zoom on focus).",
            "<b>1.4.3:</b> caption-sized text uses roles that are checked at 4.5:1; there is no reliance on the large-text exemption.",
            "Inter's tabular figures and JetBrains Mono's distinct glyphs reduce misreads of money and ids; never fake mono with letter spacing."])),
        ("tokens", "Tokens", "<p>Every type token: primitives (families, sizes, weights, line heights, letter spacing) and the role shorthands.</p>"
         + _plain_table([(n, (_FAMILY_USE.get(n) or (_SIZE_USE.get(n) or ("",))[0] or _WEIGHT_USE.get(n) or _LH_USE.get(n) or _LS_USE.get(n))) for n, _ in T.FONT])
         + _plain_table([(n, u) for n, _w, _s, _lh, _f, u in T.TYPE_ROLES])),
    ],
}


# ================================================================ SPACING
_SPACE_NOTE = {
    "0": "Resets.", "0-5": "Half step: icon nudges, gaps between nav links and strip segments.", "1": "Icon to text in tight parts; hint offsets.",
    "1-5": "Half step: status icon to word, field hint and error offsets.", "2": "Gap between related controls; dashboard tile gap.",
    "2-5": "Half step: stage rows, bar margins, tooltip padding.", "3": "Small button padding; row padding; gap inside callouts.",
    "4": "Default: card padding, button padding, page margin on phones, grid gutter.", "5": "Sidebar brand inset; run tile padding from sm.",
    "6": "Dialog padding, gutter at md, page section rhythm.", "8": "Gutter and margin at lg; settings section gap.", "10": "Compact empty states; form rail gap.",
    "12": "Stage indent; sign-in side padding from sm.", "16": "Empty-state padding; sidebar brand height.", "20": "Reserved for large layout gaps.",
    "24": "Reserved for large layout gaps.",
}
_SCALE = "".join(f'<div class="ds-scale__row"><code>--space-{k}</code><span data-token="--space-{k}"></span><span class="ds-scale__bar" style="--size: var(--space-{k});"></span></div>' for k, _v in T.SPACE)
_CH = [n for n, _v, _u in T.INTERACTION if n.startswith("--control-height-")]
_CH_USE = {n: u for n, _v, u in T.INTERACTION}
_CH_EX = (f'<a class="tile__open" href="#control-heights">Open {icon("arrow-right", "icon--sm")}</a>'
          + btn("Small · 32px", "", "sm") + btn("Medium · 40px") + btn("Large · 48px", "", "lg"))
_INSIDE = ex(f'<div class="card" style="max-width: 22rem;"><div class="card__header"><b>Spend today</b></div><p class="text-sm">$86.40 across 3 running directions. This week $512.70.</p><div class="card__footer">{btn("View spend", "ghost", "sm")}</div></div>'
             f'<div class="stack stack--sm" style="max-width: 18rem;">{status("Running")}{status("Paused")}{status("Queued")}</div>',
             "Inside: the card pads 16px (<code>--space-4</code>) and its header and footer 12×16px; status icons sit 6px (<code>--space-1-5</code>) from their word. Between: the stack separates items by 8px (<code>--space-2</code>).")

SPECS["spacing"] = {
    "lead": "One 4px scale for every gap, padding and margin, with three half steps for dense parts. Small numbers live inside components; large numbers separate them.",
    "desc": "Hewn spacing: the 4px scale with half steps, inside-versus-between rules, control heights and padding by component size.",
    "sections": [
        ("overview", "Overview", ul([
            "Token names count quarters of a rem: <code>--space-4</code> is 1rem (16px), <code>--space-1-5</code> is 0.375rem (6px). The name says the multiple of 4px.",
            "Three half steps (<code>0-5</code>, <code>1-5</code>, <code>2-5</code> = 2, 6, 10px) exist for dense parts the prototype draws tightly: nav link gaps, status icon offsets, stage rows. They replaced off-grid nudges in the mocks (0.15rem icon offsets, 3px strip gaps, a 3.1rem stage indent, a 0.6rem bar margin).",
            "Spacing never scales with the viewport. A breakpoint changes which token a layout uses (the gutter goes from <code>--space-4</code> to <code>--space-6</code> to <code>--space-8</code>), never the token's value."])),
        ("scale", "Scale", '<div class="ds-scale">' + _SCALE + "</div>"
         + table(["Token", "Value", "px", "Use"], [[code("--space-" + k), _val("--space-" + k), _px(v) if v != "0" else "0", _SPACE_NOTE[k]] for k, v in T.SPACE])),
        ("inside-between", "Inside and between", _INSIDE + table(["Where", "Space", "Example in the product"], [
            ["Icon to its text", "<code>--space-1</code> – <code>--space-2</code>", "Button icon and label (8px); status icon and word (6px)."],
            ["Inside small parts", "<code>--space-2</code> – <code>--space-3</code>", "Small button padding 12px; chip padding; menu items 12px inline."],
            ["Inside containers", "<code>--space-4</code> – <code>--space-6</code>", "Card and tile body 16px; toast 12/16px; dialog 24px."],
            ["Between related controls", "<code>--space-2</code> – <code>--space-3</code>", "Buttons in a cluster (8px); fields in a form row."],
            ["Between groups on a page", "<code>--space-6</code> – <code>--space-8</code>", "Page sections (24px block padding); settings sections (32px)."],
            ["Around whole states", "<code>--space-10</code> – <code>--space-16</code>", "Empty states pad 64px (40px when tight); sign-in centres with 64px."]])
         + "<p>Rule of thumb: a component pads itself with ≤ <code>--space-6</code>; layout separates components with ≥ <code>--space-6</code>. If two things need more space between them than inside them, they are probably two groups and need a heading.</p>"),
        ("control-heights", "Control heights", f"""<p>Interactive parts take one of four heights; padding grows with height so labels stay optically centred. Below lg, nav links, tabs and icon actions grow to <code>--target-comfortable</code> (44px; see {page('foundations/accessibility#targets', 'Accessibility')}).</p>
{ex(_CH_EX, "Tile link 28px, then small, medium and large buttons.")}
{table(["Size", "Height", "Inline padding", "Label", "Used by"], [
    ["xs", code("--control-height-xs") + " · 28px", code("--space-2"), code("--text-caption"), "Tile <i>Open</i> links, toast close, avatars."],
    ["sm", code("--control-height-sm") + " · 32px", code("--space-3"), code("--font-size-xs"), "Buttons in rows and tile headers, compact inputs, segmented options; nav sub-links from lg."],
    ["md", code("--control-height-md") + " · 40px", code("--space-4"), code("--font-size-sm"), "Default buttons, inputs, selects, tabs, nav links from lg."],
    ["lg", code("--control-height-lg") + " · 48px", code("--space-6"), code("--font-size-md"), "Sign-in, empty-state calls to action, large inputs."]])}
<p>The mocks had 36px side-project links, small tabs and state links between these heights; they now map to sm/md on desktop and 44px below lg.</p>
{_plain_table([(n, _CH_USE[n]) for n in _CH])}"""),
        ("usage", "Usage", ul([
            "Use a token for every gap, padding and margin. <code>calc()</code> with tokens is fine (<code>calc(-1 * var(--space-4))</code> to bleed a card header); a raw <code>0.6rem</code> is not.",
            "Prefer <code>gap</code> on flex and grid parents (<code>.stack</code>, <code>.cluster</code>, <code>.grid</code>) to margins on children.",
            "Half steps are for dense parts only. If you reach for <code>--space-2-5</code> in a layout, use <code>--space-2</code> or <code>--space-3</code>.",
            "<code>--space-20</code> and <code>--space-24</code> are reserved; no current screen needs them. Large empty areas are a sign the layout is wrong, not that it needs more space.",
            "Page margins and grid gutters come from <code>--layout-margin</code> and <code>--layout-gutter</code>, which pick a space token per breakpoint; do not hard-code them."])),
        ("tokens", "Tokens", _plain_table([("--space-" + k, _SPACE_NOTE[k]) for k, _v in T.SPACE]) + _plain_table([(n, _CH_USE[n]) for n in _CH])),
    ],
}


# ================================================================ LAYOUT
_L = {n: (v, u) for n, v, u in T.LAYOUT}
_BP = [n for n, _v, _u in T.LAYOUT if "breakpoint" in n]
_GRID = ["--layout-columns", "--layout-gutter", "--layout-margin"]
_CONTAINER = ["--layout-container-max", "--layout-measure", "--layout-form-max"]
_RAILS = [n for n, _v, _u in T.LAYOUT if n not in _BP + _GRID + _CONTAINER]
_BAND = {"--layout-breakpoint-sm": "S", "--layout-breakpoint-md": "M", "--layout-breakpoint-lg": "L", "--layout-breakpoint-xl": "XL", "--layout-breakpoint-2xl": "–"}

_GRID_DEMO = ('<div class="ds-grid-demo" aria-hidden="true">' + "".join(f"<span>{i}</span>" for i in range(1, 13)) + "</div>"
              '<p class="text-caption">This grid reads the live tokens: <span data-token="--layout-columns"></span> columns, gutter <span data-token="--layout-gutter"></span>, margin <span data-token="--layout-margin"></span> at your current width. Twelve cells wrap onto three rows at 4 columns and two at 8.</p>')


def _schematic(cols, cells, rows="auto"):
    box = "display: grid; place-items: center; min-height: 2.5rem; padding: var(--space-1); border-radius: var(--radius-sm); background: var(--color-accent-subtle); border: var(--border-width-hairline) dashed var(--color-accent); color: var(--color-fg-accent); font: var(--text-caption);"
    inner = "".join(f'<div style="{box} grid-column: {c}; grid-row: {r};">{label}</div>' for label, c, r in cells)
    return (f'<div style="display: grid; grid-template-columns: {cols}; grid-auto-rows: minmax(2.5rem, auto); gap: var(--space-1); width: 100%; max-width: 32rem;" '
            f'role="img" aria-label="Schematic: {", ".join(c[0] for c in cells)}">{inner}</div>')


_TEMPLATES = [
    ("App shell", "pages/dashboard/default",
     _schematic("minmax(0, 1fr) minmax(0, 3fr)", [("Sidebar 240px (lg+)", "1", "1 / span 3"), ("Page header", "2", "1"), ("Content: 12-column dash grid", "2", "2 / span 2")]),
     "<code>.shell</code> → <code>.shell__sidebar</code> (<code>--layout-sidebar-width</code>, from lg) + <code>.shell__body</code> → <code>.topbar</code> (below lg, sticky, <code>--layout-topbar-height</code>) + <code>.shell__main</code> → <code>.page-header</code> + <code>.pad</code> content. Below lg the sidebar becomes the navigation drawer behind the top bar's menu button.",
     [("pages/dashboard/default", "dashboard, 12-column tiles"), ("pages/projects/default", "row list"), ("dialogs/mobile-nav/default", "drawer below lg")]),
    ("Sign-in (auth)", "pages/sign-in/default",
     _schematic("minmax(0, 1fr) minmax(0, 1fr)", [("Form column: headline, lede, GitHub button", "1", "1 / span 2"), ("Aside: pipeline stages (lg+)", "2", "1 / span 2")]),
     "<code>.auth</code> is one column below lg and two equal columns from lg; <code>.auth__main</code> centres a 28rem column (<code>.auth__center</code>), <code>.auth__aside</code> lists the ten stages and appears from lg. No sidebar, no top bar.",
     [("pages/sign-in/default", "default"), ("pages/sign-in/denied", "not on the allow list"), ("pages/sign-in/signed-out", "signed out")]),
    ("Settings", "pages/settings/default",
     _schematic("minmax(0, 1fr) minmax(0, 2fr)", [("Page header", "1 / span 2", "1"), ("Section intro", "1", "2"), ("Section body: fields, tables", "2", "2"), ("Section intro", "1", "3"), ("Section body", "2", "3")]),
     "Inside the shell, <code>.settings-section</code> stacks intro over body below lg and becomes a two-column grid (16rem intro, body) from lg, separated by 32px. Fieldsets use <code>.fieldset</code>; forms cap at <code>--layout-form-max</code>.",
     [("pages/settings/default", "four sections"), ("pages/settings/invalid", "error summary"), ("pages/settings/viewer", "read-only")]),
    ("Project detail", "pages/project-pipeline/default",
     _schematic("minmax(0, 1fr) minmax(0, 2fr)", [("Project header: name, repo, status, spend, tabs", "1 / span 2", "1"), ("Stage rail (lg+)", "1", "2 / span 2"), ("Stage detail and live log", "2", "2 / span 2")]),
     "<code>.phead</code> (name, repo, status, spend, then <code>.tabs</code>) over a <code>.split</code>: <code>--pipeline</code> puts the stage list beside the detail from lg (18rem, <code>--layout-rail-pipeline</code> at xl); <code>--aside</code> and <code>--form</code> add a right rail (<code>--layout-rail-aside</code> at xl); <code>--trace</code> a requirement list. Below lg the rail stacks above as a horizontal stepper (L2-046 AC2).",
     [("pages/project-pipeline/default", "pipeline split"), ("pages/increment/default", "aside rail"), ("pages/traceability/default", "trace split"), ("pages/new-direction/default", "form rail")]),
    ("Error page", "pages/not-found/default",
     _schematic("minmax(0, 1fr) minmax(0, 3fr)", [("Sidebar (kept)", "1", "1 / span 2"), ("Centred message: code, title, text, actions", "2", "1 / span 2")]),
     "Errors keep the shell so navigation still works. <code>.errpage</code> centres a 30rem column in at least 70dvh: <code>.errpage__code</code> (404, or 500 with a reference), the <code>h1</code>, one paragraph and an action cluster.",
     [("pages/not-found/default", "404"), ("pages/server-error/default", "500 with reference")]),
]
_TEMPLATES_HTML = "".join(
    f'<h3>{name}</h3>{ex(fig, "Schematic of " + mock(src), False)}<p>{desc}</p><p>Mocks: ' + ", ".join(mock(p, n) for p, n in srcs) + ".</p>"
    for name, src, fig, desc, srcs in _TEMPLATES)

SPECS["layout"] = {
    "lead": "Five breakpoints, a 4/8/12-column grid whose gutters and margins step up with the screen, a 240px sidebar from 992px, and five page templates every screen is built from.",
    "desc": "Hewn layout: breakpoints, columns, gutters and margins, container and measure, sidebar, rails and page templates.",
    "sections": [
        ("overview", "Overview", ul([
            "Mobile first: base styles target a 360px phone; every media query is <code>min-width</code> in rem, so it follows the reader's font size.",
            "The grid, gutter and margin are tokens that change at md and lg; components read them instead of writing their own queries.",
            "Navigation is a fixed sidebar from lg (992px) and a drawer behind a menu button below it (L2-046).",
            "Every screen is one of five templates: the app shell, sign-in, settings, project detail and the error page."])),
        ("breakpoints", "Breakpoints", f"""<p>Hewn's breakpoints are the product's own, not the extraction skill's defaults (640/768/1024/1280). They come from requirement <b>L2-046</b>, which fixes the bands at XS below 576px, S from 576px, M from 768px, L from 992px and XL from 1200px; the mocks and the Angular <code>BreakpointService</code> are tested against those widths. 2xl (1536px) is added only to say where the content stops growing.</p>
{table(["Token", "Value", "px", "L2-046 band", "What changes"], [[code(n), _val(n), _px(_L[n][0]), _BAND[n], _L[n][1].split(": ", 1)[-1]] for n in _BP])}
<p>Custom properties cannot be used inside <code>@media</code>, so queries repeat the value: <code>@media (min-width: 62rem)</code> means <code>--layout-breakpoint-lg</code>. The mocks had two extra breakpoints (40rem for dialogs and toasts, and <code>max-width: 61.99rem</code> queries); dialogs and toasts now switch at sm and every query is min-width.</p>"""),
        ("grid", "Columns, gutters and margins", f"""{table(["Range", "Columns", "Gutter", "Margin", "Notes"], [
            ["Base (0–767px)", "4", code("--space-4") + " · 16px", code("--space-4") + " · 16px", "XS and S. One column of content; tiles and cards stack."],
            ["md (768–991px)", "8", code("--space-6") + " · 24px", code("--space-4") + " · 16px", "M. Tables show their md columns; traceability goes 2-up."],
            ["lg (992–1199px)", "12", code("--space-8") + " · 32px", code("--space-8") + " · 32px", "L. Sidebar appears, so the content area is the viewport minus 240px."],
            ["xl (1200px+)", "12", code("--space-8") + " · 32px", code("--space-8") + " · 32px", "XL. Rails widen; traceability 4-up; project header goes horizontal."]])}
<p>The margin stays 16px at md because the shell still has no sidebar there and phones in landscape need the width. The dashboard uses its own 12-column grid from lg with <code>--layout-dash-row</code> (60px) rows and an 8px gap, because tiles are placed by row and column span.</p>
{_GRID_DEMO}
{_plain_table([(n, _L[n][1]) for n in _GRID])}"""),
        ("container", "Container and measure", f"""<p><code>.container</code> caps content at <code>--layout-container-max</code> (1440px) and centres it; past 2xl the page grows margins, not content. Prose stops at <code>--layout-measure</code>; single-column forms at <code>--layout-form-max</code> (672px), which is why New direction has a rail beside its form instead of wider fields.</p>
{_plain_table([(n, _L[n][1]) for n in _CONTAINER])}"""),
        ("rails", "Chrome, rails and overlays", f"""<p>Fixed widths for the parts that frame content. Rails appear at lg and widen at xl; below lg they stack above or below the content.</p>
{table(["Token", "Value", "Use", "Below lg"], [[code(n), _val(n), _L[n][1], {
    "--layout-sidebar-width": "Drawer instead (<code>--layout-drawer-width</code>).", "--layout-drawer-width": "Used below lg only.",
    "--layout-topbar-height": "Shown below lg; also <code>scroll-padding-top</code>.", "--layout-rail-nav": "Section nav becomes a scrolling row.",
    "--layout-rail-pipeline": "Horizontal stepper above the detail.", "--layout-rail-aside": "Stacks under the main column.",
    "--layout-dash-row": "Tiles stack at their natural height.", "--layout-dialog-width": "Bottom sheet below sm.",
    "--layout-dialog-width-lg": "Bottom sheet below sm.", "--layout-toast-width": "Full width below sm."}[n]] for n in _RAILS])}
<p>Some rails are still written as raw widths in <code>components.css</code> at lg (pipeline 18rem, traceability 17rem, form rail 20rem, settings intro 16rem); they are listed in the README's open items to become tokens.</p>"""),
        ("templates", "Page templates", "<p>Five templates cover all 29 screens. Each schematic shows the lg layout; below lg every template is one column.</p>" + _TEMPLATES_HTML),
        ("usage", "Usage", ul([
            "Start from a template; do not invent a page layout. A new screen is the shell plus a page header plus one of the content patterns (grid, row list, split).",
            "Use <code>.grid</code> (reads <code>--layout-columns</code>) for column layouts and <code>.grid--cards</code> (<code>auto-fill, minmax(18rem, 1fr)</code>) for card collections; neither needs a media query.",
            "Content inside the shell pads with <code>.pad</code> (<code>--layout-margin</code>); full-bleed parts (tabs, the project header, tables on phones) go edge to edge and pad their own content.",
            "Write media queries as <code>min-width</code> in rem at the five values above, and nowhere else. If a component needs a different breakpoint, it needs a container-size rule, not a new viewport breakpoint.",
            "Use <code>100dvh</code>, not <code>100vh</code>, for full-height layouts (shell, sign-in, error page)."])),
        ("accessibility", "Accessibility", ul([
            "<b>1.4.10 Reflow:</b> every template works at 320px with no horizontal page scroll (L2-046 AC4 extends that to 2560px). Only tables and the log scroll horizontally, inside their own wrapper.",
            "<b>2.4.11 Focus not obscured:</b> the sticky top bar is 56px, and <code>scroll-padding-top</code> equals <code>--layout-topbar-height</code>, so a focused field is never hidden under it.",
            "<b>2.4.1 Bypass blocks:</b> every template starts with a skip link to <code>#main</code>; landmarks are <code>nav</code> (sidebar), <code>header</code> (top bar), <code>main</code>.",
            "<b>1.3.2 Meaningful sequence:</b> DOM order is visual order at every breakpoint; rails that move use grid placement, never <code>order</code> that would scramble focus.",
            "<b>1.3.4 Orientation:</b> no template locks orientation; landscape phones get the base layout."])),
        ("tokens", "Tokens", _plain_table([(n, u) for n, _v, u in T.LAYOUT])),
    ],
}


# ================================================================ ELEVATION
_SH = [(n, u) for n, _v, u in T.SHADOW_LIGHT]
_SHADOW_FOCUS = [(n, u) for n, _v, u in T.DERIVED if n.startswith("--shadow-")]
_SHADOW_GRID = ('<div class="ds-shadow-grid">' + "".join(f'<div style="--shadow: var({n});">{n}</div>' for n, _u in _SH if n != "--shadow-color") + "</div>")
_SURF = "padding: var(--space-4); border-radius: var(--radius-md); font: var(--text-caption); color: var(--color-fg-muted);"
_SURFACES = (f'<div style="{_SURF} background: var(--color-bg-canvas); box-shadow: inset 0 0 0 var(--border-width-hairline) var(--color-border-default);">Canvas: the page'
             f'<div style="{_SURF} margin-top: var(--space-2); background: var(--color-bg-surface); box-shadow: inset 0 0 0 var(--border-width-hairline) var(--color-border-default), var(--shadow-1);">Surface: tile, card, sidebar'
             f'<div style="{_SURF} margin-top: var(--space-2); background: var(--color-bg-surface-sunken); box-shadow: inset 0 0 0 var(--border-width-hairline) var(--color-border-default);">Sunken: log, code box, preview stage</div>'
             f'<div style="{_SURF} margin-top: var(--space-2); background: var(--color-bg-surface-raised); box-shadow: inset 0 0 0 var(--border-width-hairline) var(--color-border-default), var(--shadow-3);">Raised: dialog, toast, menu</div></div></div>')
_Z_NOTE = {n: u for n, _v, u in T.Z}
_Z_STACK = ('<div style="position: relative; height: 13rem; width: 100%; max-width: 20rem; overflow: hidden;" role="img" aria-label="Layers from page content up to tooltip">'
            + "".join(f'<div style="position: absolute; left: calc({i} * var(--space-5)); top: calc({i} * var(--space-5)); z-index: var({n}); width: 9rem; padding: var(--space-1) var(--space-2); border-radius: var(--radius-sm); background: var(--color-bg-surface-raised); box-shadow: inset 0 0 0 var(--border-width-hairline) var(--color-border-strong), var(--shadow-2); font: var(--text-caption);">{n}</div>'
                      for i, (n, _v, _u) in enumerate(T.Z)) + "</div>")
_FOCUS_DEMO = '<div style="display: inline-grid; place-items: center; width: 8rem; height: var(--control-height-md); border-radius: var(--radius-md); background: var(--color-bg-surface); box-shadow: var(--shadow-focus); font: var(--text-label);">Tile in edit</div>'

SPECS["elevation"] = {
    "lead": "Elevation is surface colour first and shadow second. Four shadow levels, tinted for each theme, and nine named layers so nothing ever writes a raw z-index.",
    "desc": "Hewn elevation: four shadow levels per theme, the focus shadow, surface hierarchy and the z-order scale.",
    "sections": [
        ("overview", "Overview", ul([
            "A thing that floats is lighter (dark) or brighter (light) than what it floats on <em>and</em> casts a shadow. Surface colour does most of the work in dark, where shadows barely show.",
            "Four levels: <b>1</b> resting tiles, <b>2</b> tiles being edited and preview frames, <b>3</b> toasts, menus, tooltips and the log's jump pill, <b>4</b> dialogs and drawers. Cards and rows have no shadow; a hairline is enough.",
            "Shadows are tinted with <code>--shadow-color</code> (slate ink in light, pure dark in dark) and get stronger in dark so they still read on a dark page.",
            "Layering uses <code>--z-*</code> tokens only."])),
        ("shadows", "Shadow levels", f"""{themes(_SHADOW_GRID)}
{_themed_table(_SH)}"""),
        ("surfaces", "Surface hierarchy", f"""<p>Canvas → surface → raised, with sunken for wells. In dark each step up is lighter (slate 950 → 900 → 850); in light the canvas is stone and surfaces are paper, and raised steps slightly back to stone so dialogs separate from the white tiles behind the scrim.</p>
{themes(_SURFACES)}
<p>Overlays add the backdrop (<code>--color-bg-backdrop</code>) behind them so the page recedes; the backdrop, not the shadow, separates a dialog from the page.</p>"""),
        ("focus-shadow", "Focus shadow", f"""<p><code>--shadow-focus</code> draws the focus ring as two box shadows (offset gap in <code>--color-focus-ring-offset</code>, then the ring) for a part whose outline would be clipped by an <code>overflow: hidden</code> ancestor, such as something focusable inside a dashboard tile body or the video frame. No shipped component needs it yet; everywhere the ring is a real <code>outline</code>, which forced-colours mode keeps, so reach for the shadow only when the outline is genuinely clipped.</p>
{themes(_FOCUS_DEMO)}
{_themed_table(_SHADOW_FOCUS)}"""),
        ("z-order", "Z-order", f"""<p>Nine layers, far enough apart that a component can add 1 inside its own layer. Toasts sit above dialogs, so a failure during a dialog is still seen; tooltips and the skip link are topmost.</p>
{ex(_Z_STACK, "Each card sets <code>z-index: var(--z-…)</code>; the later layer always wins.", False)}
{_plain_table([(n, _Z_NOTE[n]) for n, _v, _u in T.Z])}"""),
        ("usage", "Usage", ul([
            "Pick the level by what the thing is, not how important it feels: a toast is level 3 wherever it appears.",
            "Combine shadow with the inset hairline ring (<code>box-shadow: inset 0 0 0 var(--border-width-hairline) var(--color-border-default), var(--shadow-3)</code>) so the edge stays crisp in both themes.",
            "Do not animate shadows; animate opacity and transform. Edit-mode tiles switch from level 1 to 2 instantly.",
            "Never write <code>z-index: 9999</code>. If two things in the same layer collide, the later one in the DOM wins; restructure before inventing a layer.",
            "<code>--z-popover</code> is reserved for a popover opened from inside a dialog; no current screen uses it."])),
        ("tokens", "Tokens", _themed_table(_SH + _SHADOW_FOCUS) + _plain_table([(n, u) for n, _v, u in T.Z])),
    ],
}


# ================================================================ SHAPE
_S = {n: u for n, _v, u in T.SHAPE}
_RADII = [n for n, _v, _u in T.SHAPE if n.startswith("--radius-")]
_BORDERS = [n for n, _v, _u in T.SHAPE if n.startswith("--border-width-")]
_RADIUS_BOXES = "".join(f'<div class="stack stack--sm" style="align-items: center;"><span class="ds-scale__box" style="--size: var({n});"></span><code>{n}</code><span class="text-caption" data-token="{n}"></span></div>' for n in _RADII)
_BORDER_DEMO = (f'<div style="padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); box-shadow: inset 0 0 0 var(--border-width-hairline) var(--color-border-strong); font: var(--text-body-sm);">Hairline inset ring (input edge)</div>'
                f'<div style="padding: var(--space-3) var(--space-4); border-bottom: var(--border-width-thick) solid var(--color-accent); font: var(--text-label); color: var(--color-fg-accent);">Thick: selected tab</div>'
                f'<div style="padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); box-shadow: inset 0 0 0 var(--border-width-thick) var(--color-danger-icon); font: var(--text-body-sm);">Thick: invalid ring</div>'
                f'<div style="padding: var(--space-3) var(--space-4); border-left: var(--border-width-thick) solid var(--color-accent); font: var(--text-body-sm);">Thick: current stage edge</div>')

SPECS["shape"] = {
    "lead": "Six radii that grow with the size of the thing, and two border widths. Edges are drawn as inset rings so borders never change an element's size.",
    "desc": "Hewn shape: the 2/4/6/8/12px radius scale plus full, hairline and thick borders, inset rings and which radius goes where.",
    "sections": [
        ("overview", "Overview", ul([
            "Radius grows with size: 2px for bars and segments, 4px for small parts, 6px for controls and containers, 8px for overlays, 12px for bottom sheets, full for pills and dots.",
            "The mocks had a 6px <code>--radius-lg</code> equal to <code>--radius-md</code> and off-grid 1px and 3px radii; the scale is now 2 / 4 / 6 / 8 / 12px on the 2px grid, and overlays (dialog, drawer, toast) take lg.",
            "Edges are <code>box-shadow: inset 0 0 0 var(--border-width-hairline) …</code>, not <code>border</code>, so a state change (hover ring, invalid ring) never shifts the layout by a pixel."])),
        ("radius", "Radius", ex(_RADIUS_BOXES, "Live radius per token.", False)
         + table(["Token", "Value", "Use"], [[code(n), _val(n), _S[n]] for n in _RADII])),
        ("borders", "Border widths", ex(_BORDER_DEMO, "Hairline draws every edge; thick marks selection, the current stage and invalid fields.", False, "ds-example__canvas--stack")
         + _plain_table([(n, _S[n]) for n in _BORDERS])),
        ("usage", "Usage", table(["Element", "Radius", "Why"], [
            ["Pipeline segments, spend bars, skeleton chips", code("--radius-xs"), "Long thin marks; more radius makes them read as pills."],
            ["Segmented options, tile links, state links, inline code", code("--radius-sm"), "Small targets inside a larger control."],
            ["Buttons, inputs, selects, callouts, cards, tiles", code("--radius-md"), "The default for anything you click or that contains content."],
            ["Dialogs, drawers, toasts, menus' outer panel", code("--radius-lg"), "Overlays are larger and float; slightly rounder separates them."],
            ["Bottom sheets below sm", code("--radius-xl") + " (top corners)", "The sheet meets the screen edge; only the top corners round."],
            ["Avatars, pills, dots, meters, the theme toggle", code("--radius-full"), "Shapes defined by being round."]])
         + ul(["Nested shapes reduce radius: a 6px card holding 4px chips, not 6px inside 6px.",
               "Never mix border and inset ring on one element; pick the ring.",
               "Thick (2px) borders are state, not decoration: if nothing is selected, current or invalid, use the hairline."])),
        ("tokens", "Tokens", _plain_table([(n, u) for n, _v, u in T.SHAPE])),
    ],
}


# ================================================================ MOTION
_M = {n: (v, u) for n, v, u in T.MOTION}
_DUR = [n for n, _v, _u in T.MOTION if n.startswith("--duration-")]
_EASE = [n for n, _v, _u in T.MOTION if n.startswith("--ease-")]
_DELAY = [n for n, _v, _u in T.MOTION if n.startswith("--delay-")]


def _motion(label, dur, ease):
    return (f'<div class="ds-motion-demo" style="--demo-duration: var({dur}); --demo-ease: var({ease}); align-items: center;">'
            f'<button class="btn btn--sm" type="button" data-motion-run>{label}</button><span class="dot"></span></div>')


_DUR_DEMOS = "".join(_motion(f"Play {n.replace('--duration-', '')}", n, "--ease-standard") for n in _DUR if n not in ("--duration-pulse", "--duration-spin"))
_EASE_DEMOS = "".join(_motion(f"Play {n.replace('--ease-', '')}", "--duration-deliberate", n) for n in _EASE)
_LOOPS = (f'<span class="spinner">{icon("loader")}Loading workers…</span>'
          f'<span class="cluster"><span class="dot dot--accent pulse"></span><span class="text-sm">Running segment pulse</span></span>'
          f'<span style="display: block; width: 10rem;"><span class="skeleton skeleton--line"></span></span>')
_TIP = (f'<span class="tooltip-anchor">{icon_btn("refresh", "Refresh workers", "", attrs="aria-describedby=" + chr(34) + "motion-tip" + chr(34))}'
        '<span class="tooltip" role="tooltip" id="motion-tip">Fetch the worker registry again</span></span>')

SPECS["motion"] = {
    "lead": "Motion confirms that something happened and shows where it went. Seven durations, four easings, one delay; under reduced motion transitions are instant and loops stop.",
    "desc": "Hewn motion: durations, easings and the tooltip delay with replayable demos, loops, choreography and reduced motion.",
    "sections": [
        ("overview", "Overview", ul([
            "Most motion is feedback: a hover tint (120ms), a tab underline sliding (200ms), a dialog rising in (240ms). Nothing moves to decorate.",
            "Things arriving use <code>--ease-enter</code> (the prototype's curve: fast out, long settle); things leaving use <code>--ease-exit</code> and are quicker; everything else uses <code>--ease-standard</code>.",
            "Loops show live work: the running pipeline segment and log cursor pulse, the spinner turns, skeletons shimmer. All share <code>--duration-pulse</code> (2s) so the screen breathes at one rate.",
            "The mocks' raw timings (2s pulse, 1.4s shimmer, 1.2s cursor) and raw easings (<code>linear</code>, <code>ease-in-out</code>) were replaced by these tokens."])),
        ("durations", "Durations", f"""<p>Press a button to replay the move at that duration. With reduced motion on, every dot jumps: that is the intended behaviour.</p>
{ex(_DUR_DEMOS, "Distances are the same; only the duration changes.", False, "ds-example__canvas--stack")}
{_plain_table([(n, _M[n][1]) for n in _DUR])}
<p><code>--duration-deliberate</code> (500ms) is reserved for large moves a person should notice; no shipped component uses it yet.</p>"""),
        ("easing", "Easing", f"""{ex(_EASE_DEMOS, "Each curve played at <code>--duration-deliberate</code> so the shape is visible; in the product they run at fast to slow.", False, "ds-example__canvas--stack")}
{_plain_table([(n, _M[n][1]) for n in _EASE])}"""),
        ("loops", "Loops and delays", f"""{ex(_LOOPS, "Spinner (<code>--duration-spin</code>, linear), pulse (<code>--duration-pulse</code>, standard), shimmer (<code>--duration-pulse</code>, linear).", False)}
{ex(_TIP, "Hover or focus the button: the tooltip waits <code>--delay-tooltip</code>, then fades in over <code>--duration-fast</code>; it hides with no delay.", False)}
{_plain_table([(n, _M[n][1]) for n in ("--duration-pulse", "--duration-spin")] + [(n, _M[n][1]) for n in _DELAY])}"""),
        ("choreography", "Choreography", table(["Moment", "What moves", "Duration · easing"], [
            ["Hover, press", "Background and colour; buttons scale to 98% while active.", code("--duration-fast") + " · " + code("--ease-standard")],
            ["Tab change, chevron, switch thumb", "Underline slides; chevron rotates; thumb travels.", code("--duration-base") + " · " + code("--ease-standard")],
            ["Dialog opens", "Backdrop fades; panel rises 8px and scales from 96% (sm+), or slides up as a sheet (below sm).", code("--duration-slow") + " · " + code("--ease-enter")],
            ["Drawer opens", "Slides in 24px from its edge while fading in.", code("--duration-slow") + " · " + code("--ease-enter")],
            ["Toast arrives / leaves", "Rises 8px and fades in; leaves by fading and dropping back.", code("--duration-slow") + " · " + code("--ease-enter") + " / " + code("--duration-base") + " · " + code("--ease-exit")],
            ["Menu opens", "Rises in from the trigger.", code("--duration-fast") + " · " + code("--ease-enter")],
            ["Live work", "Running segment and log cursor pulse; spinner turns; skeleton shimmers.", code("--duration-pulse") + " / " + code("--duration-spin")]])
         + ul(["One thing moves at a time. A dialog and a toast do not both animate in on the same click.",
               "Exits are faster than entrances; nothing waits for an exit animation before the next step can be used.",
               "Never animate layout properties (<code>width</code>, <code>height</code>, <code>top</code>); animate <code>opacity</code>, <code>transform</code> and <code>translate</code>.",
               "Status changes from the event stream do not animate in place; the new status word and icon simply replace the old one, and the live region announces it."])),
        ("usage", "Usage", ul([
            "Every <code>transition</code> and <code>animation</code> reads a duration and an easing token. A raw <code>0.3s ease</code> is drift.",
            "Use <code>--duration-instant</code> for state flips that should not animate (selected rows, edit-mode shadow).",
            "Loops are for live, ongoing work only and stop when the work does: a Paused segment does not pulse.",
            "Tooltips use <code>--delay-tooltip</code> on show only, so moving across a toolbar does not flash a row of tooltips."])),
        ("accessibility", "Accessibility", f"""{ul([
            "<b>2.3.3 Animation from interactions</b> and <code>prefers-reduced-motion: reduce</code>: <code>tokens.css</code> sets fast, base, slow and deliberate to <code>0.01ms</code> (transitions still fire their end events) and pulse and spin to <code>0s</code> (loops stop rather than flash). Components need no media queries of their own.",
            "With loops stopped, live work is still visible: the spinner keeps its icon and label, the running segment keeps its accent fill, the status word still says <i>Running</i>.",
            "<b>2.2.2 Pause, stop, hide:</b> no loop is decorative and none runs longer than the work it shows; the log's auto-follow can be turned off with <i>Follow log</i>.",
            "Nothing flashes more than three times a second (2.3.1); the fastest loop is 2s.",
            "Smooth scrolling in the docs is off under reduced motion; the product does not smooth-scroll."])}
<pre><code>@media (prefers-reduced-motion: reduce) {{
  :root {{
    --duration-fast: 0.01ms; --duration-base: 0.01ms; --duration-slow: 0.01ms; --duration-deliberate: 0.01ms;
    --duration-pulse: 0s; --duration-spin: 0s;
  }}
}}</code></pre>"""),
        ("tokens", "Tokens", _plain_table([(n, u) for n, _v, u in T.MOTION])),
    ],
}


# ================================================================ ICONOGRAPHY
_IS = [(n, u) for n, _v, u in T.INTERACTION if n.startswith("--size-icon-")]
_ICON_CELL = "display: grid; place-items: center; padding: var(--space-4) var(--space-2) var(--space-2); text-align: center; border-radius: var(--radius-md); box-shadow: inset 0 0 0 var(--border-width-hairline) var(--color-border-default); background: var(--color-bg-surface); color: var(--color-fg-default);"
_ICON_SHEET = ('<div style="display: grid; gap: var(--space-2); grid-template-columns: repeat(auto-fill, minmax(min(100%, 7rem), 1fr));">'
               + "".join(f'<div style="{_ICON_CELL}">{icon(n, "icon--lg")}<code style="margin-top: var(--space-2); background: none; overflow-wrap: anywhere; font-size: var(--font-size-xs);">{n}</code></div>' for n in sorted(ICONS))
               + "</div>")
_ICON_SIZES = "".join(f'<div class="stack stack--sm" style="align-items: center;">{icon("git-merge", "icon--" + n.split("-")[-1] if not n.endswith("-md") else "")}<code>{n}</code><span class="text-caption" data-token="{n}"></span></div>' for n, _u in _IS)
_STATUS_ROWS = []
for _word, (_ic, _tone, _spin) in STATUS.items():
    _STATUS_ROWS.append([status(_word), code(_ic), code("status--" + _tone), "Spins (stops under reduced motion)" if _spin else "–"])

SPECS["iconography"] = {
    "lead": f"{len(ICONS)} outline icons on a 24-unit grid, drawn with a 2px round stroke in currentColor. Icons support a word; they never replace one, except on labelled icon buttons.",
    "desc": "Hewn iconography: the 24-unit stroke icon set, sizes, status icons and labelling rules, with every icon in the set.",
    "sections": [
        ("overview", "Overview", ul([
            "Every icon is an inline SVG with <code>viewBox=\"0 0 24 24\"</code>, <code>fill: none</code>, <code>stroke: currentColor</code>, <code>stroke-width: 2</code>, round caps and joins (<code>.icon</code>). Lucide-style geometry and names, drawn from the mocks' own set so the product needs no icon font or network.",
            "Icons inherit the text colour, so a status icon is the status colour and an icon in a button is the label colour. Never fill an icon or give it its own colour outside the status and callout roles.",
            "Decorative icons are <code>aria-hidden=\"true\"</code>. An icon that is the only content of a control gets its name from the control's <code>aria-label</code>.",
            "One icon means one thing everywhere: <code>loader</code> is always work in progress, <code>x-circle</code> always failed or blocked, <code>pause-circle</code> always paused."])),
        ("set", "The icon set", f"<p>Every icon in the set, at <code>--size-icon-lg</code> (20px), with the name you pass to the icon helper.</p>{_ICON_SHEET}"),
        ("sizes", "Sizes", ex(_ICON_SIZES, "<code>.icon--xs</code>, <code>--sm</code>, default, <code>--lg</code>, <code>--xl</code>.", False)
         + _plain_table(_IS)
         + ul(["Inside text and buttons the icon matches the text: 16px with 14–16px text, 14px in small buttons and rows, 12px in breadcrumbs and small status.",
               "Navigation and the top bar use 20px; empty and error states use 28px.",
               "Icons sit on the text's centre line; the mocks' 0.15rem nudges were replaced by <code>--space-0-5</code> top offsets in callouts, toasts and field errors."])),
        ("status-icons", "Status icons", "<p>Status is icon + word + colour, always together. The map lives in one place (the mocks' <code>STATUS</code> table) and every status in the product goes through it.</p>"
         + table(["Status", "Icon", "Tone class", "Motion"], _STATUS_ROWS)),
        ("labelling", "Labelling", ul([
            "<b>Decorative</b> (next to a word that says the same): <code>&lt;svg class=\"icon\" aria-hidden=\"true\"&gt;</code>. This is the default from the helper.",
            "<b>Icon-only control:</b> the <code>button</code> or <code>a</code> carries <code>aria-label</code> with verb and object (<i>Refresh workers</i>, <i>Open navigation</i>, <i>Close menu</i>) and shows a tooltip with the same words.",
            "<b>Meaningful on its own</b> (a status icon in a compact cell): <code>role=\"img\"</code> and <code>aria-label</code> (<i>Failed</i>), or a visually hidden word next to it.",
            "<b>External links</b> add the <code>external</code> icon after the label and say so in the name if it opens a new tab (<i>Open PR #28 on GitHub</i>).",
            "Never use an icon as the only cue for something a person must act on; Blocked has the x-circle <em>and</em> the word."])),
        ("usage", "Usage", ul([
            "Use an icon only when it speeds recognition of something repeated: status, navigation, common actions (copy, refresh, external). A one-off action gets a word.",
            "Leading icons in buttons are for the primary verbs people scan for (<i>New direction</i> with plus); most buttons have none.",
            "Do not rotate, mirror or recolour icons to mean something new; add an icon to the set instead (24-unit grid, 2px stroke, 2px padding, round joins).",
            "Spinning is reserved for <code>loader</code> and <code>refresh</code> during reconnects."])),
        ("accessibility", "Accessibility", ul([
            "<b>1.1.1:</b> every icon is either hidden (decorative) or named (role img or the control's label); the checker fails unnamed icon-only buttons.",
            "<b>1.4.11:</b> status and callout icons use the <code>-icon</code> roles, checked at 3:1 against surface, canvas and their callout fill.",
            "<b>1.4.1:</b> icons add a non-colour cue to status, but the word is the primary cue.",
            "<b>2.5.8:</b> an icon is never the target; the control around it is ≥ 24px (44px below lg for main phone targets)."])),
        ("tokens", "Tokens", _plain_table(_IS)),
    ],
}


# ================================================================ THEMING
_THEME_CSS = """/* tokens.css (generated from _build/tokens.py) */
:root {                                   /* light is the default */
  --color-bg-canvas: var(--palette-stone-100);
  …
  color-scheme: light;
}
[data-theme="light"] { …same light values… }   /* restated, so a light island works inside a dark page */
[data-theme="dark"]  { --color-bg-canvas: var(--palette-slate-950); … color-scheme: dark; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { …identical to [data-theme="dark"]… }
}"""
_THEME_TS = """// mission-control/src/app/core/theme.service.ts
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly key = 'hewn.theme';               // 'light' | 'dark' | 'system'
  readonly choice = signal<ThemeChoice>(this.read());

  constructor() {
    effect(() => {
      const c = this.choice();
      const root = document.documentElement;
      if (c === 'system') root.removeAttribute('data-theme');   // CSS follows prefers-color-scheme
      else root.setAttribute('data-theme', c);
      try { localStorage.setItem(this.key, c); } catch { /* private mode: keep in memory */ }
    });
  }
  private read(): ThemeChoice {
    try { return (localStorage.getItem(this.key) as ThemeChoice) ?? 'system'; } catch { return 'system'; }
  }
}"""
_ANGULAR_JSON = """// angular.json → projects.mission-control.architect.build.options
"styles": [
  "src/styles/tokens.css",        // copied from docs/design-system/tokens/tokens.css
  "src/styles/components.css",    // copied from docs/design-system/assets/components.css
  "src/styles.css"
]"""
_JSON_SNIPPET = """{
  "color": { "bg": { "canvas": {
    "$type": "color",
    "$value": "{palette.stone.100}",
    "$extensions": { "com.agent-toolkit": {
      "css": "--color-bg-canvas",
      "themes": { "dark": { "$value": "{palette.slate.950}" } }
    } }
  } } }
}"""
_ISLAND = ('<div data-theme="dark" style="width: 100%; padding: var(--space-4); border-radius: var(--radius-md); background: var(--color-bg-canvas); color: var(--color-fg-default);">'
           f'<p class="text-sm">Dark page · Ledgerline {status("Running")}</p>'
           '<div data-theme="light" class="card" style="margin-top: var(--space-3); color: var(--color-fg-default);"><p class="text-sm">Light island: tokens resolve light again inside <code>[data-theme="light"]</code>.</p>'
           f'<div class="cluster" style="margin-top: var(--space-2);">{btn("Start direction", "primary", "sm")}{status("Paused")}</div></div></div>')
_THEMED_COUNT = len(T.COLOR) + len(T.DERIVED) + len(T.SHADOW_LIGHT)

SPECS["theming"] = {
    "lead": "Light and dark are two values for the same semantic tokens. The OS decides until the person chooses; components never know which theme they are in.",
    "desc": "Hewn theming: data-theme, prefers-color-scheme, color-scheme, light islands, the three token tiers, adding a theme and consuming tokens.json from Angular.",
    "sections": [
        ("overview", "Overview", ul([
            f"A theme overrides <b>colour and shadow tokens only</b> ({_THEMED_COUNT} tokens). Type, space, layout, shape, motion and z-order are the same in every theme.",
            "Light is <code>:root</code>. Dark is <code>[data-theme=\"dark\"]</code> and, with no attribute, the OS preference. Light is restated under <code>[data-theme=\"light\"]</code> so it can be forced, and so a light island inside a dark page works.",
            "Each theme sets <code>color-scheme</code>, so native scrollbars, form controls and the date picker follow.",
            "Dark carries the prototype's palette; light is derived from the same roles and verified separately. Neither is an inversion of the other."])),
        ("how-it-works", "How it works", f"""<pre><code>{_THEME_CSS.replace("&", "&amp;").replace("<", "&lt;")}</code></pre>
{table(["Person's choice", "Attribute on <html>", "Result"], [
    ["Nothing saved (first visit)", "none", "Follows the OS via <code>prefers-color-scheme</code> (L2-048 AC1)."],
    ["System", "none", "Same as first visit; changes live when the OS switches."],
    ["Light", code('data-theme="light"'), "Light, even when the OS is dark."],
    ["Dark", code('data-theme="dark"'), "Dark, even when the OS is light."]])}
<p>The choice is made in Settings → Appearance ({mock('pages/settings/default', 'Light, Dark, System')}), applies immediately, is kept in <code>localStorage['hewn.theme']</code> on this device, and survives reloads (L2-048 AC2). Viewers can change their own theme and nothing else. Keep the two dark blocks identical: the generator writes both from the same data, and <code>check_contrast.py</code> reads both.</p>"""),
        ("islands", "Islands", f"""<p>Any element can set <code>data-theme</code> to render its subtree in another theme: these docs use it for the side-by-side examples. In the product the increment video and design preview do not need an island: they use the fixed <code>--color-preview-*</code> tokens instead, because they draw the customer's app, not Mission Control.</p>
{ex(_ISLAND, "A light card inside a dark panel. The light block restates every colour and shadow token; the card sets its own <code>color</code> and background.")}
<p><b>An island must set <code>color</code> and <code>background</code> itself.</b> Tokens re-resolve inside the island, but properties the parent already computed (its text colour) inherit as finished values. Without <code>color: var(--color-fg-default)</code> on the island, its text keeps the dark page's light ink on a light card. Components that set their own text colour are unaffected.</p>"""),
        ("tiers", "Token tiers", table(["Tier", "Prefix", "Count", "Who reads it", "Themes override it?"], [
            ["1 · Primitive", "<code>--palette-*</code>, <code>--font-*</code>, <code>--line-height-*</code>, <code>--letter-spacing-*</code>",
             str(sum(len(s) for s in T.PALETTE.values()) + len(T.FONT)), "Semantic tokens only.", "No: a theme points roles at different primitives."],
            ["2 · Semantic", "<code>--color-*</code>, <code>--text-*</code>, <code>--space-*</code>, <code>--layout-*</code>, <code>--radius-*</code>, <code>--border-width-*</code>, <code>--shadow-*</code>, <code>--duration-*</code>, <code>--delay-*</code>, <code>--ease-*</code>, <code>--z-*</code>, <code>--target-*</code>, <code>--focus-ring-*</code>, <code>--control-height-*</code>, <code>--size-icon-*</code>",
             str(len(T.COLOR) + len(T.DERIVED) + len(T.TYPE_ROLES) + len(T.SPACE) + len(T.LAYOUT) + len(T.SHAPE) + len(T.SHADOW_LIGHT) + len(T.MOTION) + len(T.Z) + len(T.INTERACTION)),
             "Components and pages.", "Colour and shadow only."],
            ["3 · Component", "<code>--btn-*</code>, <code>--field-*</code>, <code>--callout-*</code>, <code>--card-*</code>, <code>--tile-*</code>, <code>--dialog-*</code>, <code>--nav-*</code> …",
             "per component", "One component, declared in <code>components.css</code>; always aliases a semantic token.", "No; re-skin a component by overriding these in a scope."]])
         + "<p>A brand change touches primitives; changing what accent means touches semantic tokens; changing how buttons look touches component tokens. Each change lives in exactly one tier.</p>"),
        ("adding-a-theme", "Adding a theme", ul([
            "Add primitives for any new hue to <code>PALETTE</code> in <code>_build/tokens.py</code>.",
            "Add a theme block that sets every <code>--color-*</code> role and the five shadow tokens, plus <code>color-scheme</code>. Start by copying the light or dark column; change roles, never names.",
            "Add the theme to the contrast checks and run <code>check_contrast.py</code> until every pair passes.",
            "Add the option to Settings → Appearance and to <code>ThemeChoice</code>; the service only sets the attribute.",
            "Screenshot the mocks and these docs with <code>?theme=&lt;name&gt;</code>.",
            "See " + page("foundations/color#brand-theme", "Color → Adding a brand theme") + " for the accent set to override."])),
        ("media", "Contrast and forced colours", ul([
            "<code>prefers-contrast: more</code> applies in every theme: hairlines take <code>--color-border-strong</code> and subtle text takes <code>--color-fg-muted</code>.",
            "<code>forced-colors: active</code>: the focus ring becomes <code>Highlight</code> and borders <code>CanvasText</code>; everything else is left to the system palette. Edges drawn as inset box shadows disappear in forced colours, so controls whose edge matters also keep a transparent <code>outline</code> or <code>border</code>.",
            "Print uses light regardless of the theme."])),
        ("angular", "Using tokens in Angular", f"""<p>Mission Control is Angular. It ships the two stylesheets as global styles and reads tokens in component styles as plain <code>var(--…)</code>; it never redeclares a token value.</p>
<pre><code>{_ANGULAR_JSON.replace("&", "&amp;").replace("<", "&lt;")}</code></pre>
<pre><code>{_THEME_TS.replace("&", "&amp;").replace("<", "&lt;")}</code></pre>
<p>For values TypeScript needs (breakpoints for <code>BreakpointService</code>'s <code>matchMedia</code> queries, durations for timers, chart colours), generate constants from <a href="../tokens/tokens.json">tokens/tokens.json</a>, the W3C DTCG export. Aliases are <code>{{group.token}}</code>; each token carries its CSS name and its dark value under <code>$extensions</code>:</p>
<pre><code>{_JSON_SNIPPET.replace("&", "&amp;").replace("<", "&lt;")}</code></pre>
{ul(["Generate at build time (a small Node script or Style Dictionary) into <code>src/app/core/tokens.ts</code>; do not hand-copy values.",
     "Read colours at runtime with <code>getComputedStyle(root)</code> + <code>.getPropertyValue('--color-accent')</code> when a canvas or chart needs them, and re-read on theme change; generated constants hold only the light value.",
     "Never put a token value in a component's <code>styles</code>; if a component needs a new value, it is a new token in <code>tokens.py</code>."])}"""),
        ("usage", "Usage", ul([
            "Write components against roles and test them in both themes; a component that looks right in only one is using the wrong role.",
            "Do not branch on theme in code (<code>if (dark)</code>). If something must differ, it is a token with two values.",
            "Do not use <code>prefers-color-scheme</code> in component CSS; only <code>tokens.css</code> reads it.",
            "Islands are for documentation and genuine embeds. Product surfaces that must look fixed use fixed tokens (<code>--color-preview-*</code>, <code>--color-bg-scrim</code>).",
            "Images and screenshots of the product being built are shown as they are; do not invert or dim them in dark."])),
        ("accessibility", "Accessibility", ul([
            "Both themes meet WCAG 2.2 AA on every declared pair (L2-048 AC2 asks for 4.5:1 text in both); see " + page("foundations/color#contrast", "Color → Contrast pairs") + ".",
            "The theme follows the OS by default, which respects people who set dark mode for light sensitivity, and the choice is per device.",
            "The theme toggle in Settings is a radio group with visible labels and descriptions (<i>Follow your operating system</i>), not an icon-only switch.",
            "Changing theme moves nothing and announces nothing; focus stays where it was."])),
        ("tokens", "Tokens", f"""<p>Theming owns no tokens of its own. Each theme block overrides these groups, documented on their own pages:</p>
{table(["Group", "Tokens per theme", "Page"], [
    ["Semantic colour roles", str(len(T.COLOR)), page("foundations/color#roles", "Color")],
    ["Derived focus tokens (<code>--color-focus-ring-offset</code>, <code>--shadow-focus</code>)", str(len(T.DERIVED)), page("foundations/color#roles", "Color") + ", " + page("foundations/elevation#focus-shadow", "Elevation")],
    ["Shadows and <code>--shadow-color</code>", str(len(T.SHADOW_LIGHT)), page("foundations/elevation#shadows", "Elevation")],
    ["<code>color-scheme</code> (a property, not a token)", "1", "–"]])}"""),
    ],
}


# ================================================================ RESPONSIVE
_RESP = [
    ("Shell and navigation", "Top bar (56px) with menu button; drawer (288px) opens over the page.", "–", "–", "Sidebar (240px) fixed; top bar hidden.", "–"),
    ("Page header", "Title, description, then actions stacked; primary full width.", "Row: title left, actions right, aligned to the bottom.", "–", "Padding 32px.", "–"),
    ("Project header", "Name, repo, status and spend stacked; tabs scroll horizontally.", "–", "–", "Padding 32px.", "Stats sit in a row beside the name."),
    ("Pipeline", "Vertical stage list (L2-046 AC1).", "Horizontal, scrollable stepper above the detail (AC2).", "Same.", "Stage rail 18rem beside the detail (AC3).", "Rail 20rem."),
    ("Dashboard", "Tiles stack at natural height; Edit is hidden.", "–", "–", "12-column grid, 60px rows; layout editing available.", "–"),
    ("Row lists (projects, workers, backlog)", "Each row is a stacked card: title, then meta, then actions.", "–", "–", "Rows become a table with a header row.", "–"),
    ("Tables (audit, runs)", "Scroll inside <code>.table-wrap</code>; secondary columns hidden.", "<code>.col-sm</code> columns appear.", "<code>.col-md</code> columns appear.", "–", "–"),
    ("Forms", "One column; actions stacked, primary on top.", "<code>.form-grid--2</code> pairs short fields.", "–", "Form beside its rail (<code>.split--form</code>).", "Rail 24rem."),
    ("Dialogs", "Bottom sheet, 12px top corners, sticky footer with safe-area padding.", "Centred panel, 28/32rem, 8px corners.", "–", "–", "–"),
    ("Toasts", "Full width at the bottom.", "Bottom right, 24rem.", "–", "–", "–"),
    ("Event and file lists", "Two-line items.", "Columns: kind, time, text; file path, size, date, action.", "–", "–", "–"),
    ("Traceability", "One column.", "–", "Two columns.", "Requirement list as a rail.", "Four columns."),
    ("Settings", "Intro above each section's body.", "–", "–", "Intro (16rem) beside body.", "–"),
    ("Sign-in", "Headline 36px; button full width.", "Headline 48px; button auto width; 48px side padding.", "–", "Two columns with the stage aside; 64px side padding.", "–"),
    ("Targets", "Nav links, tabs, icon actions, menu items and state links 44px.", "–", "–", "Back to control heights: 40px (md) or 32px (sm).", "–"),
]
_RESP_TABLE = table(["Part", "Base (0)", "sm · 36rem", "md · 48rem", "lg · 62rem", "xl · 75rem"], [list(r) for r in _RESP])

SPECS["responsive"] = {
    "lead": "Mobile first, five breakpoints, one column on phones and a sidebar from 992px. No page scrolls sideways at any width from 320 to 2560px.",
    "desc": "Hewn responsive rules: mobile-first CSS, what each component does at each breakpoint, touch rules and the testing matrix.",
    "sections": [
        ("overview", "Overview", ul([
            "Base styles are the phone. Each breakpoint <em>adds</em>: columns, rails, the sidebar. There are no <code>max-width</code> queries.",
            "Breakpoints are " + page("foundations/layout#breakpoints", "Layout's") + " five: sm 36rem (576px), md 48rem (768px), lg 62rem (992px), xl 75rem (1200px), 2xl 96rem (1536px), matching L2-046's XS/S/M/L/XL bands.",
            "Layout tokens (<code>--layout-columns</code>, <code>--layout-gutter</code>, <code>--layout-margin</code>) step up at md and lg, so most components need no query at all.",
            "lg is the big change: the sidebar appears, the top bar goes, row lists become tables, rails appear beside content and touch-sized targets return to control heights."])),
        ("bands", "Bands", table(["Band (L2-046)", "Width", "Shape of every page"], [
            ["XS", "< 576px", "One column; navigation in a drawer behind the menu button; pipeline as a vertical list."],
            ["S and M", "576–991px", "Still one main column, no sidebar; the project page shows the pipeline as a horizontal scrollable stepper above the stage detail."],
            ["L and XL", "≥ 992px", "Fixed sidebar; the project page shows pipeline and stage detail side by side."]])),
        ("components", "By component", "<p>What changes at each breakpoint. A dash means no change from the column to its left.</p>" + _RESP_TABLE),
        ("touch", "Touch and pointer", ul([
            "Below lg, every main phone target is ≥ 44×44px (<code>--target-comfortable</code>): nav links, tabs, icon actions, menu items, state links and the top bar's menu button.",
            "From lg, controls use their control height (32–40px), which still clears WCAG 2.5.8's 24px minimum; small targets in rows keep ≥ 8px between them.",
            "<code>(hover: none)</code> reveals anything that is hover-only on desktop (row actions, the tile <i>Open</i> link); nothing is reachable by hover alone.",
            "<code>(pointer: coarse)</code> is not used to grow targets; they are already large enough below lg.",
            "Fixed bottom parts (bottom sheet footer, toast region) add <code>env(safe-area-inset-bottom)</code>.",
            "Dashboard layout editing (drag to move, handle to resize) is desktop only, ≥ 992px; below that tiles stack and Edit is hidden."])),
        ("testing", "Testing matrix", table(["Width × height", "Why", "Check"], [
            ["320 × 640", "Reflow minimum (1.4.10).", "No horizontal page scroll; nothing clipped."],
            ["360 × 800", "Base phone; most mocks are screenshotted here.", "One column, drawer navigation, bottom-sheet dialogs, 44px targets."],
            ["576 / 768 × 1024", "S and M starts.", "Dialogs centre; stepper above the detail; md table columns."],
            ["992 × 800", "L start: sidebar appears.", "Sidebar, row lists as tables, rails beside content."],
            ["1280 × 800", "Common laptop; the XL layout.", "Rails at full width; project header in a row."],
            ["2560 × 1440", "L2-046 AC4 upper bound.", "Content capped at the container; no stretched lines."]])
         + "<p>Every width in both themes; repeat 360 and 1280 at 200% zoom. The mocks' <code>screenshot_mocks.py</code> takes <code>--viewport</code> for each width and works on these docs too.</p>"),
        ("usage", "Usage", ul([
            "Write the phone layout first, then add <code>@media (min-width: …)</code> blocks in ascending order at the five values only.",
            "Prefer intrinsic layouts (<code>auto-fill</code> grids, <code>flex-wrap</code>, <code>minmax(0, 1fr)</code>) to breakpoints.",
            "Hide with <code>.sm-only</code> / <code>.lg-only</code> utilities only when the content exists elsewhere at that size; never hide information on phones.",
            "Long strings (paths, SHAs, URLs) truncate or wrap with <code>overflow-wrap: anywhere</code>; they never push the page wide."])),
        ("accessibility", "Accessibility", ul([
            "<b>1.4.10 Reflow</b>: 320px with no two-dimensional scroll, except tables and the log inside their own scrolling wrapper, which has a focusable region and a label.",
            "<b>1.3.4 Orientation</b>: no orientation lock.",
            "<b>2.5.8 Target size</b>: ≥ 24px everywhere, ≥ 44px for main targets below lg.",
            "<b>2.4.11 Focus not obscured</b>: the sticky top bar never covers the focused element (<code>scroll-padding-top</code>), and the bottom sheet's sticky footer does not cover the field being edited.",
            "<b>1.4.4 Resize text</b>: breakpoints are in rem, so at 200% text a 1280px window gets the md layout instead of overflowing."])),
        ("tokens", "Tokens", "<p>Responsive behaviour reads the layout tokens; their values are listed on " + page("foundations/layout#tokens", "Layout") + ".</p>"
         + table(["Token", "Value", "Changes at"], [[code(n), v or _L[n][0], w] for n, v, w in [
             ("--layout-breakpoint-sm", "", "–"), ("--layout-breakpoint-md", "", "–"), ("--layout-breakpoint-lg", "", "–"),
             ("--layout-breakpoint-xl", "", "–"), ("--layout-breakpoint-2xl", "", "–"),
             ("--layout-columns", "4 / 8 / 12", "md, lg"), ("--layout-gutter", "16 / 24 / 32px", "md, lg"), ("--layout-margin", "16 / 16 / 32px", "lg")]])),
    ],
}


# ================================================================ ACCESSIBILITY
_A11Y_TOKENS = [(n, u) for n, _v, u in T.INTERACTION if n.startswith(("--target-", "--focus-ring-"))]
_PERCEIVABLE = [
    ("Text contrast", "1.4.3", "Body, label, caption and placeholder text ≥ 4.5:1 on every surface it sits on, in both themes; " + str(len([p for p in _PAIRS if p["min"] >= 4.5])) + " text pairs in <code>contrast-pairs.json</code>."),
    ("Non-text contrast", "1.4.11", "Control edges (<code>--color-border-strong</code>), meaningful icons, pipeline and meter fills, and the focus ring ≥ 3:1 against neighbours. Hairlines between content are decorative and exempt."),
    ("Use of colour", "1.4.1", "Status is icon + word + colour; links in text are underlined; invalid fields have an icon and a message; required fields say so in the label."),
    ("Resize and reflow", "1.4.4, 1.4.10", "All sizes in rem; every page reflows to 320px; only tables and the log scroll horizontally, inside their wrapper."),
    ("Text spacing", "1.4.12", "Controls and rows use <code>min-height</code>; nothing clips with 1.5× line height, 2× paragraph, 0.12em letter and 0.16em word spacing."),
    ("Non-text content", "1.1.1", "Decorative SVGs are <code>aria-hidden</code>; icon-only controls have <code>aria-label</code>; the design preview frame and video have titles; the pipeline strip has a text alternative."),
    ("Orientation; animation", "1.3.4, 2.3.3", "No orientation lock; motion tokens zero under <code>prefers-reduced-motion</code>, and loops stop."),
    ("Input purpose", "1.3.5", "<code>autocomplete</code> on the few personal fields (GitHub login); <code>autocomplete=\"off\"</code> on worker names and secrets."),
]
_OPERABLE = [
    ("Keyboard", "2.1.1, 2.1.2", "Everything works with Tab, Shift+Tab, Enter and Space, plus arrows where the APG pattern says (tabs, radios, menus). The only trap is a modal dialog or drawer, which releases on Esc (L2-047 AC2)."),
    ("Focus visible", "2.4.7, 2.4.13", "One ring: 2px <code>--color-focus-ring</code>, 2px offset, on <code>:focus-visible</code>, ≥ 3:1 against the surface and the control."),
    ("Focus not obscured", "2.4.11", "<code>scroll-padding-top</code> equals the 56px top bar; toasts sit bottom right and never cover a focused control; the sheet footer does not cover the field being edited."),
    ("Focus order", "2.4.3", "DOM order is visual order; no positive <code>tabindex</code>; dialogs move focus in (to the first field, or Cancel for destructive confirmations) and return it to the trigger."),
    ("Target size", "2.5.8", "≥ 24×24px everywhere (<code>--target-min</code>); 44×44px for main phone targets below lg (<code>--target-comfortable</code>)."),
    ("Dragging", "2.5.7", "Dashboard tiles can be moved and resized by drag or with the keyboard (arrow keys on the focused tile and handle)."),
    ("Timing", "2.2.1, 2.2.2", "Info and success toasts stay 5 s and pause on hover and focus; warnings 10 s; errors stay until dismissed. The log's auto-follow can be turned off."),
    ("Bypass blocks", "2.4.1", "Skip link to <code>#main</code> on every page; landmarks <code>nav</code>, <code>header</code>, <code>main</code>."),
    ("Titles and headings", "2.4.2, 2.4.6", "Unique <code>&lt;title&gt;</code> per page and state; one <code>h1</code>; headings in order."),
    ("Link purpose", "2.4.4", "Links say where they go (<i>Open the pipeline</i>, <i>Open PR #28 on GitHub</i>), never <i>click here</i>."),
    ("Pointer cancellation", "2.5.2", "Actions fire on click, never on pointer down."),
]
_UNDERSTANDABLE = [
    ("Labels", "3.3.2", "Every control has a visible label; placeholders are examples, never labels; optional fields say <i>(optional)</i>."),
    ("Errors", "3.3.1, 3.3.3", "Each error names the field and how to fix it, with <code>aria-invalid</code> and <code>aria-describedby</code>; a summary links each error to its field and takes focus on submit."),
    ("Error prevention", "3.3.4", "Delete is a typed confirmation; stop, cancel, revoke and raise-budget confirm in a dialog that says what happens; nothing destructive is one click."),
    ("Redundant entry", "3.3.7", "A feature direction pre-selects its product; failed submits keep every value."),
    ("Accessible authentication", "3.3.8", "Sign-in is GitHub OAuth: no passwords, puzzles or codes to transcribe in Hewn."),
    ("Consistent navigation", "3.2.3, 3.2.4", "One shell, one sidebar order, one name per thing on every page; an icon means one thing."),
    ("Language", "3.1.1", "<code>&lt;html lang=\"en\"&gt;</code> on every page."),
    ("On input", "3.2.2", "Changing a select, radio or switch never navigates or submits; theme radios apply immediately because that is their documented purpose."),
    ("Consistent help", "3.2.6", "Help and docs links sit in the same place (the sidebar footer) on every page."),
]
_ROBUST = [
    ("Name, role, value", "4.1.2", "Native elements first (<code>button</code>, <code>a</code>, <code>input</code>, <code>select</code>, <code>dialog</code>); ARIA only where a WAI-ARIA APG pattern needs it, named on each component page."),
    ("Status messages", "4.1.3", "Toasts in a polite <code>role=\"status\"</code> region; error toasts in a separate <code>role=\"alert\"</code> region (so they are not announced twice); stage status changes announced politely at most once every 5 s per project (L2-047 AC3)."),
    ("Valid markup", "–", "Unique ids, no interactive content inside interactive content, no block content inside buttons."),
]


def _wcag(rows):
    return table(["Requirement", "SC", "Hewn's commitment"], [[r, sc, rule] for r, sc, rule in rows])


_CHECKLIST = '<ul class="ds-checklist">' + "".join(f"<li><span><b>{r}</b> ({sc})</span></li>" for r, sc, _x in _PERCEIVABLE + _OPERABLE + _UNDERSTANDABLE + _ROBUST) + "</ul>"
_FOCUS_EX = btn("Start direction", "primary", attrs='data-state="focus"') + btn("Pause", attrs='data-state="focus"') + btn("Delete project", "danger", attrs='data-state="focus"')
_TARGET_BOX = "display: inline-grid; place-items: center; border-radius: var(--radius-sm); border: var(--border-width-hairline) dashed var(--color-accent); color: var(--color-fg-accent);"
_TARGETS = (f'<div class="stack stack--sm" style="align-items: center;"><span style="{_TARGET_BOX} width: var(--target-min); height: var(--target-min);">{icon("x", "icon--sm")}</span><code>--target-min</code><span class="text-caption" data-token="--target-min"></span></div>'
            f'<div class="stack stack--sm" style="align-items: center;"><span style="{_TARGET_BOX} width: var(--target-comfortable); height: var(--target-comfortable);">{icon("menu", "icon--lg")}</span><code>--target-comfortable</code><span class="text-caption" data-token="--target-comfortable"></span></div>')

SPECS["accessibility"] = {
    "lead": "Hewn meets WCAG 2.2 AA on every page in every state, in both themes, by keyboard alone. These are the commitments every component makes and how they are checked.",
    "desc": "Hewn accessibility: the WCAG 2.2 AA commitments, focus and target tokens, the testing procedure and the contract every component page answers.",
    "sections": [
        ("overview", "Overview", f"""<p>Requirement L2-047 sets the bar: axe-core finds no serious or critical violations on any page in any state, everything is reachable and usable by keyboard with a visible focus indicator and no traps, and stage status changes are announced politely at most once every 5 seconds per project. L2-048 adds 4.5:1 text contrast in both themes; L2-046 adds no horizontal scroll from 320 to 2560px.</p>
{_CHECKLIST}"""),
        ("perceivable", "Perceivable", _wcag(_PERCEIVABLE)),
        ("operable", "Operable", _wcag(_OPERABLE)),
        ("understandable", "Understandable", _wcag(_UNDERSTANDABLE)),
        ("robust", "Robust", _wcag(_ROBUST)),
        ("focus", "Focus ring", f"""<p>One ring for everything focusable: <code>outline: var(--focus-ring-width) solid var(--color-focus-ring); outline-offset: var(--focus-ring-offset)</code> on <code>:focus-visible</code>. The offset gap shows the surface, so the ring passes 3:1 against both a blue primary button and the page. Where an outline would be clipped, the same ring is drawn with <code>--shadow-focus</code> (see {page('foundations/elevation#focus-shadow', 'Elevation')}).</p>
{themes(_FOCUS_EX)}
{_plain_table([t for t in _A11Y_TOKENS if t[0].startswith("--focus-ring-")])}"""),
        ("targets", "Target sizes", f"""{ex(_TARGETS, "24px is the floor for any target; 44px for main targets below lg.", False)}
{_plain_table([t for t in _A11Y_TOKENS if t[0].startswith("--target-")])}
<p>L2-046 AC4 asks for 44×44px touch targets. Below lg (where people use touch) every main target meets it; from lg, buttons and rows use 32–40px control heights, which meet WCAG 2.5.8 (24px) for pointer use. Control heights are on {page('foundations/spacing#control-heights', 'Spacing')}.</p>"""),
        ("testing", "Testing procedure", table(["Step", "Tool", "Passes when"], [
            ["1. Contrast", "<code>check_contrast.py tokens/tokens.css</code>", "Every pair in <code>contrast-pairs.json</code> passes in light and dark."],
            ["2. Structure", "<code>check_design_system.py</code> / <code>check_mocks.py</code>", "Labels, names, alt text, landmarks, one h1, valid links and fragments, no raw colours."],
            ["3. Automated audit", "Playwright + axe-core (<code>AccessibilitySuite</code>), every route in every mocked state", "No serious or critical violations (L2-047 AC1)."],
            ["4. Keyboard walk", "Playwright tabs through each page", "Focus is always visible, never trapped outside a modal, and follows reading order (AC2)."],
            ["5. Screen reader", "VoiceOver (Safari) and NVDA (Firefox) on one dialog, one form and one table per release", "Names, roles, states and live announcements read correctly; toasts are read once."],
            ["6. Zoom and reflow", "Browser zoom 200% and 400%; 320px viewport", "No loss of content or function; no sideways scroll."],
            ["7. Preferences", "Emulate <code>prefers-reduced-motion</code>, <code>prefers-contrast: more</code>, <code>forced-colors: active</code>, both colour schemes", "Loops stop; edges and focus stay visible; text passes."]])),
        ("contract", "Component contract", "<p>Every " + page("components/button", "component page") + "'s Accessibility section answers the same seven questions, so a reviewer can check any component the same way:</p>"
         + "<ol><li><b>Role and pattern</b>: the native element or WAI-ARIA APG pattern, linked.</li><li><b>Keyboard</b>: a table of keys and what they do.</li>"
           "<li><b>Focus</b>: where focus starts, where it goes on close, what the ring looks like.</li><li><b>Labelling</b>: what needs a name, how it gets one, what is announced.</li>"
           "<li><b>Contrast</b>: the token pairs involved, with live ratios in both themes.</li><li><b>Motion</b>: what animates and what happens under reduced motion.</li>"
           "<li><b>Touch</b>: target sizes and the alternative to any hover-only affordance.</li></ol>"),
        ("usage", "Usage", ul([
            "Use the native element. A <code>div</code> with a click handler is a bug, not a variant.",
            "Do not remove the focus outline; if a design hides it, the design is wrong.",
            "Hide owner-only actions from Viewers instead of disabling them, and say why where it matters (<i>Read-only for Viewers</i>).",
            "Every new colour pairing is added to <code>contrast-pairs.json</code> before it ships.",
            "Live updates go through the one status announcer, not ad hoc <code>aria-live</code> regions per component."])),
        ("tokens", "Tokens", _plain_table(_A11Y_TOKENS)),
    ],
}


# ================================================================ CONTENT
_VERBS = [
    ("Start direction", "Starting…", "pages/new-direction/default"), ("Stop all workers", "Stopping 3 workers…", "dialogs/stop-workers/busy"),
    ("Delete project", "Deleting…", "dialogs/delete-project/busy"), ("Raise and resume", "Saving…", "dialogs/raise-budget/busy"),
    ("Create token", "Creating token…", "dialogs/worker-token/busy"), ("Revoke token", "Revoking…", "dialogs/revoke-worker/busy"),
    ("Add to allow list", "Adding…", "dialogs/add-user/busy"), ("Cancel direction", "Cancelling…", "dialogs/cancel-direction/busy"),
]
_ERRORS = [
    ("Load failed", "The pipeline couldn’t load", "Ledgerline’s stages didn’t load (timeout after 10 s). The run itself is unaffected and keeps going on quinn-mbp.local.", "pages/project-pipeline/error"),
    ("Action failed", "The budget wasn’t changed", "The API returned 409: another session changed this budget a moment ago. Reload it and try again.", "dialogs/raise-budget/failed"),
    ("Field invalid", "New budget", "New budget must be more than the $250.00 already spent.", "dialogs/raise-budget/invalid"),
    ("Typed confirmation", "Project name", "Type Harbor CRM exactly to delete it.", "dialogs/delete-project/invalid"),
    ("Connection", "Connection lost", "Connection lost. Retrying every 30 s; agents keep working and nothing is lost.", "notifications/connection-banner/danger"),
    ("Server error", "Mission Control hit a problem", "The page couldn’t be built. Your directions keep running on their workers; this only affects what you can see.", "pages/server-error/default"),
]
_EMPTIES = [
    ("First run", "No projects yet", "Describe a product in plain language. Hewn takes it from brief to merged pull requests without stopping to ask.", "New product", "pages/projects/empty"),
    ("Waiting on a stage", "No backlog yet", "The backlog is produced by stage 9, Estimates. Increments appear here, in journey order, as soon as estimates finish.", "Open the pipeline", "pages/backlog/empty"),
    ("No results", "No archived projects", "Archive a project you’ve finished with to keep this list short. Archived projects can be restored.", "Show all projects", "pages/projects/no-results"),
    ("Forbidden", "You don’t have access", "The audit log records who did what and from where, so only Owners can read it. Ask an Owner if you need an entry.", "Back to dashboard", "pages/audit/forbidden"),
]
_LIBRARY = [
    ("Primary action, new project", "New product", "pages/projects/default"),
    ("Primary action, form", "Start direction", "pages/new-direction/default"),
    ("Safe choice in a destructive dialog", "Keep running", "dialogs/stop-workers/default"),
    ("Dismiss without doing", "Not now", "dialogs/update-skills/default"),
    ("Retry", "Try again", "pages/dashboard/error"),
    ("Destructive confirmation title", "Delete Harbor CRM?", "dialogs/delete-project/default"),
    ("Consequence line", "Its directions, runs, decisions, events and spend history are deleted from Hewn. This can’t be undone.", "dialogs/delete-project/default"),
    ("Reassurance after failure", "Nothing was removed; try again.", "dialogs/delete-project/failed"),
    ("Toast, success", "Ledgerline #27 merged · Split a transaction · 62% complete", "notifications/live-toast/success"),
    ("Toast, warning", "Kiln Booking at 80% of budget · $200.00 of $250.00. It pauses at $250.00.", "notifications/live-toast/warning"),
    ("Loading line", "Loading live work…", "pages/dashboard/loading"),
    ("Reconnecting", "Reconnecting… next attempt in 10 s. Missed events will catch up from #48,213.", "notifications/connection-banner/warning"),
    ("Caught up", "Reconnected. Caught up 14 missed events, #48,200 to #48,213.", "notifications/connection-banner/success"),
    ("Saved", "Defaults saved", "pages/settings/success"),
    ("Read-only", "Read-only for Viewers", "pages/settings/viewer"),
    ("Error summary", "3 things to fix before Hewn can start", "pages/new-direction/invalid"),
    ("Sign-in headline", "Give it a direction. Get back merged code.", "pages/sign-in/default"),
    ("Access rule", "Only GitHub accounts on the allow list can sign in.", "pages/sign-in/default"),
    ("Not found", "That project isn’t here", "pages/not-found/default"),
]
_EMPTY_EX = (f'<div class="empty empty--tight" style="width: 100%;">{icon("inbox")}<div><h3 class="empty__title">No backlog yet</h3>'
             '<p class="empty__text">The backlog is produced by stage 9, Estimates. Increments appear here, in journey order, as soon as estimates finish.</p></div>'
             f'{btn("Open the pipeline", "", "sm")}</div>')
_ERROR_EX = (f'<div class="callout callout--danger" style="width: 100%;">{icon("x-circle")}<div class="callout__body-wrap"><p class="callout__title">The budget wasn’t changed</p>'
             '<p class="callout__body">The API returned 409: another session changed this budget a moment ago. Reload it and try again.</p>'
             f'<div class="callout__actions">{btn("Try again", "", "sm")}</div></div></div>')

SPECS["content"] = {
    "lead": "Hewn talks like a calm colleague who has the facts: what happened, to what, what it means for your work, and what to do next. Plain words, real numbers, sentence case.",
    "desc": "Hewn content rules: voice and tone, sentence case, button verbs, numbers, money, dates and times, error and empty-state formulas and the microcopy library.",
    "sections": [
        ("overview", "Overview", ul([
            "Mission Control reports on autonomous work. People open it to find out whether anything needs them, so copy leads with state and consequence: <i>Parcel Post is blocked. Requirements failed after 3 retries. Other projects keep running.</i>",
            "Every message names the real thing: the project, the stage, the PR number, the worker, the amount. No <i>item</i>, <i>resource</i> or <i>entity</i>.",
            "Reassure with facts, not adjectives: <i>Agents keep working; nothing is lost</i>, not <i>Don’t worry!</i>",
            "These rules are extracted from the mocks; where the mocks disagreed, the decision is noted here."])),
        ("voice", "Voice and tone", table(["We are", "So we write", "Not"], [
            ["Direct", "Stop all workers?", "Are you sure you want to proceed with stopping?"],
            ["Specific", "Kiln Booking at 80% of budget", "Budget warning"],
            ["Calm in failure", "The run itself is unaffected and keeps going on quinn-mbp.local.", "Error! Something went wrong."],
            ["Honest about limits", "This can’t be undone.", "Deleting is permanent and irreversible!!"],
            ["Plain", "Hewn takes it from brief to merged pull requests without stopping to ask.", "Leverage our AI-powered end-to-end delivery pipeline."]])
         + ul(["Second person for the reader, <i>Hewn</i> for the product, and the agent's name only when it matters (<i>the agent answers it and records the answer here</i>).",
               "No exclamation marks, no emoji, no jokes in errors.",
               "Contractions are fine (<i>couldn’t</i>, <i>isn’t</i>); use the typographic apostrophe ’ and ellipsis …."])),
        ("casing", "Sentence case", ul([
            "Everything is sentence case: page titles (<i>New direction</i>), buttons (<i>Raise and resume</i>), tabs (<i>Design system</i>), dialog titles (<i>Raise Kiln Booking’s budget</i>), table heads (<i>Last sign-in</i>).",
            "Proper nouns keep their capitals: Hewn, Mission Control, GitHub, Magic Patterns, Greenlit, Owner and Viewer (roles), and project names (Ledgerline, Harbor CRM).",
            "No all caps, including the sidebar's section labels and overlines; the overline role gives emphasis by weight and size.",
            "Stage names are sentence case after their number: <i>Stage 3 · Design system</i>, <i>10 · Increments</i>."])),
        ("verbs", "Buttons and verbs", "<p>Buttons are verb first and name the object when the context does not. Busy buttons switch to the progressive form with an ellipsis and keep focus.</p>"
         + table(["Button", "While busy", "Mock"], [[f"<i>{a}</i>", f"<i>{b}</i>", mock(m)] for a, b, m in _VERBS])
         + ul(["Never <i>OK</i>, <i>Yes</i>, <i>Submit</i> or <i>Confirm</i>: the button says what happens.",
               "The safe choice in a destructive dialog says what is kept: <i>Keep running</i>, not <i>Cancel</i> (which would be ambiguous in <i>Cancel direction</i>).",
               "<i>Cancel</i> closes a form without saving; <i>Cancel direction</i> stops work. Do not use bare <i>Cancel</i> where it could mean either.",
               "Links say where they go: <i>Open the pipeline</i>, <i>Back to projects</i>, <i>Open log</i>."])),
        ("numbers", "Numbers, money, dates and times", table(["Kind", "Format", "Examples from the mocks"], [
            ["Money", "Dollar sign, two decimals, always; <i>of</i> between spend and budget.", "$184.20 of $400.00 · $86.40 today · $512.70 this week"],
            ["Percent", "Digits and %, no space.", "62% complete · at 80% of budget"],
            ["Counts", "Digits, thousands separated by commas; the noun agrees.", "1 thing to fix · 3 things to fix · 46 mocks · #48,213"],
            ["Long date", "Weekday, day, month, year; no commas, no ordinals.", "Monday 9 November 2026"],
            ["Short date and time", "Day, short month, year, then 24-hour time.", "9 Nov 2026, 14:31:07 (audit) · 8 Nov at 17:01"],
            ["Time of day", "24-hour, no seconds unless it is a log or audit entry.", "14:31 · Paused by quinntynebrown at 14:29"],
            ["Relative time", "Number, space, unit, <i>ago</i>; switch to a date after a day.", "12 s ago · 14 min ago · 2 h ago · Yesterday"],
            ["Durations and limits", "Number, space, unit.", "timeout after 10 s · resets in 2 min · Retrying every 30 s"],
            ["Ids and hashes", "Mono, exactly as the system has them.", "wk-7f3a · 5a1fe37 · L2-014 · PR #28"]])
         + ul(["“Today” is Monday 9 November 2026 in every mock; times cluster around 14:31.",
               "Use digits for all numbers in UI copy, including one to nine (<i>3 retries</i>, <i>Increment 7 of 12</i>).",
               "Amounts that change in place use tabular figures.",
               "Some mocks mix formats (<i>4s ago</i> and <i>18m ago</i> in Projects and Workers, <i>Today, 08:02 AM</i> in Settings, whole-dollar <i>$300</i> in a hint). The rules above win: <i>4 s ago</i>, <i>18 min ago</i>, <i>Today, 08:02</i>, <i>$300.00</i>."])),
        ("errors", "Error messages", f"""<p><b>Formula:</b> what failed (title) + why, with the real cause and code if known + what is still fine + what to do. Field errors: what is wrong + how to fix it, in one sentence.</p>
{ex(_ERROR_EX, "From " + mock("dialogs/raise-budget/failed") + ".")}
{table(["Kind", "Title", "Body", "Mock"], [[k, f"<i>{t}</i>", b, mock(m)] for k, t, b, m in _ERRORS])}
{ul(["Titles are past tense and name the thing: <i>Projects couldn’t load</i>, <i>Harbor CRM wasn’t deleted</i>.",
     "Give the real cause when you have it (<i>GitHub returned 502</i>, <i>timeout after 10 s</i>); it helps the Owner decide whether to wait or act.",
     "Always say what is unaffected: agents and runs keep going when only the view failed.",
     "Never blame the reader; never say <i>invalid</i> alone. Say what valid looks like: <i>Worker name must be 3–40 lowercase letters, digits or hyphens.</i>"])}"""),
        ("empty-states", "Empty states", f"""<p><b>Formula:</b> what is not here yet (title) + why, or what will fill it and when + one action, if there is one the reader can take.</p>
{ex(_EMPTY_EX, "From " + mock("pages/backlog/empty") + ".")}
{table(["Kind", "Title", "Text", "Action", "Mock"], [[k, f"<i>{t}</i>", x, f"<i>{a}</i>", mock(m)] for k, t, x, a, m in _EMPTIES])}
{ul(["First-run empties explain what the thing is and how it gets filled; they do not apologise.",
     "No-results empties say which filter is on and offer to clear it.",
     "Forbidden empties say who can see it and how to get access, without revealing what is there.",
     "Viewers get the same empty without the action they cannot take."])}"""),
        ("library", "Microcopy library", "<p>Common strings, verbatim from the mocks. Reuse them before writing new ones.</p>"
         + table(["Situation", "Copy", "Mock"], [[s, f"<i>{c}</i>", mock(m)] for s, c, m in _LIBRARY])),
        ("usage", "Usage", ul([
            "Write the state first, then the consequence, then the action.",
            "One idea per sentence; two sentences in a toast, three in a dialog body.",
            "Keep button labels to three words; a label that wraps at 360px is too long.",
            "Use the cast and numbers from the mocks in examples and tests so screenshots stay comparable.",
            "When a message is announced (toast, live status), make the first words carry it: <i>Parcel Post is blocked</i>."])),
        ("accessibility", "Accessibility", ul([
            "<b>2.4.4 / 2.4.9:</b> link and button text makes sense out of context; repeated <i>Open</i> links carry the object in their accessible name (<i>Open Live run</i>).",
            "<b>3.3.1 / 3.3.3:</b> errors name the field and the fix; summaries count the problems (<i>3 things to fix</i>).",
            "<b>2.4.2:</b> every page title is unique: page, then state if any, then Hewn.",
            "<b>4.1.3:</b> announced text is short and self-contained, because screen readers read it without its surroundings.",
            "Plain language helps everyone, including people using translation and people under stress during an outage."])),
        ("tokens", "Tokens", NA("Content has no tokens. Type roles for copy are on Typography; this page sets the words.")),
    ],
}
