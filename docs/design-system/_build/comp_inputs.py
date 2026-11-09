"""Component specs: Inputs (text field, textarea, select, checkbox, radio group, switch, form field, form layout).

Live examples use only assets/components.css classes. Ids are generated with _uid() so they are unique on a
page, and _themes() renames ids, names and fragment links in the dark copy so radio groups and labels keep
working when the same markup is shown in both themes.
"""
import re

from common import (NA, anatomy, btn, code, dodont, ex, icon, icon_btn, kbd, matrix, mock, page, themes, ul)

SPECS = {}

# ============================================================== shared helpers
_COUNTS = {}


def _uid(prefix):
    _COUNTS[prefix] = _COUNTS.get(prefix, 0) + 1
    return f"{prefix}-{_COUNTS[prefix]}"


_ATTR = re.compile(r'\b(id|for|name|aria-describedby|aria-labelledby|aria-controls)="([^"]+)"')
_FRAG = re.compile(r'href="#([^"]+)"')


def _dk(m):
    vals = " ".join(v + "-dk" for v in m.group(2).split())
    return m.group(1) + '="' + vals + '"'


def _themes(html, stack=True):
    """themes() with the dark copy's ids, names and fragment links suffixed, so both copies stay valid."""
    out = themes(html, stack)
    head, sep, dark = out.partition('<div data-theme="dark">')
    local = set(re.findall(r'\bid="([^"]+)"', dark))
    dark = _ATTR.sub(_dk, dark)
    dark = _FRAG.sub(lambda m: 'href="#' + m.group(1) + ('-dk"' if m.group(1) in local else '"'), dark)
    return head + sep + dark


_ERR_ICON = icon("alert-circle", "icon--sm")
_OK_ICON = icon("check-circle", "icon--sm")


def fld(label, ctrl, hint="", err="", ok="", counter="", opt=False, p="f", label_extra=""):
    """A .field. ctrl uses @ID for the control id and @A where aria-describedby / aria-invalid go."""
    fid = _uid(p)
    ids, help_html = [], ""
    if err:
        ids.append(fid + "-err")
        help_html += f'<span class="field__error" id="{fid}-err">{_ERR_ICON}{err}</span>'
    elif ok:
        ids.append(fid + "-ok")
        help_html += f'<span class="field__success" id="{fid}-ok">{_OK_ICON}{ok}</span>'
    if hint and not err:
        ids.append(fid + "-hint")
        help_html += f'<span class="field__hint" id="{fid}-hint">{hint}</span>'
    if counter:
        ids.append(fid + "-count")
        help_html += f'<span class="field__counter" id="{fid}-count">{counter}</span>'
    attrs = (' aria-describedby="' + " ".join(ids) + '"' if ids else "") + (' aria-invalid="true"' if err else "")
    ctrl = ctrl.replace("@ID", fid).replace("@A", attrs)
    o = ' <span class="optional">(optional)</span>' if opt else ""
    return (f'<div class="field"><label class="field__label" for="{fid}">{label}{o}{label_extra}</label>'
            f'<div class="field__control">{ctrl}</div>{help_html}</div>')


def _cell(html, w="11rem"):
    return f'<div style="min-width: {w};">{html}</div>'


def _box(html, w="24rem"):
    return f'<div style="width: 100%; max-width: {w};">{html}</div>'


_MONEY = '<div class="prefix prefix--money"><span class="prefix__sym" aria-hidden="true">$</span><input class="input" id="@ID" inputmode="decimal" value="{v}"@A></div>'


def _money(v):
    return _MONEY.replace("{v}", v)


_IN_USD = '<span class="visually-hidden"> in US dollars</span>'

# ============================================================== text field
_TF_NAME = fld("Name", '<input class="input" id="@ID" value="Ledgerline" autocomplete="off"@A>', "1–100 characters, unique among your projects", p="tf")
_TF_BUDGET = fld("Budget", _money("400.00"), "Pauses at 100%, warns at 80%. Project default is $300.", p="tf", label_extra=_IN_USD)
_TF_LOGIN = fld("GitHub login", '<div class="prefix"><span class="prefix__sym" aria-hidden="true">@</span><input class="input" id="@ID" value="nadia-k" autocomplete="off" autocapitalize="off" spellcheck="false"@A></div>',
                "They sign in with this GitHub account.", p="tf")
_TF_MONO = fld("Worker name", '<input class="input mono" id="@ID" value="hewn-cloud-eus-03" autocomplete="off" autocapitalize="off" spellcheck="false"@A>',
               "Shown on the Workers page and in the audit log.", p="tf")
_TF_UNIT = fld("Descope threshold", '<div class="cluster"><input class="input" style="width: 6rem;" id="@ID" inputmode="numeric" value="3"@A><span class="text-sm text-muted">ideal days</span></div>',
               "Designs estimated above this are split, or deferred with a reason.", p="tf")
_TF_SEARCH = ('<div class="prefix prefix--search">' + icon("search", "icon--sm") +
              '<input class="input input--sm" type="search" aria-label="Find an L2" placeholder="L2-018 or a title"></div>')
_TF_SECRET_ID = _uid("tf")
_TF_SECRET = (f'<div class="field"><label class="field__label" for="{_TF_SECRET_ID}">Anthropic API key</label><div class="field__control"><div class="suffix">'
              f'<input class="input mono" id="{_TF_SECRET_ID}" type="password" value="sk-ant-api03-ledgerline" autocomplete="off" spellcheck="false" aria-describedby="{_TF_SECRET_ID}-hint">'
              f'<button class="btn btn--link suffix__btn" type="button" aria-controls="{_TF_SECRET_ID}" aria-label="Show API key">Show</button></div></div>'
              f'<span class="field__hint" id="{_TF_SECRET_ID}-hint">Encrypted at rest. Hewn never shows it again after you save.</span></div>')

_TF_VARIANTS = ('<div class="stack" style="width: 100%; max-width: 28rem; gap: var(--space-6);">'
                + _TF_NAME + _TF_BUDGET + _TF_LOGIN + _TF_MONO + _TF_UNIT + _TF_SECRET + "</div>")


def _tf_row(label, value, ph=""):
    v = f' value="{value}"' if value else ""
    phs = f' placeholder="{ph}"' if ph else ""
    a = f' aria-label="{label}"'
    c = lambda extra: _cell(f'<input class="input"{a}{v}{phs}{extra}>')
    return (label, [c(""), c(' data-state="hover"'), c(' data-state="focus"'), c(' aria-invalid="true"'), c(" readonly"), c(" disabled")])


def _money_row():
    def c(extra):
        return _cell(f'<div class="prefix prefix--money"><span class="prefix__sym" aria-hidden="true">$</span><input class="input" aria-label="Budget in US dollars" inputmode="decimal" value="400.00"{extra}></div>')
    return ("Money prefix", [c(""), c(' data-state="hover"'), c(' data-state="focus"'), c(' aria-invalid="true"'), c(" readonly"), c(" disabled")])


_TF_MATRIX = matrix(["Default", "Hover", "Focus", "Invalid", "Read-only", "Disabled"],
                    [_tf_row("Filled", "Ledgerline"), _tf_row("Placeholder", "", "https://github.com/owner/repo"), _money_row()])
_TF_THEMES = _themes(_TF_NAME.replace("tf-1", "tf-th1") + fld("Name", '<input class="input" id="@ID" value="Field Notes" autocomplete="off"@A>', err="Name is already used by another project. Pick a different name.", p="tf")
                     + _TF_BUDGET.replace("tf-2", "tf-th2"))
_TF_STATE_NOTES = ul([
    "<b>Invalid</b> is <code>aria-invalid=\"true\"</code> plus a message: the ring thickens to 2px <code>--field-invalid</code> and the " + page("components/form-field", "field") + "'s error replaces the hint. Colour is never the only signal.",
    "<b>Read-only</b> (<code>readonly</code>) is used while a form submits and for Viewers: the value stays focusable, selectable and announced, on <code>--color-bg-subtle</code>. Prefer it to <code>disabled</code>, which removes the value from the tab order, the screen reader's form list and the submission.",
    "<b>Disabled</b> is for a control that cannot apply at all in this context; say why next to it.",
    "<b>Active</b> has no distinct look: pressing an input focuses it, so it shows the focus ring. <b>Hover</b> darkens the edge to <code>--color-fg-muted</code>."])

SPECS["text-field"] = {
    "lead": "Text fields take one line of input: a project name, a GitHub login, a budget, a worker name, a search term.",
    "readme_variants": "text, money prefix, @ prefix, mono, with unit, search, secret with reveal",
    "readme_states": "default, hover, focus, invalid, read-only, disabled, placeholder",
    "pills": ["Native <code>&lt;input&gt;</code>"],
    "overview": f"""<p>Use a text field for a short, free-form value the person types. It always sits inside a {page('components/form-field', 'form field')} that gives it a visible label, a hint and room for an error. Use a {page('components/textarea')} when the text can run to several lines (an idea, a feature), a {page('components/select')} or {page('components/radio-group', 'radio group')} when the answer comes from a fixed list, and a {page('components/switch')} for an on/off setting.</p>
{ul(["<b>Text</b>: names and free text (<i>Name</i>, <i>Stack</i>, <i>Existing repository</i>).",
     "<b>Money prefix</b> (<code>.prefix.prefix--money</code>): budgets. A fixed <code>$</code> sits inside the field; the value is <code>inputmode=&quot;decimal&quot;</code> with two decimals.",
     "<b>@ prefix</b> (<code>.prefix</code>): GitHub logins, so people do not type the @ themselves.",
     "<b>Mono</b> (<code>.input.mono</code>): machine identifiers that are copied character for character (worker names, repository paths).",
     "<b>With unit</b>: a short number with its unit as text after it (<i>3 ideal days</i>).",
     "<b>Search</b> (<code>.prefix.prefix--search</code>, <code>type=&quot;search&quot;</code>): filters a list in place, like the requirement list on Traceability.",
     "<b>Secret with reveal</b> (<code>.suffix</code>): API keys and webhook secrets, masked, with a Show button."])}
<p>Numbers are typed into <code>type="text"</code> with <code>inputmode</code>, not <code>type="number"</code>: number inputs drop the trailing zeros in <i>400.00</i>, change value on scroll and spin buttons, and announce inconsistently.</p>""",
    "anatomy": (_box(fld("Budget", _money("400.00"), "Pauses at 100%, warns at 80%.", p="tf")),
                [(14, 22), (14, 46), (32, 46), (46, 46), (49, 66)],
                [("Label", "<code>.field__label</code>, <code>--text-label</code>, <code>--color-fg-default</code>; a <code>&lt;label for&gt;</code>."),
                 ("Prefix (optional)", "<code>.prefix__sym</code>, <code>--color-fg-subtle</code>, <code>aria-hidden</code>; the input's left padding grows to <code>--space-6</code>."),
                 ("Value", "<code>--text-body-sm</code> in <code>--field-fg</code>; tabular figures in money fields."),
                 ("Container", "Height <code>--control-height-md</code>, <code>--radius-md</code>, 1px inset ring <code>--field-border</code> on <code>--field-bg</code>; padding <code>--space-3</code>."),
                 ("Hint or error", "<code>.field__hint</code> (<code>--text-caption</code>, <code>--color-fg-subtle</code>) or <code>.field__error</code>, linked with <code>aria-describedby</code>.")]),
    "variants": f"""<p>Variants change what the field accepts, not how loud it is. All of them share the container, states and sizes.</p>
{ex(_TF_VARIANTS, "Text, money prefix, @ prefix, mono, with unit and secret with reveal, with the copy used in New direction, Settings and the dialogs.", cls="ds-example__canvas--stack")}
<h3>Search</h3>
{ex(_box(_TF_SEARCH, "18rem"), "Small search field from the Traceability rail. The icon is decorative; the field is named with <code>aria-label</code> because the rail heading already says what is searched.")}""",
    "sizes": f"""<p>Medium (40px) is the default for every form. Small (32px) is for filters and rails next to small buttons; large (48px) is for a single prominent field such as a confirmation on a phone.</p>
{ex('<div class="stack" style="width: 100%; max-width: 22rem;"><input class="input input--sm" aria-label="Small, 32px" value="Small · 32px"><input class="input" aria-label="Medium, 40px" value="Medium · 40px"><input class="input input--lg" aria-label="Large, 48px" value="Large · 48px"></div>',
    "Heights <code>--control-height-sm/md/lg</code>; large also steps the value up to <code>--text-body</code>.", cls="ds-example__canvas--stack")}""",
    "states": f"""<p>Pointer and focus states are forced with <code>data-state</code>; in the product they come from <code>:hover</code> and <code>:focus-visible</code>. Invalid, read-only and disabled use the real attributes.</p>
{_TF_MATRIX}
{_TF_THEMES}
{_TF_STATE_NOTES}""",
    "responsive": ul([
        "Mobile first, fields fill their column at every breakpoint; the column stops at <code>--layout-form-max</code> (42rem) in <code>.form-col</code> and at the dialog width in dialogs.",
        "Below <code>--layout-breakpoint-sm</code> (36rem) every field is one column; from sm, short related fields pair up in <code>.form-grid--2</code> (Stack and Existing repository).",
        "Money fields keep a fixed 10rem (<code>.prefix--money</code>) and unit fields 6rem at every size, so the number never stretches across a desktop column.",
        "From <code>--layout-breakpoint-lg</code> (62rem) the Traceability search moves into the 17rem rail; below lg it sits above the requirement strip at full width.",
        "Height stays 40px on phones; the label is part of the target, so the tap area is label + field."]),
    "theming": """<p>The field reads component tokens set on <code>.field</code>: <code>--field-bg</code>, <code>--field-fg</code>, <code>--field-border</code>, <code>--field-ring</code> and <code>--field-invalid</code>. A theme changes the semantic tokens underneath; a local re-skin overrides the component tokens on a wrapper.</p>
<pre><code>/* Fields on a sunken panel keep their contrast */
.panel--sunken .field { --field-bg: var(--color-bg-surface-raised); }</code></pre>
<p>In dark the field is a step above the canvas (<code>--color-bg-surface</code>), its edge is the lighter <code>--color-border-strong</code> and the invalid ring is the dark-theme red icon colour, all at 3:1 or more.</p>""",
    "a11y": {
        "pattern": "<p>Native <code>&lt;input&gt;</code> with a visible <code>&lt;label for&gt;</code>; there is no APG widget pattern for a text box, so follow the <a href=\"https://www.w3.org/WAI/tutorials/forms/labels/\">W3C forms tutorial on labels</a> and <a href=\"https://www.w3.org/WAI/tutorials/forms/instructions/\">instructions</a>. Search fields are <code>type=\"search\"</code> inside a <code>role=\"search\"</code> region when they filter the whole page.</p>",
        "keys": [(kbd("Tab") + " / " + kbd("Shift", "Tab"), "Moves into and out of the field."),
                 (kbd("Enter"), "Submits the form the field belongs to (single-line fields only)."),
                 (kbd("Esc"), "In <code>type=\"search\"</code> clears the query; inside a dialog it closes the dialog."),
                 (kbd("Space") + " / " + kbd("Enter") + " on Show", "Reveals or masks the secret; focus stays on the button.")],
        "focus": "<p>Focus replaces the 1px edge with a 2px inset <code>--field-ring</code>, so the ring is never clipped by a scrolling dialog. A focused invalid field currently keeps only the red ring; the fix (an outer focus ring around the red one) is logged for components.css. Focus is never moved into a field automatically except to the first invalid field from the error summary link.</p>",
        "labelling": "<p>Every field has a visible label; placeholders are examples, never the label. Hints, errors and counters are linked with <code>aria-describedby</code> in that order (error first). Prefix symbols are <code>aria-hidden</code>, so the label carries the unit: <i>Budget</i> gets a visually hidden <i>in US dollars</i>. Optional fields say <i>(optional)</i> in the label; required ones are the default and carry <code>required</code> with the form set to <code>novalidate</code>. Add <code>autocomplete</code> tokens for personal data and <code>autocomplete=\"off\"</code> plus <code>spellcheck=\"false\"</code> for identifiers.</p>",
        "pairs": [("Value on field", "--color-fg-default", "--color-bg-surface", 4.5), ("Placeholder and prefix", "--color-fg-subtle", "--color-bg-surface", 4.5),
                  ("Edge on surface", "--color-border-strong", "--color-bg-surface", 3), ("Edge on canvas", "--color-border-strong", "--color-bg-canvas", 3),
                  ("Edge in dialogs", "--color-border-strong", "--color-bg-surface-raised", 3), ("Focus ring", "--color-focus-ring", "--color-bg-surface", 3),
                  ("Invalid ring", "--color-danger-icon", "--color-bg-surface", 3), ("Read-only value", "--color-fg-muted", "--color-bg-subtle", 4.5)],
        "motion": "<p>The edge changes over <code>--duration-fast</code> with <code>--ease-standard</code>; reduced motion zeroes it in the tokens. Nothing else moves.</p>",
        "touch": "<p>40px fields with the label as part of the target. <code>inputmode=\"decimal\"</code> and <code>\"numeric\"</code> bring up number keypads; <code>autocapitalize=\"off\"</code> stops phones capitalising logins and worker names. Value text is 14px; iOS zooms into fields under 16px, so the product steps fields to <code>--text-body</code> below lg (logged for components.css).</p>",
    },
    "content": ul(["Labels are nouns in sentence case with no colon: <i>Name</i>, <i>Existing repository</i>, <i>Default budget per direction</i>.",
                   "Hints state the rule or the default: <i>1–100 characters, unique among your projects</i>, <i>Default: .NET backend, Angular frontend</i>.",
                   "Placeholders show an example value only (<i>.NET + Angular</i>) and never carry information the person needs after typing.",
                   "Errors say what is wrong and how to fix it, naming numbers: <i>Default budget must be between $10.00 and $10,000.00.</i>",
                   "Money always shows two decimals and a thousands separator: <i>$10,000.00</i>."]),
    "dodont": [
        (_box(fld("Existing repository", '<input class="input" id="@ID" placeholder="https://github.com/owner/repo"@A>', "Leave empty and Hewn creates hewn-builds/ledgerline.", opt=True, p="tf")),
         "The hint says what happens when the field is left empty; the placeholder only shows the format.",
         _box(fld("Existing repository", '<input class="input" id="@ID" placeholder="Creates hewn-builds/ledgerline"@A>', "https://github.com/{owner}/{repo}", opt=True, p="tf")),
         "New direction put the behaviour in the placeholder, so it disappears as soon as someone types, and screen readers may skip it."),
        (_box(fld("Default budget per direction", _money("5.00"), err="Default budget must be between $10.00 and $10,000.00.", p="tf", label_extra=_IN_USD)),
         "The error names the range in the same format the field takes.",
         _box(fld("Default budget per direction", _money("5.00"), err="Default budget is out of range.", p="tf", label_extra=_IN_USD)),
         "The Settings error summary said <i>out of range</i> without the range; the person has to guess."),
    ],
    "tokens": [("Background", "--color-bg-surface"), ("Value", "--color-fg-default"), ("Placeholder, prefix and search icon", "--color-fg-subtle"),
               ("Edge / hover edge", "--color-border-strong / --color-fg-muted"), ("Focus ring", "--color-focus-ring"), ("Invalid ring", "--color-danger-icon"),
               ("Read-only and disabled background", "--color-bg-subtle"), ("Disabled value / edge", "--color-fg-disabled / --color-border-default"),
               ("Ring widths", "--border-width-hairline / --border-width-thick"), ("Height sm / md / lg", "--control-height-sm / --control-height-md / --control-height-lg"),
               ("Padding / prefix padding / search padding", "--space-3 / --space-6 / --space-8"), ("Radius", "--radius-md"), ("Value type", "--text-body-sm"),
               ("Transition", "--duration-fast / --ease-standard")],
    "code": {"snippet": """<div class="field">
  <label class="field__label" for="budget">Budget<span class="visually-hidden"> in US dollars</span></label>
  <div class="field__control">
    <div class="prefix prefix--money">
      <span class="prefix__sym" aria-hidden="true">$</span>
      <input class="input" id="budget" inputmode="decimal" value="400.00" aria-describedby="budget-hint">
    </div>
  </div>
  <span class="field__hint" id="budget-hint">Pauses at 100%, warns at 80%. Project default is $300.</span>
</div>
<input class="input" id="name" value="Field Notes" aria-invalid="true" aria-describedby="name-err">""",
             "classes": [("<code>.input</code>", "Base single-line field, 40px, full width."),
                         ("<code>.input--sm</code> <code>.input--lg</code>", "32px / 48px."),
                         ("<code>.input.mono</code>", "Monospace value for identifiers."),
                         ("<code>.prefix</code> + <code>.prefix__sym</code>", "Fixed symbol inside the field (@, $)."),
                         ("<code>.prefix--money</code>", "10rem wide, tabular figures."),
                         ("<code>.prefix--search</code>", "Leading search icon; pair with <code>type=\"search\"</code>."),
                         ("<code>.suffix</code> + <code>.suffix__btn</code>", "Trailing button inside the field (Show)."),
                         ("<code>aria-invalid=\"true\"</code>", "Invalid ring; pair with a <code>.field__error</code>."),
                         ("<code>readonly</code> / <code>disabled</code>", "Read-only (focusable) / disabled (not focusable)."),
                         ("<code>data-state=\"hover|focus\"</code>", "Documentation only: forces a state.")]},
    "sources": {"mocks": [("pages/new-direction/default", "name, stack, repository, budget"), ("pages/new-direction/invalid", "three invalid fields"),
                          ("pages/new-direction/submitting", "read-only while submitting"), ("pages/settings/default", "default budget, threshold with unit"),
                          ("pages/settings/viewer", "read-only for Viewers"), ("dialogs/add-user/default", "@ prefix"), ("dialogs/worker-token/invalid", "mono, invalid"),
                          ("dialogs/delete-project/confirm", "type to confirm"), ("pages/traceability/default", "search")],
                "drift": "the threshold field's width was an inline <code>style=\"width: 6rem\"</code> (a <code>.input--narrow</code> class is requested); the repository hint and placeholder were swapped; money fields named no currency for screen readers; the Traceability search wrapped its label around the icon with <code>style=\"display:block\"</code>."},
}

# ============================================================== textarea
_IDEA = ("A web app for small accounting teams (2–10 people) to reconcile bank and card statements against receipts. Connect a bank feed "
         "or import a CSV, match each transaction to a receipt photo, split transactions across categories, and close a month once a second "
         "person reviews it. Export the closed period to the general ledger.")
_FEATURE = "Add a CSV export to the shift report so supervisors can open it in Excel. One row per shift, with crew, hours and incidents."
_TA_IDEA = fld("Idea", f'<textarea class="textarea" id="@ID" rows="7"@A>{_IDEA}</textarea>', "Who it is for, what they do with it and what “done” looks like.", counter="323 of 20,000 characters", p="ta")
_TA_FEATURE = fld("Feature", f'<textarea class="textarea" id="@ID" rows="4"@A>{_FEATURE}</textarea>', counter="124 of 20,000 characters", p="ta")
_TA_AUTO = fld("Note for the reviewer", '<textarea class="textarea" id="@ID" rows="2" style="field-sizing: content; max-height: 20rem;"@A>Second person reviews the March close.</textarea>',
               "Grows with the text up to 20rem, then scrolls.", opt=True, p="ta")


def _ta_row(label, value):
    def c(extra):
        return _cell(f'<textarea class="textarea" rows="2" aria-label="{label}"{extra}>{value}</textarea>', "12rem")
    return (label, [c(""), c(' data-state="hover"'), c(' data-state="focus"'), c(' aria-invalid="true"'), c(" readonly"), c(" disabled")])


_TA_MATRIX = matrix(["Default", "Hover", "Focus", "Invalid", "Read-only", "Disabled"], [_ta_row("Idea", "Expenses")])
_TA_THEMES = _themes(fld("Idea", '<textarea class="textarea" id="@ID" rows="3"@A>Expenses</textarea>', err="The idea must be 10 to 20,000 characters. This one has 8.", p="ta")
                     + fld("Feature", f'<textarea class="textarea" id="@ID" rows="3"@A>{_FEATURE}</textarea>', counter="124 of 20,000 characters", p="ta"))

SPECS["textarea"] = {
    "lead": "Textareas take the long text Hewn builds from: the idea for a new product and the feature for an existing one.",
    "readme_variants": "fixed rows (4, 7), with counter, auto-grow",
    "readme_states": "default, hover, focus, invalid, read-only, disabled",
    "pills": ["Native <code>&lt;textarea&gt;</code>"],
    "overview": f"""<p>Use a textarea when the answer is prose that can run to several lines. In Hewn that text is the direction itself: everything downstream (brief, mocks, requirements, increments) is generated from it, so the field is generous, keeps what was typed through every failure, and shows how much room is left. For a single line use a {page('components/text-field', 'text field')}.</p>
{ul(["<b>Idea</b>: 7 rows for a new product, with a counter against the 20,000-character limit.",
     "<b>Feature</b>: 4 rows for a feature on an existing product.",
     "<b>Auto-grow</b>: <code>field-sizing: content</code> grows the box with its text up to a cap, for short optional notes. Browsers without support keep the fixed rows."])}""",
    "anatomy": (_box(fld("Feature", f'<textarea class="textarea" id="@ID" rows="3"@A>{_FEATURE}</textarea>', counter="124 of 20,000 characters", p="ta"), "26rem"),
                [(8, 10), (50, 45), (96, 74), (88, 92)],
                [("Label", "<code>.field__label</code>, a <code>&lt;label for&gt;</code>."),
                 ("Text area", "<code>.textarea</code>: <code>--space-3</code> padding, <code>--line-height-relaxed</code>, at least two control heights tall."),
                 ("Resize handle", "Vertical only (<code>resize: vertical</code>); the width follows the column."),
                 ("Counter", "<code>.field__counter</code>: right-aligned, tabular, <code>--text-caption</code>; linked with <code>aria-describedby</code>.")]),
    "variants": f"""{ex(_box(_TA_IDEA + '<div class="mt-6"></div>' + _TA_FEATURE + '<div class="mt-6"></div>' + _TA_AUTO, "36rem"), "Idea (7 rows, hint and counter), Feature (4 rows) and an auto-growing optional note.", cls="ds-example__canvas--stack")}""",
    "sizes": f"""<p>One height of type; the size is the number of visible rows. Use <code>rows="7"</code> for an idea, <code>rows="4"</code> for a feature, and never fewer than 2 (<code>min-height</code> is two control heights). Width always follows the column.</p>
{ex(_box('<div class="stack"><textarea class="textarea" rows="2" aria-label="Two rows">2 rows: the minimum</textarea><textarea class="textarea" rows="4" aria-label="Four rows">4 rows: a feature</textarea><textarea class="textarea" rows="7" aria-label="Seven rows">7 rows: an idea</textarea></div>', "30rem"), "Rows 2, 4 and 7.", cls="ds-example__canvas--stack")}""",
    "states": f"""<p>The same states as the {page('components/text-field', 'text field')}, from the same classes.</p>
{_TA_MATRIX}
{_TA_THEMES}
{ul(["<b>Read-only</b> while the direction is queuing: the text stays selectable and is read in full by screen readers, and the person can scroll it.",
     "<b>Invalid</b> shows the count in the error (<i>This one has 8.</i>), so the counter is replaced rather than repeated.",
     "<b>Counter</b> updates as the person types and is announced politely, debounced to 500 ms, only within the last 10% of the limit; elsewhere it is read on focus through <code>aria-describedby</code>."])}""",
    "responsive": ul([
        "Full column width at every breakpoint; the column caps at <code>--layout-form-max</code>.",
        "Rows do not change with the viewport: 7 rows is about 13rem on a phone and stays readable without scrolling the page.",
        "Below sm the resize handle is still available, but the field also scrolls internally; the page never scrolls sideways.",
        "From lg the New direction form sits beside the 20rem plan rail (<code>.split--form</code>); the textarea does not widen past the form column."]),
    "theming": "<p>Shares the field component tokens (<code>--field-bg</code>, <code>--field-fg</code>, <code>--field-border</code>, <code>--field-ring</code>, <code>--field-invalid</code>). Long text sits on <code>--color-bg-surface</code> with <code>--line-height-relaxed</code> in both themes so a 300-word idea stays comfortable to proofread in dark.</p>",
    "a11y": {
        "pattern": "<p>Native <code>&lt;textarea&gt;</code> with a visible <code>&lt;label for&gt;</code>; see the <a href=\"https://www.w3.org/WAI/tutorials/forms/labels/\">W3C forms tutorial</a>. Do not replace it with a <code>contenteditable</code> region.</p>",
        "keys": [(kbd("Tab") + " / " + kbd("Shift", "Tab"), "Moves into and out of the textarea; Tab never inserts a tab character."),
                 (kbd("Enter"), "Inserts a new line. It never submits the form."),
                 (kbd("Esc"), "No effect in the field; inside a dialog it closes the dialog, so dialogs with a textarea confirm before discarding text.")],
        "focus": "<p>2px inset <code>--field-ring</code>, the same as text fields. After a failed submit (<i>Hewn couldn’t queue this direction</i>) focus goes to the alert, not the textarea, and the text is kept.</p>",
        "labelling": "<p>Visible label; the hint says what to write; the counter is linked after the hint in <code>aria-describedby</code> so it is read on focus. Over the limit, the field is <code>aria-invalid</code> and the error states the count.</p>",
        "pairs": [("Text on field", "--color-fg-default", "--color-bg-surface", 4.5), ("Counter and hint on canvas", "--color-fg-subtle", "--color-bg-canvas", 4.5),
                  ("Edge on canvas", "--color-border-strong", "--color-bg-canvas", 3), ("Focus ring", "--color-focus-ring", "--color-bg-surface", 3),
                  ("Invalid ring", "--color-danger-icon", "--color-bg-surface", 3), ("Read-only text", "--color-fg-muted", "--color-bg-subtle", 4.5)],
        "motion": "<p>Edge transition over <code>--duration-fast</code>, zeroed under reduced motion. Auto-grow changes height instantly.</p>",
        "touch": "<p>The field is at least 80px tall; a phone keyboard covers part of the screen, so the form keeps the textarea's label in view with <code>scroll-padding-top</code>. Autocorrect and spellcheck stay on for prose.</p>",
    },
    "content": ul(["Label with the noun the person is writing: <i>Idea</i>, <i>Feature</i>.",
                   "Hint says what a good answer contains, not that the field is required.",
                   "Counter format: <i>323 of 20,000 characters</i>, tabular, with a thousands separator.",
                   "Errors give the limit and the current count: <i>The idea must be 10 to 20,000 characters. This one has 8.</i>",
                   "After a failure, say the text is safe: <i>Nothing was created; your text is kept below.</i>"]),
    "dodont": [
        (_box(fld("Idea", '<textarea class="textarea" id="@ID" rows="3"@A>Reconcile bank and card statements against receipts.</textarea>', "Who it is for and what they do with it.", counter="54 of 20,000 characters", p="ta")),
         "The count is a <code>.field__counter</code>, right-aligned under the hint and kept up to date.",
         _box(fld("Idea", '<textarea class="textarea" id="@ID" rows="3"@A>Reconcile bank and card statements against receipts.</textarea>', "54 of 20,000 characters", p="ta")),
         "New direction showed the count as the hint. It reads like an instruction, sits where guidance belongs and never changes."),
        (_box(fld("Feature", f'<textarea class="textarea" id="@ID" rows="3" readonly@A>{_FEATURE}</textarea>', counter="124 of 20,000 characters", p="ta")),
         "While submitting, <code>readonly</code>: the text can still be read, selected and announced.",
         _box(fld("Feature", f'<textarea class="textarea" id="@ID" rows="3" disabled@A>{_FEATURE}</textarea>', counter="124 of 20,000 characters", p="ta")),
         "<code>disabled</code> greys the person's own words, drops them from the tab order and from the submission."),
    ],
    "tokens": [("Background / text", "--color-bg-surface / --color-fg-default"), ("Edge / hover edge", "--color-border-strong / --color-fg-muted"),
               ("Focus ring / invalid ring", "--color-focus-ring / --color-danger-icon"), ("Read-only background / text", "--color-bg-subtle / --color-fg-muted"),
               ("Counter", "--color-fg-subtle"), ("Padding", "--space-3 / --space-3"), ("Line height", "--line-height-relaxed"),
               ("Minimum height (two rows of controls)", "--control-height-md"), ("Radius", "--radius-md"), ("Type", "--text-body-sm")],
    "code": {"snippet": """<div class="field">
  <label class="field__label" for="idea">Idea</label>
  <div class="field__control">
    <textarea class="textarea" id="idea" rows="7" aria-describedby="idea-hint idea-count">…</textarea>
  </div>
  <span class="field__hint" id="idea-hint">Who it is for, what they do with it and what “done” looks like.</span>
  <span class="field__counter" id="idea-count">323 of 20,000 characters</span>
</div>""",
             "classes": [("<code>.textarea</code>", "Multi-line field; vertical resize; at least two control heights."),
                         ("<code>rows</code>", "Visible rows: 4 (feature) or 7 (idea)."),
                         ("<code>.field__counter</code>", "Right-aligned tabular counter."),
                         ("<code>style=\"field-sizing: content\"</code>", "Auto-grow (progressive); add a <code>max-height</code>."),
                         ("<code>aria-invalid=\"true\"</code>", "Invalid ring with a <code>.field__error</code>."),
                         ("<code>readonly</code>", "While submitting.")]},
    "sources": {"mocks": [("pages/new-direction/default", "idea, 7 rows"), ("pages/new-direction/feature", "feature, 4 rows"),
                          ("pages/new-direction/invalid", "too short"), ("pages/new-direction/submitting", "read-only"),
                          ("pages/new-direction/error", "text kept after a 503")],
                "drift": "the character count was rendered as a static <code>.field__hint</code>; it is now <code>.field__counter</code>, kept live and announced near the limit."},
}

# ============================================================== select
_SEL_PRODUCT = fld("Product", '<select class="select" id="@ID"@A><option>Northwind Ops · northwind/ops-portal</option><option>Field Notes · hewn-builds/field-notes</option>'
                   '<option>Ledgerline · queues behind the running direction</option><option>Kiln Booking · queues behind the paused direction</option></select>',
                   "A product whose first direction isn’t complete queues the feature behind it", p="sel")
_SEL_EXPIRY = fld("Expires", '<select class="select" id="@ID"@A><option>In 90 days</option><option>In 30 days</option><option>In 1 year</option></select>',
                  "The worker stops leasing runs when its token expires.", p="sel")
_SEL_PLACEHOLDER = fld("Product", '<select class="select" id="@ID" required@A><option value="" selected disabled>Choose a product</option><option>Northwind Ops · northwind/ops-portal</option><option>Field Notes · hewn-builds/field-notes</option></select>', p="sel")
_SEL_INLINE = ('<label class="inline-label">Stage <select class="select select--auto select--sm"><option selected>All stages</option><option>Idea</option>'
               '<option>Design system</option><option>Stack</option><option>Estimates</option><option>Increments</option></select></label>')
_SEL_FILTERS = ('<div class="cluster"><label class="inline-label"><span class="visually-hidden">Project</span><select class="select select--auto select--sm"><option selected>All projects</option><option>Ledgerline</option><option>Tidewater</option><option>Northwind Ops</option><option>Harbor CRM</option></select></label>'
                '<label class="inline-label"><span class="visually-hidden">Action</span><select class="select select--auto select--sm"><option selected>All actions</option><option>Sign in</option><option>Direction submitted</option><option>Pause</option><option>Resume</option><option>Merge</option><option>Token revoked</option></select></label></div>')


def _sel_row(label, extra_cls=""):
    def c(extra):
        return _cell(f'<select class="select{extra_cls}" aria-label="{label}"{extra}><option>In 90 days</option><option>In 30 days</option></select>')
    return (label, [c(""), c(' data-state="hover"'), c(' data-state="focus"'), c(' aria-invalid="true"'), c(" disabled")])


_SEL_MATRIX = matrix(["Default", "Hover", "Focus", "Invalid", "Disabled"], [_sel_row("Medium"), _sel_row("Small filter", " select--sm")])
_SEL_THEMES = _themes(_SEL_EXPIRY.replace("sel-2", "sel-th1") + fld("Product", '<select class="select" id="@ID"@A><option value="">Choose a product</option></select>', err="Choose the product this feature is for.", p="sel")
                      + '<div class="mt-4">' + _SEL_INLINE + "</div>")

SPECS["select"] = {
    "lead": "Selects choose one option from a list too long for radios: the product a feature is for, a token’s expiry, a log filter.",
    "readme_variants": "field, with placeholder option, inline filter, filter with hidden label",
    "readme_states": "default, hover, focus, invalid, disabled, open (native)",
    "pills": ["Native <code>&lt;select&gt;</code>"],
    "overview": f"""<p>Use a native select for one choice from four or more options, or from a list that changes (products, projects). With two or three options that each need a description, use a {page('components/radio-group', 'radio group')} so every choice is visible; for filters that toggle a few views in place, a {page('components/button-group', 'button group')} or {page('components/tabs')}. Hewn does not ship a custom listbox: the native control is accessible, works with every phone picker and needs no script.</p>
{ul(["<b>Field select</b>: inside a " + page("components/form-field", "form field") + " with a label above (<i>Product</i>, <i>Expires</i>).",
     "<b>With placeholder option</b>: when there is no safe default, a first <code>&lt;option value=&quot;&quot; disabled&gt;</code> such as <i>Choose a product</i> and <code>required</code>.",
     "<b>Inline filter</b> (<code>.inline-label</code> + <code>.select--auto.select--sm</code>): label beside the control, above a list it filters (<i>Stage</i> on Decisions).",
     "<b>Filter with hidden label</b>: when the first option names the filter (<i>All projects</i>, <i>All actions</i>), the label can be visually hidden but never omitted."])}""",
    "anatomy": (_box(_SEL_EXPIRY.replace("sel-2", "sel-an1")),
                [(8, 12), (40, 50), (92, 50), (40, 84)],
                [("Label", "<code>.field__label</code> with <code>&lt;label for&gt;</code>."),
                 ("Selected option", "<code>--text-body-sm</code>; padding <code>--space-3</code> left, <code>--space-8</code> right to clear the chevron."),
                 ("Chevron", "Drawn with two gradients in <code>currentColor</code>, so it follows the text colour in both themes and in forced colours."),
                 ("Hint", "<code>.field__hint</code>, linked with <code>aria-describedby</code>.")]),
    "variants": f"""{ex(_box(_SEL_PRODUCT + '<div class="mt-6"></div>' + _SEL_EXPIRY + '<div class="mt-6"></div>' + _SEL_PLACEHOLDER, "28rem"), "Field selects from New direction (feature) and New worker token, and one with a placeholder option.", cls="ds-example__canvas--stack")}
<h3>Filters</h3>
{ex(_SEL_INLINE + _SEL_FILTERS, "Inline filters from Decisions (visible label) and Audit (visually hidden labels; the first option names the filter). Changing a filter updates the list in place and announces the new count.")}""",
    "sizes": f"""{ex(_box('<div class="stack"><select class="select select--sm" aria-label="Small, 32px"><option>Small · 32px</option></select><select class="select" aria-label="Medium, 40px"><option>Medium · 40px</option></select><select class="select select--lg" aria-label="Large, 48px"><option>Large · 48px</option></select></div>', "20rem"), "Heights <code>--control-height-sm/md/lg</code>. Small is for filters beside small buttons; medium for forms.", cls="ds-example__canvas--stack")}
<p><code>.select--auto</code> sizes the control to its longest option instead of the column; use it for filters only.</p>""",
    "states": f"""{_SEL_MATRIX}
<p><b>Open</b> is drawn by the operating system (a popup list on desktop, a wheel or sheet on phones) and cannot be styled; that is the point of using it. <b>Active</b> opens the list and shows focus.</p>
{_SEL_THEMES}""",
    "responsive": ul([
        "Field selects fill their column at every breakpoint; long option text is cut with an ellipsis by the browser in the closed control and shown in full in the native picker.",
        "Filter rows (<code>.cluster</code>) wrap under the page header below sm, each select keeping its content width; from md they sit to the right of the header text.",
        "Phones show the native picker, which is always a large target; the closed control stays 40px (32px for filters, which are ≥ 24px with 8px between them)."]),
    "theming": "<p>Shares the field component tokens. The chevron uses <code>currentColor</code>, so it re-themes with <code>--field-fg</code>. <code>color-scheme</code> is set per theme in tokens.css, so the native option list is dark in the dark theme.</p>",
    "a11y": {
        "pattern": "<p>Native <code>&lt;select&gt;</code>. If a custom list is ever needed (rich options, multi-select with chips), it follows the <a href=\"https://www.w3.org/WAI/ARIA/apg/patterns/combobox/\">APG combobox</a> or <a href=\"https://www.w3.org/WAI/ARIA/apg/patterns/listbox/\">listbox</a> pattern, not this component.</p>",
        "keys": [(kbd("Tab"), "Moves to the select."),
                 (kbd("Space") + " / " + kbd("Alt", "↓"), "Opens the list."),
                 (kbd("↑") + " " + kbd("↓"), "Moves through options (on Windows, changes the value without opening)."),
                 ("Type a letter", "Jumps to the next option starting with it (type-ahead)."),
                 (kbd("Enter") + " / " + kbd("Esc"), "Chooses / closes without changing.")],
        "focus": "<p>2px inset <code>--field-ring</code>. Changing the value never moves focus, navigates or submits (3.2.2): filters update the list below and announce <i>12 entries</i> in a <code>role=\"status\"</code> region.</p>",
        "labelling": "<p>Every select has a label: visible above (fields) or beside (<code>.inline-label</code>), or visually hidden when the first option names the filter. Hints are linked with <code>aria-describedby</code>. Option text leads with the distinguishing word (<i>Northwind Ops · northwind/ops-portal</i>) so type-ahead works.</p>",
        "pairs": [("Value on field", "--color-fg-default", "--color-bg-surface", 4.5), ("Edge on canvas", "--color-border-strong", "--color-bg-canvas", 3),
                  ("Edge in dialogs", "--color-border-strong", "--color-bg-surface-raised", 3), ("Inline label", "--color-fg-muted", "--color-bg-canvas", 4.5),
                  ("Focus ring", "--color-focus-ring", "--color-bg-surface", 3), ("Invalid ring", "--color-danger-icon", "--color-bg-surface", 3)],
        "motion": "<p>Only the edge transition (<code>--duration-fast</code>); the picker's animation belongs to the operating system.</p>",
        "touch": "<p>Native pickers on iOS and Android give large targets and work with screen readers and switch access without extra code.</p>",
    },
    "content": ul(["Options are short and parallel; put the name first and context after a middle dot: <i>Ledgerline · queues behind the running direction</i>.",
                   "Order options by likelihood or a natural order (<i>In 30 days</i>, <i>In 90 days</i>, <i>In 1 year</i> sorted by duration), and say which is the default in the hint.",
                   "Filters start with <i>All …</i> as the first, default option.",
                   "Placeholder options are instructions in sentence case without a trailing ellipsis: <i>Choose a product</i>."]),
    "dodont": [
        (_box(_SEL_EXPIRY.replace("sel-2", "sel-dd1")), "The hint is linked with <code>aria-describedby</code>, so it is read with the select.",
         _box('<div class="field"><label class="field__label" for="sel-dd2">Product</label><div class="field__control"><select class="select" id="sel-dd2"><option>Northwind Ops · northwind/ops-portal</option></select></div><span class="field__hint">A product whose first direction isn’t complete queues the feature behind it</span></div>'),
         "New direction (feature) rendered the hint with an id but never linked it, so screen readers never hear that the feature may queue."),
        ('<fieldset class="fieldset"><legend>Location</legend><div class="choices choices--row"><label class="choice"><input type="radio" name="sel-loc1">Local<small>Your machine</small></label><label class="choice"><input type="radio" name="sel-loc1" checked>Cloud<small>A VM or container host</small></label></div></fieldset>',
         "Two options with descriptions are radios: both choices and their consequences are visible.",
         _box(fld("Location", '<select class="select" id="@ID"@A><option>Cloud</option><option>Local</option></select>', p="sel")),
         "A select hides the other option and drops the descriptions."),
    ],
    "tokens": [("Background / value", "--color-bg-surface / --color-fg-default"), ("Edge / hover edge", "--color-border-strong / --color-fg-muted"),
               ("Focus ring / invalid ring", "--color-focus-ring / --color-danger-icon"), ("Disabled", "--color-bg-subtle / --color-fg-disabled"),
               ("Inline label", "--color-fg-muted"), ("Height sm / md / lg", "--control-height-sm / --control-height-md / --control-height-lg"),
               ("Padding left / right", "--space-3 / --space-8"), ("Chevron inset", "--space-3 / --space-4"), ("Radius", "--radius-md")],
    "code": {"snippet": """<div class="field">
  <label class="field__label" for="expiry">Expires</label>
  <div class="field__control">
    <select class="select" id="expiry" aria-describedby="expiry-hint">
      <option>In 90 days</option><option>In 30 days</option><option>In 1 year</option>
    </select>
  </div>
  <span class="field__hint" id="expiry-hint">The worker stops leasing runs when its token expires.</span>
</div>
<label class="inline-label">Stage <select class="select select--auto select--sm">…</select></label>""",
             "classes": [("<code>.select</code>", "Native select with the field look and a chevron."),
                         ("<code>.select--sm</code> <code>.select--lg</code>", "32px / 48px."),
                         ("<code>.select--auto</code>", "Width of the longest option (filters)."),
                         ("<code>.inline-label</code>", "Label beside the control, muted."),
                         ("<code>aria-invalid=\"true\"</code>", "Invalid ring."),
                         ("<code>&lt;option value=\"\" disabled&gt;</code>", "Placeholder option with <code>required</code>.")]},
    "sources": {"mocks": [("pages/new-direction/feature", "Product"), ("dialogs/worker-token/default", "Expires"), ("pages/decisions/default", "Stage filter"),
                          ("pages/audit/default", "Project and Action filters")],
                "drift": "filters used <code>.input--sm</code> on a select (now <code>.select--sm</code>); the Product hint was not linked with <code>aria-describedby</code>."},
}

# ============================================================== checkbox
_INDET_SCRIPT = '<script>document.querySelectorAll("input[data-indeterminate]").forEach(function (i) { i.indeterminate = true; });</script>'
_CB_SINGLE = ('<label class="choice"><input type="checkbox" checked><span>Include merged increments'
              '<small>Show increments whose pull request has merged, not only open and failed ones.</small></span></label>')
_CB_GROUP = ('<fieldset class="fieldset"><legend>Actions</legend><div class="choices">'
             + "".join(f'<label class="choice"><input type="checkbox"{" checked" if c else ""}>{a}</label>' for a, c in
                       [("Direction submitted", True), ("Pause", True), ("Resume", True), ("Merge", False), ("Token created", False), ("Token revoked", False)])
             + "</div></fieldset>")
_CB_ROW = ('<fieldset class="fieldset"><legend>Status</legend><div class="choices choices--row">'
           + "".join(f'<label class="choice"><input type="checkbox"{" checked" if c else ""}>{a}</label>' for a, c in [("Running", True), ("Paused", True), ("Blocked", True), ("Complete", False)])
           + "</div></fieldset>")
_CB_ALL = ('<fieldset class="fieldset"><legend class="visually-hidden">Workers to revoke</legend><div class="choices">'
           '<label class="choice"><input type="checkbox" data-indeterminate>Select all workers</label>'
           '<div class="choices" style="padding-left: var(--space-6);">'
           + "".join(f'<label class="choice"><input type="checkbox"{" checked" if c else ""}><span><span class="mono">{n}</span><small>{w}</small></span></label>' for n, w, c in
                     [("quinn-mbp.local", "wk-7f3a · Ledgerline", False), ("hewn-cloud-eus-01", "wk-c21e · Tidewater", False), ("hewn-cloud-eus-02", "wk-90bd · Idle", True), ("build-box-02", "wk-4e18 · Offline", True)])
           + "</div></div></fieldset>")
_CB_CARD = ('<label class="choice choice--card"><input type="checkbox" checked><span>Include merged increments<small>Open, failed and merged</small></span></label>')


def _cb_cells(base, card=False):
    cls = "choice choice--card" if card else "choice"
    def c(extra, lab_extra=""):
        return f'<label class="{cls}"{lab_extra}><input type="checkbox"{base}{extra}>Pause</label>'
    return [c(""), c("", ' data-state="hover"'), c(' data-state="focus"'), c(" disabled"), c(' aria-invalid="true"')]


_CB_MATRIX = matrix(["Default", "Hover", "Focus", "Disabled", "Invalid"],
                    [("Unchecked", _cb_cells("")), ("Checked", _cb_cells(" checked")), ("Indeterminate", _cb_cells(" data-indeterminate")),
                     ("Card, checked", _cb_cells(" checked", True))])

SPECS["checkbox"] = {
    "lead": "Checkboxes turn independent options on or off, alone or in a group, and take effect when the form is saved.",
    "readme_variants": "single, with description, group (vertical, row), select all, card",
    "readme_states": "unchecked, checked, indeterminate, hover, focus, disabled, invalid",
    "pills": ["Native <code>&lt;input type=\"checkbox\"&gt;</code>", "Core set: not yet in the mocks"],
    "overview": f"""<p>Use a checkbox for an option that is independent of the others and is applied with the rest of a form (<i>Save</i>, <i>Apply</i>). Several options that can all be on together form a group in a fieldset. Use a {page('components/radio-group', 'radio group')} when only one may be on, and a {page('components/switch')} when flipping it takes effect immediately with no save.</p>
<p>The mocks have not needed a checkbox yet; it is part of the core set because the next screens will. The likely first uses are a multi-choice <i>Action</i> filter on the Audit log (today a single select), bulk revoke on Workers (today one row at a time) and opt-ins in Settings' direction defaults.</p>
{ul(["<b>Single</b>, optionally with a description in <code>&lt;small&gt;</code>.",
     "<b>Group</b>: a <code>.fieldset</code> with a <code>&lt;legend&gt;</code>, options in <code>.choices</code> (vertical) or <code>.choices--row</code> (wrapping row, for short labels).",
     "<b>Select all</b>: a parent checkbox that is <i>indeterminate</i> when some, not all, children are checked.",
     "<b>Card</b> (<code>.choice--card</code>): a bordered option that tints when checked, for options with a longer description."])}""",
    "anatomy": (_box('<label class="choice"><input type="checkbox" checked><span>Include merged increments<small>Show increments whose pull request has merged.</small></span></label>', "22rem"),
                [(4, 30), (40, 28), (50, 70)],
                [("Box", "Native checkbox, <code>--size-icon-md</code> (16px), <code>accent-color: --color-accent</code>, nudged <code>--space-0-5</code> to sit on the first line."),
                 ("Label", "The whole <code>&lt;label class=\"choice\"&gt;</code> is clickable; <code>--text-body-sm</code>, gap <code>--space-3</code>."),
                 ("Description (optional)", "<code>&lt;small&gt;</code>: <code>--text-caption</code> in <code>--color-fg-subtle</code>.")]),
    "variants": f"""{ex(_CB_SINGLE, "Single, with description.")}
{ex(_CB_GROUP + _CB_ROW, "Vertical group (Audit actions) and a wrapping row (project status filter).")}
{ex(_CB_ALL, "Select all: 2 of 4 workers checked, so the parent is indeterminate. Checking it checks all four; unchecking clears them.")}
{ex(_box(_CB_CARD, "22rem"), "Card: the whole card is the label and tints with <code>--color-accent-subtle</code> when checked.")}""",
    "sizes": NA("Checkboxes have one size: a 16px box (--size-icon-md) on a row at least --target-min (24px) tall; the label is part of the target."),
    "states": f"""<p>The box is the native control coloured with <code>accent-color</code>, so its hover look is the browser's; the card variant adds a hover fill. Focus uses the shared ring; invalid adds a 2px <code>--color-danger-icon</code> outline.</p>
{_CB_MATRIX}
{_INDET_SCRIPT}
{_themes(_CB_SINGLE + _CB_ROW + _CB_CARD)}
{ul(["<b>Indeterminate</b> is a property, not an attribute: set <code>input.indeterminate = true</code> from script whenever some children are checked. It is announced as <i>mixed</i>.",
     "<b>Invalid</b> is rare: only a required acknowledgement can be wrong. Put <code>aria-invalid</code> on the input and the error under the group, linked from the fieldset with <code>aria-describedby</code>.",
     "<b>Disabled</b> dims the label to <code>--color-fg-disabled</code>; say why nearby, or hide the option for Viewers."])}""",
    "responsive": ul([
        "Groups stack vertically at every breakpoint; <code>.choices--row</code> wraps onto new lines below sm instead of shrinking labels.",
        "Rows are at least 24px tall with 4px (<code>--space-1</code>) between them in a group; on phones the whole label row is the target.",
        "Card checkboxes go full width below sm and can sit two-up in <code>.form-grid--2</code> from sm."]),
    "theming": "<p><code>accent-color: var(--color-accent)</code> colours the checked box and its tick; the unchecked edge is drawn by the browser from <code>color-scheme</code>, which tokens.css sets per theme. Card colours come from <code>--color-bg-surface</code>, <code>--color-border-default</code>, <code>--color-accent-subtle</code> and <code>--color-accent</code>. In forced colours the native box uses system colours with no extra work.</p>",
    "a11y": {
        "pattern": "<p>Native <code>&lt;input type=\"checkbox\"&gt;</code> in a <code>&lt;label&gt;</code>; groups in <code>&lt;fieldset&gt;</code> with <code>&lt;legend&gt;</code>. Behaviour follows the <a href=\"https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/\">APG checkbox pattern</a>, including mixed state for select all.</p>",
        "keys": [(kbd("Tab") + " / " + kbd("Shift", "Tab"), "Moves to each checkbox in turn; every checkbox is a tab stop."),
                 (kbd("Space"), "Toggles the focused checkbox. Enter does not toggle; it submits the form.")],
        "focus": "<p>The shared ring (2px <code>--color-focus-ring</code>, 2px offset) around the box on <code>:focus-visible</code>. Toggling never moves focus; select all updates the children without moving focus to them.</p>",
        "labelling": "<p>The label text is the name and the <code>&lt;small&gt;</code> description is part of it, so keep descriptions short. The legend names the group (<i>Actions</i>) and is read when focus enters it. A select-all parent says what it selects: <i>Select all workers</i>.</p>",
        "pairs": [("Checked box", "--color-accent", "--color-bg-surface", 3), ("Label", "--color-fg-default", "--color-bg-surface", 4.5),
                  ("Description", "--color-fg-subtle", "--color-bg-surface", 4.5), ("Card edge, checked", "--color-accent", "--color-bg-surface", 3),
                  ("Label on checked card", "--color-fg-default", "--color-accent-subtle", 4.5), ("Invalid outline", "--color-danger-icon", "--color-bg-surface", 3),
                  ("Focus ring", "--color-focus-ring", "--color-bg-surface", 3)],
        "motion": "<p>None beyond the browser's own tick. Card fill changes are instant.</p>",
        "touch": "<p>The label row is at least 24px tall and the whole row toggles, so the target is far larger than the 16px box. Keep 4px between rows; in dense lists, use cards or 44px rows below lg.</p>",
    },
    "content": ul(["Say what checking does, positively: <i>Include merged increments</i>, not <i>Don’t hide merged increments</i>.",
                   "Labels are sentence case without end punctuation; descriptions are one sentence.",
                   "Legends are nouns: <i>Actions</i>, <i>Status</i>.",
                   "Never <i>Check this to …</i> or <i>Enable …</i>; the control already says it can be checked."]),
    "dodont": [
        ('<label class="switch switch--end" style="width: 100%;"><input type="checkbox" role="switch" checked><span>Merged pull requests<small>Toast when an increment merges</small></span></label>',
         "A setting that applies the moment it changes is a " + page("components/switch", "switch") + ".",
         _box(_CB_SINGLE.replace("Include merged increments", "Toast when an increment merges").replace("<small>Show increments whose pull request has merged, not only open and failed ones.</small>", "")),
         "A lone checkbox with no Save button leaves people unsure whether it took effect."),
        (_box(fld("Type <strong>Harbor CRM</strong> to confirm", '<input class="input" id="@ID" autocomplete="off" value="Harbor CRM"@A>', "The GitHub repository is kept; only Hewn’s record is deleted.", p="cb")),
         "Delete project asks for the project's name, which cannot be done without reading it.",
         '<label class="choice"><input type="checkbox">I understand this can’t be undone</label>',
         "An acknowledgement checkbox is ticked out of habit; do not use it as the only guard on a destructive action."),
    ],
    "tokens": [("Checked box and tick", "--color-accent"), ("Box size", "--size-icon-md"), ("Label / description", "--color-fg-default / --color-fg-subtle"),
               ("Disabled label", "--color-fg-disabled"), ("Invalid outline", "--color-danger-icon"), ("Row height", "--target-min"),
               ("Gap / row gap", "--space-3 / --space-1"), ("Card background / edge", "--color-bg-surface / --color-border-default"),
               ("Card checked background / edge", "--color-accent-subtle / --color-accent"), ("Card hover", "--color-bg-subtle"), ("Card radius", "--radius-md")],
    "code": {"snippet": """<fieldset class="fieldset">
  <legend>Actions</legend>
  <div class="choices">
    <label class="choice"><input type="checkbox" name="action" value="pause" checked>Pause</label>
    <label class="choice"><input type="checkbox" name="action" value="resume">Resume</label>
  </div>
</fieldset>
<script>selectAll.indeterminate = someChecked && !allChecked;</script>""",
             "classes": [("<code>.choice</code>", "Label row wrapping the input, text and optional <code>&lt;small&gt;</code>."),
                         ("<code>.choice--card</code>", "Bordered card; tints when checked."),
                         ("<code>.choices</code> / <code>.choices--row</code>", "Vertical group / wrapping row."),
                         ("<code>.fieldset</code>", "Unstyled fieldset; the legend is a label."),
                         ("<code>aria-invalid=\"true\"</code>", "Danger outline on the box."),
                         ("<code>input.indeterminate</code>", "Mixed state (script).")]},
    "sources": {"mocks": [("pages/audit/default", "Action filter, where a multi-choice group would go"), ("pages/workers/default", "rows revoked one at a time; bulk select would use select all"),
                          ("dialogs/delete-project/confirm", "type-to-confirm chosen over an acknowledgement checkbox"), ("pages/settings/default", "direction defaults, where opt-ins would sit")],
                "drift": "none: no mock uses a checkbox yet. The component follows the radio styles the mocks already use (<code>.choice</code>)."},
}

# ============================================================== radio group
_RG_ROLE = ('<fieldset class="fieldset"><legend>Role</legend><div class="choices">'
            '<label class="choice"><input type="radio" name="rg-role" value="viewer" checked><span>' + icon("users", "icon--sm") + '</span><span>Viewer<small>Watches every project</small></span></label>'
            '<label class="choice"><input type="radio" name="rg-role" value="owner"><span>' + icon("key", "icon--sm") + '</span><span>Owner<small>Gives direction, stops work, manages access</small></span></label></div></fieldset>')
_RG_LOC = ('<fieldset class="fieldset"><legend>Location</legend><div class="choices choices--row">'
           '<label class="choice"><input type="radio" name="rg-loc" value="local"><span>' + icon("laptop", "icon--sm") + '</span><span>Local<small>Your machine</small></span></label>'
           '<label class="choice"><input type="radio" name="rg-loc" value="cloud" checked><span>' + icon("cloud", "icon--sm") + '</span><span>Cloud<small>A VM or container host</small></span></label></div></fieldset>')
_RG_THEME = ('<fieldset class="fieldset"><legend>Theme</legend><div class="choices">'
             + "".join(f'<label class="choice"><input type="radio" name="rg-theme" value="{k.lower()}"{" checked" if k == "System" else ""}><span>{icon(ic, "icon--sm")}</span><span>{k}<small>{s}</small></span></label>'
                       for k, ic, s in [("Light", "sun", "Stone canvas, slate ink"), ("Dark", "moon", "The Mission Control default at night"), ("System", "monitor", "Follow your operating system")])
             + "</div></fieldset>")
_RG_CARD = ('<fieldset class="fieldset"><legend>Role</legend><div class="form-grid form-grid--2" style="gap: var(--space-3);">'
            '<label class="choice choice--card"><input type="radio" name="rg-rc" value="viewer" checked><span>Viewer<small>Watches every project</small></span></label>'
            '<label class="choice choice--card"><input type="radio" name="rg-rc" value="owner"><span>Owner<small>Gives direction, stops work, manages access</small></span></label></div></fieldset>')


def _rg_cells(checked, card=False):
    cls = "choice choice--card" if card else "choice"
    out = []
    for extra, lab in [("", ""), ("", ' data-state="hover"'), (' data-state="focus"', ""), (" disabled", ""), (' aria-invalid="true"', "")]:
        nm = _uid("rgm")
        out.append(f'<label class="{cls}"{lab}><input type="radio" name="{nm}"{" checked" if checked else ""}{extra}>Cloud</label>')
    return out


_RG_MATRIX = matrix(["Default", "Hover", "Focus", "Disabled", "Invalid"],
                    [("Unchecked", _rg_cells(False)), ("Checked", _rg_cells(True)), ("Card, unchecked", _rg_cells(False, True)), ("Card, checked", _rg_cells(True, True))])
_RG_INVALID = ('<fieldset class="fieldset" aria-describedby="rg-inv-err"><legend>Location</legend><div class="choices choices--row">'
               '<label class="choice"><input type="radio" name="rg-inv" value="local" aria-invalid="true">Local</label>'
               '<label class="choice"><input type="radio" name="rg-inv" value="cloud" aria-invalid="true">Cloud</label></div>'
               f'<span class="field__error" id="rg-inv-err">{_ERR_ICON}Choose where the worker runs.</span></fieldset>')

SPECS["radio-group"] = {
    "lead": "Radio groups choose exactly one of a few options and show them all, with what each one means.",
    "readme_variants": "vertical with descriptions, horizontal, with icons, card",
    "readme_states": "unchecked, checked, hover, focus, disabled, invalid",
    "pills": ["Native <code>&lt;input type=\"radio\"&gt;</code>"],
    "overview": f"""<p>Use a radio group when exactly one of two to five options must be chosen and the person benefits from seeing every option and its consequence at once: a user's role, where a worker runs, the theme. With more options, or options that change, use a {page('components/select')}; for an independent on/off choice use a {page('components/checkbox')} or {page('components/switch')}; for switching a view in place (width, light/dark preview) use a {page('components/button-group', 'button group')}.</p>
{ul(["<b>Vertical with descriptions</b> (<code>.choices</code>): the default, used for Role in Add a GitHub login and Theme in Settings.",
     "<b>Horizontal</b> (<code>.choices--row</code>): two or three short options, used for Location in New worker token.",
     "<b>With icons</b>: an <code>icon--sm</code> before the text reinforces the option; it is decorative.",
     "<b>Card</b> (<code>.choice--card</code>): bordered options that tint when chosen, two-up from sm."])}
<p>Always preselect the safest option (<i>Viewer</i>, <i>System</i>) unless the choice is consequential enough that a default would be presumptuous; then start empty and validate.</p>""",
    "anatomy": (_box(_RG_ROLE.replace('name="rg-role"', 'name="rg-an"'), "22rem"),
                [(4, 8), (3, 36), (12, 36), (30, 36), (40, 52)],
                [("Legend", "<code>.fieldset &gt; legend</code>, <code>--text-label</code>; names the group."),
                 ("Radio", "Native radio, <code>--size-icon-md</code>, <code>accent-color: --color-accent</code>."),
                 ("Icon (optional)", "<code>icon--sm</code>, decorative, <code>aria-hidden</code>."),
                 ("Option label", "<code>--text-body-sm</code> in <code>--color-fg-default</code>."),
                 ("Description", "<code>&lt;small&gt;</code>, <code>--text-caption</code>, <code>--color-fg-subtle</code>.")]),
    "variants": f"""{ex(_RG_ROLE, "Vertical with icons and descriptions (Add a GitHub login).")}
{ex(_RG_LOC, "Horizontal (New worker token).")}
{ex(_RG_THEME, "Three options (Settings › Appearance; saved immediately, on this device only).")}
{ex(_box(_RG_CARD, "32rem"), "Card, two-up from sm.", cls="ds-example__canvas--stack")}""",
    "sizes": NA("Radio groups have one size: a 16px radio on a row at least --target-min (24px) tall, with the whole label as the target."),
    "states": f"""{_RG_MATRIX}
<h3>Invalid group</h3>
{ex(_box(_RG_INVALID, "22rem"), "Only when nothing is preselected and the person submits without choosing: every radio gets <code>aria-invalid</code>, the error sits under the options and the fieldset references it.")}
{_themes(_RG_ROLE + '<div class="mt-4"></div>' + _box(_RG_CARD, "32rem"))}
{ul(["<b>Disabled</b>: individual options are disabled only when they cannot apply (Owner when the person is not an Owner); disabling a whole group while an unrelated form submits is wrong.",
     "<b>Hover</b> is the browser's on plain radios; cards fill with <code>--color-bg-subtle</code>.",
     "<b>Checked cards</b> tint with <code>--color-accent-subtle</code> and an accent edge, so the choice is shown by more than the dot."])}""",
    "responsive": ul([
        "Vertical groups are the same at every breakpoint.",
        "<code>.choices--row</code> wraps below sm when the options do not fit; it never squeezes descriptions onto one line.",
        "Cards stack below sm and sit two-up in <code>.form-grid--2</code> from sm (36rem).",
        "In Settings (lg and up) the group sits in the right column of the <code>.settings-section</code> grid, beside its section heading."]),
    "theming": "<p>The radio is native, coloured by <code>accent-color: var(--color-accent)</code>; its unchecked edge follows <code>color-scheme</code>. Cards use <code>--color-bg-surface</code> and <code>--color-border-default</code>, switching to <code>--color-accent-subtle</code> and <code>--color-accent</code> when checked; in dark the tint is the deep blue that keeps text at 4.5:1.</p>",
    "a11y": {
        "pattern": "<p>Native radios sharing a <code>name</code>, inside <code>&lt;fieldset&gt;</code> with <code>&lt;legend&gt;</code>. Keyboard behaviour is the browser's and matches the <a href=\"https://www.w3.org/WAI/ARIA/apg/patterns/radio/\">APG radio group pattern</a>. Do not build radios from links or buttons with <code>role=\"radio\"</code>.</p>",
        "keys": [(kbd("Tab"), "Moves into the group, to the checked radio (or the first when none is checked), then out of the group."),
                 (kbd("↓") + " / " + kbd("→"), "Checks the next option (wraps)."),
                 (kbd("↑") + " / " + kbd("←"), "Checks the previous option (wraps)."),
                 (kbd("Space"), "Checks the focused option when none is checked.")],
        "focus": "<p>The shared ring around the radio. The group is a single tab stop. Moving with arrows changes the value, so changing a radio must never navigate or submit; theme changes apply but keep focus in place.</p>",
        "labelling": "<p>The legend names the group and is read once on entry (<i>Role, group</i>). Each option's label and description form its name (<i>Viewer, Watches every project, radio button, 1 of 2, checked</i>). A visually hidden legend is acceptable only when a visible heading directly above says the same thing (Settings: <i>Appearance</i> / legend <i>Theme</i>). Give every radio a <code>value</code>.</p>",
        "pairs": [("Checked radio", "--color-accent", "--color-bg-surface", 3), ("Radio edge in dialogs", "--color-border-strong", "--color-bg-surface-raised", 3),
                  ("Option label", "--color-fg-default", "--color-bg-surface-raised", 4.5), ("Description", "--color-fg-subtle", "--color-bg-surface-raised", 4.5),
                  ("Label on checked card", "--color-fg-default", "--color-accent-subtle", 4.5), ("Focus ring on checked card", "--color-focus-ring", "--color-accent-subtle", 3)],
        "motion": "<p>None; the dot is the browser's.</p>",
        "touch": "<p>The whole label row is the target and at least 24px tall; options with descriptions are about 40px. Keep 4px between rows, or use cards for a larger target on phones.</p>",
    },
    "content": ul(["Option labels are short nouns or noun phrases, parallel in form: <i>Viewer</i> / <i>Owner</i>, <i>Local</i> / <i>Cloud</i>.",
                   "Descriptions state the consequence: <i>Gives direction, stops work, manages access</i>.",
                   "Order from least to most powerful or by a natural order (Light, Dark, System); put the default first unless the natural order says otherwise.",
                   "Legends are nouns: <i>Role</i>, <i>Location</i>, <i>Theme</i>."]),
    "dodont": [
        ('<fieldset class="fieldset"><legend>Direction type</legend><div class="choices choices--row"><label class="choice"><input type="radio" name="rg-dd1" checked>New product</label><label class="choice"><input type="radio" name="rg-dd1">Feature for a product</label></div></fieldset>',
         "A choice that changes the form below uses real radios (or links with <code>aria-current</code> if it goes to another page).",
         '<div class="segmented" role="radiogroup" aria-label="Direction type"><a class="segmented__opt" role="radio" href="#states" aria-checked="true">New product</a><a class="segmented__opt" role="radio" href="#states" aria-checked="false">Feature for a product</a></div>',
         "New direction used links with <code>role=\"radio\"</code>: arrow keys did nothing and choosing navigated away."),
        (_RG_ROLE.replace('name="rg-role"', 'name="rg-dd2"'), "The safest role is preselected; Owner is a deliberate choice.",
         _RG_ROLE.replace('name="rg-role"', 'name="rg-dd3"').replace(' checked>', '>').replace('value="owner">', 'value="owner" checked>'),
         "Preselecting Owner grants stop-work and access rights to anyone added in a hurry."),
    ],
    "tokens": [("Checked radio", "--color-accent"), ("Radio size", "--size-icon-md"), ("Legend / label", "--color-fg-default / --color-fg-default"),
               ("Description", "--color-fg-subtle"), ("Disabled", "--color-fg-disabled"), ("Invalid outline", "--color-danger-icon"),
               ("Row height / gap", "--target-min / --space-3"), ("Group gap / row gap", "--space-1 / --space-6"),
               ("Card / card checked", "--color-bg-surface / --color-accent-subtle"), ("Card edge / checked edge", "--color-border-default / --color-accent")],
    "code": {"snippet": """<fieldset class="fieldset">
  <legend>Role</legend>
  <div class="choices">
    <label class="choice">
      <input type="radio" name="role" value="viewer" checked>
      <span><svg class="icon icon--sm" aria-hidden="true">…</svg></span>
      <span>Viewer<small>Watches every project</small></span>
    </label>
    <label class="choice">
      <input type="radio" name="role" value="owner">
      <span>…</span><span>Owner<small>Gives direction, stops work, manages access</small></span>
    </label>
  </div>
</fieldset>""",
             "classes": [("<code>.fieldset</code>", "Unstyled fieldset; legend styled as a label."),
                         ("<code>.choices</code> / <code>.choices--row</code>", "Vertical / wrapping horizontal group."),
                         ("<code>.choice</code>", "Label row with radio, optional icon, text and description."),
                         ("<code>.choice--card</code>", "Card option; tints when checked."),
                         ("<code>aria-invalid=\"true\"</code>", "Danger outline on each radio, with an error under the group.")]},
    "sources": {"mocks": [("dialogs/add-user/default", "Role"), ("dialogs/worker-token/default", "Location, horizontal"), ("pages/settings/default", "Theme"),
                          ("pages/settings/submitting", "theme radios disabled while defaults save"), ("pages/new-direction/default", "segmented links posing as radios")],
                "drift": "fieldsets were reset inline with <code>style=\"border:0; padding:0; margin:0\"</code> in Settings, Add a GitHub login and New worker token (now <code>.fieldset</code>); options sat in <code>.stack</code> / <code>.cluster</code> instead of <code>.choices</code>; radios had no <code>value</code>; Settings › submitting disabled the theme radios, which belong to a different, immediately-saved section."},
}

# ============================================================== switch
_SW_ROWS = ('<div class="stack" style="width: 100%; max-width: 30rem;">'
            '<label class="switch switch--end"><input type="checkbox" role="switch" checked><span>Merged pull requests<small>Toast when an increment merges: “Ledgerline #27 merged”</small></span></label>'
            '<label class="switch switch--end"><input type="checkbox" role="switch"><span>Stage started<small>Toast when a project moves to its next stage</small></span></label>'
            '<label class="switch switch--end"><input type="checkbox" role="switch" checked><span>Budget warnings<small>Toast at 80% of a direction’s budget</small></span></label>'
            '<label class="switch switch--end"><input type="checkbox" role="switch" checked disabled><span>Blocked projects<small>Always shown; errors never auto-dismiss</small></span></label></div>')
_SW_START = '<label class="switch"><input type="checkbox" role="switch" checked><span>Follow the live log<small>Scroll to new lines as they arrive</small></span></label>'


def _sw_cells(on):
    def c(extra, lab=""):
        return f'<label class="switch"{lab}><input type="checkbox" role="switch" aria-label="Budget warnings"{" checked" if on else ""}{extra}></label>'
    return [c(""), c(' data-state="hover"'), c(' data-state="focus"'), c(" disabled")]


_SW_MATRIX = matrix(["Default", "Hover", "Focus", "Disabled"], [("Off", _sw_cells(False)), ("On", _sw_cells(True))])

SPECS["switch"] = {
    "lead": "A switch turns a setting on or off and the change takes effect immediately, with no Save button.",
    "readme_variants": "label after, label before (settings row), with description",
    "readme_states": "off, on, hover, focus, disabled",
    "pills": ["<code>role=\"switch\"</code> on a checkbox", "Core set: not yet in the mocks"],
    "overview": f"""<p>Use a switch for a preference that applies the moment it is flipped and is saved on its own: which live events raise a toast, whether the log follows new lines. If the change waits for a Save or Apply button, use a {page('components/checkbox')}. If it changes the view rather than a setting (Follow log in a toolbar, Captions on the increment video), use a toggle {page('components/button')} with <code>aria-pressed</code>.</p>
<p>The mocks do not use a switch yet. Its first home is a Notifications section in Settings, beside Appearance, which is already <i>saved immediately</i>; the four live-toast kinds (merged, stage started, budget at 80%, blocked) map one switch each.</p>
{ul(["<b>Label after</b> (<code>.switch</code>): inline, for a single preference in a panel.",
     "<b>Label before</b> (<code>.switch--end</code>): settings rows, label left and switch right-aligned, so a column of switches lines up.",
     "<b>With description</b>: a <code>&lt;small&gt;</code> under the label says what the setting changes."])}""",
    "anatomy": (_box('<label class="switch switch--end"><input type="checkbox" role="switch" checked><span>Budget warnings<small>Toast at 80% of a direction’s budget</small></span></label>', "26rem"),
                [(13, 28), (13, 56), (84, 14), (80, 62)],
                [("Label", "<code>--text-body-sm</code>, <code>--color-fg-default</code>; names the setting."),
                 ("Description", "<code>&lt;small&gt;</code>, <code>--text-caption</code>, <code>--color-fg-subtle</code>."),
                 ("Track", "40×24 (<code>--space-10</code> × <code>--space-6</code>), <code>--radius-full</code>; off: <code>--color-bg-surface</code> with a <code>--color-border-strong</code> ring; on: <code>--color-accent</code>."),
                 ("Thumb", "16px (<code>--space-4</code>); off: <code>--color-fg-muted</code> at the start; on: <code>--color-fg-on-accent</code>, moved <code>--space-4</code>.")]),
    "variants": f"""{ex(_SW_ROWS, "Label before: a proposed Notifications section in Settings, one switch per live-toast kind. Blocked projects is on and disabled because error toasts always show.", cls="ds-example__canvas--stack")}
{ex(_SW_START, "Label after, for a single preference.")}""",
    "sizes": NA("Switches have one size: a 40×24 track with a 16px thumb on a row at least --target-min (24px) tall; the label is part of the target."),
    "states": f"""{_SW_MATRIX}
{_themes(_SW_ROWS)}
{ul(["<b>On</b> is shown by position, fill and thumb colour together, never by colour alone.",
     "<b>Saving</b>: the switch moves at once (optimistic). If the save fails it moves back and an error " + page("components/toast", "toast") + " says <i>Couldn’t save notification settings. Budget warnings are still off.</i>",
     "<b>Disabled</b> is 50% opacity; the description says why (<i>Always shown</i>). Viewers can change their own notifications, so do not disable switches by role."])}""",
    "responsive": ul([
        "<code>.switch--end</code> rows span the column at every breakpoint; the switch stays at the end and top-aligned while the label and description wrap.",
        "Below sm the description wraps under the label; the switch never shrinks.",
        "From lg, inside a <code>.settings-section</code>, the rows sit in the right-hand column beside the section heading."]),
    "theming": "<p>Track and thumb read <code>--color-bg-surface</code>, <code>--color-border-strong</code>, <code>--color-fg-muted</code>, <code>--color-accent</code>, <code>--color-accent-hover</code> and <code>--color-fg-on-accent</code>. In dark the on track is the lighter blue with a near-black thumb, matching the primary button, so on reads the same way in both themes.</p>",
    "a11y": {
        "pattern": "<p><code>&lt;input type=\"checkbox\" role=\"switch\"&gt;</code> inside its <code>&lt;label&gt;</code>, following the <a href=\"https://www.w3.org/WAI/ARIA/apg/patterns/switch/\">APG switch pattern</a>. The native checkbox gives keyboard, form and forced-colours support; the role makes it announce <i>on</i> and <i>off</i>.</p>",
        "keys": [(kbd("Tab") + " / " + kbd("Shift", "Tab"), "Moves to the switch."),
                 (kbd("Space"), "Toggles it and applies the setting.")],
        "focus": "<p>The shared ring around the track. Toggling keeps focus on the switch; an error toast after a failed save does not take focus.</p>",
        "labelling": "<p>The label names the setting, not the action: <i>Budget warnings</i>, not <i>Turn on budget warnings</i>. It is announced as <i>Budget warnings, Toast at 80% of a direction’s budget, switch, on</i>. Never put on/off text inside the track.</p>",
        "pairs": [("Off track edge", "--color-border-strong", "--color-bg-surface", 3), ("Off thumb", "--color-fg-muted", "--color-bg-surface", 4.5),
                  ("On track", "--color-accent", "--color-bg-surface", 3), ("On thumb on track", "--color-fg-on-accent", "--color-accent", 4.5),
                  ("Label", "--color-fg-default", "--color-bg-canvas", 4.5), ("Description", "--color-fg-subtle", "--color-bg-canvas", 4.5),
                  ("Focus ring", "--color-focus-ring", "--color-bg-canvas", 3)],
        "motion": "<p>The thumb slides over <code>--duration-base</code> and the track fills over <code>--duration-fast</code>, both <code>--ease-standard</code>. Reduced motion zeroes both; the state still changes.</p>",
        "touch": "<p>The whole row is the target (label, description and track), at least 24px and about 40px with a description. The switch never relies on dragging the thumb: a tap toggles.</p>",
    },
    "content": ul(["Label the thing being switched, as a noun phrase: <i>Merged pull requests</i>, <i>Stage started</i>.",
                   "Descriptions say what happens when it is on, in the present tense: <i>Toast when an increment merges</i>.",
                   "No <i>Enable</i>, <i>Turn on</i> or question marks.",
                   "Group related switches under a heading (<i>Notifications</i>) with one sentence saying they save immediately."]),
    "dodont": [
        (_SW_START, "A switch that applies immediately, with nothing to save.",
         '<form class="stack" style="width: 100%; max-width: 22rem;" action="#states"><label class="switch"><input type="checkbox" role="switch" checked><span>Budget warnings</span></label><div><button class="btn btn--primary btn--sm" type="submit">Save defaults</button></div></form>',
         "A switch inside a form with a Save button: people cannot tell whether it already applied. Use a checkbox there."),
        ('<label class="switch switch--end" style="width: 100%;"><input type="checkbox" role="switch" checked><span>Budget warnings<small>Toast at 80% of a direction’s budget</small></span></label>',
         "The label names the setting; the switch shows its state.",
         '<label class="switch switch--end" style="width: 100%;"><input type="checkbox" role="switch" checked><span>Turn budget warnings off</span></label>',
         "An action label (<i>Turn … off</i>) contradicts the on state and flips meaning each time."),
    ],
    "tokens": [("Track off / on", "--color-bg-surface / --color-accent"), ("Track off edge / hover edge", "--color-border-strong / --color-fg-muted"),
               ("Track on, hover", "--color-accent-hover"), ("Thumb off / on", "--color-fg-muted / --color-fg-on-accent"),
               ("Track size", "--space-10 / --space-6"), ("Thumb size / travel / inset", "--space-4 / --space-4 / --space-1"), ("Radius", "--radius-full"),
               ("Label / description", "--color-fg-default / --color-fg-subtle"), ("Row height / gap", "--target-min / --space-3"),
               ("Motion", "--duration-base / --duration-fast / --ease-standard")],
    "code": {"snippet": """<label class="switch switch--end">
  <input type="checkbox" role="switch" name="notify-budget" checked>
  <span>Budget warnings<small>Toast at 80% of a direction’s budget</small></span>
</label>""",
             "classes": [("<code>.switch</code>", "Label row; the input is drawn as a track and thumb."),
                         ("<code>.switch--end</code>", "Same markup (input first), drawn reversed: label at the start, switch at the end (settings rows)."),
                         ("<code>role=\"switch\"</code>", "Announces on/off; required."),
                         ("<code>checked</code> / <code>disabled</code>", "On / disabled."),
                         ("<code>data-state=\"hover|focus\"</code>", "Documentation only.")]},
    "sources": {"mocks": [("pages/settings/default", "Appearance is saved immediately; a Notifications section would sit beside it"),
                          ("notifications/live-toast/stacked", "the toast kinds a switch would control"),
                          ("pages/increment/default", "Captions on the video player is a toggle button, not a switch")],
                "drift": "none: no mock uses a switch yet."},
}

# ============================================================== form field
_FF_PARTS = fld("Name", '<input class="input" id="@ID" value="Ledgerline" autocomplete="off"@A>', "1–100 characters, unique among your projects", p="ff")


def _ff_cell(kind):
    w = "15rem"
    if kind == "hint":
        return _cell(fld("New budget", _money("350.00"), "Warns again at 80%. $250.00 spent so far.", p="ffm"), w)
    if kind == "error":
        return _cell(fld("New budget", _money("200.00"), err="New budget must be more than the $250.00 already spent.", p="ffm"), w)
    if kind == "success":
        return _cell(fld("Existing repository", '<input class="input" id="@ID" value="https://github.com/northwind/ops-portal"@A>', ok="Hewn can write to northwind/ops-portal.", p="ffm"), w)
    if kind == "readonly":
        return _cell(fld("New budget", _money("350.00").replace("@A", " readonly@A"), "Warns again at 80%. $250.00 spent so far.", p="ffm"), w)
    return _cell(fld("New budget", _money("350.00").replace("@A", " disabled@A"), "Only Owners can raise a budget.", p="ffm"), w)


_FF_MATRIX = matrix(["Hint", "Error", "Success", "Read-only", "Disabled"], [("Field", [_ff_cell(k) for k in ["hint", "error", "success", "readonly", "disabled"]])])
_FF_LEGEND = ('<fieldset class="fieldset field"><legend class="field__label">Location</legend><div class="choices choices--row">'
              '<label class="choice"><input type="radio" name="ff-loc" value="local">Local</label><label class="choice"><input type="radio" name="ff-loc" value="cloud" checked>Cloud</label></div></fieldset>')
_FF_STATIC = ('<div class="field"><p class="field__label">Token</p><div class="codebox mt-2"><code class="mono">hwt_live_8Qm2vR7xKc4pZ1nLw9sTj3dYf6aB0eHg</code>'
              + icon_btn("copy", "Copy token", "ghost", "sm") + "</div></div>")
_FF_CONFIRM = fld("Type <strong>Harbor CRM</strong> to confirm", '<input class="input" id="@ID" autocomplete="off" value="Harbor"@A>', err="Type Harbor CRM exactly to delete it.", p="ff")

SPECS["form-field"] = {
    "lead": "The form field wraps one control with its label, hint, error, success message and counter, in a fixed order and spacing.",
    "readme_variants": "with hint, error, success, counter, optional marker, fieldset as field, static value",
    "readme_states": "hint, invalid, success, read-only, disabled",
    "pills": ["Layout primitive"],
    "overview": f"""<p>Every {page('components/text-field', 'text field')}, {page('components/textarea')} and {page('components/select')} sits in a <code>.field</code>. It owns the parts that are the same for every control, so each form reads the same way: label on top, control, then one line of help that turns into an error when something is wrong. Radio and checkbox groups use the same parts on a <code>&lt;fieldset&gt;</code>, with the legend as the label.</p>
{ul(["<b>Label</b> (<code>.field__label</code>): always visible, above the control; <code>(optional)</code> in a lighter weight when the field can be left empty.",
     "<b>Hint</b> (<code>.field__hint</code>): the rule, the default or the consequence, one line where possible.",
     "<b>Error</b> (<code>.field__error</code>): replaces the hint; icon + text in <code>--color-danger-strong</code>.",
     "<b>Success</b> (<code>.field__success</code>): rare; only for a check the server ran, such as repository access.",
     "<b>Counter</b> (<code>.field__counter</code>): right-aligned, for limits the person can reach.",
     "<b>Static value</b>: a <code>&lt;p class=&quot;field__label&quot;&gt;</code> above a value that is not a control (the new token)."])}
<p>The field also owns validation timing: validate a field when it loses focus after the person has changed it; once a field shows an error, re-validate on every input so the error clears as soon as it is fixed; on submit, validate everything, show the {page('components/form-layout', 'error summary')} and move focus to it. Server-side checks (name already used, no repository access) appear after submit.</p>""",
    "anatomy": (_box(fld("Idea", '<textarea class="textarea" id="@ID" rows="2"@A>Expenses</textarea>', err="The idea must be 10 to 20,000 characters. This one has 8.", counter="8 of 20,000 characters", p="ff"), "26rem"),
                [(6, 8), (50, 36), (6, 74), (94, 92)],
                [("Label", "<code>&lt;label class=\"field__label\" for&gt;</code>; <code>--text-label</code>. Gap below: <code>--space-2</code> (<code>.field__control</code>)."),
                 ("Control", "Any field control at full width."),
                 ("Error (or hint)", "<code>--space-1-5</code> below the control; icon <code>icon--sm</code> + text, <code>--text-body-sm</code>, <code>--color-danger-strong</code>. Hints are <code>--text-caption</code>, <code>--color-fg-subtle</code>."),
                 ("Counter", "<code>--space-1-5</code> below; right-aligned, tabular.")]),
    "variants": f"""{ex(_box(_FF_PARTS + '<div class="mt-6"></div>' + fld("Stack", '<input class="input" id="@ID" placeholder=".NET + Angular"@A>', "Default: .NET backend, Angular frontend", opt=True, p="ff") + '<div class="mt-6"></div>' + _FF_CONFIRM, "28rem"),
    "Hint, optional marker, and a label with emphasis (Delete project: <i>Type <b>Harbor CRM</b> to confirm</i>).", cls="ds-example__canvas--stack")}
{ex(_box(_FF_LEGEND + '<div class="mt-6"></div>' + _FF_STATIC, "28rem"), "A fieldset as a field (legend in the label style) and a static value with a label that is not a <code>&lt;label&gt;</code>.", cls="ds-example__canvas--stack")}""",
    "sizes": NA("The field has no sizes of its own; it follows its control's size and always fills its column."),
    "states": f"""<p>The field's state is the state of its message line. Raise budget's <i>New budget</i> field in each:</p>
{_FF_MATRIX}
{_themes(_box(fld("New budget", _money("200.00"), err="New budget must be more than the $250.00 already spent.", p="ff") + '<div class="mt-6"></div>' + fld("Existing repository", '<input class="input" id="@ID" value="https://github.com/northwind/ops-portal"@A>', ok="Hewn can write to northwind/ops-portal.", p="ff"), "26rem"))}
{ul(["<b>Error</b> replaces the hint because the error repeats the rule; when the hint holds something else the person still needs, keep both (error first).",
     "<b>Success</b> only follows a server check and disappears when the value changes.",
     "<b>Read-only</b> and <b>disabled</b> keep the hint visible so the reason stays readable."])}""",
    "responsive": ul([
        "The field is always one column inside: label, control, message. It never puts the label beside the control in a form; side labels are only for filters (<code>.inline-label</code>).",
        "Between fields: <code>--space-6</code> in pages, <code>--space-5</code> in dialogs; the same at every breakpoint.",
        "From sm two fields can share a row in <code>.form-grid--2</code>; their messages wrap independently, so rows may differ in height.",
        "Messages wrap freely; the error icon stays on the first line (<code>margin-top: --space-0-5</code>)."]),
    "theming": "<p><code>.field</code> declares the field component tokens (<code>--field-bg</code>, <code>--field-fg</code>, <code>--field-border</code>, <code>--field-ring</code>, <code>--field-invalid</code>) that its control reads, so overriding them on one field or a whole form re-skins every control inside. Messages use semantic tokens directly: <code>--color-fg-subtle</code>, <code>--color-danger-strong</code>, <code>--color-success-fg</code>.</p>",
    "a11y": {
        "pattern": "<p>No ARIA widget: native label association plus <code>aria-describedby</code> and <code>aria-invalid</code>, as in the W3C tutorials on <a href=\"https://www.w3.org/WAI/tutorials/forms/instructions/\">instructions</a> and <a href=\"https://www.w3.org/WAI/tutorials/forms/notifications/\">user notifications</a>.</p>",
        "keys": [(kbd("Tab"), "Moves between the controls; labels, hints and errors are not focusable."),
                 ("Click or tap the label", "Focuses (or toggles) the control.")],
        "focus": "<p>Focus rings belong to the controls. The field never steals focus while the person types; errors that appear on blur do not move focus back.</p>",
        "labelling": "<p><code>&lt;label for&gt;</code> names the control; <code>aria-describedby</code> lists the error (or hint) and the counter, in reading order. The error icon is <code>aria-hidden</code>; errors start with the field's name so they make sense when read alone. Fieldsets use <code>&lt;legend class=\"field__label\"&gt;</code>. Live errors that appear on blur are not announced as alerts; they are read when the person returns to the field and listed in the summary on submit.</p>",
        "pairs": [("Label on page", "--color-fg-default", "--color-bg-canvas", 4.5), ("Hint on page", "--color-fg-subtle", "--color-bg-canvas", 4.5),
                  ("Hint in dialog", "--color-fg-subtle", "--color-bg-surface-raised", 4.5), ("Error on page", "--color-danger-strong", "--color-bg-canvas", 4.5),
                  ("Error in dialog", "--color-danger-strong", "--color-bg-surface-raised", 4.5), ("Success on surface", "--color-success-fg", "--color-bg-surface", 4.5)],
        "motion": "<p>Messages appear without animation, so nothing shifts while someone is reading.</p>",
        "touch": "<p>The label extends the control's target. Messages are text, not targets.</p>",
    },
    "content": ul(["Label: a noun, sentence case, no colon; add <i>(optional)</i> rather than marking required fields.",
                   "Hint: the rule, the default or the consequence (<i>Warns again at 80%. $250.00 spent so far.</i>).",
                   "Error: what is wrong, then how to fix it, using the field's name and real numbers (<i>New budget must be more than the $250.00 already spent.</i>).",
                   "Success: what was verified (<i>Hewn can write to northwind/ops-portal.</i>), never <i>Looks good!</i>"]),
    "dodont": [
        (_box(fld("New budget", _money("200.00"), err="New budget must be more than the $250.00 already spent.", p="ff")), "Ring plus an error that says how to fix it.",
         _box('<div class="field"><label class="field__label" for="ff-dd2">New budget</label><div class="field__control"><div class="prefix prefix--money"><span class="prefix__sym" aria-hidden="true">$</span><input class="input" id="ff-dd2" inputmode="decimal" value="200.00" aria-invalid="true"></div></div></div>'),
         "A red ring alone fails 1.4.1 and says nothing about what to change."),
        (_box(fld("Stack", '<input class="input" id="@ID" placeholder=".NET + Angular"@A>', "Default: .NET backend, Angular frontend", opt=True, p="ff")), "Optional fields say so; everything else is required.",
         _box('<div class="field"><label class="field__label" for="ff-dd4">Name <span class="required">*</span></label><div class="field__control"><input class="input" id="ff-dd4" value="Ledgerline"></div></div>'),
         "Asterisks need a legend, are read as <i>star</i> and mark the majority instead of the exception."),
    ],
    "tokens": [("Label", "--text-label"), ("Label colour / optional marker", "--color-fg-default / --color-fg-subtle"), ("Label to control", "--space-2"),
               ("Control to message", "--space-1-5"), ("Hint and counter", "--text-caption"), ("Hint colour", "--color-fg-subtle"),
               ("Error / success text", "--color-danger-strong / --color-success-fg"), ("Error and success type", "--text-body-sm"),
               ("Between fields, page / dialog", "--space-6 / --space-5")],
    "code": {"snippet": """<div class="field">
  <label class="field__label" for="new-budget">New budget</label>
  <div class="field__control">…control…</div>
  <span class="field__error" id="new-budget-err">
    <svg class="icon icon--sm" aria-hidden="true">…</svg>New budget must be more than the $250.00 already spent.
  </span>
</div>
<!-- control: aria-invalid="true" aria-describedby="new-budget-err" -->""",
             "classes": [("<code>.field</code>", "Wrapper; declares the field component tokens."),
                         ("<code>.field__label</code>", "Label (or legend, or static label)."),
                         ("<code>.optional</code>", "Lighter <i>(optional)</i> marker inside the label."),
                         ("<code>.field__control</code>", "Spacing between label and control."),
                         ("<code>.field__hint</code> / <code>.field__error</code> / <code>.field__success</code>", "Message line."),
                         ("<code>.field__counter</code>", "Right-aligned counter.")]},
    "sources": {"mocks": [("dialogs/raise-budget/default", "hint"), ("dialogs/raise-budget/invalid", "error"), ("dialogs/delete-project/invalid", "label with emphasis, error"),
                          ("dialogs/worker-token/success", "static value"), ("dialogs/add-user/default", "fieldset as field"), ("pages/new-direction/default", "optional markers")],
                "drift": "<code>.field__counter</code> and <code>.field__success</code> existed in the kit but no mock used them; counters were drawn as hints. Fieldsets used as fields were reset with inline styles."},
}

# ============================================================== form layout
def _fl_summary(px, sid=True):
    i = f' id="{px}-summary"' if sid else ""
    return (f'<div class="callout callout--danger form-summary" role="alert" tabindex="-1"{i}>' + icon("alert-triangle", "icon--lg")
            + '<div><p class="callout__title">2 things to fix before Hewn can start</p><ul>'
            f'<li><a href="#{px}-name">Name is already used by another project</a></li><li><a href="#{px}-idea">The idea must be 10 to 20,000 characters</a></li></ul></div></div>')


def _fl_invalid_fields(px, rows="3"):
    return (f'<div class="field"><label class="field__label" for="{px}-name">Name</label><div class="field__control"><input class="input" id="{px}-name" value="Field Notes" aria-invalid="true" aria-describedby="{px}-name-err" autocomplete="off"></div>'
            f'<span class="field__error" id="{px}-name-err">{_ERR_ICON}Name is already used by another project. Pick a different name.</span></div>'
            f'<div class="field"><label class="field__label" for="{px}-idea">Idea</label><div class="field__control"><textarea class="textarea" id="{px}-idea" rows="{rows}" aria-invalid="true" aria-describedby="{px}-idea-err">Expenses</textarea></div>'
            f'<span class="field__error" id="{px}-idea-err">{_ERR_ICON}The idea must be 10 to 20,000 characters. This one has 8.</span></div>')


def _fl_form(px):
    return (f'<form class="form-col" style="width: 100%;" action="#states" novalidate>' + _fl_summary(px) + '<div class="stack mt-6" style="gap: var(--space-6);">'
            + _fl_invalid_fields(px) + '<div class="form-grid form-grid--2">'
            + fld("Stack", '<input class="input" id="@ID" placeholder=".NET + Angular"@A>', "Default: .NET backend, Angular frontend", opt=True, p=px)
            + fld("Existing repository", '<input class="input" id="@ID" placeholder="https://github.com/owner/repo"@A>', "Leave empty to create hewn-builds/field-notes.", opt=True, p=px)
            + "</div>" + fld("Budget", _money("400.00"), "Pauses at 100%, warns at 80%. Project default is $300.", p=px, label_extra=_IN_USD) + "</div>"
            '<div class="form-actions"><button class="btn btn--primary" type="submit">' + icon("arrow-right") + 'Start direction</button>'
            '<a class="btn btn--ghost" href="#overview">Cancel</a></div></form>')


_FL_FORM = _fl_form("fl")
_FL_SETTINGS = ('<form class="settings-section" style="width: 100%;" aria-labelledby="fl-s-defaults" action="#states" novalidate><div class="settings-section__intro"><h3 id="fl-s-defaults">Direction defaults</h3><p>What every new direction starts with.</p></div>'
                '<div class="settings-section__body stack" style="gap: var(--space-6);">'
                + fld("Default budget per direction", _money("300.00"), "Warns at 80%, pauses at 100%. Can be changed on each direction.", p="fl", label_extra=_IN_USD)
                + fld("Descope threshold", '<div class="cluster"><input class="input" style="width: 6rem;" id="@ID" inputmode="numeric" value="3"@A><span class="text-sm text-muted">ideal days</span></div>', "Designs estimated above this are split, or deferred with a reason.", p="fl")
                + '<div class="form-actions form-actions--inline"><button class="btn btn--primary" type="submit">Save defaults</button></div></div></form>')
_FL_DIALOG = ('<div class="dialog dialog--static"><div class="dialog__panel" role="dialog" aria-modal="false" aria-labelledby="fl-dlg-title">'
              '<h3 class="dialog__title" id="fl-dlg-title">Raise Kiln Booking’s budget</h3><p class="dialog__text">The direction resumes from checkpoint 4c1e0b2 as soon as the new budget is saved.</p>'
              '<div class="dialog__body">' + fld("New budget", _money("350.00"), "Warns again at 80%. $250.00 spent so far.", p="fl", label_extra=_IN_USD) + '</div>'
              '<div class="dialog__footer">' + btn("Cancel", "ghost") + btn("Raise and resume", "primary", ic="play") + "</div></div></div>")
_FL_CALLOUTS = ('<div class="stack" style="width: 100%; max-width: 36rem;">'
                '<div class="callout callout--danger" role="alert">' + icon("alert-triangle", "icon--lg") + '<div><p class="callout__title">Hewn couldn’t queue this direction</p><p class="callout__body">The API returned 503. Nothing was created; your text is kept below. Try again.</p></div></div>'
                '<div class="callout callout--warn" role="status">' + icon("clock", "icon--lg") + '<div><p class="callout__title">Too many directions in a minute</p><p class="callout__body">You’ve submitted 10 in the last minute. You can submit again in 42 seconds; nothing you typed is lost.</p></div></div>'
                '<div class="callout callout--ok" role="status">' + icon("check-circle", "icon--lg") + '<div><p class="callout__title">Defaults saved</p><p class="callout__body">New directions start with a $350.00 budget and a 3-day descope threshold. Directions already running keep theirs.</p></div></div>'
                '<div class="callout callout--info" role="status">' + icon("info", "icon--lg") + '<div><p class="callout__title">Read-only for Viewers</p><p class="callout__body">You can change your own theme. Defaults, sign-in access and integrations are managed by an Owner.</p></div></div></div>')
_FL_BUSY = ('<div class="stack" style="width: 100%; max-width: 28rem;">'
            + fld("Name", '<input class="input" id="@ID" value="Ledgerline" readonly autocomplete="off"@A>', "1–100 characters, unique among your projects", p="fl")
            + '<div class="form-actions form-actions--inline"><button class="btn btn--primary" type="button" aria-busy="true" aria-disabled="true">' + icon("loader") + 'Queuing direction…</button><a class="btn btn--ghost" href="#states">Cancel</a></div></div>')
_FL_STATES_TABLE = ('<div class="ds-table-wrap"><table class="ds-table"><thead><tr><th scope="col">State</th><th scope="col">What the form does</th><th scope="col">Mock</th></tr></thead><tbody>'
                    + "".join(f"<tr><td>{s}</td><td>{d}</td><td>{mock(m)}</td></tr>" for s, d, m in [
                        ("Default", "Fields with hints; primary action enabled.", "pages/new-direction/default"),
                        ("Invalid", "Error summary at the top (<code>role=\"alert\"</code>, focused), each field marked and explained.", "pages/new-direction/invalid"),
                        ("Submitting", "Fields <code>readonly</code>, submit busy with a progressive label, Cancel still available.", "pages/new-direction/submitting"),
                        ("Error", "Danger callout at the top; values kept; focus on the callout; submit enabled to retry.", "pages/new-direction/error"),
                        ("Rate-limited", "Warning callout with the wait; submit <code>aria-disabled</code> until the wait ends.", "pages/new-direction/rate-limited"),
                        ("Server check failed", "Summary with one item and the field error from the server.", "pages/new-direction/repo-no-access"),
                        ("Success", "Success callout (<code>role=\"status\"</code>) in place, or navigation to the created object.", "pages/settings/success"),
                        ("Read-only", "Info callout explains why; values <code>readonly</code>; no submit.", "pages/settings/viewer"),
                        ("Loading", "Skeletons where values will be; no submit until loaded.", "pages/new-direction/loading")])
                    + "</tbody></table></div>")

SPECS["form-layout"] = {
    "lead": "Form layout arranges fields into a column, groups them, places the actions and reports problems in an error summary.",
    "readme_variants": "single column, two-up row, with side rail, settings section, dialog form, actions bar, error summary",
    "readme_states": "default, invalid, submitting, error, rate-limited, success, read-only, loading",
    "pills": ["<code>&lt;form novalidate&gt;</code>"],
    "overview": f"""<p>Hewn's forms are short and serious: a direction runs to merged code without asking anything else, and settings change what every direction starts with. So every form is one column read top to bottom, fields are grouped by meaning, there is one primary action, and every problem is listed in one place before anything is submitted. See the {page('patterns/forms', 'forms pattern')} for validation timing and confirmation rules.</p>
{ul(["<b>Single column</b> (<code>.form-col</code>, max <code>--layout-form-max</code>): page forms such as New direction.",
     "<b>Two-up row</b> (<code>.form-grid.form-grid--2</code>): only for short, related, optional fields (Stack + Existing repository), from sm.",
     "<b>With side rail</b> (<code>.split.split--form</code>): the form beside a <code>.rail</code> that explains what happens next, from lg.",
     "<b>Settings section</b> (<code>.settings-section</code>): heading and intro on the left, fields on the right from lg; each section saves on its own.",
     "<b>Dialog form</b>: fields in <code>.dialog__body</code>, actions in <code>.dialog__footer</code>.",
     "<b>Actions bar</b> (<code>.form-actions</code>): a hairline and generous space above; <code>--inline</code> drops the hairline for short forms.",
     "<b>Error summary</b> (<code>.callout.callout--danger.form-summary</code>): a count, then one link per problem to its field."])}""",
    "anatomy": (_box(_fl_form("fla"), "40rem"),
                [(4, 4), (1.5, 29), (1.5, 61), (50, 61), (1.5, 93)],
                [("Error summary", "Danger callout, <code>role=\"alert\"</code>, <code>tabindex=\"-1\"</code>; title counts the problems; links jump to fields."),
                 ("Fields", "One column, <code>--space-6</code> apart."),
                 ("Two-up row", "<code>.form-grid--2</code>: two columns from sm, <code>--space-6</code> gap."),
                 ("Optional field", "Optional fields go after required ones."),
                 ("Actions bar", "<code>.form-actions</code>: <code>--space-10</code> above, hairline, primary first then Cancel; <code>--space-3</code> gap.")]),
    "variants": f"""<h3>Page form with summary</h3>
{ex(_box(_FL_FORM, "42rem"), "New direction, invalid: the summary is focused on submit; its links move focus to each field.", cls="ds-example__canvas--stack")}
<h3>Settings section</h3>
{ex(_FL_SETTINGS, "Direction defaults: the section saves on its own with an inline actions bar.", cls="ds-example__canvas--stack")}
<h3>Dialog form</h3>
{ex(_FL_DIALOG, "Raise budget: one field, actions in the footer, primary last (right) from sm, stacked with primary on top below sm.")}
<h3>Form-level messages</h3>
{ex(_FL_CALLOUTS, "Server failure, rate limit, success and read-only callouts, all placed above the first field.", cls="ds-example__canvas--stack")}""",
    "sizes": f"""<p>Forms have widths rather than sizes:</p>
{ul(["Page form column: <code>--layout-form-max</code> (42rem), left-aligned in the content area.",
     "Rail beside it from lg: 20rem, then <code>--layout-rail-aside</code> from xl.",
     "Dialog form: <code>--layout-dialog-width</code> (28rem); <code>--layout-dialog-width-lg</code> when the body shows code.",
     "Settings: a 16rem intro column and the rest for fields from lg.",
     "Short numeric fields keep fixed widths (money 10rem, units 6rem) inside any of these."])}""",
    "states": f"""{_FL_STATES_TABLE}
<h3>Submitting</h3>
{ex(_FL_BUSY, "Fields become <code>readonly</code>; the submit button is <code>aria-busy</code> + <code>aria-disabled</code> (focus stays on it) and its label turns progressive.")}
{_themes(_fl_summary("flt", False) + '<div class="stack mt-4">' + _fl_invalid_fields("flt", "2") + "</div>")}""",
    "responsive": ul([
        "Below sm (36rem): one column; <code>.form-grid--2</code> stacks; the actions bar wraps, primary first; dialogs become bottom sheets with a sticky footer.",
        "From sm: <code>.form-grid--2</code> pairs fields; dialog footers sit in a row, right-aligned.",
        "From lg (62rem): <code>.split--form</code> puts the 20rem rail beside the form with a hairline; settings sections become a 16rem intro column plus fields.",
        "From xl (75rem): the rail widens to <code>--layout-rail-aside</code>. The form column never exceeds 42rem, so line length stays readable on wide screens."]),
    "theming": "<p>Layout uses spacing and border tokens only (<code>--space-*</code>, <code>--border-width-hairline</code>, <code>--color-border-default</code> for the actions bar and rail rules). The summary is a danger " + page("components/alert", "callout") + " and themes with it. Field colours come from the field component tokens.</p>",
    "a11y": {
        "pattern": "<p><code>&lt;form novalidate&gt;</code> with custom messages, following the W3C tutorial on <a href=\"https://www.w3.org/WAI/tutorials/forms/notifications/\">user notifications</a> and <a href=\"https://www.w3.org/WAI/tutorials/forms/grouping/\">grouping controls</a>. Settings sections are <code>&lt;form aria-labelledby&gt;</code> (or <code>&lt;section&gt;</code> when they hold no form) so each is a named region.</p>",
        "keys": [(kbd("Tab"), "Follows visual order: summary links, fields top to bottom, then actions."),
                 (kbd("Enter") + " in a single-line field", "Submits the form."),
                 (kbd("Enter") + " on a summary link", "Moves focus to the field (script calls <code>focus()</code> on the target, not just the scroll)."),
                 (kbd("Esc") + " in a dialog form", "Closes without saving; if fields have changed, asks first.")],
        "focus": "<p>On submit with errors, focus moves to the summary (<code>tabindex=\"-1\"</code>). On a server error, focus moves to the danger callout. While submitting, focus stays on the busy button. On success in place (Settings) focus stays and the success callout is announced; on success that navigates, focus goes to the new page's heading.</p>",
        "labelling": "<p>The summary title counts the problems (<i>3 things to fix before Hewn can start</i>) and each link repeats the field's error in short. Groups use <code>&lt;fieldset&gt;</code> + <code>&lt;legend&gt;</code>. Form-level callouts use <code>role=\"alert\"</code> for failures and <code>role=\"status\"</code> for rate limits, success and read-only notes.</p>",
        "pairs": [("Summary text", "--color-danger-fg", "--color-danger-bg", 4.5), ("Summary title", "--color-danger-strong", "--color-danger-bg", 4.5),
                  ("Summary icon", "--color-danger-icon", "--color-danger-bg", 3), ("Warning callout text", "--color-warning-fg", "--color-warning-bg", 4.5),
                  ("Success callout text", "--color-success-fg", "--color-success-bg", 4.5), ("Focus ring on summary", "--color-focus-ring", "--color-bg-canvas", 3)],
        "motion": "<p>No layout animation: the summary and callouts appear in place and the page scrolls to them instantly (smooth scrolling is off under reduced motion).</p>",
        "touch": "<p>Actions are 40px buttons with 12px between them; on phones in dialogs they are full width. Summary links are text links in a list, each on its own line.</p>",
    },
    "content": ul(["Summary title: a count and the goal: <i>3 things to fix before Hewn can start</i>, <i>2 things to fix</i>.",
                   "Summary items: the field's problem, short, in the same order as the fields; never different words from the field error.",
                   "Primary action names the outcome: <i>Start direction</i>, <i>Save defaults</i>, <i>Raise and resume</i>.",
                   "Server failures say what happened, what was kept and what to do: <i>Nothing was created; your text is kept below. Try again.</i>",
                   "Success says what changed and what did not: <i>Directions already running keep theirs.</i>"]),
    "dodont": [
        (_box('<div class="callout callout--danger form-summary">' + icon("alert-triangle", "icon--lg") + '<div><p class="callout__title">2 things to fix</p><ul><li><a href="#fl-name">Default budget must be $10.00 to $10,000.00</a></li><li><a href="#fl-idea">Descope threshold must be 1 to 20 days</a></li></ul></div></div>', "26rem"),
         "Summary items say what to do, matching the field errors.",
         _box('<div class="callout callout--danger form-summary">' + icon("alert-triangle", "icon--lg") + '<div><p class="callout__title">2 things to fix</p><ul><li><a href="#fl-name">Default budget is out of range</a></li><li><a href="#fl-idea">Descope threshold must be 1 to 20 days</a></li></ul></div></div>', "26rem"),
         "Settings › invalid said <i>out of range</i> in the summary and gave the range only in the field."),
        (_box(_RG_THEME.replace('name="rg-theme"', 'name="fl-dd1"') + '<div class="form-actions form-actions--inline"><button class="btn btn--primary btn--sm" type="button" aria-busy="true" aria-disabled="true">' + icon("loader") + "Saving…</button></div>", "24rem"),
         "While Direction defaults saves, the unrelated Appearance choices stay usable.",
         _box(_RG_THEME.replace('name="rg-theme"', 'name="fl-dd2"').replace('<input ', '<input disabled ') + '<div class="form-actions form-actions--inline"><button class="btn btn--primary btn--sm" type="submit" aria-busy="true" disabled>' + icon("loader") + "Saving…</button></div>", "24rem"),
         "Settings › submitting disabled the theme radios and the busy button (losing its focus)."),
    ],
    "tokens": [("Form column", "--layout-form-max"), ("Rail (xl)", "--layout-rail-aside"), ("Dialog width / large", "--layout-dialog-width / --layout-dialog-width-lg"),
               ("Between fields (page / dialog)", "--space-6 / --space-5"), ("Two-up gap", "--space-6"), ("Actions bar margin / padding / gap", "--space-10 / --space-6 / --space-3"),
               ("Actions bar rule", "--color-border-default"), ("Settings section padding", "--space-8"), ("Summary", "--color-danger-bg / --color-danger-fg / --color-danger-border")],
    "code": {"snippet": """<form class="form-col" novalidate>
  <div class="callout callout--danger form-summary" role="alert" tabindex="-1" id="summary">
    <svg class="icon icon--lg" aria-hidden="true">…</svg>
    <div><p class="callout__title">3 things to fix before Hewn can start</p>
      <ul><li><a href="#name">Name is already used by another project</a></li>…</ul></div>
  </div>
  <div class="stack" style="gap: var(--space-6)">
    …fields… <div class="form-grid form-grid--2">…two short fields…</div>
  </div>
  <div class="form-actions">
    <button class="btn btn--primary" type="submit">Start direction</button>
    <a class="btn btn--ghost" href="/projects">Cancel</a>
  </div>
</form>""",
             "classes": [("<code>.form-col</code>", "Single column capped at <code>--layout-form-max</code>."),
                         ("<code>.split.split--form</code> + <code>.rail</code>", "Form plus side rail from lg."),
                         ("<code>.form-grid</code> / <code>.form-grid--2</code>", "Field grid / two columns from sm."),
                         ("<code>.fieldset</code>", "Unstyled fieldset for groups."),
                         ("<code>.form-actions</code> / <code>--inline</code>", "Actions bar with / without the rule."),
                         ("<code>.form-summary</code>", "On a danger callout: list styling for the problem links."),
                         ("<code>.settings-section</code> + <code>__intro</code> / <code>__body</code>", "Settings row: intro column and fields from lg."),
                         ("<code>novalidate</code>", "Hewn's messages replace the browser's bubbles.")]},
    "sources": {"mocks": [("pages/new-direction/default", "single column with rail"), ("pages/new-direction/invalid", "error summary"),
                          ("pages/new-direction/submitting", "busy"), ("pages/new-direction/error", "server failure"), ("pages/new-direction/rate-limited", "rate limit"),
                          ("pages/settings/default", "settings sections"), ("pages/settings/invalid", "summary"), ("pages/settings/submitting", "busy"),
                          ("pages/settings/success", "success"), ("pages/settings/viewer", "read-only"), ("dialogs/add-user/invalid", "dialog form"),
                          ("dialogs/raise-budget/invalid", "dialog form"), ("dialogs/worker-token/default", "dialog form with select"),
                          ("dialogs/delete-project/confirm", "type to confirm")],
                "drift": "busy submits used <code>disabled</code> (now <code>aria-busy</code> + <code>aria-disabled</code>, as for dialogs); field stacks set <code>gap</code> inline; settings fieldsets were reset inline (now <code>.fieldset</code>); Settings › submitting disabled unrelated theme radios; the rate-limited submit used <code>disabled</code> (now <code>aria-disabled</code> with the reason in the callout)."},
}
