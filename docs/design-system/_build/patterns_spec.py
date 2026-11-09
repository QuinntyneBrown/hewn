"""Pattern pages: how components combine for a job, and the rules that span them.

Each SPECS entry has the PATTERN_SECTIONS keys from build.py (overview, when, structure,
states, responsive, accessibility, content, do-dont, sources) plus lead / desc.
Live examples use components.css classes only; every id is prefixed with the
pattern's short code so the page stays valid when examples repeat.
"""
from common import (btn, code, dodont, ex, icon, icon_btn, kbd, keys, mock, page, pairs, status, table, ul, wordmark)

SPECS = {}


# ================================================================ shared builders
def _field(fid, label, value="", hint=None, err=None, optional=False, money=False, area=False,
           readonly=False, placeholder="", width=None, after=None):
    """A .field. hint / err are text; err wins and sets aria-invalid."""
    desc = f"{fid}-err" if err else (f"{fid}-hint" if hint else "")
    attrs = f' id="{fid}"'
    if placeholder:
        attrs += f' placeholder="{placeholder}"'
    if err:
        attrs += ' aria-invalid="true"'
    if desc:
        attrs += f' aria-describedby="{desc}"'
    if readonly:
        attrs += " readonly"
    if width:
        attrs += f' style="width: {width}"'
    if area:
        ctrl = f'<textarea class="textarea"{attrs} rows="4">{value}</textarea>'
    else:
        im = ' inputmode="decimal"' if money else ""
        ctrl = f'<input class="input"{attrs}{im} value="{value}" autocomplete="off">'
    if money:
        ctrl = f'<div class="prefix prefix--money"><span class="prefix__sym" aria-hidden="true">$</span>{ctrl}</div>'
    if after:
        ctrl = f'<div class="cluster">{ctrl}<span class="text-sm text-muted">{after}</span></div>'
    opt = ' <span class="optional">(optional)</span>' if optional else ""
    tail = ""
    if err:
        tail = f'<span class="field__error" id="{fid}-err">{icon("alert-circle", "icon--sm")}{err}</span>'
    elif hint:
        tail = f'<span class="field__hint" id="{fid}-hint">{hint}</span>'
    return (f'<div class="field"><label class="field__label" for="{fid}">{label}{opt}</label>'
            f'<div class="field__control">{ctrl}</div>{tail}</div>')


_CALLOUT_ICON = {"danger": "alert-triangle", "warn": "alert-triangle", "ok": "check-circle", "info": "info"}


def _callout(kind, title, body="", role="status", ic=None, items=None, cid=None, actions=""):
    """A .callout. items = [(href, text)] makes it an error summary."""
    i = icon(ic or _CALLOUT_ICON[kind], "icon--lg" if items else "")
    extra = ""
    if items:
        lis = "".join(f'<li><a href="{h}">{t}</a></li>' for h, t in items)
        extra = f"<ul>{lis}</ul>"
    b = f'<p class="callout__body">{body}</p>' if body else ""
    acts = f'<div class="callout__actions">{actions}</div>' if actions else ""
    summ = " form-summary" if items else ""
    tab = ' tabindex="-1"' if items else ""
    idattr = f' id="{cid}"' if cid else ""
    return (f'<div class="callout callout--{kind}{summ}" role="{role}"{tab}{idattr}>{i}<div><p class="callout__title">{title}</p>'
            f"{b}{extra}{acts}</div></div>")


def _empty(ic, title, text, mod="", actions="", role="", h="h4"):
    cls = "empty" + "".join(f" empty--{m}" for m in mod.split() if m)
    r = f' role="{role}"' if role else ""
    act = actions
    return (f'<div class="{cls}"{r}>{icon(ic)}<div><{h} class="empty__title">{title}</{h}>'
            f'<p class="empty__text">{text}</p></div>{act}</div>')


def _toast(kind, ic, title, text, actions="", alert=False):
    r = ' role="alert"' if alert else ""
    acts = f'<div class="toast__actions">{actions}</div>' if actions else ""
    return (f'<div class="toast toast--{kind}"{r}>{icon(ic)}<div class="toast__body"><div class="toast__title">{title}</div>'
            f'<div class="toast__text">{text}</div>{acts}</div>'
            f'<button class="toast__close" type="button" aria-label="Dismiss: {title}">{icon("x", "icon--sm")}</button></div>')


def _strip(kind, ic, text, action="", role="status", spin=False):
    cls = "icon--sm icon--spin" if spin else "icon--sm"
    return f'<div class="strip strip--{kind}" role="{role}">{icon(ic, cls)}<span class="strip__text">{text}</span>{action}</div>'


def _meter(label, now, mx, pct, cls="meter--muted meter--inline"):
    tag = "span" if "meter--inline" in cls else "div"
    return (f'<{tag} class="meter {cls}" role="meter" aria-label="{label}" aria-valuenow="{now}" aria-valuemin="0" '
            f'aria-valuemax="{mx}"><span class="meter__bar" style="--value: {pct}%"></span></{tag}>')


def _proj_row(name, sub, word, stage, note, pct, spend, when, acts):
    n = f'<span class="row__note">{note}</span>' if note else ""
    return ('<li class="row">'
            f'<span class="truncate"><a class="row__title" href="#structure">{name}</a><span class="row__sub">{sub}</span></span>'
            f'<span class="row__end lg-hide">{status(word)}</span>'
            f'<span class="row__span truncate"><span>{stage}</span>{n}</span>'
            f'<span class="lg-only">{status(word)}</span>'
            f'<span class="pct">{_meter(name + " complete", pct, 100, pct)}{pct}%</span>'
            f'<span class="row__end tabular">{spend}</span>'
            f'<span class="row__end text-subtle lg-only">{when}</span>'
            f'<span class="row__actions">{acts}</span></li>')


def _locked_acts(name):
    why = "cancel the running direction first"
    return (f'<span class="icon-action" role="button" aria-disabled="true" tabindex="0" aria-label="Archive {name}: {why}" title="Cancel the running direction first">{icon("archive")}</span>'
            f'<span class="icon-action" role="button" aria-disabled="true" tabindex="0" aria-label="Delete {name}: {why}" title="Cancel the running direction first">{icon("trash")}</span>')


def _open_acts(name):
    return (f'<button class="icon-action" type="button" aria-label="Archive {name}" title="Archive">{icon("archive")}</button>'
            f'<button class="icon-action" type="button" aria-label="Delete {name}" title="Delete">{icon("trash")}</button>')


_PROJ_HEAD = ('<div class="rows__head" aria-hidden="true"><span>Project</span><span>Stage</span><span>Status</span><span>Complete</span>'
              '<span class="row__end">Spend</span><span class="row__end">Activity</span><span class="visually-hidden">Actions</span></div>')


def _proj_rows(rows):
    return f'<div class="rows rows--projects">{_PROJ_HEAD}<ul>{"".join(rows)}</ul></div>'


_ROW_LEDGER = _proj_row("Ledgerline", "Expense reconciliation for small accounting teams", "Running", "10 · Increments",
                        "Increment 7 of 12 · implementing, iteration 3", 62, "$184.20", "4 s ago", _locked_acts("Ledgerline"))
_ROW_TIDE = _proj_row("Tidewater", "Tide and swell planner for small-boat charters", "Running", "3 · Design system",
                      "Extracting tokens from 46 mocks", 18, "$41.80", "11 s ago", _locked_acts("Tidewater"))
_ROW_PARCEL = _proj_row("Parcel Post", "Shared mailroom log for coworking spaces", "Blocked", "5 · Requirements",
                        "Requirements failed after 3 retries", 24, "$58.10", "18 m ago", _locked_acts("Parcel Post"))
_ROW_NORTH = _proj_row("Northwind Ops", "Feature: CSV export for the shift report", "Idle", "10 · Increments", "", 100,
                       "$612.45", "2 h ago", _open_acts("Northwind Ops"))
_ROW_HARBOR = _proj_row("Harbor CRM", "Lightweight CRM for marina slip rentals", "Cancelled", "7 · Detailed designs", "", 38,
                        "$96.30", "3 days ago", _open_acts("Harbor CRM"))


def _tabs(label, items, current):
    out = []
    for name, count in items:
        cur = ' aria-current="page"' if name == current else ""
        c = f'<span class="count">{count}</span>' if count else ""
        out.append(f'<a class="tab" href="#structure"{cur}>{name}{c}</a>')
    return f'<nav aria-label="{label}"><div class="tabs">{"".join(out)}</div></nav>'


_FILTERS = [("All", ""), ("Running", "2"), ("Paused", "1"), ("Blocked", "1"), ("Idle", "1"), ("Complete", "1"), ("Cancelled", "1"), ("Archived", "")]


def _skel_rows(n):
    one = ('<li class="row" aria-hidden="true"><span class="stack stack--sm"><span class="skeleton skeleton--w33"></span>'
           '<span class="skeleton skeleton--w66 skeleton--sm"></span></span><span class="skeleton skeleton--w75"></span>'
           '<span class="lg-only"><span class="skeleton skeleton--line"></span></span><span class="lg-only"><span class="skeleton skeleton--line"></span></span></li>')
    return one * n


def _loading_rows(what, n=3):
    return (f'<div aria-busy="true" aria-live="polite"><p class="visually-hidden">Loading {what}</p>'
            f'<div class="rows rows--projects">{_PROJ_HEAD}<ul>{_skel_rows(n)}</ul></div></div>')


def _dialog(pfx, title, text, body, footer, role="alertdialog", panel=""):
    pc = f"dialog__panel {panel}".strip()
    return (f'<div class="dialog dialog--static" role="{role}" aria-labelledby="{pfx}-title" aria-describedby="{pfx}-desc">'
            f'<div class="{pc}"><h4 class="dialog__title" id="{pfx}-title">{title}</h4>'
            f'<p class="dialog__text" id="{pfx}-desc">{text}</p>{body}'
            f'<div class="dialog__footer">{footer}</div></div></div>')


def _sources(items, extra=""):
    lis = "".join(f"<li>{mock(p, n)}</li>" for p, n in items)
    return f"<p>Composed from these mocks:</p><ul>{lis}</ul>{extra}"


# ================================================================ forms
_REPO_HINT = "https://github.com/{owner}/{repo}"
_ND_SUMMARY = _callout("danger", "3 things to fix before Hewn can start", role="alert", cid="fx-summary",
                       items=[("#fx-name", "Name is already used by another project"),
                              ("#fx-idea", "The idea must be 10 to 20,000 characters"),
                              ("#fx-repo", "Existing repository must be a GitHub URL")])
_ND_FORM = ('<form class="form-col" novalidate aria-labelledby="fx-title">'
            '<h4 id="fx-title" style="font: var(--text-h1)">New direction</h4>'
            '<p class="text-sm text-muted mt-1">Once you submit, Hewn runs to merged code without asking you anything.</p>'
            '<div class="stack mt-8" style="gap: var(--space-6)">' + _ND_SUMMARY
            + _field("fx-name", "Name", "Field Notes", err="Name is already used by another project. Pick a different name.")
            + _field("fx-idea", "Idea", "Expenses", area=True, err="The idea must be 10 to 20,000 characters. This one has 8.")
            + '<div class="form-grid form-grid--2">'
            + _field("fx-stack", "Stack", "", hint="Default: .NET backend, Angular frontend", optional=True, placeholder=".NET + Angular")
            + _field("fx-repo", "Existing repository", "gitlab.com/ledgerline", optional=True, placeholder="Creates hewn-builds/ledgerline",
                     err="Use a " + _REPO_HINT + " URL.")
            + "</div>"
            + _field("fx-budget", "Budget", "400.00", money=True, hint="Pauses at 100%, warns at 80%. Project default is $300.")
            + "</div>"
            + '<div class="form-actions">' + btn("Start direction", "primary", ic="arrow-right").replace('type="button"', 'type="submit"')
            + btn("Cancel", "ghost") + "</div></form>")

_SETTINGS_SECTION = ('<form class="settings-section" aria-labelledby="fs-title" novalidate>'
                     '<div class="settings-section__intro"><h4 id="fs-title" style="font: var(--text-h3)">Direction defaults</h4><p>What every new direction starts with.</p></div>'
                     '<div class="settings-section__body stack" style="gap: var(--space-6)">'
                     + _callout("ok", "Defaults saved", "New directions start with a $350.00 budget and a 3-day descope threshold. Directions already running keep theirs.")
                     + _field("fs-budget", "Default budget per direction", "350.00", money=True, hint="Warns at 80%, pauses at 100%. Can be changed on each direction.")
                     + _field("fs-threshold", "Descope threshold", "3", width="6rem", after="ideal days", hint="Designs estimated above this are split, or deferred with a reason.")
                     + '<div class="form-actions">' + btn("Save defaults", "primary").replace('type="button"', 'type="submit"') + "</div></div></form>")


def _mini(pfx, state):
    """Name + budget slice of New direction in one state."""
    top, name_err, ro, submit = "", None, False, btn("Start direction", "primary", ic="arrow-right")
    if state == "invalid":
        top = _callout("danger", "1 thing to fix before Hewn can start", role="alert", items=[(f"#{pfx}-name", "Name is already used by another project")])
        name_err = "Name is already used by another project. Pick a different name."
    elif state == "submitting":
        ro = True
        submit = ('<button class="btn btn--primary" type="button" aria-busy="true" aria-disabled="true">'
                  + icon("loader") + "Queuing direction…</button>")
    elif state == "failed":
        top = _callout("danger", "Hewn couldn’t queue this direction", "The API returned 503. Nothing was created; your text is kept below. Try again.", role="alert")
    elif state == "limited":
        top = _callout("warn", "Too many directions in a minute", "You’ve submitted 10 in the last minute. You can submit again in 42 seconds; nothing you typed is lost.", role="alert", ic="clock")
        submit = '<button class="btn btn--primary" type="button" aria-disabled="true">' + icon("arrow-right") + "Start direction</button>"
    value = "Field Notes" if state == "invalid" else ("" if state == "default" else "Ledgerline")
    body = (top + _field(f"{pfx}-name", "Name", value, hint=None if name_err else "1–100 characters, unique among your projects", err=name_err, readonly=ro)
            + _field(f"{pfx}-budget", "Budget", "400.00", money=True, hint="Pauses at 100%, warns at 80%. Project default is $300.", readonly=ro))
    return (f'<div class="form-col stack" style="gap: var(--space-6); width: 100%">{body}'
            f'<div class="form-actions form-actions--inline">{submit}{btn("Cancel", "ghost")}</div></div>')


_FORM_TIMING = table(["Moment", "What happens", "Why"], [
    ["While typing", "Nothing, except live counters (<i>323 of 20,000 characters</i>) and the type-to-confirm match in delete dialogs.", "Errors that appear mid-word punish people for not being finished."],
    ["On blur", "Format checks a field can answer alone: required, length, URL shape, money range. The error replaces the hint under the field.", "The person has said they are done with the field."],
    ["After an error shows", "Re-validate on every input; clear the error the moment the value becomes valid.", "Keeps the error honest; nobody should have to re-submit to see it gone."],
    ["On submit", "Validate everything; if anything fails, show the error summary at the top, move focus to it, keep every value.", "One place to see the whole job, with links to each field."],
    ["Server answer", "Server-only rules (unique name, GitHub App access) come back as field errors in the same summary; outages come back as a callout above the fields.", "The person cannot tell, and should not need to tell, which side checked."],
])

SPECS["forms"] = {
    "lead": "How Hewn asks for input: one column, labels above, errors under the field and summarised at the top, a single primary action that turns busy while it works.",
    "desc": "Form pattern: layout, labels, validation timing, error summary, submit states and destructive confirmation.",
    "overview": f"""<p>Mission Control has few forms, and each one starts something expensive: a direction that spends up to its budget, a worker token, a budget raise that resumes work. So forms are short, every field explains its limit up front, and nothing typed is ever lost to an error.</p>
{ul(["<b>Page forms</b>: New direction is the only one. A <code>.form-col</code> next to a rail that explains what happens after submit.",
     "<b>Settings sections</b>: each <code>.settings-section</code> that edits values is its own <code>&lt;form&gt;</code> with its own Save button (<i>Save defaults</i>). Sections that take effect immediately (theme) have no button and say so: <i>Saved immediately</i>.",
     "<b>Dialog forms</b>: one to three fields that finish a single action: raise a budget, add a GitHub login, name a worker token.",
     "<b>Destructive confirmation</b>: a dialog that asks the person to type the object's name before the danger button enables (<i>Type Harbor CRM to confirm</i>)."])}
<p>The pattern is assembled from {page('components/form-field')}, {page('components/form-layout')}, {page('components/text-field')}, {page('components/textarea')}, {page('components/select')}, {page('components/radio-group')}, {page('components/switch')}, {page('components/button')}, {page('components/alert')} and {page('components/inline-message')}. Writing rules for labels and errors are in {page('foundations/content', 'Content')}.</p>""",
    "when": table(["Situation", "Use", "Not"], [
        ["Starting new work with several inputs", "A page form with a rail (New direction)", "A dialog: the idea field needs room, and people paste long text"],
        ["Changing saved defaults", "A settings section form with its own Save", "One Save button for the whole Settings page"],
        ["A preference that is safe to apply instantly", "Radios or a " + page("components/switch", "switch") + " with no Save; say <i>Saved immediately</i>", "A Save button that does nothing visible"],
        ["One to three values that complete an action", "A dialog form (Raise budget, Add a GitHub login)", "Navigating away to a page and back"],
        ["Deleting something that cannot be restored", "An alertdialog with type-to-confirm", "A danger button directly on the page (Settings had one; see " + page("components/button#do-dont", "Button") + ")"],
        ["Filtering a list", "Inline selects in the page header, applied on change (Audit)", "A form with an Apply button"],
    ]),
    "structure": f"""<p>New direction after a failed submit: page title and one-line consequence, the error summary, then the fields in the order people think about them, optional ones marked, pairs side by side from sm, money with its prefix, and the actions bar.</p>
{ex(_ND_FORM, "Live: links in the summary move focus to each field. Labels sit above controls; hints and errors sit below and are tied to the control with <code>aria-describedby</code>.", cls="ds-example__canvas--stack")}
<ol>
<li><b>Title and consequence</b>: the page heading plus one sentence on what submitting does (<i>Hewn runs to merged code without asking you anything</i>).</li>
<li><b>Error summary</b> (<code>.callout--danger.form-summary</code>, <code>role="alert"</code>, <code>tabindex="-1"</code>): only after a submit. Title counts the problems and names the goal: <i>3 things to fix before Hewn can start</i>. One link per error, in field order, worded as the problem.</li>
<li><b>Fields</b>: one column (<code>--layout-form-max</code>). Two short, related fields may pair in <code>.form-grid--2</code> from sm (Stack and Existing repository). Long text gets a textarea sized to the expected answer.</li>
<li><b>Hints</b>: the rule before it is broken (<i>1–100 characters, unique among your projects</i>, <i>Pauses at 100%, warns at 80%</i>). When the field errs, the error replaces the hint.</li>
<li><b>Actions bar</b> (<code>.form-actions</code>): primary first and leftmost on pages, then Cancel as a ghost button. In dialogs the order flips: primary last, on the right (see {page('patterns/dialogs-and-overlays')}).</li>
</ol>
<h3>Settings section form</h3>
{ex(_SETTINGS_SECTION, "A section is a form with an intro column (title, one line) and a body. After saving, the result is a success callout in the section, not a toast, so it stays next to what changed.", cls="ds-example__canvas--stack")}
<h3>Validation timing</h3>
{_FORM_TIMING}""",
    "states": f"""<p>Every form moves through the same states. The slice below is New direction's Name and Budget fields; the full mocks are linked under Sources.</p>
<h3>Default</h3>{ex(_mini("fd", "default"), "Hints state the rules. The primary button is enabled even when fields are empty: submitting shows what is missing.", cls="ds-example__canvas--stack")}
<h3>Invalid, with summary</h3>{ex(_mini("fi", "invalid"), "Focus moves to the summary on submit. The field keeps the bad value, gets <code>aria-invalid</code> and an error that says how to fix it.", cls="ds-example__canvas--stack")}
<h3>Submitting</h3>{ex(_mini("fb", "submitting"), "Fields become <code>readonly</code> (still readable and focusable); the primary turns busy with a progressive label. Cancel stays available.", cls="ds-example__canvas--stack")}
<h3>Failed</h3>{ex(_mini("ff", "failed"), "A server or network failure is a danger callout above the fields: what failed, the code, what was not done, and that nothing typed is lost. The button is ready to try again.", cls="ds-example__canvas--stack")}
<h3>Rate limited</h3>{ex(_mini("fr", "limited"), "A temporary refusal is a warning, not an error: say when it can be retried. The primary is <code>aria-disabled</code> until the countdown ends.", cls="ds-example__canvas--stack")}
<h3>Success</h3>
<p>A page form that creates something navigates to it (New direction opens the project pipeline, which shows <i>Waiting for a worker</i>). A section or dialog form that edits values confirms in place: the <i>Defaults saved</i> callout above, or the dialog closing with a toast on the page behind.</p>
<h3>Read-only</h3>
{ex('<div class="stack" style="gap: var(--space-6); width: 100%">' + _callout("info", "Read-only for Viewers", "You can change your own theme. Defaults, sign-in access and integrations are managed by an Owner.", ic="lock") + _field("fv-budget", "Default budget per direction", "300.00", money=True, readonly=True, hint="Warns at 80%, pauses at 100%. Can be changed on each direction.") + "</div>",
    "Viewers see the values as <code>readonly</code> inputs with an info callout that says who can change them; there is no Save button at all.", cls="ds-example__canvas--stack")}
<h3>Destructive confirmation</h3>
<p>Delete project keeps <i>Delete project</i> disabled until the typed name matches exactly; a near miss (<i>Harbor</i>) shows <i>Type Harbor CRM exactly to delete it.</i> The full dialog states are on {page('patterns/dialogs-and-overlays#states', 'Dialogs and overlays')}.</p>""",
    "responsive": ul([
        "Mobile first: one column, full width, inside the page margin (<code>--layout-margin</code>). Controls are 40px tall; the money prefix and inputs never shrink below their text.",
        "From sm (36rem) <code>.form-grid--2</code> puts paired short fields side by side; the page header and its actions sit in a row.",
        "From lg (62rem) <code>.split--form</code> adds the rail (<i>What runs next</i>) beside the form with a hairline; below lg the rail follows the form. Settings sections switch to a 16rem intro column beside the body.",
        "From xl (75rem) the rail widens to <code>--layout-rail-aside</code>; the form column stays at <code>--layout-form-max</code> so lines stay readable.",
        "Dialog forms become bottom sheets below sm with a sticky footer, so <i>Raise and resume</i> is never pushed off screen by the keyboard.",
        "Inputs keep 16px text on phones so iOS does not zoom on focus.",
    ]),
    "accessibility": f"""<h3>Role and pattern</h3>
<p>Native <code>&lt;form novalidate&gt;</code> with native controls; the app runs its own validation so the messages follow these rules rather than the browser's. Each settings form is labelled by its section title (<code>aria-labelledby</code>). Radio groups and type pickers are <code>&lt;fieldset&gt;</code> + <code>&lt;legend&gt;</code> (visually hidden when the section title already says it).</p>
<h3>Keyboard</h3>
{keys([(kbd("Tab"), "Moves through fields, then the actions, in visual order."),
       (kbd("Enter"), "Submits from a single-line input. In a textarea it adds a line."),
       (kbd("Enter") + " on a summary link", "Moves focus into the field with the error (the link targets the control's id)."),
       (kbd("Esc"), "In a dialog form, closes the dialog and keeps nothing; on a page it does nothing.")])}
<h3>Focus and announcements</h3>
<p>On a failed submit, focus moves to the error summary (<code>tabindex="-1"</code>, <code>role="alert"</code>), so its title and count are read at once. Field errors are linked with <code>aria-describedby</code> and the control gets <code>aria-invalid="true"</code>; the error text starts with the field's subject so it makes sense alone. A busy primary keeps focus (<code>aria-busy</code> + <code>aria-disabled</code>, never <code>disabled</code>). Success in place is a <code>role="status"</code> callout; success that navigates moves focus to the new page's <code>h1</code>.</p>
<h3>Labelling</h3>
<p>Every control has a visible <code>&lt;label for&gt;</code>; placeholders only show an example or the default (<i>Creates hewn-builds/ledgerline</i>) and never replace the label. <i>(optional)</i> is part of the label text, so it is read. The money prefix is <code>aria-hidden</code>; the label or hint states the currency where it is not obvious.</p>
<h3>Contrast</h3>
{pairs([("Input edge on surface", "--color-border-strong", "--color-bg-surface", 3), ("Hint text", "--color-fg-subtle", "--color-bg-surface", 4.5),
        ("Field error text", "--color-danger-strong", "--color-bg-surface", 4.5), ("Invalid input ring", "--color-danger-icon", "--color-bg-surface", 3),
        ("Summary title", "--color-danger-strong", "--color-danger-bg", 4.5), ("Summary links and body", "--color-danger-fg", "--color-danger-bg", 4.5),
        ("Read-only value", "--color-fg-muted", "--color-bg-subtle", 4.5), ("Focus ring", "--color-focus-ring", "--color-bg-surface", 3)])}
<h3>Errors are never colour alone</h3>
<p>Each error has an icon, text and a thicker ring (<code>--border-width-thick</code>); the summary repeats it in words. That covers 1.4.1, 3.3.1 and 3.3.3.</p>
<h3>Touch</h3>
<p>Inputs are 40px tall and full width on phones; summary links have a full line of text as the target; actions are 40px buttons with 12px between them.</p>""",
    "content": ul([
        "Labels are nouns in sentence case: <i>Name</i>, <i>Idea</i>, <i>Existing repository</i>, <i>Default budget per direction</i>. No colons, no question marks.",
        "Hints give the rule and the default: <i>1–100 characters, unique among your projects</i>; <i>Default: .NET backend, Angular frontend</i>; <i>Pauses at 100%, warns at 80%. Project default is $300.</i>",
        "Errors say what is wrong and how to fix it, with the actual number: <i>The idea must be 10 to 20,000 characters. This one has 8.</i>; <i>Default budget must be between $10.00 and $10,000.00.</i>",
        "Errors that depend on something outside the form say who can fix it: <i>Hewn’s GitHub App can’t write to northwind/handover. Install the app on that repository, or leave this empty to create one.</i>",
        "Summary titles count and name the goal: <i>3 things to fix before Hewn can start</i>; in Settings, where there is no single goal, <i>2 things to fix</i>. Summary links are short forms of the field errors.",
        "Submit verbs match the outcome: <i>Start direction</i>, <i>Save defaults</i>, <i>Raise and resume</i>, <i>Create token</i>, <i>Add to allow list</i>. The busy label is the progressive form: <i>Queuing direction…</i>, <i>Saving…</i>, <i>Creating token…</i>.",
        "Mark the optional fields, not the required ones: most fields are required, and <i>(optional)</i> is the rarer, more useful signal.",
    ]),
    "do-dont": dodont([
        (_callout("danger", "1 thing to fix before Hewn can start", role="note", items=[("#structure", "Hewn can’t write to this repository")]),
         "Summary counts the problems, names the goal and links each one.",
         _callout("danger", "There were errors in the form", "Please check the fields below.", role="note"),
         "A generic summary with no links makes the person hunt for the problems."),
        ('<button class="btn btn--primary" type="button" aria-busy="true" aria-disabled="true">' + icon("loader") + "Saving…</button>",
         "Busy uses <code>aria-busy</code> + <code>aria-disabled</code>, so focus stays on the button.",
         '<button class="btn btn--primary" type="button" aria-busy="true" disabled>' + icon("loader") + "Saving…</button>",
         "<code>disabled</code> drops focus to the page body. pages/new-direction/submitting and pages/settings/submitting did this."),
        ('<div class="field" style="width: 100%"><label class="field__label">Existing repository <span class="optional">(optional)</span><span class="field__control" style="display: block"><input class="input" placeholder="Creates hewn-builds/ledgerline"></span></label><span class="field__hint">' + _REPO_HINT + "</span></div>",
         "A visible label, the default as a placeholder, and the format as a hint.",
         '<div class="field" style="width: 100%"><div class="field__control"><input class="input" aria-label="Repository" placeholder="Repository URL"></div></div>',
         "A placeholder as the label disappears as soon as the person types."),
    ]),
    "sources": _sources([("pages/new-direction/default", "page form, rail"), ("pages/new-direction/invalid", "error summary and field errors"),
                         ("pages/new-direction/submitting", "busy submit, readonly fields"), ("pages/new-direction/error", "503 callout"),
                         ("pages/new-direction/rate-limited", "warning, countdown"), ("pages/new-direction/repo-no-access", "server-side field error"),
                         ("pages/new-direction/forbidden", "Viewer cannot give direction"),
                         ("pages/settings/default", "section forms, theme saved immediately"), ("pages/settings/invalid", "section summary"),
                         ("pages/settings/submitting", "Saving…"), ("pages/settings/success", "Defaults saved"), ("pages/settings/viewer", "read-only"),
                         ("dialogs/raise-budget/invalid", "dialog form error"), ("dialogs/delete-project/invalid", "type-to-confirm")],
                        "<p>Drift: the submitting mocks set <code>disabled</code> alongside <code>aria-busy</code> (the dialog version is already logged); the pattern uses <code>aria-disabled</code> everywhere. pages/new-direction/rate-limited disables Start direction with <code>disabled</code>; it is <code>aria-disabled</code> here so the reason in the callout stays reachable.</p>"),
}


# ================================================================ feedback and loading
_FB_TABLE = table(["The person…", "Feedback", "Where", "Example"], [
    ["presses a button that finishes in under a second", "None beyond the result itself", "In place", "Theme radio: the page changes theme"],
    ["presses a button that waits on the server", "Busy button, then the result", "The button, then the object", "<i>Pause</i> → <i>Pausing…</i> → status <i>Paused</i> and the callout <i>Paused by quinntynebrown at 14:29</i>"],
    ["submits a form", "Busy primary, then navigate or confirm in place", "The form", "<i>Queuing direction…</i>; <i>Defaults saved</i>"],
    ["confirms a dialog", "Busy danger or primary in the dialog, then close + toast or strip", "Dialog, then page", "<i>Stopping 3 workers…</i> → strip <i>All workers stopped.</i>"],
    ["did something that failed", "Danger callout where they acted", "Form or dialog", "<i>Harbor CRM wasn’t deleted</i>"],
    ["opens a page", "Skeleton in the shape of the content", "The region that loads", "Projects rows, settings sections"],
    ["waits on something with a known end", "Meter or progress bar with numbers", "The object", "Spend <i>$184.20 of $400.00</i>; <i>Increment 7 of 12</i>"],
    ["waits on something with no known end", "Spinner with a sentence", "Inline with text", "<i>Connecting to Mission Control… live updates start in a moment.</i>"],
    ["is told about something they did not do", "Toast (events) or strip (system state)", "Bottom right / under the top bar", "<i>Ledgerline #27 merged</i>; <i>Connection lost.</i>"],
])

_SKEL_SETTINGS = ('<div aria-busy="true" aria-live="polite" style="width: 100%"><p class="visually-hidden">Loading settings</p>'
                  + ('<div class="settings-section"><div class="stack stack--sm"><span class="skeleton skeleton--w50" aria-hidden="true"></span>'
                     '<span class="skeleton skeleton--w75" aria-hidden="true"></span></div><div class="stack"><span class="skeleton skeleton--line" aria-hidden="true"></span>'
                     '<span class="skeleton skeleton--line" aria-hidden="true"></span><span class="skeleton skeleton--w66" aria-hidden="true"></span></div></div>') * 2
                  + "</div>")

_SPEND = ('<div style="min-width: 14rem"><div class="progress__label"><span>Spend</span><span class="tabular"><strong>$184.20</strong> of $400.00</span></div>'
          + _meter("Spend", "184.20", "400.00", 46, "") + "</div>"
          + '<div style="min-width: 14rem"><div class="progress__label"><span>Kiln Booking spend</span><span class="tabular"><strong>$250.00</strong> of $250.00</span></div>'
          + _meter("Kiln Booking spend", 250, 250, 100, "meter--warn") + "</div>")

_SPIN = ('<span class="spinner">' + icon("loader") + "Connecting to Mission Control…</span>"
         + '<span class="status status--run">' + icon("loader", "icon--spin") + "Running</span>")

_BUSY_ROW = (btn("Pause", "", "sm", "pause")
             + '<button class="btn btn--sm" type="button" aria-busy="true" aria-disabled="true">' + icon("loader") + "Pausing…</button>"
             + status("Paused"))

SPECS["feedback"] = {
    "lead": "Every action gets an answer in proportion to it: a busy button for a wait, a callout for a failure, a skeleton for a page, a toast for news the person did not ask for.",
    "desc": "Feedback and loading pattern: which feedback for which action; skeleton vs spinner vs progress.",
    "overview": f"""<p>Hewn works while nobody watches, so Mission Control's feedback has two jobs: confirm what the person just did, and report what the factory did on its own. The first stays where the person acted; the second goes to the edges of the screen and never steals focus.</p>
{_FB_TABLE}
<p>Components: {page('components/button')} (busy), {page('components/alert')} (callout and strip), {page('components/toast')}, {page('components/skeleton')}, {page('components/spinner')}, {page('components/progress-bar')}, {page('components/badge', 'Status')}. How the edge-of-screen messages stack and dismiss is on {page('patterns/notifications')}.</p>""",
    "when": table(["Indicator", "Use when", "Do not use when"], [
        [page("components/skeleton", "Skeleton"), "A page or region is loading and its shape is known (rows, sections, the stage list). Shows within 300 ms.", "One small value is refreshing; a list is being re-filtered (keep the old rows until the new ones arrive)"],
        [page("components/spinner", "Spinner"), "An indeterminate wait inline with a sentence or a status (<i>Connecting…</i>, <i>Running</i>), or inside a busy button.", "A whole page is loading (use a skeleton); the end is known (use a meter)"],
        [page("components/progress-bar", "Meter / progress bar"), "The quantity and its limit are known: spend against budget, percent complete, increments done.", "The number is a guess; there is no limit"],
        ["Busy button", "The person pressed it and is waiting for the server.", "Background work the person did not start"],
        ["Optimistic update", "The change is cheap to undo and almost always succeeds (dismissing a toast, reordering tiles in edit layout).", "Anything that spends money, stops work or deletes"],
    ]),
    "structure": f"""<h3>Loading a region</h3>
{ex(_loading_rows("projects"), "Skeleton rows in the real row grid, <code>aria-busy</code> on the container and a visually hidden <i>Loading projects</i> for screen readers. The page header and filters are real; only the unknown part is a placeholder.", cls="ds-example__canvas--stack")}
{ex(_SKEL_SETTINGS, "Settings: one skeleton per section, in the section's two-column shape.", cls="ds-example__canvas--stack")}
<h3>Waiting on an action</h3>
{ex(_BUSY_ROW, "Before, during and after: the button names its progressive verb while the request runs; the result appears on the object (status word), not in a toast.")}
<h3>Known and unknown waits</h3>
{ex(_SPEND, "Meters always carry the numbers as text. Warning colour at 80%, the paused state at 100%.")}
{ex(_SPIN, "Spinners sit next to words; the status icon spins only for live work (<i>Running</i>, <i>Leased</i>).")}""",
    "states": f"""<p>The lifecycle of one action, <i>Save defaults</i>, and of one region, the Projects list.</p>
{table(["State", "Action (Save defaults)", "Region (Projects)"], [
    ["Idle", "Primary enabled", "Rows"],
    ["Waiting, under 300 ms", "No change (avoid a flash)", "Old content stays"],
    ["Waiting", "<i>Saving…</i>, <code>aria-busy</code>, fields readonly", "Skeleton rows, <i>Loading projects…</i> in the header description"],
    ["Slow (over 10 s)", "Keep busy; never time out silently", "Error state with the timeout: <i>timeout after 10 s</i>"],
    ["Succeeded", "<i>Defaults saved</i> callout in the section", "Rows, focus unchanged"],
    ["Failed", "Danger callout with the code; values kept", "<i>Projects couldn’t load</i> with <i>Try again</i>"],
])}
<h3>Results</h3>
{ex(_callout("ok", "Defaults saved", "New directions start with a $350.00 budget and a 3-day descope threshold. Directions already running keep theirs.") + _callout("danger", "The budget wasn’t changed", "The API returned 503. Kiln Booking is still paused at $250.00; try again.", role="alert"),
    "Success and failure in place. Both say what is true now, not only what happened.", cls="ds-example__canvas--stack")}""",
    "responsive": ul([
        "Skeletons use the same responsive grid as the content they stand for, so nothing jumps when data arrives: one stacked row per project on phones, the full row grid from lg.",
        "Busy labels must fit at 360px: <i>Stopping 3 workers…</i> is the longest in the mocks.",
        "Toasts are full width at the bottom below sm and a fixed <code>--layout-toast-width</code> column bottom right from sm; strips are full width under the top bar at every size.",
        "Meters inside rows are 3.5rem (<code>.meter--inline</code>) with the percentage beside them at every size.",
    ]),
    "accessibility": f"""<h3>Announcements</h3>
<p>Loading containers set <code>aria-busy="true"</code> and contain a visually hidden sentence (<i>Loading projects</i>) inside an <code>aria-live="polite"</code> region; when content arrives the busy flag clears. Results in place use <code>role="status"</code> (success, info) or <code>role="alert"</code> (failure). Busy buttons keep their focus and name; the outcome is announced by the callout, the toast or the dialog closing.</p>
<h3>Keyboard</h3>
{keys([(kbd("Tab"), "Skeletons are <code>aria-hidden</code> and never focusable; focus skips to real controls."),
       (kbd("Enter") + " on a busy button", "Ignored while busy; the button keeps focus."),
       (kbd("Enter") + " on <i>Try again</i>", "Re-runs the load; focus moves to the region's first heading when it succeeds.")])}
<h3>Meters</h3>
<p><code>role="meter"</code> with <code>aria-valuenow</code>, <code>aria-valuemin</code>, <code>aria-valuemax</code> and a label (<i>Ledgerline complete</i>, <i>Spend</i>). The visible text carries the same value.</p>
<h3>Contrast</h3>
{pairs([("Meter fill vs track", "--color-accent", "--color-border-default", 3), ("Warning fill vs track", "--color-warning-solid", "--color-border-default", 3),
        ("Running status text", "--color-fg-accent", "--color-bg-surface", 4.5), ("Success callout text", "--color-success-fg", "--color-success-bg", 4.5),
        ("Danger callout text", "--color-danger-fg", "--color-danger-bg", 4.5), ("Loading caption", "--color-fg-muted", "--color-bg-surface", 4.5)])}
<h3>Motion</h3>
<p>The skeleton shimmer and status pulse use <code>--duration-pulse</code>; the spinner <code>--duration-spin</code>. Reduced motion sets loops to 0s: skeletons become flat shapes and spinners stand still, while the words (<i>Loading projects</i>, <i>Saving…</i>) still say it is working.</p>
<h3>Touch</h3>
<p>Nothing in a loading state is a target. <i>Try again</i> is a 40px button.</p>""",
    "content": ul([
        "Busy labels are the verb's progressive form plus the object when it helps: <i>Queuing direction…</i>, <i>Stopping 3 workers…</i>, <i>Revoking…</i>, <i>Waiting for GitHub…</i>. Use the ellipsis character.",
        "Loading text names the thing: <i>Loading projects</i>, <i>Loading the pipeline</i>. Never <i>Please wait</i>.",
        "Results say what is now true and what did not change: <i>Directions already running keep theirs.</i>; <i>Nothing was removed; try again.</i>",
        "Known waits give the number and the limit: <i>$200.00 of $250.00. It pauses at $250.00.</i>; promised waits give a time: <i>within 10 seconds</i>, <i>usually within 2 seconds</i>.",
        "Never claim success before the server confirms it, except for optimistic, undoable changes.",
    ]),
    "do-dont": dodont([
        (_loading_rows("projects", 2), "A skeleton in the shape of the rows, with the header and filters already real.",
         '<div class="empty empty--center" style="width: 100%"><span class="spinner">' + icon("loader") + "Loading…</span></div>",
         "A centred page spinner says nothing about what is coming and shifts the layout when it arrives."),
        (status("Paused") + '<span class="text-sm text-muted">Paused by quinntynebrown at 14:29</span>',
         "The result of <i>Pause</i> shows on the project itself, where the person is looking.",
         _toast("ok", "check-circle", "Success", "Your request was completed."),
         "A toast for the person's own action: it covers content, vanishes, and says nothing specific."),
    ]),
    "sources": _sources([("pages/projects/loading", "skeleton rows"), ("pages/settings/loading", "section skeletons"), ("pages/project-pipeline/loading", "stage list skeleton"),
                         ("pages/settings/submitting", "Saving…"), ("pages/settings/success", "Defaults saved"), ("dialogs/stop-workers/busy", "Stopping 3 workers…"),
                         ("dialogs/raise-budget/failed", "The budget wasn’t changed"), ("pages/project-pipeline/paused", "result on the object"),
                         ("notifications/connection-banner/info", "spinner in a strip"), ("pages/project-pipeline/budget-reached", "meter at 100%")]),
}


# ================================================================ empty and error states
_EMPTY_KINDS = [
    ("First run (Owner)", _empty("folder-open", "No projects yet", "Describe a product in plain language. Hewn takes it from brief to merged pull requests without stopping to ask.", actions=btn("New product", "primary", ic="plus"))),
    ("First run (Viewer)", _empty("folder-open", "No projects yet", "Nothing is being built yet. When an Owner gives Hewn a direction, the project appears here and you can watch it live.")),
    ("Waiting", _empty("clock", "Waiting for a worker", "The direction is queued. Stage 0 starts as soon as a worker leases it, usually within 2 seconds. Nothing to do here.", "tight")),
    ("No results", _empty("search", "No entries match these filters", "Nobody stopped all workers from Ledgerline. Stop all is recorded against All projects.", "tight", btn("Clear filters"))),
    ("Forbidden", _empty("lock", "You don’t have access", "The audit log records who did what and from where, so only Owners can read it. Ask an Owner if you need an entry.", "forbidden", btn("Back to dashboard"))),
    ("Failed to load", _empty("alert-triangle", "The audit log couldn’t load", "The audit store returned 500. Entries are still being written; nothing has been lost.", "error", '<div class="cluster">' + btn("Try again", ic="refresh") + "</div>", role="alert")),
]

_ERRPAGE = ('<div class="errpage" style="min-height: 0"><div class="errpage__inner"><p class="errpage__code">500 · ref 7c2e-91af</p>'
            '<h4 style="font: var(--text-h1); margin-top: var(--space-2)">Mission Control hit a problem</h4>'
            "<p>The page couldn’t be built. Your directions keep running on their workers; this only affects what you can see. Try again, or share the reference with whoever runs this Hewn.</p>"
            '<div class="cluster">' + btn("Try again", "primary", ic="refresh") + btn("Dashboard", "ghost") + "</div></div></div>")

_EMPTY_FORMULAS = table(["Kind", "Title", "Body", "Action"], [
    ["First run", "<i>No [things] yet</i>", "What appears here and what makes it appear: the stage, the person, the event.", "The one action that creates the first thing, if this person can take it"],
    ["Waiting", "What it is waiting for", "What happens next and roughly when; <i>Nothing to do here.</i> when that is true.", "None"],
    ["No results", "<i>No [things] match these filters</i> / <i>No [filter] [things]</i>", "Why, in terms of the filter; a hint toward where the thing is.", "<i>Clear filters</i> or <i>Show all [things]</i>"],
    ["Forbidden", "<i>You don’t have access</i> / <i>You don’t have permission</i>", "Why the rule exists and who can help: <i>Ask an Owner</i>.", "Back to a page they can use"],
    ["Failed to load", "<i>[Thing] couldn’t load</i>", "The source and code (<i>returned 503</i>, <i>timeout after 10 s</i>), then what is still safe.", "<i>Try again</i>, plus a way out if the page is a dead end"],
    ["Error page", "What happened, in plain words", "What is unaffected; what to do; a reference for 500s.", "Primary recovery + <i>Dashboard</i>"],
])

SPECS["empty-and-error-states"] = {
    "lead": "When a region has nothing to show, say which kind of nothing it is, what will fill it, and the one thing the person can do about it.",
    "desc": "Empty and error states: copy formulas and when to use which.",
    "overview": f"""<p>Mission Control is empty a lot: a new project has no designs until stage 2, no backlog until stage 9, and nobody is allowed to see the audit log without being an Owner. Each of those is a different situation and gets different words, so a person never wonders whether something is broken.</p>
<p>Six kinds share one component, {page('components/empty-state')}: first run, waiting, no results, forbidden, failed to load, and the full {page('components/error-page')}. They replace the region that would hold the content (a tile body, a list, a page body) and keep everything around it: the shell, the page header and its filters stay, so the person can change course.</p>
<p>Copy rules build on {page('foundations/content', 'Content')} and {page('patterns/content-and-tone')}.</p>""",
    "when": table(["Situation", "Kind", "Modifier", "Seen in"], [
        ["The collection exists but nothing is in it yet", "First run", "<code>.empty</code>", "Projects, Workers, Audit, Decisions, Artifacts"],
        ["Something will appear without the person doing anything", "Waiting", "<code>.empty--tight</code>", "Pipeline after New direction"],
        ["Filters or a tab exclude everything", "No results", "<code>.empty--tight</code>", "Audit filters, Decisions filter, Archived tab"],
        ["The person's role cannot see this", "Forbidden", "<code>.empty--forbidden</code>", "Audit for Viewers, New direction for Viewers"],
        ["The data source failed", "Failed to load", "<code>.empty--error</code> + <code>role=&quot;alert&quot;</code>", "Every page's error state"],
        ["The page itself cannot be built or does not exist", "Error page", "<code>.errpage</code>", "404, 500"],
        ["Part of a page failed (one tile)", "Failed to load, in the tile", "<code>.empty--tight.empty--error</code>", "Dashboard partial"],
    ]),
    "structure": f"""<p>Icon, title, one or two sentences, at most two actions. Left aligned in page bodies with a hairline above; centred (<code>.empty--center</code>) only inside small tiles.</p>
{"".join(ex(h, k, cls="ds-example__canvas--stack") for k, h in _EMPTY_KINDS)}
<h3>Error page</h3>
{ex(_ERRPAGE, "A 500 keeps the shell (sidebar and top bar), shows the status code and a reference id in mono, and offers a retry plus a way out.", cls="ds-example__canvas--stack")}
<h3>Copy formulas</h3>
{_EMPTY_FORMULAS}""",
    "states": f"""<p>One region, the Audit log, in each state it can be in. The page header and its filters stay in every state except forbidden, where filters are meaningless.</p>
{table(["State", "What the region shows", "Mock"], [
    ["Loading", "Skeleton table rows, <code>aria-busy</code>", mock("pages/audit/loading")],
    ["Default", "The table, newest first", mock("pages/audit/default")],
    ["Empty", "<i>No entries yet</i>, no action (entries come from activity)", mock("pages/audit/empty")],
    ["No results", "<i>No entries match these filters</i> + <i>Clear filters</i>", mock("pages/audit/no-results")],
    ["Error", "<i>The audit log couldn’t load</i> + <i>Try again</i>", mock("pages/audit/error")],
    ["Forbidden", "<i>You don’t have access</i> + <i>Back to dashboard</i>", mock("pages/audit/forbidden")],
])}
<h3>Choosing the right one</h3>
{ul(["Check permission first, then failure, then filters, then emptiness. A Viewer on Audit sees forbidden even when the store is down.",
     "No results is never shown as first run: if filters are on, say so and offer to clear them.",
     "Role changes the first-run copy, not just the button: Owners get <i>Describe a product…</i> with <i>New product</i>; Viewers get <i>When an Owner gives Hewn a direction…</i> with no button."])}""",
    "responsive": ul([
        "Below sm the icon, text and actions stack left aligned at full width; buttons stay their natural width (they never stretch).",
        "<code>.empty__text</code> is capped at 28rem so lines stay readable on wide screens.",
        "Tight empties (<code>.empty--tight</code>) halve the vertical padding for tiles and filtered lists; centred empties are only used inside tiles, where the tile is the frame.",
        "Error pages centre in at least 70% of the viewport height and keep the 16px margin on phones.",
    ]),
    "accessibility": f"""<h3>Structure</h3>
<p>The empty title is a heading one level below the page heading (<code>h2</code> in a page, <code>h3</code> in a tile), so it shows up in the heading list. The icon is <code>aria-hidden</code>: the title says it all.</p>
<h3>Announcements</h3>
<p>Failed-to-load states carry <code>role="alert"</code> because they replace content the person was waiting for. First run, waiting, no results and forbidden are quiet: they arrive with the page. When filters produce no results, the change is announced by the polite live region that wraps the results.</p>
<h3>Keyboard</h3>
{keys([(kbd("Tab"), "Reaches the state's actions in order: recovery first, way out second."),
       (kbd("Enter") + " on <i>Try again</i>", "Reloads the region; focus moves to its heading when content arrives."),
       (kbd("Enter") + " on <i>Clear filters</i>", "Resets the filters; focus returns to the first filter control.")])}
<h3>Contrast</h3>
{pairs([("Empty title", "--color-fg-default", "--color-bg-canvas", 4.5), ("Empty text", "--color-fg-muted", "--color-bg-canvas", 4.5),
        ("Empty icon (decorative, still visible)", "--color-fg-subtle", "--color-bg-canvas", 4.5), ("Error icon", "--color-danger-icon", "--color-bg-canvas", 3),
        ("Forbidden icon", "--color-warning-icon", "--color-bg-canvas", 3), ("Error page code", "--color-fg-subtle", "--color-bg-canvas", 4.5)])}
<h3>Touch</h3>
<p>Actions are 40px buttons; there is never more than two, so they cannot crowd.</p>""",
    "content": ul([
        "Titles are short statements, not apologies: <i>No backlog yet</i>, <i>Projects couldn’t load</i>, <i>That project isn’t here</i>. No <i>Oops</i>, no exclamation marks.",
        "Explain the factory: say which stage fills the region. <i>The backlog is produced by stage 9, Estimates.</i>; <i>Stage 2 designs every screen and state in Magic Patterns…</i>",
        "Errors name the source and code: <i>The Hewn API returned 503 Service Unavailable.</i>; <i>GitHub returned 502 while listing commits.</i>; <i>timeout after 10 s</i>.",
        "Then say what is still safe, because the person's first fear is lost work: <i>Your directions are still running on their workers.</i>; <i>Entries are still being written; nothing has been lost.</i>",
        "Forbidden says why and who can help, without blame: <i>…so only Owners can read it. Ask an Owner if you need an entry.</i>",
        "404s do not leak: <i>It may have been deleted, or it belongs to a Hewn you can’t see. Nothing about other projects is shown on purpose.</i>",
    ]),
    "do-dont": dodont([
        (_empty("search", "No entries match these filters", "Nobody stopped all workers from Ledgerline. Stop all is recorded against All projects.", "tight", btn("Clear filters")),
         "No results says the filters caused it, hints where the entry is, and offers to clear them.",
         _empty("inbox", "No entries yet", "Sign-ins, directions, pauses, cancels, stops, tokens and merges are recorded here as they happen.", "tight"),
         "The first-run message on a filtered list makes it look as if nothing was ever recorded."),
        (_empty("alert-triangle", "Projects couldn’t load", "The Hewn API returned 503 Service Unavailable. Your directions are still running on their workers.", "tight error", btn("Try again", ic="refresh")),
         "Source, code, what is safe, one recovery action.",
         _empty("alert-triangle", "Something went wrong", "Please try again later.", "tight error"),
         "Vague and final: no cause, no reassurance, no way to retry."),
    ]),
    "sources": _sources([("pages/projects/empty", "Owner first run"), ("pages/projects/viewer-empty", "Viewer first run"), ("pages/projects/no-results", "Archived tab, none"),
                         ("pages/projects/error", "503 with two actions"), ("pages/audit/empty", "no action"), ("pages/audit/no-results", "filters"),
                         ("pages/audit/forbidden", "Owners only"), ("pages/audit/error", "store 500"), ("pages/audit/loading", "skeleton"),
                         ("pages/project-pipeline/empty", "waiting for a worker"), ("pages/backlog/empty", "stage explains"), ("pages/decisions/no-results", "filter by stage"),
                         ("pages/dashboard/partial", "one tile failed"), ("pages/new-direction/forbidden", "permission"), ("pages/not-found/default", "404"),
                         ("pages/server-error/default", "500 with reference")],
                        "<p>Drift: pages/projects/viewer-empty keeps the header description <i>7 projects · sorted by last activity</i> above <i>No projects yet</i>; an empty list's header has no count. pages/projects/no-results (Archived tab, none) contradicts pages/projects/archived, which lists Saltmarsh Survey; treat them as two different data sets.</p>"),
}


# ================================================================ navigation
def _nav_links(current):
    items = [("Dashboard", "layout-grid"), ("Projects", "folder-kanban"), ("Workers", "server"), ("Audit", "scroll-text"), ("Settings", "settings")]
    return "".join(f'<a class="nav-link" href="#structure"{" aria-current=" + chr(34) + "page" + chr(34) if n == current else ""}>{icon(i)}{n}</a>' for n, i in items)


def _side_projects(current=None):
    ps = [("Ledgerline", "Running", "62%"), ("Tidewater", "Running", "18%"), ("Parcel Post", "Blocked", "24%"), ("Kiln Booking", "Paused", "81%")]
    out = []
    for n, s, p in ps:
        cur = ' aria-current="page"' if n == current else ""
        out.append(f'<li><a class="side-project" href="#structure"{cur}>{status_icon_html(s)}<span class="side-project__name">{n}</span>'
                   f'<span class="visually-hidden">, {s},</span><span class="side-project__pct">{p}</span></a></li>')
    return "".join(out)


def status_icon_html(word):
    from common import status_icon
    return status_icon(word)


def _sidebar(current, project=None, conn="Live", dot="dot", viewer=False, sfx="n"):
    cta = "" if viewer else ('<div class="sidebar__cta"><a class="btn btn--primary btn--block" href="#structure">' + icon("plus") + "New direction</a></div>")
    stop = "" if viewer else ('<a class="btn btn--danger btn--sm btn--block" href="#structure" style="margin-top: var(--space-3)">' + icon("octagon-x") + "Stop all workers</a>")
    who, role, ini = ("ama-osei", "Viewer", "AO") if viewer else ("quinntynebrown", "Owner", "QB")
    return ('<div class="sidebar">'
            f'<div class="sidebar__brand">{wordmark("", "#structure", "Hewn, go to dashboard")}</div>{cta}'
            f'<nav class="sidebar__nav" aria-label="Primary, example {sfx}">{_nav_links(current)}</nav>'
            f'<p class="sidebar__section" id="sp-{sfx}">Active directions</p>'
            f'<ul class="sidebar__projects" aria-labelledby="sp-{sfx}">{_side_projects(project)}</ul>'
            f'<div class="sidebar__foot"><div class="conn"><span class="conn__state"><span class="{dot}"></span>{conn}</span>'
            f'<span class="tabular text-subtle">3 of 4 workers</span></div>{stop}'
            f'<div class="user"><span class="avatar" aria-hidden="true">{ini}</span><div class="truncate"><div class="user__name truncate">{who}</div>'
            f'<div class="user__role">{role}</div></div></div></div></div>')


_PHEAD = ('<div class="phead"><div class="phead__top">'
          '<nav aria-label="Breadcrumb, example"><ol class="breadcrumb"><li><a href="#structure">Projects</a></li><li aria-hidden="true">' + icon("chevron-right") + '</li><li aria-current="page">Ledgerline</li></ol></nav>'
          '<div class="phead__row"><div class="truncate"><div class="cluster cluster--lg"><h4 style="font: var(--text-h1)">Ledgerline</h4>' + status("Running") + "</div>"
          '<div class="phead__meta"><span>Product direction · started 7 Nov</span><a class="phead__repo" href="#structure">' + icon("github", "icon--sm") + " hewn-builds/ledgerline</a></div></div>"
          '<div class="phead__stats"><div class="phead__spend"><div class="phead__label"><span>Spend</span><span class="tabular"><strong>$184.20</strong> of $400.00</span></div>'
          + _meter("Spend", "184.20", "400.00", 46, "mt-2") + "</div>"
          + '<div class="cluster">' + btn("Pause", "", "sm", "pause") + btn("Cancel", "ghost", "sm", "x") + "</div></div></div></div>"
          '<nav class="phead__tabs" aria-label="Project sections, example"><div class="tabs tabs--flush">'
          + "".join(f'<a class="tab" href="#structure"{" aria-current=" + chr(34) + "page" + chr(34) if t == "Pipeline" else ""}>{t}</a>' for t in ["Pipeline", "Backlog", "Designs", "Design system", "Decisions", "Artifacts", "Traceability"])
          + "</div></nav></div>")

_SHELL = ('<div class="shell" style="min-height: 0; width: 100%; box-shadow: inset 0 0 0 var(--border-width-hairline) var(--color-border-default)">'
          '<aside class="shell__sidebar" aria-label="Sidebar, example" style="position: static; height: auto">' + _sidebar("Projects", "Ledgerline", sfx="a") + "</aside>"
          '<div class="shell__body"><header class="topbar" style="position: static">'
          + icon_btn("menu", "Open menu", "ghost", attrs="").replace("btn--icon btn--ghost", "btn--icon btn--ghost btn--touch")
          + wordmark("sm", "#structure", "Hewn, go to dashboard")
          + '<span class="topbar__slot" role="img" aria-label="Connection: Live"><span class="dot"></span></span></header>'
          '<div class="shell__main">' + _PHEAD
          + '<div class="pad section"><p class="text-sm text-muted">Stage list and stage detail go here.</p></div></div></div></div>')

_PAGE_HEADER = ('<div style="width: 100%"><div class="page-header" style="padding-inline: 0"><div class="truncate"><h4 style="font: var(--text-h1)">Projects</h4>'
                '<p class="page-header__desc">7 projects · sorted by last activity</p></div><div class="cluster">' + btn("New product", "primary", "sm", "plus") + "</div></div>"
                + _tabs("Filter by status, example", _FILTERS, "All") + "</div>")

_NAV_PARTS = ul([f"{page('components/sidebar-nav', 'Sidebar')}: primary nav, the <i>New direction</i> call to action, active directions with live status, connection state, <i>Stop all workers</i>, and the signed-in person.",
     f"{page('components/top-bar', 'Top bar')}: replaces the sidebar below lg with a menu button that opens the sidebar in a {page('components/drawer', 'drawer')}, the wordmark, and the connection dot.",
     f"{page('components/page-header', 'Page header')}: <code>h1</code>, one-line description, page actions. On project pages it is the project header with status, spend, Pause / Cancel and the tabs.",
     f"{page('components/tabs', 'Tabs')}: links to sibling views (<code>aria-current=&quot;page&quot;</code>), used for project sections and for list filters.",
     f"{page('components/breadcrumb', 'Breadcrumb')}: only on project pages and below (<i>Projects / Ledgerline</i>, <i>Backlog / Increment 7</i>).",
     f"{page('components/skip-link', 'Skip link')}: first focusable element on every page, to <code>#main</code>."])

SPECS["navigation"] = {
    "lead": "One shell everywhere: a sidebar for where you can go, a page header for where you are, project tabs for the views of one project, and a breadcrumb for the way back.",
    "desc": "Navigation and page structure: shell, page header, project tabs, breadcrumbs, back.",
    "overview": f"""<p>Mission Control has two levels. The top level is five places in the sidebar (Dashboard, Projects, Workers, Audit, Settings) plus the active directions under them. The second level is a project, whose seven views (Pipeline, Backlog, Designs, Design system, Decisions, Artifacts, Traceability) are tabs in the {page('components/project-header')}. Everything else is a dialog over one of those pages, never a third level.</p>
{_NAV_PARTS}""",
    "when": table(["Need", "Use", "Not"], [
        ["Move between top-level places", "Sidebar nav link (<code>aria-current=&quot;page&quot;</code>)", "Tabs across the top of the app"],
        ["Switch between views of one project", "Project tabs (links, each its own URL)", "A select, or JS tabs that do not change the URL"],
        ["Narrow a list without leaving it", "Filter tabs with counts (Projects) or inline selects (Audit)", "Sidebar sub-items"],
        ["Get back up one level", "Breadcrumb link", "A lone back arrow: the browser already has one"],
        ["Go straight to a running project", "Sidebar active directions", "Searching the Projects list"],
        ["Leave a dead end (forbidden, 404)", "One button to the nearest useful page: <i>Back to projects</i>, <i>Go to projects</i>", "Only the browser's Back"],
    ]),
    "structure": f"""<h3>The shell at small scale</h3>
{ex(_SHELL, "Live: from lg the sidebar is visible and the top bar hides; below lg (try 360px) the top bar appears and the sidebar moves into the menu drawer. The project header carries breadcrumb, title, status, spend, actions and tabs.", cls="ds-example__canvas--stack")}
<ol>
<li><b>Skip link</b> to <code>#main</code>, then the sidebar (an <code>aside</code> holding <code>nav aria-label="Primary"</code>), then the body.</li>
<li><b>Top bar</b> (below lg): menu button (44px), wordmark linking to the dashboard, connection dot with a text alternative.</li>
<li><b>Strips</b> sit between the top bar and <code>main</code>, full width, so they push content down rather than cover it (see {page('patterns/notifications')}).</li>
<li><b>Page header</b>: one <code>h1</code> per page. Its description is a live summary (<i>2 directions running · 2 need attention · $86.40 spent today</i>), not a tagline.</li>
<li><b>Tabs</b> under the header; the active tab matches the URL.</li>
</ol>
<h3>Top-level page header with filter tabs</h3>
{ex(_PAGE_HEADER, "Projects: title, live count, the page's primary action, then filter tabs inside a labelled <code>nav</code>, each with its count.", cls="ds-example__canvas--stack")}
<h3>Back behaviour</h3>
{ul(["Breadcrumbs start at the top-level place, not at Dashboard: <i>Projects / Ledgerline</i>. The last item is the current page, not a link.",
     "Closing a dialog returns to the page underneath with focus on the trigger; it never adds a history entry.",
     "Tabs and filters are links, so Back walks back through them, which is what people expect from URLs.",
     "Dead ends offer one way forward: forbidden New direction has <i>Back to projects</i>; the 404 has <i>Go to projects</i> and <i>Dashboard</i>."])}""",
    "states": f"""<h3>Current, hover, focus</h3>
{ex('<nav aria-label="Nav link states, example" class="sidebar__nav" style="padding: 0; width: 16rem">' + '<a class="nav-link" href="#states">' + icon("layout-grid") + 'Dashboard</a><a class="nav-link" href="#states" aria-current="page">' + icon("folder-kanban") + 'Projects</a><a class="nav-link" href="#states" data-state="hover">' + icon("server") + 'Workers</a><a class="nav-link" href="#states" data-state="focus">' + icon("scroll-text") + "Audit</a></nav>",
    "Default, current (raised surface, accent icon), hover, focus. Current is set by <code>aria-current=&quot;page&quot;</code> on the place the page belongs to: project pages mark Projects and the project in Active directions.")}
<h3>Connection states in the sidebar foot</h3>
{ex('<div class="conn" style="width: 16rem"><span class="conn__state"><span class="dot"></span>Live</span><span class="tabular text-subtle">3 of 4 workers</span></div>'
    '<div class="conn" style="width: 16rem"><span class="conn__state"><span class="dot dot--warn pulse"></span>Reconnecting…</span><span class="tabular text-subtle">3 of 4 workers</span></div>'
    '<div class="conn" style="width: 16rem"><span class="conn__state"><span class="dot dot--danger"></span>Offline</span><span class="tabular text-subtle">0 of 4 workers</span></div>',
    "The dot never stands alone: the word beside it (and the top bar's <code>aria-label</code>) says the same thing. The strip under the top bar carries the detail.", cls="ds-example__canvas--stack")}
<h3>Role</h3>
{table(["", "Owner", "Viewer"], [
    ["New direction in sidebar", "Yes", "Hidden"],
    ["Stop all workers / Start workers", "Yes", "Hidden"],
    ["Page actions (New product, Edit layout)", "Yes", "Hidden"],
    ["Audit", "Readable", "Linked, shows forbidden"],
    ["Project tabs", "All seven", "All seven"],
])}
<p>Hide what a role can never do; show, with the reason, what it could do in another state (row actions disabled with <i>cancel the running direction first</i>).</p>""",
    "responsive": table(["Breakpoint", "Shell", "Header and tabs"], [
        ["Base (under 36rem)", "Top bar (<code>--layout-topbar-height</code>) with menu button; sidebar in a drawer from the start edge", "Header stacks: title, description, then actions. Tabs scroll sideways with no visible scrollbar"],
        ["sm (36rem)", "Same", "Header actions move beside the title, aligned to the bottom"],
        ["md (48rem)", "Same", "Same; audit table gains the IP column"],
        ["lg (62rem)", "Sidebar (<code>--layout-sidebar-width</code>) sticky beside the body; top bar hidden", "Header padding grows to <code>--space-8</code>; nav links drop to 40px"],
        ["xl (75rem)", "Same", "Project header puts spend and actions beside the title"],
    ]),
    "accessibility": f"""<h3>Landmarks and headings</h3>
<p>Every page has: skip link, <code>aside</code> containing <code>nav aria-label="Primary"</code> (the drawer copy is labelled <i>Primary, menu</i> so the two are distinct), one <code>main id="main"</code>, one <code>h1</code>. Project tabs are a <code>nav aria-label="Project sections"</code>; filter tabs a <code>nav aria-label="Filter by status"</code>; the breadcrumb a <code>nav aria-label="Breadcrumb"</code> with an <code>ol</code>. See the <a href="https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/">APG breadcrumb pattern</a>. Tabs that navigate are links with <code>aria-current</code>, not the APG tabs widget.</p>
<h3>Keyboard</h3>
{keys([(kbd("Tab") + " (first)", "Shows the skip link; " + kbd("Enter") + " jumps to <code>main</code>."),
       (kbd("Tab"), "Sidebar: New direction, five places, active directions, Stop all workers. Then the page."),
       (kbd("Enter"), "Follows a nav link, tab or breadcrumb."),
       (kbd("Esc"), "Closes the menu drawer and returns focus to the menu button.")])}
<h3>Labelling</h3>
<p>Active directions announce status in visually hidden text (<i>Ledgerline, Running, 62%</i>). The connection dot in the top bar is <code>role="img"</code> with <code>aria-label="Connection: Live"</code>, updated with the state. The wordmark link is <i>Hewn, go to dashboard</i>.</p>
<h3>Contrast</h3>
{pairs([("Nav link", "--color-fg-muted", "--color-bg-surface", 4.5), ("Current nav link", "--color-fg-default", "--color-bg-surface-raised", 4.5),
        ("Current nav icon", "--color-fg-accent", "--color-bg-surface-raised", 4.5), ("Tab underline", "--color-accent", "--color-bg-surface", 3),
        ("Breadcrumb", "--color-fg-subtle", "--color-bg-surface", 4.5), ("Section label", "--color-fg-subtle", "--color-bg-surface", 4.5)])}
<h3>Touch</h3>
<p>Below lg nav links, side projects and tabs are 44px (<code>--target-comfortable</code>); from lg they drop to 40px and 32px, where a pointer is likely.</p>""",
    "content": ul([
        "Place names are one word, plural for collections: <i>Projects</i>, <i>Workers</i>; singular for the rest: <i>Dashboard</i>, <i>Audit</i>, <i>Settings</i>. The page <code>h1</code> matches the nav label exactly.",
        "Project tabs are nouns named after what the stage produces: <i>Backlog</i>, <i>Designs</i>, <i>Decisions</i>, <i>Traceability</i>.",
        "Page descriptions are live facts: <i>7 projects · sorted by last activity</i>; <i>All workers stopped · 2 directions held at their checkpoints</i>. Separate facts with a middle dot.",
        "Filter tabs show the count of each filter beside the name, and no count on <i>All</i> or on tabs that are not counted (<i>Archived</i>).",
    ]),
    "do-dont": dodont([
        ('<nav aria-label="Breadcrumb, do"><ol class="breadcrumb"><li><a href="#do-dont">Projects</a></li><li aria-hidden="true">' + icon("chevron-right") + '</li><li aria-current="page">Ledgerline</li></ol></nav>',
         "The breadcrumb starts at the top-level place and ends, unlinked, at the current page.",
         btn("Back", "ghost", "sm"),
         "A lone back button duplicates the browser and hides where Back goes."),
        ('<div class="conn" style="width: 14rem"><span class="conn__state"><span class="dot dot--warn pulse"></span>Reconnecting…</span><span class="tabular text-subtle">3 of 4 workers</span></div>',
         "The connection state changes everywhere at once: sidebar, top bar label and strip.",
         '<div class="stack stack--sm" style="width: 100%">' + _strip("danger", "wifi-off", "Connection lost. Retrying every 30 s.", role="note") + '<span class="topbar__slot" role="img" aria-label="Connection: Live"><span class="dot"></span></span></div>',
         "notifications/connection-banner/* show a lost connection while the top bar still says Live."),
    ]),
    "sources": _sources([("pages/dashboard/default", "shell, page header"), ("pages/projects/default", "filter tabs with counts"), ("pages/project-pipeline/default", "project header, tabs, breadcrumb"),
                         ("pages/dashboard/viewer", "Viewer sidebar"), ("pages/dashboard/reconnecting", "connection state everywhere"),
                         ("pages/dashboard/stopped", "Start workers"), ("dialogs/mobile-nav/default", "drawer"),
                         ("pages/new-direction/forbidden", "Back to projects"), ("pages/not-found/default", "Go to projects")],
                        "<p>Drift: notifications/connection-banner/warning and /danger keep the top bar's <i>Connection: Live</i> under a reconnecting or lost strip (pages/dashboard/reconnecting gets it right). Viewer mocks show ama-osei with the avatar initials <i>QB</i>; settings rows use <i>QU</i> for quinntynebrown. Initials come from the login: <i>AO</i>, <i>QB</i>.</p>"),
}


# ================================================================ dialogs and overlays
_DLG_DELETE = _dialog("dd", "Delete Harbor CRM?",
                      "Its directions, runs, decisions, events and spend history are deleted from Hewn. This can’t be undone.",
                      '<div class="dialog__body">' + _field("dd-name", "Type <strong>Harbor CRM</strong> to confirm", "Harbor",
                                                           err="Type Harbor CRM exactly to delete it.") + "</div>",
                      btn("Cancel", "ghost") + btn("Delete project", "danger", ic="trash", disabled=True))

_DLG_BUDGET = _dialog("db", "Raise Kiln Booking’s budget", "The direction resumes from checkpoint 4c1e0b2 as soon as the new budget is saved.",
                      '<div class="dialog__body">' + _field("db-new", "New budget", "350.00", money=True, hint="Warns again at 80%. $250.00 spent so far.") + "</div>",
                      btn("Cancel", "ghost") + btn("Raise and resume", "primary", ic="play"), role="dialog")

_MENU = ('<div class="menu menu--static" role="menu" aria-label="Ledgerline actions, example">'
         '<button class="menu__item" type="button" role="menuitem">' + icon("pause") + "Pause</button>"
         '<button class="menu__item" type="button" role="menuitem">' + icon("refresh") + "Update skills</button>"
         '<hr class="menu__sep">'
         '<button class="menu__item menu__item--danger" type="button" role="menuitem">' + icon("x") + "Cancel direction…</button></div>")

_TIP = ('<span class="tooltip-anchor">' + icon_btn("refresh", "Refresh workers", "") +
        '<span class="tooltip" role="tooltip" data-state="open">Refresh workers</span></span>')


def _dlg_state(pfx, state):
    title = "Delete Harbor CRM?"
    text = "Its directions, runs, decisions, events and spend history are deleted from Hewn. This can’t be undone."
    val, err, hint, top = "", None, "The GitHub repository is kept; only Hewn’s record is deleted.", ""
    danger = btn("Delete project", "danger", ic="trash", disabled=True)
    if state == "invalid":
        val, err = "Harbor", "Type Harbor CRM exactly to delete it."
    elif state == "confirm":
        val, danger = "Harbor CRM", btn("Delete project", "danger", ic="trash")
    elif state == "busy":
        val = "Harbor CRM"
        danger = '<button class="btn btn--danger" type="button" aria-busy="true" aria-disabled="true">' + icon("loader") + "Deleting…</button>"
    elif state == "failed":
        val = "Harbor CRM"
        top = _callout("danger", "Harbor CRM wasn’t deleted", "The API returned 503. Nothing was removed; try again.", role="alert")
        danger = btn("Try again", "danger", ic="refresh")
    body = top + '<div class="dialog__body">' + _field(f"{pfx}-name", "Type <strong>Harbor CRM</strong> to confirm", val, hint=hint, err=err, readonly=state == "busy") + "</div>"
    return _dialog(pfx, title, text, body, btn("Cancel", "ghost") + danger, panel="")


SPECS["dialogs-and-overlays"] = {
    "lead": "Overlays interrupt. Use a dialog only to confirm something costly or to finish a small task; use a drawer for navigation on phones, a menu for a short list of actions and a tooltip only to name an icon.",
    "desc": "Dialogs and overlays: dialog vs drawer vs menu vs tooltip vs page; mobile sheets.",
    "overview": f"""<p>Every Mission Control dialog stands between the person and something that spends money, stops agents or deletes history: stop all workers, cancel a direction, delete a project, revoke a worker, raise a budget, add a login, create a token, update skills. That is the whole list, and new dialogs should be just as rare.</p>
{ul([f"{page('components/dialog')}: centred modal from sm, bottom sheet below. <code>role=&quot;alertdialog&quot;</code> for destructive confirmations, <code>role=&quot;dialog&quot;</code> for small forms.",
     f"{page('components/drawer')}: the mobile navigation menu, from the start edge. Not used for content.",
     f"{page('components/menu')}: a short list of actions on one object from a menu button.",
     f"{page('components/tooltip')}: the name of an icon-only control, on hover and focus. Never content, never interactive."])}
<p>The page behind a dialog is <code>inert</code> and dimmed by the backdrop (<code>--color-bg-backdrop</code>, <code>--z-overlay</code>); the dialog sits at <code>--z-modal</code>. Only one dialog at a time: a dialog never opens another.</p>""",
    "when": table(["Need", "Use", "Not"], [
        ["Confirm an action that cannot be undone or spends money", "Alertdialog: consequence, then a danger or primary button named for the action", "A browser <code>confirm()</code>; an undo toast for things that cannot actually be undone"],
        ["Finish a task of one to three fields", "Dialog form (Raise budget, Add a GitHub login, New worker token)", "A new page"],
        ["Fill in long or several-part input", "A page (New direction)", "A large dialog with scrolling"],
        ["Show a secret once (worker token)", "The dialog's success state, with Copy and <i>Done</i>", "A toast, which can vanish before it is copied"],
        ["Navigate on a phone", "Drawer with the sidebar inside", "A bottom sheet or full-screen page"],
        ["Offer several actions on one object", "Menu", "A row of five buttons"],
        ["Name an icon-only button", "Tooltip plus <code>aria-label</code>", "A tooltip with links or longer help (use a hint or a page)"],
    ]),
    "structure": f"""<h3>Destructive confirmation (alertdialog)</h3>
{ex(_DLG_DELETE, "Shown static. Title as a question naming the object; text says exactly what is lost and what is kept; type-to-confirm; Cancel then the danger action, named for what it does. In the app: <code>aria-modal=&quot;true&quot;</code>, backdrop, page <code>inert</code>.", cls="ds-example__canvas--stack ds-example__canvas--canvas")}
<h3>Small form (dialog)</h3>
{ex(_DLG_BUDGET, "Title as an instruction; text says what happens on save; one field with the current figure in its hint; the primary names both outcomes: <i>Raise and resume</i>.", cls="ds-example__canvas--stack ds-example__canvas--canvas")}
<h3>Menu and tooltip</h3>
{ex('<div class="cluster" style="align-items: flex-start; gap: var(--space-12)">' + _MENU + '<div style="padding-top: var(--space-10)">' + _TIP + "</div></div>",
    "A menu groups object actions, destructive ones last and separated, with an ellipsis when they open a dialog. The tooltip only names the icon.")}
<h3>Rules that span them</h3>
{ul(["<b>Anatomy order</b>: title, text, optional callout (failures), body (fields or the affected list), footer. Footer: Cancel (ghost) first, the action last, right aligned from sm.",
     "<b>The affected list</b>: when an action touches several things, list them (Stop all workers lists the three workers and what each was running).",
     "<b>Dismissal</b>: <kbd>Esc</kbd>, Cancel and the backdrop close form dialogs; alertdialogs close on <kbd>Esc</kbd> and Cancel only, never on a stray backdrop tap. A busy dialog cannot be dismissed until the request settles.",
     "<b>After</b>: close and show the result on the page (a strip for Stop all workers, the status for Cancel direction, the row gone for Delete project). The token dialog is the exception: it stays open on success to show the secret once."])}""",
    "states": f"""<p>Delete project through its states. The same five apply to every dialog that sends a request.</p>
<h3>Default</h3>{ex(_dlg_state("d1", "default"), "Danger action disabled until the name matches.", cls="ds-example__canvas--stack ds-example__canvas--canvas")}
<h3>Invalid</h3>{ex(_dlg_state("d2", "invalid"), "A near miss explains exactly what to type.", cls="ds-example__canvas--stack ds-example__canvas--canvas")}
<h3>Confirmed, ready</h3>{ex(_dlg_state("d3", "confirm"), "The match enables Delete project.", cls="ds-example__canvas--stack ds-example__canvas--canvas")}
<h3>Busy</h3>{ex(_dlg_state("d4", "busy"), "<i>Deleting…</i> keeps focus (<code>aria-busy</code> + <code>aria-disabled</code>); the field is readonly; Esc and Cancel wait.", cls="ds-example__canvas--stack ds-example__canvas--canvas")}
<h3>Failed</h3>{ex(_dlg_state("d5", "failed"), "The failure is a callout inside the dialog, under the text; the typed name is kept so <i>Try again</i> is one press.", cls="ds-example__canvas--stack ds-example__canvas--canvas")}""",
    "responsive": table(["Breakpoint", "Dialog", "Drawer, menu, tooltip"], [
        ["Base (under 36rem)", "Bottom sheet: full width, top corners <code>--radius-xl</code>, max 90% of the viewport height, body scrolls, footer sticky with safe-area padding, buttons stacked full width with the action on top", "Drawer up to 85% of the width; menus open below the trigger and stay inside the viewport; tooltips do not appear on touch (the label is in <code>aria-label</code>)"],
        ["sm (36rem) and up", "Centred panel, <code>--layout-dialog-width</code> (<code>-lg</code> for the token dialog), <code>--radius-lg</code>, footer in a row, right aligned", "Drawer not used from lg (the sidebar is always visible)"],
    ]),
    "accessibility": f"""<h3>Role and pattern</h3>
<p><a href="https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/">APG alert dialog</a> for confirmations and <a href="https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/">APG modal dialog</a> for forms and the drawer: <code>aria-modal="true"</code>, labelled by the title, described by the text; the page behind is <code>inert</code>. Menus follow the <a href="https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/">APG menu button</a>; tooltips the <a href="https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/">APG tooltip</a>.</p>
<h3>Keyboard</h3>
{keys([(kbd("Tab") + " / " + kbd("Shift", "Tab"), "Cycles inside the dialog only."),
       (kbd("Esc"), "Closes the dialog, drawer, menu or tooltip and returns focus to the trigger (not while busy)."),
       (kbd("Enter"), "In a form dialog, submits from a single-line field."),
       (kbd("↑") + " / " + kbd("↓"), "Moves between menu items; " + kbd("Home") + " / " + kbd("End") + " jump to the ends.")])}
<h3>Initial focus</h3>
{ul(["Form dialogs: the first field (<i>New budget</i>).",
     "Type-to-confirm: the confirmation field.",
     "Plain confirmations (Stop all workers, Cancel direction): the safe button (Cancel / <i>Keep running</i>), so a stray Enter does no harm.",
     "Drawer: the close button."])}
<h3>Contrast</h3>
{pairs([("Dialog text on raised surface", "--color-fg-muted", "--color-bg-surface-raised", 4.5), ("Dialog title", "--color-fg-default", "--color-bg-surface-raised", 4.5),
        ("Danger label", "--color-fg-on-danger", "--color-danger-solid", 4.5), ("Field edge in dialog", "--color-border-strong", "--color-bg-surface-raised", 3),
        ("Focus ring in dialog", "--color-focus-ring", "--color-bg-surface-raised", 3), ("Tooltip", "--color-fg-inverse", "--color-bg-inverse", 4.5)])}
<h3>Motion</h3>
<p>Dialogs rise in from sm and slide up as sheets below, over <code>--duration-slow</code> with <code>--ease-enter</code>; the drawer slides from the start edge. Reduced motion removes the movement; the dialog simply appears.</p>
<h3>Touch</h3>
<p>Sheet buttons are full width and 40px tall; the drawer close button is 44px. The sticky footer keeps the action reachable above the on-screen keyboard.</p>""",
    "content": ul([
        "Confirmation titles are a question naming the action and the object: <i>Delete Harbor CRM?</i>, <i>Stop all workers?</i>, <i>Revoke build-box-02?</i>, <i>Cancel Ledgerline’s direction?</i>",
        "Form dialog titles are an instruction or the thing being made: <i>Raise Kiln Booking’s budget</i>, <i>Add a GitHub login</i>, <i>New worker token</i>.",
        "The text says what happens, what is kept and whether it can be undone, with numbers: <i>All 3 online workers halt their active runs within 10 seconds…</i>; <i>Six merged increments stay merged.</i>; <i>This can’t be undone.</i>",
        "The action button repeats the verb of the title: <i>Delete project</i>, <i>Stop all workers</i>, <i>Cancel direction</i>. When the action itself is <i>Cancel</i>, the dismiss button becomes <i>Keep running</i> so two Cancels never sit side by side.",
        "Failure callouts in dialogs say the object was not changed: <i>Harbor CRM wasn’t deleted</i>, <i>The budget wasn’t changed</i>, <i>Cancel didn’t reach the worker</i>.",
    ]),
    "do-dont": dodont([
        ('<div class="cluster">' + btn("Keep running", "ghost") + btn("Cancel direction", "danger", ic="x") + "</div>",
         "When the action is a cancel, the dismiss says what staying means.",
         '<div class="cluster">' + btn("Cancel", "ghost") + btn("Cancel", "danger") + "</div>",
         "Two Cancels: nobody can tell which one stops the direction."),
        (_callout("danger", "Harbor CRM wasn’t deleted", "The API returned 503. Nothing was removed; try again.", role="note") + _field("dx1", "Type <strong>Harbor CRM</strong> to confirm", "Harbor CRM"),
         "After a failure the typed confirmation is kept, so the retry is honest and quick.",
         _callout("danger", "Harbor CRM wasn’t deleted", "The API returned 503. Nothing was removed; try again.", role="note") + _field("dx2", "Type <strong>Harbor CRM</strong> to confirm", ""),
         "dialogs/delete-project/failed clears the field yet leaves <i>Try again</i> enabled, skipping the type-to-confirm gate."),
    ]),
    "sources": _sources([("dialogs/delete-project/default", "type-to-confirm"), ("dialogs/delete-project/invalid", ""), ("dialogs/delete-project/confirm", ""),
                         ("dialogs/delete-project/busy", "Deleting…"), ("dialogs/delete-project/failed", "callout in dialog"),
                         ("dialogs/stop-workers/default", "affected list"), ("dialogs/cancel-direction/default", "Keep running"),
                         ("dialogs/raise-budget/default", "form dialog"), ("dialogs/worker-token/success", "secret shown once"),
                         ("dialogs/revoke-worker/default", ""), ("dialogs/mobile-nav/default", "drawer")],
                        "<p>Drift: dialogs/delete-project/failed empties the confirmation field while <i>Try again</i> stays enabled. Logged here; the pattern keeps the typed value.</p>"),
}


# ================================================================ data tables and lists
_AUDIT_FILTERS = ('<div class="cluster"><label class="inline-label"><span class="visually-hidden">Project</span><select class="select select--auto input--sm">'
                  "<option selected>All projects</option><option>Ledgerline</option><option>Tidewater</option><option>Northwind Ops</option><option>Harbor CRM</option></select></label>"
                  '<label class="inline-label"><span class="visually-hidden">Action</span><select class="select select--auto input--sm">'
                  "<option selected>All actions</option><option>Sign in</option><option>Pause</option><option>Resume</option><option>Merge</option><option>Stop all workers</option></select></label></div>")


def _audit_row(when, who, action, target, ip, warn=False):
    a = f'<span class="text-warn">{action}</span>' if warn else f"<span>{action}</span>"
    return (f'<tr><td class="mono text-muted tabular">{when}</td><td>{who}</td><td>{a}<span class="text-caption sm-hide" style="display: block">{target}</span></td>'
            f'<td class="col-sm text-muted">{target}</td><td class="col-md num mono text-subtle">{ip}</td></tr>')


_AUDIT = ('<div class="table-wrap" style="width: 100%"><table class="table"><caption class="visually-hidden">Audit log, newest first</caption>'
          '<thead><tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">Action</th><th scope="col" class="col-sm">Target</th><th scope="col" class="col-md num">IP</th></tr></thead><tbody>'
          + _audit_row("9 Nov 2026, 14:31:07", "quinntynebrown", "Merge", "Ledgerline #27", "—")
          + _audit_row("9 Nov 2026, 13:02:44", "quinntynebrown", "Resume", "Tidewater", "24.114.38.91")
          + _audit_row("9 Nov 2026, 10:15:22", "ama-osei", "Sign in", "—", "99.230.12.4")
          + _audit_row("8 Nov 2026, 17:01:36", "quinntynebrown", "Cancel", "Harbor CRM", "24.114.38.91", True)
          + "</tbody></table></div>")

_DATA_WHICH = table(["Component", "Use for", "Mobile strategy", "Seen in"], [
    [page("components/row-list", "Row list"), "Objects people act on, with a title, status, a few figures and row actions", "Each row stacks: title and status, then the stage line, then figures; actions move to their own line", "Projects, Backlog, Workers, Users"],
    [page("components/table", "Table"), "Records read across columns: logs, runs, matrices", "Low-priority columns hide (<code>.col-sm</code>, <code>.col-md</code>); their value moves under the main cell as a caption; the rest scrolls inside <code>.table-wrap</code>", "Audit, Runs, Traceability matrix"],
    [page("components/list", "List"), "One or two lines per item, no columns: events, PRs, files, checks", "Unchanged", "Dashboard tiles, Artifacts"],
    [page("components/description-list", "Description list"), "Properties of one object", "Pairs stack", "Increment, Worker detail"],
])

SPECS["data-tables-and-lists"] = {
    "lead": "Lists of projects, workers and log entries: dense enough to scan, specific about status, with the object's actions in its row and a mobile layout that stacks instead of scrolling.",
    "desc": "Data tables and lists: density, filtering, selection, row actions, responsive strategy.",
    "overview": f"""<p>Most of Mission Control is a list of something that is changing: projects at different stages, workers leasing runs, audit entries arriving. The pattern decides which component holds the data, how people narrow it, what they can do to one item, and what happens on a phone.</p>
{_DATA_WHICH}
<p>Status is always {page('components/badge', 'icon + word')}; figures are tabular and right aligned; time is relative in lists (<i>4 s ago</i>) and absolute in logs (<i>9 Nov 2026, 14:31:07</i>). Filtering uses {page('components/tabs')} or {page('components/select')}; long ordered sets use {page('components/pagination')}; filters applied as tags use {page('components/chip', 'chips')}.</p>""",
    "when": table(["Question", "Answer"], [
        ["Row list or table?", "If each item is an object you open or act on, a row list. If each item is a record you read across, a table."],
        ["Filter tabs or selects?", "Tabs when there are up to eight mutually exclusive filters worth counting (project status). Selects when filters combine or have many values (Audit: project × action)."],
        ["Pagination or load more?", "Pagination for ordered records people come back to (audit, runs). Short lists (projects, workers, under 50) show everything. No infinite scroll: footers and the end of a list must be reachable."],
        ["Row actions or a detail page?", "Up to two frequent actions as icon buttons in the row (Archive, Delete; Revoke; Remove). Everything else on the object's page."],
        ["Selection and bulk actions?", "Not used: Hewn's destructive actions are one object at a time on purpose. Selected rows (<code>aria-selected</code>) only mark the current item in a master-detail view (Backlog, Traceability)."],
        ["Sorting?", "Each list has one natural order, stated in the header (<i>sorted by last activity</i>, <i>newest first</i>). Sortable column headers use <code>aria-sort</code> with a button, only where people asked for another order."],
    ]),
    "structure": f"""<h3>Project row list with filters and row actions</h3>
{ex('<div style="width: 100%">' + _tabs("Filter by status, data example", _FILTERS, "All") + '<div class="mt-4">' + _proj_rows([_ROW_LEDGER, _ROW_PARCEL, _ROW_NORTH, _ROW_HARBOR]) + "</div></div>",
    "Title links to the project; status is icon + word; the stage line carries the live note; spend is tabular and right aligned. Row actions are enabled only when they can work: on a running project they are <code>aria-disabled</code> and say why.", cls="ds-example__canvas--stack")}
{ul(["<b>Column header</b> (<code>.rows__head</code>) is visual only (<code>aria-hidden</code>) and appears from lg; each cell carries its own meaning in text, so the stacked mobile row needs no header.",
     "<b>Row title</b> is the only link in the row; the row itself is not clickable, so actions inside it are unambiguous.",
     "<b>Row actions</b> are <code>.icon-action</code> buttons whose <code>aria-label</code> names verb and object (<i>Archive Northwind Ops</i>). Disabled ones stay focusable with <code>aria-disabled</code> and the reason in the label and tooltip.",
     "<b>Destructive row actions</b> open a dialog (Delete → delete-project); reversible ones act at once and say so (Archive moves the row to the Archived tab, which offers <i>Restore</i>)."])}
<h3>Audit table with inline filters</h3>
{ex('<div style="width: 100%"><div class="cluster cluster--between">' + '<span class="text-sm text-muted">Who did what, when and from where. Entries can’t be edited.</span>' + _AUDIT_FILTERS + '</div><div class="mt-4">' + _AUDIT + "</div></div>",
    "Timestamps are mono and absolute; the Target column hides below sm and its value appears under the action; IP hides below md. Destructive actions are tinted warning, with the word itself saying what happened.", cls="ds-example__canvas--stack")}""",
    "states": f"""<p>Every data region has the same seven states; the region is replaced, the page header and filters stay.</p>
<h3>Loading</h3>{ex(_loading_rows("projects", 3), "Skeleton rows in the row grid.", cls="ds-example__canvas--stack")}
<h3>Filtered</h3>{ex('<div style="width: 100%">' + _tabs("Filter by status, filtered example", _FILTERS, "Blocked") + '<div class="mt-4">' + _proj_rows([_ROW_PARCEL]) + "</div></div>", "The current filter tab is marked; counts never change with the filter.", cls="ds-example__canvas--stack")}
<h3>Empty, no results, error, forbidden</h3>
{ex(_empty("folder-open", "No projects yet", "Describe a product in plain language. Hewn takes it from brief to merged pull requests without stopping to ask.", "tight", btn("New product", "primary", ic="plus"))
    + _empty("archive", "No archived projects", "Archive a project you’ve finished with to keep this list short. Archived projects can be restored.", "tight", btn("Show all projects"))
    + _empty("alert-triangle", "Projects couldn’t load", "The Hewn API returned 503 Service Unavailable. Your directions are still running on their workers.", "tight error", '<div class="cluster">' + btn("Try again", ic="refresh") + btn("Go to dashboard", "ghost") + "</div>", role="alert")
    + _empty("lock", "You don’t have access", "The audit log records who did what and from where, so only Owners can read it. Ask an Owner if you need an entry.", "tight forbidden", btn("Back to dashboard")),
    "Formulas and selection rules are on " + page("patterns/empty-and-error-states", "Empty and error states") + ".", cls="ds-example__canvas--stack")}
<h3>Row states</h3>
{ex('<div class="rows rows--users" style="width: 100%"><ul>'
    '<li class="row"><span class="cluster"><span class="avatar" aria-hidden="true">QB</span><span class="mono">quinntynebrown</span></span><span class="text-sm">Owner</span><span class="text-xs text-subtle lg-only">Today, 08:02</span><span class="row__actions"></span></li>'
    '<li class="row" data-state="hover"><span class="cluster"><span class="avatar" aria-hidden="true">AO</span><span class="mono">ama-osei</span></span><span class="text-sm">Viewer</span><span class="text-xs text-subtle lg-only">Today, 10:15</span><span class="row__actions">' + btn("Remove", "ghost", "sm", attrs='aria-label="Remove ama-osei"') + "</span></li>"
    '<li class="row" aria-selected="true"><span class="cluster"><span class="avatar" aria-hidden="true">DP</span><span class="mono">devon-park</span></span><span class="text-sm">Viewer</span><span class="text-xs text-subtle lg-only">Never</span><span class="row__actions">' + btn("Remove", "ghost", "sm", attrs='aria-label="Remove devon-park"') + "</span></li></ul></div>",
    "Default, hover (<code>--color-bg-subtle</code>), selected (<code>--color-accent-subtle</code>). The signed-in Owner cannot remove themselves, so their row has no action.", cls="ds-example__canvas--stack")}""",
    "responsive": table(["Breakpoint", "Row list", "Table"], [
        ["Base (under 36rem)", "Rows stack: title + status on one line, stage and note below, then figures; actions on their own line, right aligned, 44px", "Only primary columns; secondary values as captions under the main cell; horizontal scroll inside <code>.table-wrap</code> as a last resort"],
        ["sm (36rem)", "Same", "<code>.col-sm</code> columns appear (Target)"],
        ["md (48rem)", "Same", "<code>.col-md</code> columns appear (IP)"],
        ["lg (62rem)", "Column grid with the visual header; <code>.lg-only</code> cells appear (Activity, Last sign-in); actions 32px", "Full table; dense variant available for runs"],
    ]),
    "accessibility": f"""<h3>Semantics</h3>
<p>Row lists are a <code>ul</code> of <code>li.row</code>: each cell's text stands alone (status words, <i>Last sign-in: Never</i>), so the visual column header is <code>aria-hidden</code>. Tables are real <code>table</code>s with a caption (visually hidden when the page title says it), <code>th scope="col"</code>, and <code>aria-sort</code> on sortable headers (<a href="https://www.w3.org/WAI/ARIA/apg/patterns/table/examples/sortable-table/">APG sortable table</a>). Filter tabs are links in a labelled <code>nav</code>; filter selects have visually hidden labels.</p>
<h3>Keyboard</h3>
{keys([(kbd("Tab"), "Row title link, then each row action, row by row. Disabled actions stay in the order so their reason can be heard."),
       (kbd("Enter") + " / " + kbd("Space"), "Activates a row action; Delete opens its dialog and focus returns to the same row's button."),
       (kbd("Shift", "Tab") + " after a filter", "Filters apply on change; focus stays on the control and the result count is announced politely.")])}
<h3>Labelling</h3>
<p>Row actions name the object: <i>Archive Ledgerline</i>, <i>Remove ama-osei</i>, <i>Restore Saltmarsh Survey</i>; disabled ones add the reason: <i>Delete Ledgerline: cancel the running direction first</i>. Meters in rows are labelled <i>Ledgerline complete</i> and the percentage is printed beside them.</p>
<h3>Contrast</h3>
{pairs([("Row text", "--color-fg-default", "--color-bg-canvas", 4.5), ("Row sub and figures", "--color-fg-muted", "--color-bg-canvas", 4.5),
        ("Header and activity", "--color-fg-subtle", "--color-bg-canvas", 4.5), ("Text on hovered row", "--color-fg-subtle", "--color-bg-subtle-hover", 4.5),
        ("Text on selected row", "--color-fg-default", "--color-accent-subtle", 4.5), ("Focus ring on selected row", "--color-focus-ring", "--color-accent-subtle", 3)])}
<h3>Touch</h3>
<p>Row actions are 44px below lg with at least 4px between them; from lg they shrink to 32px where a pointer is expected.</p>""",
    "content": ul([
        "Header descriptions state the count and the order: <i>7 projects · sorted by last activity</i>; captions the order too: <i>Audit log, newest first</i>.",
        "Status words come from one vocabulary (Running, Paused, Blocked, Idle, Complete, Cancelled, Archived) and always appear with their icon.",
        "Money: dollar sign, two decimals, thousands separator: <i>$612.45</i>, <i>$10,000.00</i>. Percentages without a space: <i>62%</i>.",
        "Relative time in lists with a space before the unit: <i>4 s ago</i>, <i>18 m ago</i>, <i>2 h ago</i>, <i>Yesterday</i>, <i>3 days ago</i>, then a date (<i>12 Oct</i>). Logs use the full timestamp.",
        "An absent value is an em dash (<i>—</i>) in tables, or a word in lists (<i>Last sign-in: Never</i>). Never a blank cell.",
    ]),
    "do-dont": dodont([
        (_locked_acts("Ledgerline"), "Unavailable actions stay visible and focusable and say why in the label and tooltip.",
         '<button class="icon-action" type="button" disabled aria-label="Delete">' + icon("trash") + "</button>",
         "A native-disabled icon with a bare <i>Delete</i> name: unreachable by keyboard and no reason given."),
        ('<span class="row__end text-subtle">4 s ago</span><span class="row__end text-subtle">18 m ago</span>',
         "One unit style everywhere: a space before <i>s</i>, <i>m</i>, <i>h</i>.",
         '<span class="row__end text-subtle">4s ago</span><span class="row__end text-subtle">12 s ago</span>',
         "pages/projects/* write <i>4s ago</i> while Settings writes <i>12 s ago</i> on the same screen family."),
    ]),
    "sources": _sources([("pages/projects/default", "row list, row actions"), ("pages/projects/filtered", "Blocked tab"), ("pages/projects/archived", "Restore"),
                         ("pages/projects/loading", "skeleton rows"), ("pages/projects/no-results", "Archived, none"), ("pages/projects/error", ""),
                         ("pages/projects/viewer", "no row actions"), ("pages/audit/default", "table, inline filters"), ("pages/audit/no-results", ""),
                         ("pages/audit/forbidden", ""), ("pages/workers/default", "worker rows"), ("pages/settings/default", "user rows"),
                         ("pages/backlog/default", "selected row")],
                        "<p>Drift: projects rows use <i>4s ago</i>, <i>18m ago</i>, <i>2h ago</i> while Settings and the strips use <i>12 s</i>, <i>10 s</i>, <i>30 s</i>; the pattern puts a space before every unit. Disabled row actions on Parcel Post (Blocked) and Kiln Booking (Paused) say <i>cancel the running direction first</i>; the reason should say <i>active direction</i>, since neither is running.</p>"),
}


# ================================================================ notifications
_N_TABLE = table(["Channel", "For", "Lives", "Dismissal", "Role"], [
    [page("components/toast", "Toast"), "Events in projects the person may not be watching: merged, stage started, budget warning, blocked", "Bottom right (bottom, full width, below sm), over content", "Info and success after 5 s; warning after 10 s; danger stays until dismissed. Hover and focus pause the timer", "<code>status</code> region; danger in a separate <code>alert</code> region"],
    ["Strip (" + page("components/alert", "alert") + ")", "System state that affects every page: connection, workers stopped, credentials invalid, skills update", "Under the top bar, full width, pushes content down", "Persists while the condition is true; success strips fade after 4 s", "<code>status</code>; <code>alert</code> for danger"],
    ["Callout (" + page("components/alert", "alert") + ")", "State of one object or the result of the person's action: paused, budget reached, saved, failed", "Inside the page or dialog, near the object", "Persists while true; never auto-dismisses", "<code>status</code> or <code>alert</code>"],
    [page("components/badge", "Status / count"), "The current state of an item, and how many need attention", "On the item, in the nav", "Changes with the item", "None; text is in the item"],
])

_N_STACK = ('<div class="toast-region toast-region--static" role="status" aria-live="polite" style="width: 100%; max-width: var(--layout-toast-width)">'
            + _toast("ok", "git-merge", "Ledgerline #27 merged", "Split a transaction · 62% complete")
            + _toast("info", "info", "Tidewater started stage 3", "Design system · extracting tokens from 46 mocks")
            + _toast("warn", "alert-triangle", "Kiln Booking at 80% of budget", "$200.00 of $250.00. It pauses at $250.00.")
            + '<p class="text-caption cluster cluster--end">+2 more in the event stream</p></div>')

_N_ALERT = ('<div class="toast-region toast-region--static" role="alert" style="width: 100%; max-width: var(--layout-toast-width)">'
            + _toast("danger", "x-circle", "Parcel Post is blocked", "Requirements failed after 3 retries. Other projects keep running.",
                     '<a class="toast__action" href="#structure">Open log</a><button class="toast__action" type="button">Retry stage</button>')
            + "</div>")

_N_STRIPS = (_strip("info", "loader", "Connecting to Mission Control… live updates start in a moment.", spin=True)
             + _strip("warn", "refresh", "Reconnecting… next attempt in 10 s. Missed events will catch up from #48,213.")
             + _strip("danger", "wifi-off", "Connection lost. Retrying every 30 s; agents keep working and nothing is lost.", btn("Retry now", "", "sm", "refresh"), role="alert")
             + _strip("ok", "check-circle", "Reconnected. Caught up 14 missed events, #48,200 to #48,213."))

_N_SYS = (_strip("info", "refresh", "Greenlit has 4 new skill commits. Each project updates when you choose.", btn("Review", "", "sm"))
          + _strip("warn", "octagon-x", "All workers stopped by quinntynebrown at 08:30. Nothing new will be leased until you start them again.")
          + _strip("danger", "shield-alert", "GitHub App credentials are invalid. Pull requests can’t be opened or merged until an Owner reconnects the app in Settings.", btn("Open settings", "", "sm"), role="alert"))

SPECS["notifications"] = {
    "lead": "Three channels, one rule: toasts for things that happened, strips for conditions that hold everywhere, callouts for the state of the thing in front of you.",
    "desc": "Notifications: toast vs strip vs callout; priority, stacking, dismissal.",
    "overview": f"""<p>Hewn streams events (sequence #48,213 and counting) to every open Mission Control. Most of them update a status or a number in place and need no notification at all. A few are worth interrupting for, and the channel depends on whether the news is an event, a condition, or the state of the object on screen.</p>
{_N_TABLE}
<p>For feedback on the person's own actions (busy buttons, saved callouts) see {page('patterns/feedback')}.</p>""",
    "when": table(["Event", "Channel", "Why"], [
        ["A pull request merged, a stage started", "Info / success toast", "Good to know, safe to miss; the dashboard has it too"],
        ["A project reaches 80% of budget", "Warning toast, 10 s", "Needs a decision soon, not now"],
        ["A project is blocked", "Danger toast with <i>Open log</i> and <i>Retry stage</i>; stays", "Work has stopped until someone acts"],
        ["A project paused at its budget", "Warning callout on that project (<i>Paused · Budget reached</i>) + status word", "It is the state of the object, and the fix (Raise budget) belongs there"],
        ["Connection lost or reconnecting", "Strip; sidebar and top bar state", "Affects every number on every page"],
        ["Workers stopped by an Owner", "Strip until started again", "A condition that holds across pages"],
        ["Credentials invalid", "Danger strip with <i>Open settings</i>", "Blocks merges everywhere; only an Owner can fix it"],
        ["Five events in a second", "Three toasts, then <i>+2 more in the event stream</i>", "A pile of toasts is noise"],
    ]),
    "structure": f"""<h3>Toast stack</h3>
{ex(_N_STACK, "Newest on top, at most three visible, the overflow counted in a caption that points to the event stream. Each toast: status icon, title (the event), one line of detail, close.", cls="ds-example__canvas--stack ds-example__canvas--canvas")}
{ex(_N_ALERT, "Danger toasts sit in their own <code>role=&quot;alert&quot;</code> region, carry up to two text actions, and stay until dismissed.", cls="ds-example__canvas--stack ds-example__canvas--canvas")}
<h3>Connection strips</h3>
{ex('<div class="stack" style="width: 100%; gap: var(--space-2)">' + _N_STRIPS + "</div>", "The four connection states. One strip at a time takes the slot under the top bar; these are stacked here only to compare.", cls="ds-example__canvas--stack")}
<h3>System strips</h3>
{ex('<div class="stack" style="width: 100%; gap: var(--space-2)">' + _N_SYS + "</div>", "Conditions that hold across pages, with at most one action that leads to the fix.", cls="ds-example__canvas--stack")}
<h3>Priority and stacking</h3>
{ul(["<b>One strip</b>: if several conditions hold, show the most severe (danger, then warning, then info); connection outranks system strips because nothing else is trustworthy while it is down.",
     "<b>Three toasts</b>: newest on top; older ones fold into <i>+N more in the event stream</i>. A danger toast never folds away.",
     "<b>Grouping</b>: repeated events from one project replace the previous toast (stage 3 started → stage 3 succeeded) rather than stacking.",
     "<b>No duplicates</b>: an event already shown as a callout on the current page (budget reached while on Kiln Booking's pipeline) does not also toast."])}""",
    "states": f"""<h3>Toast lifecycle</h3>
{table(["State", "Behaviour"], [
    ["Entering", "Rises in over <code>--duration-slow</code> with <code>--ease-enter</code>"],
    ["Visible", "Timer runs: 5 s for info and success, 10 s for warning; none for danger"],
    ["Hovered or focused", "Timer pauses; resumes on leave or blur (WCAG 2.2.1)"],
    ["Leaving", "<code>.toast--leaving</code>: fades and drops over <code>--duration-base</code> with <code>--ease-exit</code>"],
    ["Dismissed", "Removed; focus, if it was inside, moves to the next toast or back to where it came from"],
])}
<h3>Tones</h3>
{ex('<div class="toast-region toast-region--static" style="width: 100%; max-width: var(--layout-toast-width)">' + _toast("info", "info", "Tidewater started stage 3", "Design system · extracting tokens from 46 mocks") + _toast("ok", "git-merge", "Ledgerline #27 merged", "Split a transaction · 62% complete") + _toast("warn", "alert-triangle", "Kiln Booking at 80% of budget", "$200.00 of $250.00. It pauses at $250.00.") + _toast("danger", "x-circle", "Parcel Post is blocked", "Requirements failed after 3 retries.") + "</div>",
    "Tone is carried by the icon (and the ring for danger), never by a coloured background: toasts sit over content and must stay quiet.", cls="ds-example__canvas--stack ds-example__canvas--canvas")}
<h3>Strip lifecycle</h3>
<p>Connection: <i>Connecting…</i> on load, nothing while live, <i>Reconnecting…</i> with backoff, <i>Connection lost</i> with <i>Retry now</i> after fast retries give up, then <i>Reconnected</i> for 4 s. System strips stay until their condition clears.</p>""",
    "responsive": ul([
        "Below sm the toast region spans the width with a 16px inset and sits above the safe area; from sm it is a <code>--layout-toast-width</code> column at the bottom right.",
        "Strips are full width at every size; text wraps and the action drops under it when there is no room (<code>flex-wrap</code>).",
        "On phones a visible bottom sheet hides the toast region until it closes, so toasts never cover a dialog's actions.",
    ]),
    "accessibility": f"""<h3>Live regions</h3>
<p>One polite region (<code>role="status"</code>, <code>aria-live="polite"</code>) for info, success and warning toasts, and a separate <code>role="alert"</code> region for danger toasts, so nothing is announced twice. Both regions exist on load (empty) so the first toast is announced. Strips use <code>role="status"</code>, or <code>role="alert"</code> for danger.</p>
<h3>Keyboard</h3>
{keys([(kbd("Tab"), "Toasts are not in the way: they follow the page in the tab order and never take focus when they appear."),
       (kbd("Enter") + " on a toast action", "Runs it (<i>Open log</i> navigates; <i>Retry stage</i> retries and dismisses the toast)."),
       (kbd("Enter") + " on close", "Dismisses; focus moves to the next toast or back to the page."),
       (kbd("F6") + " (app shortcut)", "Moves focus to the newest toast, so keyboard users can reach a danger toast's actions.")])}
<h3>Labelling</h3>
<p>Close buttons name what they dismiss: <i>Dismiss: Parcel Post is blocked</i>. Icons are <code>aria-hidden</code>; the title carries the meaning.</p>
<h3>Contrast</h3>
{pairs([("Toast title", "--color-fg-default", "--color-bg-surface-raised", 4.5), ("Toast text", "--color-fg-muted", "--color-bg-surface-raised", 4.5),
        ("Toast action", "--color-fg-accent", "--color-bg-surface-raised", 4.5), ("Warning strip", "--color-warning-fg", "--color-warning-bg", 4.5),
        ("Danger strip", "--color-danger-fg", "--color-danger-bg", 4.5), ("Info strip", "--color-info-fg", "--color-info-bg", 4.5), ("Success strip", "--color-success-fg", "--color-success-bg", 4.5)])}
<h3>Motion</h3>
<p>Reduced motion keeps the fade and drops the movement; spinning strip icons stop.</p>
<h3>Touch</h3>
<p>The close button is 24px (<code>--control-height-xs</code>) with space around it; toast actions are at least 24px tall (<code>--target-min</code>).</p>""",
    "content": ul([
        "Toast titles are the event, with the project first: <i>Ledgerline #27 merged</i>, <i>Tidewater started stage 3</i>, <i>Parcel Post is blocked</i>.",
        "Toast detail is one line of context with numbers: <i>Split a transaction · 62% complete</i>; <i>$200.00 of $250.00. It pauses at $250.00.</i>",
        "Strips say the condition and its consequence in one sentence, then reassure or instruct: <i>Connection lost. Retrying every 30 s; agents keep working and nothing is lost.</i>",
        "Say who did it when a person did: <i>All workers stopped by quinntynebrown at 08:30.</i>",
        "Actions are short verbs that lead to the fix: <i>Open log</i>, <i>Retry stage</i>, <i>Retry now</i>, <i>Open settings</i>, <i>Review</i>.",
    ]),
    "do-dont": dodont([
        ('<div class="toast-region toast-region--static" style="width: 100%">' + _toast("danger", "x-circle", "Parcel Post is blocked", "Requirements failed after 3 retries.") + "</div>",
         "The close button's name says which toast it dismisses.",
         '<div class="toast-region toast-region--static" style="width: 100%"><div class="toast toast--danger">' + icon("x-circle") + '<div class="toast__body"><div class="toast__title">Parcel Post is blocked</div></div><button class="toast__close" type="button" aria-label="Dismiss">' + icon("x", "icon--sm") + "</button></div></div>",
         "notifications/live-toast/* label every close button <i>Dismiss</i>: in a stack of three, a screen reader hears three identical buttons."),
        (_strip("warn", "octagon-x", "All workers stopped by quinntynebrown at 08:30. Nothing new will be leased until you start them again.", role="note"),
         "One event, one severity: workers stopped is a warning wherever it appears.",
         _strip("danger", "octagon-x", "All workers stopped. Nothing new will be leased until you start them again.", role="note"),
         "pages/dashboard/stopped shows the same condition as a danger strip with <code>role=&quot;status&quot;</code>."),
    ]),
    "sources": _sources([("notifications/live-toast/info", "5 s"), ("notifications/live-toast/success", "5 s"), ("notifications/live-toast/warning", "10 s"),
                         ("notifications/live-toast/danger", "stays"), ("notifications/live-toast/stacked", "three plus overflow"), ("notifications/live-toast/with-action", "actions"),
                         ("notifications/connection-banner/info", ""), ("notifications/connection-banner/warning", ""), ("notifications/connection-banner/danger", "Retry now"),
                         ("notifications/connection-banner/success", "fades after 4 s"), ("notifications/system-banner/info", ""), ("notifications/system-banner/warning", ""),
                         ("notifications/system-banner/danger", ""), ("notifications/system-banner/success", ""), ("pages/dashboard/reconnecting", ""), ("pages/dashboard/stopped", ""),
                         ("pages/project-pipeline/budget-reached", "callout, not toast")],
                        "<p>Drift: toast close buttons are all labelled <i>Dismiss</i> (now <i>Dismiss: [title]</i>). pages/dashboard/stopped renders <i>All workers stopped</i> as <code>.strip--danger</code> with <code>role=&quot;status&quot;</code>, while notifications/system-banner/warning uses <code>.strip--warn</code> for the same condition; it is a warning. The stacked toast caption is right aligned with an inline <code>text-align</code>; use <code>.cluster--end</code>.</p>"),
}


# ================================================================ content and tone
_LIB = table(["Concept", "Say", "Not", "Where"], [
    ["Start work", "<i>Start direction</i> (submit), <i>New direction</i> (sidebar), <i>New product</i> (Projects)", "<i>Submit</i>, <i>Create</i>, <i>Go</i>", "New direction, sidebar, Projects"],
    ["Hold work, resumable", "<i>Pause</i> / <i>Resume</i>", "<i>Stop</i>, <i>Suspend</i>", "Project header"],
    ["End a direction for good", "<i>Cancel direction</i>; dismiss with <i>Keep running</i>", "<i>Cancel</i> beside <i>Cancel</i>", "cancel-direction dialog"],
    ["Halt every worker", "<i>Stop all workers</i> / <i>Start workers</i>", "<i>Kill</i>, <i>Shut down</i>", "Sidebar, stop-workers dialog"],
    ["Hide, restorable", "<i>Archive</i> / <i>Restore</i>", "<i>Delete</i>", "Projects rows"],
    ["Remove for ever", "<i>Delete project</i>", "<i>Remove</i>, <i>Destroy</i>", "delete-project dialog"],
    ["Take someone off a list", "<i>Remove</i>", "<i>Delete user</i>", "Who can sign in"],
    ["End a credential", "<i>Revoke</i>, <i>Revoke token</i>", "<i>Delete token</i>, <i>Disable</i>", "Workers, revoke-worker"],
    ["Spend more", "<i>Raise budget</i>; in its dialog <i>Raise and resume</i>", "<i>Increase limit</i>, <i>Top up</i>", "Budget reached, raise-budget"],
    ["Try a failed request", "<i>Try again</i>", "<i>Retry</i> (alone), <i>Reload</i>", "Every error state"],
    ["Re-run a pipeline stage", "<i>Retry stage</i>", "<i>Try again</i>", "Blocked project, toast"],
    ["Reconnect now", "<i>Retry now</i>", "<i>Reconnect</i>", "Connection lost strip"],
    ["See detail", "<i>View log</i>, <i>Open log</i>, <i>Open the pipeline</i>, <i>View all</i>", "<i>Click here</i>, <i>More</i>", "Tiles, toasts"],
    ["Close a finished dialog", "<i>Done</i>", "<i>OK</i>, <i>Close</i>", "worker-token success"],
    ["Decline for now", "<i>Not now</i>", "<i>No</i>, <i>Later</i>", "update-skills"],
    ["Roles", "<i>Owner</i>, <i>Viewer</i> (capitalised)", "<i>admin</i>, <i>read-only user</i>", "Everywhere"],
])

_GLOSSARY = table(["Term", "Means", "Do not mix with"], [
    ["Direction", "One instruction to build a product or a feature; it runs to merged code", "Job, task, request"],
    ["Project", "The product a direction builds, with its repository", "App, repo"],
    ["Stage", "One of the eleven steps, numbered 0 to 10 (<i>3 · Design system</i>)", "Step, phase"],
    ["Increment", "One slice of the backlog, built test-first to a pull request", "Ticket, story"],
    ["Worker", "A machine that leases runs and executes the agents", "Agent, runner, node"],
    ["Run", "One worker's execution of a stage or increment", "Build, job"],
    ["Mission Control", "The web app", "Dashboard (that is one page)"],
])

_ANATOMY_MSG = ('<div class="stack" style="width: 100%">'
                + _empty("alert-triangle", "Projects couldn’t load", "The Hewn API returned 503 Service Unavailable. Your directions are still running on their workers.", "tight error", '<div class="cluster">' + btn("Try again", ic="refresh") + btn("Go to dashboard", "ghost") + "</div>")
                + "</div>")

SPECS["content-and-tone"] = {
    "lead": "Hewn talks like a calm operator: what happened, what it means for your work, and what you can do, with real names and real numbers.",
    "desc": "Content and tone: voice, verbs, numbers, money and the microcopy library.",
    "overview": f"""<p>The rules of record (casing, punctuation, number formats, the error and empty formulas) are in {page('foundations/content', 'Content')}. This page shows them applied across components, with the words the mocks already use, so new screens sound like the old ones.</p>
<h3>Voice</h3>
{ul(["<b>Calm</b>. Hewn runs unattended and spends money; people open Mission Control worried. Lead with what is safe: <i>Agents keep working; nothing is lost.</i>",
     "<b>Specific</b>. Name the project, the worker, the stage, the code: <i>Hewn’s GitHub App can’t write to northwind/handover.</i> Never <i>an error occurred</i>.",
     "<b>Plain</b>. Describe what the factory does in its own terms (stage, increment, worker) and explain them in empty states rather than avoiding them.",
     "<b>Brief</b>. One sentence for the condition, one for the consequence or the fix. Dialogs may take three when money or history is at stake.",
     "<b>Neutral about people</b>. Say who did it, never blame: <i>Paused by quinntynebrown at 14:29</i>; <i>Ask an Owner to change your role.</i>"])}""",
    "when": table(["Moment", "Tone", "Example"], [
        ["Routine news", "Matter of fact, no adjectives", "<i>Tidewater started stage 3</i>"],
        ["Success", "State the result and what did not change; no exclamation marks", "<i>Defaults saved.</i> <i>Directions already running keep theirs.</i>"],
        ["Warning", "Say the threshold and what happens at the limit", "<i>$200.00 of $250.00. It pauses at $250.00.</i>"],
        ["Failure", "Source and code, what is safe, the next step", "<i>The API returned 503. Nothing was created; your text is kept below. Try again.</i>"],
        ["Destructive confirmation", "Exact consequence, what is kept, irreversibility", "<i>…deleted from Hewn. This can’t be undone.</i> <i>The GitHub repository is kept.</i>"],
        ["Refusal (role)", "The reason for the rule and who can help", "<i>Viewers can watch every project but can’t give direction. Ask an Owner to change your role.</i>"],
        ["Empty", "What fills it and when", "<i>The backlog is produced by stage 9, Estimates.</i>"],
    ]),
    "structure": f"""<h3>Anatomy of a message</h3>
{ex(_ANATOMY_MSG, "Title: what happened, as a statement. Body: the source and code, then what is still safe. Actions: recover first, leave second.", cls="ds-example__canvas--stack")}
{table(["Part", "Rule", "From the mocks"], [
    ["Title", "Sentence case, a statement, under 8 words, no ending full stop", "<i>Hewn couldn’t queue this direction</i>"],
    ["Cause", "Who answered and how: service and code, or the limit that was hit", "<i>The API returned 503.</i> <i>You’ve submitted 10 in the last minute.</i>"],
    ["Safety", "What did not happen or is unaffected", "<i>Nothing was created; your text is kept below.</i>"],
    ["Next step", "One instruction, or a time", "<i>Try again.</i> <i>You can submit again in 42 seconds.</i>"],
    ["Action", "Verb first, matching the next step", "<i>Try again</i>"],
])}
<h3>Button verbs</h3>
{ul(["Verb + object, sentence case, up to three words: <i>Start direction</i>, <i>Save defaults</i>, <i>Add a GitHub login</i>, <i>Copy token</i>.",
     "The confirm button repeats the title's verb: <i>Stop all workers?</i> → <i>Stop all workers</i>.",
     "Busy labels use the progressive form and the ellipsis character: <i>Saving…</i>, <i>Revoking…</i>, <i>Stopping 3 workers…</i>.",
     "Two outcomes in one press are named together: <i>Raise and resume</i>."])}
<h3>Numbers, money, dates and time</h3>
{table(["Kind", "Format", "Examples"], [
    ["Money", "<code>$</code>, two decimals, comma thousands; spend as <i>of</i> the budget", "<i>$184.20 of $400.00</i>, <i>$10,000.00</i>"],
    ["Percent", "No space", "<i>62%</i>, <i>warns at 80%</i>"],
    ["Counts", "Numerals, always; singular when 1", "<i>1 thing to fix</i>, <i>3 of 4 workers</i>, <i>14 missed events</i>"],
    ["Ranges", "<i>to</i> in sentences, en dash in hints", "<i>10 to 20,000 characters</i>; <i>1–100 characters</i>"],
    ["Durations", "Number, space, unit; full word in dialog prose", "<i>10 s</i>, <i>timeout after 10 s</i>; <i>within 10 seconds</i>"],
    ["Relative time", "Space before the unit; words after a day", "<i>4 s ago</i>, <i>18 m ago</i>, <i>Yesterday</i>, <i>3 days ago</i>"],
    ["Dates", "Day, short month, year only when not this year", "<i>started 7 Nov</i>, <i>12 Oct</i>"],
    ["Timestamps", "Logs and audit only: day, month, year, 24-hour time with seconds", "<i>9 Nov 2026, 14:31:07</i>"],
    ["Time of day", "24-hour", "<i>at 08:30</i>, <i>Today, 10:15</i>"],
    ["Identifiers", "Mono, verbatim", "<code>wk-7f3a</code>, <code>4c1e0b2</code>, <i>#48,213</i>, <i>PR #28</i>"],
])}
<h3>Microcopy library</h3>
{_LIB}
<h3>Glossary</h3>
{_GLOSSARY}""",
    "states": f"""<p>The same subject, a project's budget, through its states. The words change with severity; the facts stay in the same order (project, figure, limit, consequence).</p>
{ex('<div class="stack" style="width: 100%">'
    + '<div class="progress__label" style="max-width: 20rem"><span>Spend</span><span class="tabular"><strong>$184.20</strong> of $400.00</span></div>'
    + '<div class="toast-region toast-region--static" style="max-width: var(--layout-toast-width)">' + _toast("warn", "alert-triangle", "Kiln Booking at 80% of budget", "$200.00 of $250.00. It pauses at $250.00.") + "</div>"
    + _callout("warn", "Paused · Budget reached", "Spend hit $250.00 of $250.00 after the current model call. Raise the budget, then Resume. This is a safety stop, not an approval.", ic="pause-circle", actions=btn("Raise and resume", "", "sm"))
    + _callout("ok", "Defaults saved", "New directions start with a $350.00 budget and a 3-day descope threshold. Directions already running keep theirs.")
    + "</div>",
    "Normal: a figure. Approaching: a warning toast with the limit. Reached: a callout on the project with the fix. Changed: a success that says what is not affected.", cls="ds-example__canvas--stack")}""",
    "responsive": ul([
        "Write for 360px first: button labels never wrap; if one does, shorten it (<i>Raise and resume</i>, not <i>Raise the budget and resume the direction</i>).",
        "Secondary facts may hide below lg but must not be the only place a fact lives: <i>Last sign-in</i> is <code>.lg-only</code>, and the row still makes sense without it.",
        "Truncate names with an ellipsis only in rows and the sidebar, where the full name is one click away; never truncate status words, money or errors.",
        "Long identifiers (repository URLs, SHAs) are mono and may break anywhere (<code>overflow-wrap: anywhere</code>), rather than pushing the layout wide.",
    ]),
    "accessibility": f"""<h3>Plain language</h3>
<p>Short sentences, common words, one idea each. Factory terms (stage, increment, worker) are explained the first time a person meets them, in the empty state of the page that shows them.</p>
<h3>Names</h3>
{ul(["Accessible names include the object when the visible label does not: <i>Archive Ledgerline</i>, <i>Remove ama-osei</i>, <i>Dismiss: Parcel Post is blocked</i>.",
     "An <code>aria-label</code> starts with the visible text (2.5.3 Label in Name): the button reading <i>Restore</i> is named <i>Restore Saltmarsh Survey</i>.",
     "Links say where they go: <i>Open log</i>, <i>Go to projects</i>. Never <i>here</i> or <i>more</i>.",
     "Visually hidden text completes what icons say: <i>Ledgerline, Running, 62%</i> in the sidebar."])}
<h3>Status in words</h3>
<p>Every status has a word; colour and icon only reinforce it (1.4.1). Severity is in the words too: <i>blocked</i>, <i>can’t be undone</i>, <i>nothing is lost</i>.</p>
<h3>Keyboard and screen-reader copy</h3>
{keys([(kbd("Tab") + " to a busy button", "Hears the progressive label: <i>Deleting…</i>."),
       (kbd("Tab") + " to a disabled row action", "Hears the reason: <i>Delete Ledgerline: cancel the running direction first</i>."),
       ("Error summary on submit", "Hears the count and goal: <i>3 things to fix before Hewn can start</i>.")])}
<h3>Contrast</h3>
{pairs([("Body copy", "--color-fg-default", "--color-bg-canvas", 4.5), ("Secondary copy", "--color-fg-muted", "--color-bg-canvas", 4.5),
        ("Metadata", "--color-fg-subtle", "--color-bg-surface", 4.5), ("Link", "--color-fg-link", "--color-bg-surface", 4.5)])}
<h3>Touch</h3>
<p>Short labels keep targets wide enough to hit without crowding: three-word buttons fit two to a row at 360px.</p>""",
    "content": ul([
        "Sentence case everywhere: titles, buttons, tabs, labels, column headers. Capitalise only names (Ledgerline, GitHub, Magic Patterns) and the roles Owner and Viewer.",
        "Curly apostrophes and quotes (<i>couldn’t</i>, <i>Kiln Booking’s</i>), the ellipsis character (…), the middle dot (·) between facts, the em dash (—) for an absent value.",
        "Contractions are fine and preferred: <i>can’t</i>, <i>don’t</i>, <i>wasn’t</i>.",
        "No <i>please</i>, <i>sorry</i>, <i>oops</i>, <i>successfully</i> or exclamation marks. No <i>simply</i> or <i>just</i>.",
        "Second person for the reader (<i>your directions</i>), Hewn by name for the system (<i>Hewn runs to merged code</i>), people by login (<i>quinntynebrown</i>).",
        "One word per concept: use the microcopy library and glossary above; a new screen that needs a new verb adds it there first.",
    ]),
    "do-dont": dodont([
        (btn("Cancel", "ghost") + btn("Raise and resume", "primary", ic="play"),
         "One label for one action, wherever it appears.",
         btn("Raise budget and resume", "primary", ic="play"),
         "pages/project-pipeline/budget-reached says <i>Raise budget and resume</i>; the dialog it opens says <i>Raise and resume</i>. Pick one (the shorter)."),
        (_callout("danger", "Hewn couldn’t queue this direction", "The API returned 503. Nothing was created; your text is kept below. Try again.", role="note"),
         "What failed, the code, what is safe, what to do.",
         _callout("danger", "Oops! Something went wrong", "Please try again later.", role="note"),
         "Apology and exclamation instead of facts; nothing the person can act on."),
        ('<span class="text-subtle">4 s ago · 18 m ago · 2 h ago</span>', "Units with a space, the same in every list.",
         '<span class="text-subtle">4s ago · 12 s ago · 2h ago</span>', "Mixed unit spacing across Projects and Settings."),
    ]),
    "sources": _sources([("pages/new-direction/error", "failure formula"), ("pages/new-direction/rate-limited", "time to retry"), ("pages/new-direction/forbidden", "refusal"),
                         ("pages/projects/error", "safety first"), ("pages/backlog/empty", "explains the stage"), ("pages/not-found/default", "does not leak"),
                         ("pages/server-error/default", "reference id"), ("dialogs/cancel-direction/default", "Keep running"), ("dialogs/stop-workers/default", "consequence with numbers"),
                         ("pages/project-pipeline/budget-reached", "Raise budget and resume"), ("dialogs/raise-budget/default", "Raise and resume"),
                         ("pages/settings/success", "what did not change"), ("pages/audit/default", "timestamps"), ("notifications/live-toast/warning", "threshold copy")],
                        "<p>Drift: <i>Raise budget and resume</i> (pipeline) vs <i>Raise and resume</i> (dialog) for one action; <i>4s ago</i> vs <i>12 s ago</i> unit spacing; <i>Open log</i> (toast) vs <i>View log</i> (dashboard) for the same destination, which the library keeps as two verbs only because the toast opens one project's log and the tile opens the run.</p>"),
}
