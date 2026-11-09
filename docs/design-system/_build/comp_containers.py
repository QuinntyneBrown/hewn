"""Component specs: Containers (card, tile, dialog, drawer, tooltip, divider, layout primitives).

Overlays are documented statically: dialogs use `.dialog dialog--static`, drawers `.drawer drawer--static`,
tooltips `.tooltip[data-state="open"]`. `.backdrop` is never used on a documentation page (it is fixed to
the viewport); a backdrop is shown as a box painted with `--color-bg-backdrop`.
"""
from common import (NA, btn, code, ex, icon, icon_btn, kbd, matrix, page, status, status_icon, table, themes, ul,
                    wordmark)

SPECS = {}

_C = [0]


def _uid(prefix):
    """Unique id per page: every slug's ids carry its own prefix and a module-wide counter."""
    _C[0] += 1
    return "%s-%d" % (prefix, _C[0])


def _busy(label, variant="primary"):
    v = " btn--" + variant if variant else ""
    return '<button class="btn' + v + '" type="button" aria-busy="true" aria-disabled="true">' + icon("loader") + label + "</button>"


def _ghost(label="Cancel"):
    return '<button class="btn btn--ghost" type="button">' + label + "</button>"


def _danger(label, ic, disabled=False):
    return '<button class="btn btn--danger" type="button"' + (" disabled" if disabled else "") + ">" + icon(ic) + label + "</button>"


def _primary(label, ic):
    return '<button class="btn btn--primary" type="button">' + icon(ic) + label + "</button>"


def _callout_fail(title, text):
    return ('<div class="callout callout--danger" role="alert">' + icon("alert-triangle", "icon--lg")
            + '<div><p class="callout__title">' + title + '</p><p class="callout__body">' + text + "</p></div></div>")


def _field(fid, label, control, hint="", err=""):
    out = '<div class="field"><label class="field__label" for="' + fid + '">' + label + '</label><div class="field__control">' + control + "</div>"
    if err:
        out += '<span class="field__error" id="' + fid + '-err">' + icon("alert-circle", "icon--sm") + err + "</span>"
    elif hint:
        out += '<span class="field__hint" id="' + fid + '-hint">' + hint + "</span>"
    return out + "</div>"


def _input_attrs(fid, invalid, busy):
    a = ' aria-invalid="true" aria-describedby="' + fid + '-err"' if invalid else ' aria-describedby="' + fid + '-hint"'
    return a + (" readonly" if busy else "")


# ============================================================== dialog helpers
def _dlg(title, text, body, footer, alert=False, size="", head_icon="", close=False, labelled=True):
    """A statically rendered dialog. labelled=False (for themes()) names it with aria-label so no id repeats."""
    role = "alertdialog" if alert else "dialog"
    if labelled:
        t, d = _uid("dialog-title"), _uid("dialog-desc")
        names = ' aria-labelledby="' + t + '" aria-describedby="' + d + '"'
        tid, did = ' id="' + t + '"', ' id="' + d + '"'
    else:
        names = ' aria-label="' + title + '"'
        tid = did = ""
    heading = '<h2 class="dialog__title"' + tid + ">" + title + '</h2><p class="dialog__text"' + did + ">" + text + "</p>"
    if head_icon or close:
        x = icon_btn("x", "Close", "ghost", "", 'data-close').replace('class="btn ', 'class="dialog__close btn ') if close else ""
        ic = '<span class="dialog__icon" aria-hidden="true">' + icon(head_icon) + "</span>" if head_icon else ""
        heading = '<div class="dialog__head">' + ic + "<div>" + heading + "</div>" + x + "</div>"
    pcls = "dialog__panel" + (" dialog__panel--" + size if size else "")
    return ('<div class="dialog dialog--static" role="' + role + '"' + names + '><div class="' + pcls + '">' + heading + body
            + '<div class="dialog__footer">' + footer + "</div></div></div>")


def _backdrop(inner):
    return ('<div style="width: 100%; min-width: 0; padding: var(--space-8) var(--space-3); background: var(--color-bg-backdrop); border-radius: var(--radius-md);">'
            + inner + "</div>")


def _dex(dialog_html, caption):
    return ex(_backdrop(dialog_html), caption, dialog_html, "ds-example__canvas--stack")


def _delete(state, labelled=True):
    fid = _uid("dialog-confirm")
    typed = {"confirm": "Harbor CRM", "busy": "Harbor CRM", "invalid": "Harbor", "failed": "Harbor CRM"}.get(state, "")
    invalid = state == "invalid"
    busy = state == "busy"
    control = '<input class="input" id="' + fid + '" autocomplete="off" value="' + typed + '"' + _input_attrs(fid, invalid, busy) + ">"
    field = _field(fid, "Type <strong>Harbor CRM</strong> to confirm", control,
                   "The GitHub repository is kept; only Hewn’s record is deleted.", "Type Harbor CRM exactly to delete it." if invalid else "")
    body = (_callout_fail("Harbor CRM wasn’t deleted", "The API returned 503. Nothing was removed; try again.") if state == "failed" else "")
    body += '<div class="dialog__body">' + field + "</div>"
    if busy:
        primary = _busy("Deleting…", "danger")
    elif state in ("confirm", "failed"):
        primary = _danger("Try again" if state == "failed" else "Delete project", "trash")
    else:
        primary = _danger("Delete project", "trash", disabled=True)
    return _dlg("Delete Harbor CRM?", "Its directions, runs, decisions, events and spend history are deleted from Hewn. This can’t be undone.",
                body, _ghost() + primary, alert=True, labelled=labelled)


def _stop_workers(state="default", labelled=True):
    body = _callout_fail("1 worker didn’t confirm", "hewn-cloud-eus-01 didn’t acknowledge within 10 s. The others stopped. Leasing is off, so it can’t pick up new work; try again to stop it.") if state == "failed" else ""
    body += ('<ul class="mini-list mt-4"><li>' + icon("loader", "icon--xs s-icon--run") + '<span class="mono">quinn-mbp.local</span><span class="text-subtle">Ledgerline</span></li>'
             '<li>' + icon("loader", "icon--xs s-icon--run") + '<span class="mono">hewn-cloud-eus-01</span><span class="text-subtle">Tidewater</span></li>'
             '<li>' + icon("circle-dot", "icon--xs s-icon--idle") + '<span class="mono">hewn-cloud-eus-02</span><span class="text-subtle">Idle</span></li></ul>')
    primary = _busy("Stopping 3 workers…", "danger") if state == "busy" else _danger("Try again" if state == "failed" else "Stop all workers", "octagon-x")
    return _dlg("Stop all workers?", "All 3 online workers halt their active runs within 10 seconds and stop leasing. Ledgerline and Tidewater keep their last checkpoints and resume from them when you start workers again.",
                body, _ghost() + primary, alert=True, labelled=labelled)


def _raise_budget(state="default"):
    fid = _uid("dialog-budget")
    invalid = state == "invalid"
    busy = state == "busy"
    control = ('<div class="prefix prefix--money"><span class="prefix__sym" aria-hidden="true">$</span><input class="input" id="' + fid
               + '" inputmode="decimal" value="' + ("200.00" if invalid else "350.00") + '"' + _input_attrs(fid, invalid, busy) + "></div>")
    field = _field(fid, "New budget", control, "Warns again at 80%. $250.00 spent so far.",
                   "New budget must be more than the $250.00 already spent." if invalid else "")
    body = _callout_fail("The budget wasn’t changed", "The API returned 409: another session changed this budget a moment ago. Reload it and try again.") if state == "failed" else ""
    body += '<div class="dialog__body">' + field + "</div>"
    primary = _busy("Saving…") if busy else _primary("Raise and resume", "play")
    return _dlg("Raise Kiln Booking’s budget", "The direction resumes from checkpoint 4c1e0b2 as soon as the new budget is saved.", body, _ghost() + primary)


def _update_skills():
    commits = [("3e1a9f0", "writing-html-mocks: require a bottom sheet on phones"), ("b72c4d1", "estimating-designs: 3-day descope threshold by default"),
               ("90fe215", "implementing-incrementally: record red before green"), ("4d0b8aa", "grilling: answer for the user when running unattended")]
    lis = "".join('<li><span class="mono text-subtle">' + s + '</span><span class="truncate">' + m + "</span></li>" for s, m in commits)
    body = '<div class="dialog__body"><p class="field__label">Greenlit · 4 commits since 91c0b4e</p><ul class="mini-list mt-2">' + lis + "</ul></div>"
    return _dlg("Update Ledgerline’s skills?", "Hewn opens a pull request that updates the skill files and .hewn/skills.lock, and merges it automatically when checks pass. The running increment finishes on the current skills.",
                body, _ghost("Not now") + _primary("Update skills", "refresh"), size="lg")


def _worker_token_success():
    tok = "hwt_live_8Qm2vR7xKc4pZ1nLw9sTj3dYf6aB0eHg"
    body = ('<div class="callout callout--ok" role="status">' + icon("check-circle", "icon--lg") + '<div><p class="callout__title">Token created for hewn-cloud-eus-03</p>'
            '<p class="callout__body">Copy it now. Hewn stores only a hash and can’t show it again.</p></div></div>'
            '<div class="dialog__body"><p class="field__label">Token</p><div class="codebox"><code class="mono">' + tok + "</code>"
            + icon_btn("copy", "Copy token", "ghost", "sm") + "</div>"
            '<p class="text-caption">Outbound HTTPS only; the worker needs no inbound ports.</p></div>')
    return _dlg("New worker token", "Paste the command on the machine that will run the worker.", body,
                '<button class="btn btn--primary" type="button">Done</button>', size="lg", close=True)


def _add_user():
    fid = _uid("dialog-login")
    control = ('<div class="prefix"><span class="prefix__sym" aria-hidden="true">@</span><input class="input" id="' + fid
               + '" autocomplete="off" value="nadia-k" aria-describedby="' + fid + '-hint"></div>')
    login = _field(fid, "GitHub login", control, "They sign in with this GitHub account.")
    name = _uid("dialog-role")
    role = ('<fieldset class="fieldset"><legend>Role</legend><div class="stack stack--sm">'
            '<label class="choice"><input type="radio" name="' + name + '" checked><span>' + icon("users", "icon--sm") + '</span><span>Viewer<small>Watches every project</small></span></label>'
            '<label class="choice"><input type="radio" name="' + name + '"><span>' + icon("key", "icon--sm") + '</span><span>Owner<small>Gives direction, stops work, manages access</small></span></label></div></fieldset>')
    body = '<div class="dialog__body">' + login + role + "</div>"
    return _dlg("Add a GitHub login", "They can sign in as soon as they’re added.", body, _ghost() + _primary("Add to allow list", "plus"))


def _revoke(size="", head_icon=""):
    return _dlg("Revoke build-box-02?", "Its token stops working immediately. If it is running a step, the lease is released and the run resumes on another worker from its last checkpoint.",
                "", _ghost() + _danger("Revoke token", "x-circle"), alert=True, size=size, head_icon=head_icon)


def _cancel_direction(safe="Keep running"):
    return _dlg("Cancel Ledgerline’s direction?", "The active run stops within 10 seconds and the direction can’t be resumed. Six merged increments stay merged.",
                "", _ghost(safe) + _danger("Cancel direction", "square"), alert=True)


# ============================================================== card
def _card_inc(href_id="overview", label="Increment 7 of 12 · Reconcile a card statement"):
    steps = ["Tests written", "Implement", "Video", "Pull request", "Merge"]
    cells = ""
    for i, s in enumerate(steps):
        bar = " steps__bar--ok" if i == 0 else (" steps__bar--run" if i == 1 else "")
        lab = "steps__label steps__label--now" if i == 1 else "steps__label"
        chk = icon("check", "icon--xs s-icon--ok") if i == 0 else ""
        cells += '<li><div class="steps__bar' + bar + '"></div><div class="' + lab + '">' + chk + '<span class="truncate">' + s + "</span></div></li>"
    return ('<div class="card"><div class="cluster cluster--between"><a class="row__title text-sm" href="#' + href_id + '">' + label + "</a>"
            '<span class="text-mono-xs text-subtle">journey 4 · L2-018, L2-019</span></div><ol class="steps" aria-label="Increment steps">' + cells + "</ol></div>")


def _card_pr(extra="", merged=False):
    ic = icon("git-merge", "icon--lg s-icon--ok", "Merged") if merged else icon("git-pr", "icon--lg s-icon--run", "Open")
    return ('<a class="card card--link" href="#variants"' + extra + ">" + ic
            + '<span class="list__text"><span class="list__title">Reconcile a card statement (journey 4, L2-018, L2-019)</span>'
            '<span class="list__sub">#28 · ' + ("squash-merged" if merged else "open") + " · +612 −48 · 14 files</span></span></a>")


def _card_hf():
    return ('<section class="card" aria-label="Budget"><div class="card__header"><h3 class="tile__title">Budget</h3><span class="tile__meta">Kiln Booking</span></div>'
            '<div class="progress__label"><span>Spent</span><strong>$250.00 of $250.00</strong></div>'
            '<div class="meter meter--warn" role="meter" aria-label="Kiln Booking spend" aria-valuenow="250" aria-valuemin="0" aria-valuemax="250"><span class="meter__bar" style="--value: 100%"></span></div>'
            '<p class="text-sm text-muted mt-3">Paused at increment 9 of 11. Raising the budget resumes from checkpoint 4c1e0b2.</p>'
            '<div class="card__footer">' + btn("View spend", "ghost", "sm") + btn("Raise budget", "", "sm", "wallet") + "</div></section>")


def _card_sel(cur):
    return ('<a class="card card--link" href="#states"' + (' aria-current="true"' if cur else "") + ">" + icon("cloud", "icon--lg")
            + '<span class="list__text"><span class="list__title">' + ("Cloud" if cur else "Local") + '</span><span class="list__sub">'
            + ("A VM or container host" if cur else "Your machine") + "</span></span></a>")


_CARD_PR = _card_pr()

NA_CELL = '<span class="text-subtle text-sm">n/a</span>'
_LINK_TXT = icon("git-pr", "s-icon--run") + "#28 Reconcile a card statement"
_CARD_STATES = matrix(["Default", "Hover", "Focus", "Selected"], [
    ("Static card", ['<div class="card text-sm">Ledgerline · 62% complete</div>', NA_CELL, NA_CELL, NA_CELL]),
    ("Link card", ['<a class="card card--link text-sm" href="#states">' + _LINK_TXT + "</a>",
                   '<a class="card card--link text-sm" href="#states" data-state="hover">' + _LINK_TXT + "</a>",
                   '<a class="card card--link text-sm" href="#states" data-state="focus">' + _LINK_TXT + "</a>",
                   '<a class="card card--link text-sm" href="#states" aria-current="true">' + _LINK_TXT + "</a>"]),
])

SPECS["card"] = {
    "lead": "A card is a bordered surface that groups one object’s content: an increment’s steps, a pull request, a budget. It holds content; it is not itself a control.",
    "readme_variants": "static, link card (whole card is one link), with header and footer, selected",
    "readme_states": "default, hover, focus, selected",
    "pills": ["<code>.card</code>"],
    "overview": f"""<p>Use a card to set one object apart from the page around it when it has more than a line of content: the increment card above the stage log, the pull request card in an increment’s aside. Use a {page('components/tile', 'dashboard tile')} for a panel on the dashboard grid, a {page('components/row-list')} or {page('components/list')} for many objects of the same kind, and plain sections with a {page('components/divider')} when the content belongs to the page rather than to an object.</p>
{ul(["<b>Static card</b> (<code>.card</code>): a surface with a 1px inset ring and 16px padding. Links and buttons go inside it.",
     "<b>Link card</b> (<code>.card--link</code>): the whole card is one <code>&lt;a&gt;</code> to the object (the pull request on GitHub). It has a hover tint and nothing interactive inside it.",
     "<b>With header and footer</b> (<code>.card__header</code>, <code>.card__footer</code>): a title bar and an action bar, each separated by a hairline and bleeding to the card edge.",
     "<b>Selected</b> (<code>.card--selected</code> or <code>aria-current=&quot;true&quot;</code>): the accent tint and accent ring for the chosen card in a set."])}""",
    "anatomy": (_card_hf(), [(8, 12), (40, 12), (50, 52), (80, 86)],
                [("Header (optional)", "<code>.card__header</code>: title (<code>.tile__title</code>, h3) and meta, 12 × 16px padding, hairline below."),
                 ("Container", "<code>--color-bg-surface</code>, 1px inset ring <code>--color-border-default</code>, <code>--radius-md</code>, padding <code>--space-4</code>."),
                 ("Body", "Any content; inside spacing <code>--space-3</code> to <code>--space-4</code>."),
                 ("Footer (optional)", "<code>.card__footer</code>: actions right-aligned, small buttons, hairline above.")]),
    "variants": f"""<h3>Static card</h3>
{ex(_card_inc(), "The increment card on the pipeline page: a heading link, its tags and the five-step progress. The link is the only control.", cls="ds-example__canvas--stack")}
<h3>Link card</h3>
{ex(_CARD_PR, "The pull request card in an increment’s aside. One <code>&lt;a&gt;</code>; the status icon is an image with a name (Open or Merged).", cls="ds-example__canvas--stack")}
<h3>With header and footer</h3>
{ex(_card_hf(), "Header for the title and meta, footer for actions. The section is named with <code>aria-label</code> (or <code>aria-labelledby</code> pointing at the header title).", cls="ds-example__canvas--stack")}
<h3>Selected</h3>
{ex('<div class="grid--cards grid">' + _card_sel(False) + _card_sel(True) + "</div>", "A set of link cards where one is current: accent tint, accent ring and <code>aria-current=&quot;true&quot;</code>, never colour alone.", cls="ds-example__canvas--stack")}""",
    "sizes": NA("Cards have one padding (16px) and take the width of their column; content sets the height."),
    "states": f"""<p>Only link cards have pointer states. Hover raises the surface to <code>--color-bg-surface-raised</code>; focus draws the shared ring around the whole card; selected uses the accent tint.</p>
{_CARD_STATES}
{themes('<div class="stack" style="width: 100%;">' + _card_pr(merged=True) + '<a class="card card--link" href="#states" aria-current="true">' + icon("cloud", "icon--lg") + '<span class="list__text"><span class="list__title">Cloud</span><span class="list__sub">A VM or container host</span></span></a></div>', stack=True)}
<p>A static card is never hoverable: tinting a non-interactive card on hover promises a click that does nothing.</p>""",
    "responsive": ul([
        "Cards fill their column at every breakpoint; they never set a width. In a set, use <code>.grid--cards</code> (<code>auto-fill, minmax(min(100%, 18rem), 1fr)</code>): one column at 360px, two from about 37rem, three or more in wide content.",
        "Below <code>--layout-breakpoint-sm</code> (576px) a card’s cluster rows wrap (the increment card’s tags move under the title); the step labels truncate with an ellipsis and the iteration sub-label is hidden.",
        "From <code>--layout-breakpoint-xl</code> (1200px) the pull request card sits in the 24rem aside of <code>.split--aside</code>; below xl it follows the main column.",
        "Long titles in a link card wrap; metadata lines (<code>.list__sub</code>) truncate."]),
    "theming": """<p>The card reads two component tokens: <code>--card-bg</code> (default <code>--color-bg-surface</code>) and <code>--card-ring</code> (default <code>--color-border-default</code>). Hover sets <code>--card-bg</code> to <code>--color-bg-surface-raised</code>; selected sets <code>--card-bg: --color-accent-subtle</code> and <code>--card-ring: --color-accent</code>.</p>
<pre><code>/* A sunken card for a code sample, without editing .card */
.card.card--sunken { --card-bg: var(--color-bg-surface-sunken); }</code></pre>
<p>In dark the surface steps up from the canvas by lightness rather than shadow, so a card reads as raised without a drop shadow; the ring keeps its edge visible on both.</p>""",
    "a11y": {
        "pattern": "<p>No widget role. A static card is a <code>&lt;div&gt;</code>, or a <code>&lt;section&gt;</code> with <code>aria-label</code> when it is a meaningful region. A link card is a single <code>&lt;a href&gt;</code> with block content; it never contains another link or button (no interactive content inside interactive content). Selected cards in a set carry <code>aria-current=&quot;true&quot;</code>; if choosing a card is a form choice, use a <a href='https://www.w3.org/WAI/ARIA/apg/patterns/radio/'>radio group</a> styled as cards instead.</p>",
        "keys": [(kbd("Tab"), "Moves to the link card, or to the links and buttons inside a static card, in DOM order."),
                 (kbd("Enter"), "Follows a link card.")],
        "focus": "<p>A link card shows the shared 2px ring with a 2px offset around the whole card. Static cards are not focusable.</p>",
        "labelling": "<p>A link card’s accessible name is all of its text, so keep it short: title first, then one meta line. Status icons inside carry their own name (<i>Merged</i>, <i>Open</i>) because colour alone does not tell them apart.</p>",
        "pairs": [("Card text", "--color-fg-default", "--color-bg-surface", 4.5), ("Card meta", "--color-fg-subtle", "--color-bg-surface", 4.5),
                  ("Link card text, hover", "--color-fg-default", "--color-bg-surface-raised", 4.5), ("Selected card text", "--color-fg-default", "--color-accent-subtle", 4.5),
                  ("Selected ring on surface", "--color-accent", "--color-bg-surface", 3), ("Focus ring on surface", "--color-focus-ring", "--color-bg-surface", 3)],
        "motion": "<p>Link card background transitions over <code>--duration-fast</code>; reduced motion zeroes it.</p>",
        "touch": "<p>A link card is the whole target, comfortably larger than 44px tall.</p>",
    },
    "content": ul(["Lead with the object’s name (<i>Reconcile a card statement</i>), then one meta line with numbers in tabular figures (<i>#28 · open · +612 −48 · 14 files</i>).",
                   "Card header titles are nouns in sentence case: <i>Budget</i>, <i>Pull request</i>.",
                   "Footer actions are verbs (<i>Raise budget</i>); at most two, the stronger last."]),
    "dodont": [
        ('<div style="width: 100%;">' + _card_inc("do-dont") + "</div>", "Style the title link with a class (<code>.row__title</code> here) so hover and focus come with it.",
         '<div class="card" style="width: 100%;"><a class="text-sm" style="font-weight: var(--font-weight-medium); color: inherit" href="#do-dont">Increment 7 of 12 · Reconcile a card statement</a></div>',
         "The pipeline mock restyled the title link inline (<code>font-weight</code>, <code>color: inherit</code>) in 11 places, so it lost its hover colour."),
        (_card_pr(), "One link for the whole card; the body is plain text.",
         '<div class="card cluster cluster--between" style="width: 100%;"><span class="text-sm">#28 Reconcile a card statement</span>' + btn("Open PR", "ghost", "sm") + "</div>",
         "Do not nest a button inside a link card, or make a static card clickable with script. Pick one: a link card, or a static card with explicit actions."),
    ],
    "tokens": [("Background", "--color-bg-surface"), ("Background, hover (link)", "--color-bg-surface-raised"), ("Ring", "--color-border-default"),
               ("Selected background / ring", "--color-accent-subtle / --color-accent"), ("Header and footer hairline", "--border-width-hairline / --color-border-default"),
               ("Padding", "--space-4"), ("Header and footer padding", "--space-3 / --space-4"), ("Radius", "--radius-md"),
               ("Focus ring", "--color-focus-ring"), ("Transition", "--duration-fast / --ease-standard")],
    "code": {"snippet": """<a class="card card--link" href="https://github.com/hewn-builds/ledgerline/pull/28">
  <svg class="icon icon--lg s-icon--run" viewBox="0 0 24 24" role="img" aria-label="Open">…</svg>
  <span class="list__text">
    <span class="list__title">Reconcile a card statement</span>
    <span class="list__sub">#28 · open · +612 −48 · 14 files</span>
  </span>
</a>
<section class="card" aria-label="Budget">
  <div class="card__header"><h3 class="tile__title">Budget</h3><span class="tile__meta">Kiln Booking</span></div>
  …
  <div class="card__footer"><button class="btn btn--sm" type="button">Raise budget</button></div>
</section>""",
             "classes": [("<code>.card</code>", "Surface, ring, radius, 16px padding."),
                         ("<code>.card--link</code>", "On an <code>&lt;a&gt;</code>: flex row, hover tint, focus ring."),
                         ("<code>.card__header</code> / <code>.card__footer</code>", "Edge-to-edge title bar / action bar with hairlines."),
                         ("<code>.card--selected</code> or <code>aria-current=&quot;true&quot;</code>", "Accent tint and ring."),
                         ("<code>.grid--cards</code>", "Responsive card grid (see " + page("components/layout", "layout primitives") + ")."),
                         ("<code>data-state=&quot;hover|focus&quot;</code>", "Documentation only.")]},
    "sources": {"mocks": [("pages/project-pipeline/default", "increment card"), ("pages/increment/default", "pull request link card"),
                          ("pages/increment/merged", "merged link card"), ("pages/project-pipeline/paused", "increment card, paused step")],
                "drift": "the 1px ring is now <code>--border-width-hairline</code> through <code>--card-ring</code>; header, footer and selected styles were added (the mocks had only plain and link cards); inline title restyles replaced by classes."},
}

# ============================================================== tile
_RUN = ('<ul class="tile__body divided"><li class="run"><div class="run__head"><a class="run__name" href="#overview">Ledgerline</a>'
        '<span class="run__stage">' + icon("loader", "icon--sm icon--spin") + 'Stage 10 · Increments</span>'
        '<span class="run__money">62% · $184.20 <span class="text-subtle">of $400.00</span></span></div>'
        '<div class="pstrip" role="img" aria-label="Stages 0 to 9 succeeded, Increments running">' + '<span class="pstrip__seg pstrip__seg--ok"></span>' * 10 + '<span class="pstrip__seg pstrip__seg--run"></span></div>'
        '<div><div class="text-sm">Increment 7 of 12 · Reconcile a card statement</div><div class="text-sm text-muted">Implementing, iteration 3 of 10</div></div>'
        '<div class="run__line"><span class="dot"></span><span class="truncate">Iteration 3 · Normalise posting dates to account time zone</span></div></li></ul>')
_ATTN = ('<ul class="tile__body divided"><li class="attn"><div class="attn__head"><a class="attn__name" href="#overview">Parcel Post</a>' + status("Blocked") + "</div>"
         '<p class="text-sm text-muted">Requirements failed 3 times: L2-014 has no acceptance criteria the brief can support.</p>'
         '<div class="cluster mt-1">' + btn("Retry stage", "", "sm", "rotate-ccw") + btn("View log", "ghost", "sm") + "</div></li>"
         '<li class="attn"><div class="attn__head"><a class="attn__name" href="#overview">Kiln Booking</a>' + status("Paused", "Budget reached") + "</div>"
         '<p class="text-sm text-muted tabular">$250.00 of $250.00 · increment 9 of 11 waiting</p></li></ul>')
_EVENTS = ('<ol class="tile__body events" aria-live="off">'
           + "".join('<li class="event"><span class="text-subtle">' + t + '</span><span class="event__project">' + p + '</span><span class="truncate"><span class="event__kind' + k2 + '">' + k + "</span>" + x + "</span></li>"
                     for t, p, k, k2, x in [("14:31:07", "Ledgerline", "merge", " event__kind--ok", "#27 Split a transaction · squash-merged"),
                                            ("14:30:44", "Tidewater", "spend", "", "+$0.42 · claude-sonnet · 18.2k tokens"),
                                            ("14:28:51", "Ledgerline", "log", "", "Frontend: lint clean, 236 unit tests passed"),
                                            ("14:26:58", "Kiln Booking", "stage", " event__kind--warn", "Paused · Budget reached")]) + "</ol>")
_PRS = ('<ul class="tile__body divided">' + "".join(
    '<li><a class="pr" href="#overview">' + icon("git-merge", "s-icon--ok", "Merged") + '<span class="truncate"><span class="pr__title">' + t + '</span><span class="pr__meta">' + m + "</span></span></a></li>"
    for t, m in [("Split a transaction", "Ledgerline #27 · Merged 14 min ago"), ("Reschedule a firing", "Kiln Booking #41 · Merged 51 min ago")]) + "</ul>")
_BARS = "".join('<span class="bars__bar' + (" bars__bar--today" if i == 6 else "") + '"><span class="bars__fill" style="--h: ' + h + 'rem"></span>' + d + "</span>"
                for i, (h, d) in enumerate([("1.125", "M"), ("1.562", "T"), ("0.875", "W"), ("2.062", "T"), ("1.438", "F"), ("2.250", "S"), ("1.875", "S")]))
_SPEND = ('<div class="spend"><div><div class="spend__value">$86.40</div><div class="text-xs text-muted">$512.70 this week</div></div>'
          '<div class="bars" role="img" aria-label="Spend for the last 7 days, $512.70 this week">' + _BARS + "</div></div>")
_WORKERS = ('<ul class="tile__body mini-list">' + "".join(
    "<li>" + status_icon(st, "icon--xs") + '<span class="truncate mono text-muted" style="flex: 1">' + h + '</span><span class="text-subtle">' + p + "</span></li>"
    for h, st, p in [("quinn-mbp.local", "Leased", "Ledgerline"), ("hewn-cloud-eus-01", "Leased", "Tidewater"), ("hewn-cloud-eus-02", "Idle", "Idle"), ("build-box-02", "Offline", "Offline")]) + "</ul>")


def _tile(cls, title, meta, body, open_label="", edit=False, locked=False, attrs="", labelled=True, open_state=""):
    tcls = "tile" + (" tile--edit" if edit and not locked else "") + (" tile--locked" if edit and locked else "") + (" " + cls if cls else "")
    if labelled:
        tid = _uid("tile-title")
        name, hid = ' aria-labelledby="' + tid + '"', ' id="' + tid + '"'
    else:
        name, hid = ' aria-label="' + title + '"', ""
    tab = ' tabindex="0" aria-roledescription="movable tile"' if edit and not locked else ""
    op = ""
    if open_label and not edit:
        op = ('<a class="tile__open" href="#overview"' + open_state + ">" + open_label + '<span class="visually-hidden"> ' + title.lower() + "</span> "
              + icon("arrow-up-right", "icon--xs") + "</a>")
    lock = '<span class="tile__lock">' + icon("lock", "icon--sm", "Locked tile") + "</span>" if edit and locked else ""
    handle = ('<button class="tile__handle" type="button" aria-label="Resize ' + title + '">' + icon("resize", "icon--xs") + "</button>") if edit and not locked else ""
    return ('<section class="' + tcls + '"' + name + tab + (" " + attrs if attrs else "") + '><div class="tile__header"><h2 class="tile__title"' + hid + ">" + title
            + '</h2><span class="tile__meta">' + meta + "</span>" + op + lock + "</div>" + body + handle + "</section>")


def _dash(edit=False):
    return ('<div class="dash' + (" dash--edit" if edit else "") + '">'
            + _tile("dash__live", "Live work", "1 running", _RUN, "Pipeline", edit)
            + _tile("dash__attention", "Needs attention", "2", _ATTN, "", edit)
            + _tile("dash__events", "Event stream", '<span class="mono">#48,213</span>', _EVENTS, "", edit)
            + _tile("dash__prs", "Pull requests", "9 merged today", _PRS, "", edit)
            + _tile("dash__spend tile--compact", "Spend", "Today", _SPEND, "", edit)
            + _tile("dash__workers tile--compact", "Workers", "3 of 4 online", _WORKERS, "Open", edit, locked=True) + "</div>")


_SK = '<span class="skeleton"></span>'
_TILE_LOADING = ('<div class="tile tile--compact" aria-hidden="true"><div class="tile__header"><span class="skeleton skeleton--w33"></span></div>'
                 '<div class="stack" style="padding: var(--space-4)">' + _SK + '<span class="skeleton skeleton--w75"></span><span class="skeleton skeleton--w50"></span></div></div>')
_TILE_EMPTY_BODY = ('<div class="tile__body"><div class="empty empty--center empty--tight">' + icon("check-circle")
                    + '<div><p class="empty__title">All clear</p><p class="empty__text">Blocked stages and budget stops show up here.</p></div></div></div>')
_TILE_ERROR_BODY = ('<div class="tile__body"><div class="empty empty--error empty--center empty--tight" role="alert">' + icon("alert-triangle")
                    + '<div><p class="empty__title">Events didn’t load</p><p class="empty__text">The event store timed out. Other tiles are live.</p></div>'
                    + btn("Retry", "", "sm", "refresh") + "</div></div>")


def _tile_states():
    sp = lambda **k: _tile("tile--compact", "Spend", "Today", _SPEND, **k)
    wk = lambda **k: _tile("tile--compact", "Workers", "3 of 4 online", _WORKERS, **k)
    rows = [("Header link", [wk(open_label="Open"), wk(open_label="Open", open_state=' data-state="hover"'), wk(open_label="Open", open_state=' data-state="focus"')]),
            ("Edit mode", [sp(edit=True), sp(edit=True, attrs='data-state="focus"'), wk(edit=True, locked=True)])]
    return matrix(["Default", "Hover", "Focus / locked"], rows)


_TILE_CONTENT_STATES = matrix(["Loading", "Empty", "Error"], [
    ("Content", [_TILE_LOADING, _tile("tile--compact", "Needs attention", "0", _TILE_EMPTY_BODY), _tile("tile--compact", "Event stream", "Unavailable", _TILE_ERROR_BODY)])])

SPECS["tile"] = {
    "lead": "Dashboard tiles are the panels of Mission Control’s home: a 44px header with title, meta and an Open link, and a body that scrolls inside the tile. They sit on a 12-column grid that the Owner can rearrange.",
    "readme_variants": "standard, compact, list body, stat body; edit mode, locked",
    "readme_states": "default, header link hover/focus, loading, empty, error, edit, edit focus, locked",
    "pills": ["Dashboard only", "Region landmark"],
    "overview": f"""<p>Use a tile for one live summary on the dashboard: live work, items that need attention, the event stream, pull requests, spend, workers. Each tile answers one question at a glance and links to the page that answers it in full. Elsewhere, use a {page('components/card')}.</p>
{ul(["<b>Standard</b>: 14rem minimum height below lg; from lg its height is its row span on the grid (3.75rem rows).",
     "<b>Compact</b> (<code>.tile--compact</code>): 8rem minimum below lg, for one figure or a short list (Spend, Workers).",
     "<b>Body kinds</b>: a divided list (<code>.tile__body.divided</code>: Live work, Needs attention, Pull requests), a log-like list (<code>.events</code>), a stat (<code>.spend</code>) or a mini list (<code>.mini-list</code>).",
     "<b>Edit mode</b> (<code>.dash--edit</code> on the grid, <code>.tile--edit</code> on movable tiles, <code>.tile--locked</code> on fixed ones): desktop only, with a resize handle and keyboard moves."])}""",
    "anatomy": ('<div style="width: 100%; max-width: 22rem;">' + _tile("tile--compact", "Spend", "Today", _SPEND, "Open") + "</div>",
                [(10, 10), (34, 10), (82, 10), (50, 60)],
                [("Title", "<code>.tile__title</code>, an <code>&lt;h2&gt;</code> that names the region; <code>--text-h3</code>."),
                 ("Meta", "<code>.tile__meta</code>: a count or time (<i>Today</i>, <i>3 of 4 online</i>), caption, truncates."),
                 ("Open link (optional)", "<code>.tile__open</code>: to the full page, 28px tall, pushed to the end."),
                 ("Body", "<code>.tile__body</code>: fills the rest and scrolls vertically inside the tile.")]),
    "variants": f"""<h3>The dashboard grid</h3>
<p><code>.dash</code> stacks tiles in reading order below lg. From lg it is a 12-column grid with <code>--layout-dash-row</code> rows and a fixed placement per tile (widen the window past 62rem to see it).</p>
{ex(_dash(), "Live work 8×6, Needs attention 4×6, Event stream 5×6, Pull requests 4×6, Spend 3×3, Workers 3×3.", cls="ds-example__canvas--stack ds-example__canvas--canvas")}
<h3>Body kinds</h3>
{ex('<div class="grid--cards grid" style="width: 100%;">' + _tile("", "Needs attention", "2", _ATTN) + _tile("", "Event stream", '<span class="mono">#48,213</span>', _EVENTS) + _tile("tile--compact", "Workers", "3 of 4 online", _WORKERS, "Open") + "</div>",
    "Divided list, event list and mini list. The body scrolls; the header never does.", cls="ds-example__canvas--stack ds-example__canvas--canvas")}""",
    "sizes": table(["Tile", "Grid span (lg)", "Below lg"], [
        ["Live work", "columns 1–8, 6 rows", "14rem min, full width"], ["Needs attention", "columns 9–12, 6 rows", "14rem min"],
        ["Event stream", "columns 1–5, 6 rows", "14rem min"], ["Pull requests", "columns 6–9, 6 rows", "14rem min"],
        ["Spend", "columns 10–12, 3 rows", "8rem min (<code>.tile--compact</code>)"], ["Workers", "columns 10–12, 3 rows", "8rem min (<code>.tile--compact</code>)"]])
             + "<p>Rows are <code>--layout-dash-row</code> (3.75rem) with an 8px (<code>--space-2</code>) gap. In edit mode a tile resizes in whole cells; the smallest is 3×3.</p>",
    "states": f"""<p>The header link has hover and focus. In edit mode a movable tile is focusable (the ring is drawn around the tile) and shows its resize handle; a locked tile has a stronger neutral ring and a lock icon instead.</p>
{_tile_states()}
<h3>Loading, empty and error</h3>
{_TILE_CONTENT_STATES}
<p>Loading tiles are skeletons with the same header and grid placement, <code>aria-hidden</code>, inside a region with <code>aria-busy=&quot;true&quot;</code>. A failed tile keeps its header and says what failed; the other tiles stay live.</p>
<h3>Edit mode</h3>
{ex('<p class="text-sm text-muted">Drag a tile to move it, or its corner to resize. Arrow keys move the focused tile; Shift + arrow resizes. Occupied cells refuse the drop. Workers is locked.</p>' + _dash(edit=True),
    "<code>.dash--edit</code> draws the cell grid; header links are hidden while editing. From lg only.", cls="ds-example__canvas--stack ds-example__canvas--canvas")}
{themes('<div class="stack" style="width: 100%;">' + _tile("tile--compact", "Spend", "Today", _SPEND, "Open", labelled=False) + _tile("tile--compact", "Spend", "Edit mode", _SPEND, edit=True, labelled=False).replace(' tabindex="0"', "") + "</div>", stack=True)}""",
    "responsive": ul([
        "Base to md: one column in reading order (Live work, Needs attention, Event stream, Pull requests, Spend, Workers), 8px apart; tiles size to content with a 14rem (compact 8rem) minimum.",
        "From <code>--layout-breakpoint-sm</code> (576px) the event list shows the project column and Live work shows the worker name.",
        "From <code>--layout-breakpoint-lg</code> (992px): the 12-column grid with fixed placements; tile height comes from its row span and the body scrolls.",
        "Edit layout is desktop-only: the <i>Edit layout</i> button is <code>.lg-only</code> and below lg the dashboard leaves edit mode."]),
    "theming": """<p>Tiles read <code>--tile-ring</code> (default <code>--color-border-default</code>) and <code>--tile-shadow</code> (default <code>--shadow-1</code>). Edit mode sets <code>--tile-ring: --color-accent</code> and <code>--tile-shadow: --shadow-2</code>; locked sets <code>--tile-ring: --color-border-strong</code>. The edit grid lines are <code>--color-border-grid</code>.</p>
<p>In dark the shadow tokens deepen and the surface sits a step above the canvas, so tiles separate from the page by lightness; the accent ring in edit mode lightens with the accent.</p>""",
    "a11y": {
        "pattern": "<p>Each tile is a <code>&lt;section&gt;</code> named by its <code>&lt;h2&gt;</code> title through <code>aria-labelledby</code>, so it is a region landmark screen-reader users can jump between. In edit mode, movable tiles take <code>tabindex=&quot;0&quot;</code> and <code>aria-roledescription=&quot;movable tile&quot;</code>; dragging always has the keyboard alternative below (SC 2.5.7). Live lists do not announce: the event stream is <code>aria-live=&quot;off&quot;</code> and status changes go through the shell’s throttled status region.</p>",
        "keys": [(kbd("Tab"), "Moves through the links and buttons inside each tile; in edit mode, to each movable tile and its resize handle."),
                 (kbd("←") + " " + kbd("→") + " " + kbd("↑") + " " + kbd("↓"), "Edit mode, tile focused: moves the tile one cell. Occupied cells refuse the move."),
                 (kbd("Shift", "←") + " … " + kbd("Shift", "↓"), "Edit mode, tile focused: resizes by one cell."),
                 (kbd("Enter"), "Follows the Open link.")],
        "focus": "<p>Links in the header and body show the shared ring. A focused movable tile shows the ring around the whole tile, outside its accent edge.</p>",
        "labelling": "<p>The Open link adds the tile name as visually hidden text (<i>Open workers</i>, <i>Pipeline live work</i>), so it makes sense in a links list. The lock icon is an image named <i>Locked tile</i>; the resize handle is named <i>Resize Spend</i>. Charts carry a text alternative (<i>Spend for the last 7 days, $512.70 this week</i>).</p>",
        "pairs": [("Tile title", "--color-fg-default", "--color-bg-surface", 4.5), ("Tile meta", "--color-fg-subtle", "--color-bg-surface", 4.5),
                  ("Open link", "--color-fg-muted", "--color-bg-surface", 4.5), ("Open link, hover", "--color-fg-default", "--color-bg-subtle-hover", 4.5),
                  ("Edit ring", "--color-accent", "--color-bg-canvas", 3), ("Locked ring", "--color-border-strong", "--color-bg-canvas", 3),
                  ("Resize handle icon", "--color-fg-accent", "--color-accent-subtle", 4.5)],
        "motion": "<p>No tile animation. The spinning stage icon and pulsing segment are loops on <code>--duration-pulse</code>/<code>--duration-spin</code>, stopped under reduced motion.</p>",
        "touch": "<p>The resize handle is 24px (<code>--target-min</code>); edit mode is pointer-and-keyboard desktop only. The Open link is 28px tall in a 44px header.</p>",
    },
    "content": ul(["Titles are two-word nouns: <i>Live work</i>, <i>Needs attention</i>, <i>Event stream</i>.",
                   "Meta is a count or a time window with tabular figures: <i>2 running</i>, <i>9 merged today</i>, <i>3 of 4 online</i>.",
                   "Empty bodies say what will appear and when: <i>Events stream in here as soon as a worker leases a run.</i>",
                   "Error bodies say what failed and that the rest still works: <i>The event store timed out. Other tiles are live.</i>"]),
    "dodont": [
        ('<div style="width: 100%;">' + _tile("tile--compact", "Needs attention", "0", _TILE_EMPTY_BODY) + "</div>", "Compact empty states use <code>.empty--tight</code>, which sets the title to <code>--text-h3</code>.",
         '<div class="tile tile--compact" style="width: 100%;"><div class="tile__header"><h2 class="tile__title">Needs attention</h2></div><div class="tile__body"><div class="empty empty--center">' + icon("check-circle") + '<div><p class="empty__title" style="font: var(--text-h3)">All clear</p></div></div></div></div>',
         "The dashboard mocks restyled the title inline (<code>style=&quot;font: var(--text-h3)&quot;</code>) 59 times."),
        ('<div style="width: 100%;">' + _tile("tile--compact", "Workers", "3 of 4 online", _WORKERS, "Open") + "</div>", "The Open link carries the tile name for screen readers.",
         '<div class="tile tile--compact" style="width: 100%;"><div class="tile__header"><h2 class="tile__title">Workers</h2><a class="tile__open" href="#do-dont">Open ' + icon("arrow-up-right", "icon--xs") + "</a></div></div>",
         "A bare <i>Open</i>: in a links list it reads <i>Open, Open, Pipeline</i> with no object."),
    ],
    "tokens": [("Background", "--color-bg-surface"), ("Ring", "--color-border-default"), ("Shadow", "--shadow-1"),
               ("Edit ring / shadow", "--color-accent / --shadow-2"), ("Locked ring", "--color-border-strong"), ("Edit grid lines", "--color-border-grid"),
               ("Header height", "--target-comfortable"), ("Header padding", "--space-4"), ("Title / meta", "--text-h3 / --text-caption"),
               ("Grid row / gap", "--layout-dash-row / --space-2"), ("Resize handle", "--target-min / --color-accent-subtle / --color-fg-accent"), ("Radius", "--radius-md")],
    "code": {"snippet": """<div class="dash">
  <section class="tile dash__workers tile--compact" aria-labelledby="t-workers">
    <div class="tile__header">
      <h2 class="tile__title" id="t-workers">Workers</h2>
      <span class="tile__meta">3 of 4 online</span>
      <a class="tile__open" href="/workers">Open<span class="visually-hidden"> workers</span> <svg class="icon icon--xs" aria-hidden="true">…</svg></a>
    </div>
    <ul class="tile__body mini-list">…</ul>
  </section>
</div>
<!-- edit mode -->
<div class="dash dash--edit">
  <section class="tile tile--edit dash__spend tile--compact" aria-labelledby="t-spend" tabindex="0" aria-roledescription="movable tile">
    …<button class="tile__handle" type="button" aria-label="Resize Spend">…</button>
  </section>
</div>""",
             "classes": [("<code>.dash</code>", "Stack below lg; 12-column grid from lg."),
                         ("<code>.dash__live</code> <code>__attention</code> <code>__events</code> <code>__prs</code> <code>__spend</code> <code>__workers</code>", "Grid placement of each tile from lg."),
                         ("<code>.dash--edit</code>", "Draws the cell grid behind the tiles."),
                         ("<code>.tile</code>", "Panel: ring, shadow, header + scrolling body."),
                         ("<code>.tile--compact</code>", "8rem minimum height below lg."),
                         ("<code>.tile--edit</code> / <code>.tile--locked</code>", "Movable (accent ring, handle) / fixed (strong ring, lock)."),
                         ("<code>.tile__header</code> <code>__title</code> <code>__meta</code> <code>__open</code> <code>__body</code> <code>__handle</code> <code>__lock</code>", "Parts.")]},
    "sources": {"mocks": [("pages/dashboard/default", "every tile"), ("pages/dashboard/edit", "edit mode, locked Workers"), ("pages/dashboard/loading", "skeleton tiles"),
                          ("pages/dashboard/empty", "empty tiles"), ("pages/dashboard/partial", "one failed tile"), ("pages/dashboard/viewer", "no actions for Viewers")],
                "drift": "13px tile titles snapped to <code>--text-h3</code>; inline compact-empty titles replaced by <code>.empty--tight</code>; the header height is <code>--target-comfortable</code> and the handle <code>--target-min</code> (were raw 2.75rem and 1.5rem); tiles named with <code>aria-labelledby</code> instead of a duplicate <code>aria-label</code>; Open links gained the tile name."},
}

# ============================================================== dialog
_DIALOG_STATE_NOTES = ul([
    "<b>Default</b>: focus moves to the first field, or to the safe action (<i>Cancel</i>) in a confirmation. In the typed confirmation, <i>Delete project</i> stays disabled until the name matches.",
    "<b>Invalid</b>: the field gets <code>aria-invalid=&quot;true&quot;</code> and an error linked with <code>aria-describedby</code>; focus returns to the field.",
    "<b>Busy</b>: the confirm button is <code>aria-busy</code> + <code>aria-disabled</code> with a progressive label, fields are <code>readonly</code>, and Escape and Cancel still work only if the request can be abandoned safely.",
    "<b>Failed</b>: a danger callout with <code>role=&quot;alert&quot;</code> appears above the body, says what happened and what is safe; the confirm button becomes <i>Try again</i>. The dialog never closes on failure.",
    "<b>Success</b>: the dialog closes and a toast reports the outcome; when the result must be read (a new worker token), the dialog shows it with a single <i>Done</i>."])

SPECS["dialog"] = {
    "lead": "A modal dialog asks for one decision or a few fields without leaving the page: stop every worker, delete a project, raise a budget, create a worker token. Centred from sm; a bottom sheet on phones.",
    "readme_variants": "confirmation (alertdialog), destructive with typed confirmation, form, large, with icon and close; bottom sheet below sm",
    "readme_states": "default, confirm, invalid, busy, failed, success",
    "pills": ["APG Dialog (Modal)", "<code>role=&quot;alertdialog&quot;</code> for destructive"],
    "overview": f"""<p>Use a dialog when the person must decide before the page can continue, and the decision is small: a destructive confirmation, a short form (one to three fields), or a result that must be read once. Use a page when the task has more than three fields or needs its own URL (a new direction), a {page('components/drawer')} for navigation, a {page('components/menu')} for a list of actions, and a {page('components/toast')} to report an outcome.</p>
{ul(["<b>Confirmation</b> (<code>role=&quot;alertdialog&quot;</code>): states the consequence and offers the safe action and one danger action (<i>Stop all workers?</i>, <i>Revoke build-box-02?</i>).",
     "<b>Destructive with typed confirmation</b>: for irreversible deletes the person types the object’s name before the danger button enables (<i>Delete Harbor CRM?</i>).",
     "<b>Form</b> (<code>role=&quot;dialog&quot;</code>): a few fields and a primary action (<i>Raise Kiln Booking’s budget</i>, <i>Add a GitHub login</i>).",
     "<b>Large</b> (<code>.dialog__panel--lg</code>): a list to review or a result to copy (<i>Update Ledgerline’s skills?</i>, <i>New worker token</i>).",
     "<b>With icon and close</b> (<code>.dialog__head</code>, <code>.dialog__icon</code>, <code>.dialog__close</code>): optional; the mocks rely on Cancel and Escape instead of a close button."])}""",
    "anatomy": (_revoke(head_icon="x-circle"), [(14, 18), (50, 18), (50, 46), (78, 82), (90, 50)],
                [("Icon (optional)", "<code>.dialog__icon</code>: 40px danger disc for destructive confirmations, <code>aria-hidden</code>."),
                 ("Title", "<code>.dialog__title</code> (h2, <code>--text-h2</code>); the dialog’s name via <code>aria-labelledby</code>."),
                 ("Description", "<code>.dialog__text</code>: the consequence, <code>--text-body-sm</code> muted; linked with <code>aria-describedby</code>."),
                 ("Footer", "<code>.dialog__footer</code>: safe action then confirm. A row, end-aligned, from sm; stacked with the confirm on top and sticky below sm."),
                 ("Panel", "<code>.dialog__panel</code>: <code>--color-bg-surface-raised</code>, <code>--shadow-4</code>, 24px padding, <code>--radius-lg</code> (<code>--radius-xl</code> top corners as a sheet).")]),
    "variants": f"""<p>Every example sits on a sample of <code>--color-bg-backdrop</code>; in the product the backdrop covers the viewport and the page behind is <code>inert</code>.</p>
<h3>Confirmation</h3>
{_dex(_stop_workers(), "<code>role=&quot;alertdialog&quot;</code>. The body lists what will stop; the danger button names the action.")}
<h3>Destructive with typed confirmation</h3>
{_dex(_delete("confirm"), "The name matches, so <i>Delete project</i> is enabled. Used only where the loss cannot be undone.")}
<h3>Form</h3>
{_dex(_raise_budget(), "<code>role=&quot;dialog&quot;</code>; one money field and a primary action that says what happens next.")}
{_dex(_add_user(), "Field and a radio group in a <code>.fieldset</code>.")}
<h3>Large</h3>
{_dex(_update_skills(), "<code>.dialog__panel--lg</code> (32rem) for a list to review.")}
{_dex(_worker_token_success(), "A result shown once, with a close button and a single <i>Done</i>.")}
<h3>With icon</h3>
{_dex(_revoke(head_icon="x-circle"), "<code>.dialog__head</code> + <code>.dialog__icon</code>: optional emphasis for destructive confirmations.")}""",
    "sizes": table(["Size", "Class", "Max width", "Use"], [
        ["Small", "<code>.dialog__panel--sm</code>", "24rem", "One-sentence confirmations with no body."],
        ["Medium", "(default)", "<code>--layout-dialog-width</code> (28rem)", "Confirmations and forms up to three fields."],
        ["Large", "<code>.dialog__panel--lg</code>", "<code>--layout-dialog-width-lg</code> (32rem)", "Lists to review, results to copy."]])
        + _dex(_revoke(size="sm"), "Small (24rem). Below sm every size is a full-width bottom sheet.")
        + "<p>Height is capped at 90dvh; the panel scrolls inside itself and the footer stays visible (sticky below sm).</p>",
    "states": f"""<p>The delete-project dialog in every state. Button states inside follow the {page('components/button')} page.</p>
{_dex(_delete("default"), "Default: empty field, <i>Delete project</i> disabled.")}
{_dex(_delete("invalid"), "Invalid: the name does not match; error linked to the field.")}
{_dex(_delete("confirm"), "Confirm: the name matches; the danger button is enabled.")}
{_dex(_delete("busy"), "Busy: <code>aria-busy</code> danger button, field read-only.")}
{_dex(_delete("failed"), "Failed: danger callout, the typed name kept, <i>Try again</i>.")}
<h3>Form states</h3>
{_dex(_raise_budget("invalid"), "Invalid: the new budget is below what is already spent.")}
{_dex(_raise_budget("busy"), "Busy: <i>Saving…</i>")}
{_dex(_stop_workers("failed"), "Failed: one worker did not confirm; the dialog stays open with <i>Try again</i>.")}
{themes(_backdrop(_stop_workers(labelled=False)), stack=True)}
{_DIALOG_STATE_NOTES}""",
    "responsive": ul([
        "Base (below <code>--layout-breakpoint-sm</code>, 576px): a bottom sheet. Full width, top corners <code>--radius-xl</code>, slides up, max 90dvh, safe-area padding at the bottom. The footer is sticky at the bottom of the sheet and stacks its buttons full width with the confirm on top.",
        "From sm: centred with 16px around, <code>--radius-lg</code>, rises in; the footer is a row, end-aligned, confirm last.",
        "Width never exceeds the size’s max (24 / 28 / 32rem); content does not get wider on large screens.",
        "Long content scrolls inside the panel; the page behind never scrolls while the dialog is open."]),
    "theming": """<p>Component tokens: <code>--dialog-bg</code> (<code>--color-bg-surface-raised</code>), <code>--dialog-ring</code> (<code>--color-border-default</code>), <code>--dialog-shadow</code> (<code>--shadow-4</code>), <code>--dialog-pad</code> (<code>--space-6</code>), <code>--dialog-width</code>. The backdrop is <code>--color-bg-backdrop</code>; layers are <code>--z-overlay</code> (backdrop) and <code>--z-modal</code> (dialog).</p>
<pre><code>/* A roomier dialog for a review step */
.dialog--review { --dialog-pad: var(--space-8); --dialog-width: var(--layout-dialog-width-lg); }</code></pre>
<p>In dark the raised surface is lighter than the page and the backdrop darker, so the dialog stays the brightest surface; the danger button keeps its red ring against the raised surface.</p>""",
    "a11y": {
        "pattern": "<p><a href='https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/'>APG Dialog (Modal)</a>: <code>role=&quot;dialog&quot;</code> (or <code>role=&quot;alertdialog&quot;</code> for destructive confirmations, see the <a href='https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/'>Alert Dialog pattern</a>), <code>aria-modal=&quot;true&quot;</code>, <code>aria-labelledby</code> the title and <code>aria-describedby</code> the description. The rest of the page is <code>inert</code> while it is open. A native <code>&lt;dialog&gt;</code> opened with <code>showModal()</code> is equivalent. Documentation examples omit <code>aria-modal</code> because they are not modal.</p>",
        "keys": [(kbd("Tab") + " / " + kbd("Shift", "Tab"), "Cycles through the dialog’s controls only; focus is trapped."),
                 (kbd("Esc"), "Closes the dialog (same as Cancel), unless a request in flight cannot be abandoned."),
                 (kbd("Enter"), "In a field, submits the form dialog; on a button, activates it."),
                 (kbd("Space"), "Activates the focused button, toggles a radio.")],
        "focus": "<p>On open, focus goes to the first field (form dialogs) or to the safe action (confirmations, so Enter never destroys). On close, focus returns to the control that opened it; if that control is gone (the deleted project’s row), to the page heading. A busy button keeps focus.</p>",
        "labelling": "<p>The title is a question or a task that names the object (<i>Delete Harbor CRM?</i>); the description states the consequence and is read on open. Error text is linked to its field; the failed callout is announced with <code>role=&quot;alert&quot;</code>.</p>",
        "pairs": [("Title", "--color-fg-default", "--color-bg-surface-raised", 4.5), ("Description", "--color-fg-muted", "--color-bg-surface-raised", 4.5),
                  ("Field edge", "--color-border-strong", "--color-bg-surface-raised", 3), ("Failed callout text", "--color-danger-fg", "--color-danger-bg", 4.5),
                  ("Failed callout title", "--color-danger-strong", "--color-danger-bg", 4.5), ("Danger label", "--color-fg-on-danger", "--color-danger-solid", 4.5),
                  ("Focus ring on panel", "--color-focus-ring", "--color-bg-surface-raised", 3)],
        "motion": "<p>The sheet slides up (<code>sheet-in</code>) and the centred dialog rises in (<code>rise-in</code>), both <code>--duration-slow</code> on <code>--ease-enter</code>. Reduced motion zeroes the durations; the dialog simply appears.</p>",
        "touch": "<p>Footer buttons are 40px tall and full width in the sheet; the close button is 40px. Nothing in a dialog relies on hover.</p>",
    },
    "content": ul(["Title: a question for confirmations (<i>Stop all workers?</i>), a task for forms (<i>Raise Kiln Booking’s budget</i>). Name the object; never <i>Are you sure?</i>",
                   "Description: what happens and what is kept, in one or two sentences (<i>Ledgerline and Tidewater keep their last checkpoints…</i>). Say <i>This can’t be undone</i> only when true.",
                   "Confirm button repeats the verb of the title (<i>Stop all workers</i>, <i>Revoke token</i>); the safe action says what it keeps when <i>Cancel</i> would be ambiguous (<i>Keep running</i>, <i>Not now</i>).",
                   "Failed callout: what did not happen, why, what is safe (<i>Nothing was removed; try again.</i>)."]),
    "dodont": [
        ('<div style="width: 100%; min-width: 0;">' + _backdrop(_cancel_direction()) + "</div>", "<i>Keep running</i> next to <i>Cancel direction</i>, as the cancel-direction mock does.",
         '<div style="width: 100%; min-width: 0;">' + _backdrop(_cancel_direction("Cancel")) + "</div>", "<i>Cancel</i> beside <i>Cancel direction</i>: two buttons that start with the same word, one of which is irreversible."),
        ('<div class="cluster">' + _ghost() + _busy("Deleting…", "danger") + "</div>", "Busy with <code>aria-busy</code> + <code>aria-disabled</code>; focus stays on the button.",
         '<div class="cluster">' + _ghost() + '<button class="btn btn--danger" type="button" aria-busy="true" disabled>' + icon("loader") + "Deleting…</button></div>",
         "The busy dialog mocks set <code>disabled</code>, which drops focus to the page behind the dialog."),
    ],
    "tokens": [("Panel background", "--color-bg-surface-raised"), ("Panel ring", "--color-border-default"), ("Panel shadow", "--shadow-4"),
               ("Backdrop", "--color-bg-backdrop"), ("Padding", "--space-6"), ("Body gap / footer gap", "--space-5 / --space-2"),
               ("Width md / lg", "--layout-dialog-width / --layout-dialog-width-lg"), ("Radius centred / sheet", "--radius-lg / --radius-xl"),
               ("Title / description", "--text-h2 / --text-body-sm"), ("Description colour", "--color-fg-muted"),
               ("Icon disc", "--color-danger-bg / --color-danger-icon"), ("Layers", "--z-overlay / --z-modal"), ("Enter motion", "--duration-slow / --ease-enter")],
    "code": {"snippet": """<div class="backdrop"></div>
<div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" aria-describedby="dlg-desc">
  <div class="dialog__panel">
    <h2 class="dialog__title" id="dlg-title">Stop all workers?</h2>
    <p class="dialog__text" id="dlg-desc">All 3 online workers halt their active runs within 10 seconds…</p>
    <ul class="mini-list mt-4">…</ul>
    <div class="dialog__footer">
      <button class="btn btn--ghost" type="button">Cancel</button>
      <button class="btn btn--danger" type="button">…Stop all workers</button>
    </div>
  </div>
</div>""",
             "classes": [("<code>.backdrop</code>", "Fixed full-viewport scrim, <code>--z-overlay</code>."),
                         ("<code>.dialog</code>", "Fixed positioning layer, <code>--z-modal</code>: bottom sheet below sm, centred from sm."),
                         ("<code>.dialog__panel</code> <code>--sm</code> <code>--lg</code>", "The surface and its width."),
                         ("<code>.dialog__head</code> <code>__icon</code> <code>__close</code>", "Optional header row with danger disc and close button."),
                         ("<code>.dialog__title</code> <code>__text</code> <code>__body</code> <code>__footer</code>", "Parts."),
                         ("<code>.dialog--static</code>", "Documentation only: renders the dialog in the flow, without the fixed layer.")]},
    "sources": {"mocks": [("dialogs/stop-workers/default", "confirmation"), ("dialogs/delete-project/default", "typed confirmation"), ("dialogs/delete-project/invalid", "invalid"),
                          ("dialogs/delete-project/failed", "failed"), ("dialogs/raise-budget/default", "form"), ("dialogs/add-user/default", "form with radios"),
                          ("dialogs/update-skills/default", "large"), ("dialogs/worker-token/success", "result shown once"), ("dialogs/revoke-worker/busy", "busy"),
                          ("dialogs/cancel-direction/default", "Keep running")],
                "drift": "busy buttons use <code>aria-busy</code> instead of <code>disabled</code>; the footer is sticky in the bottom sheet; the sheet switches at 36rem (was 40rem); panel radius <code>--radius-lg</code> (sheet <code>--radius-xl</code>); fieldsets in add-user and worker-token use <code>.fieldset</code> instead of inline resets; the failed delete keeps the typed name."},
}

# ============================================================== drawer
_NAV = [("Dashboard", "layout-grid", True), ("Projects", "folder-kanban", False), ("Workers", "server", False), ("Audit", "scroll-text", False), ("Settings", "settings", False)]
_SIDE = [("Ledgerline", "Running", 62), ("Tidewater", "Running", 18), ("Parcel Post", "Blocked", 24), ("Kiln Booking", "Paused", 81)]


def _drawer(end=False, labelled=True, hover=False):
    links = "".join('<a class="nav-link" href="#overview"' + (' aria-current="page"' if cur else "") + (' data-state="hover"' if hover and i == 1 else "") + ">"
                    + icon(ic, "icon--lg") + lbl + "</a>" for i, (lbl, ic, cur) in enumerate(_NAV))
    projs = "".join('<li><a class="side-project" href="#overview">' + status_icon(st, "icon--sm") + '<span class="side-project__name">' + n
                    + '</span><span class="visually-hidden">, ' + st + ',</span><span class="side-project__pct">' + str(p) + "%</span></a></li>" for n, st, p in _SIDE)
    if labelled:
        sid = _uid("drawer-projects")
        sec = '<p class="sidebar__section" id="' + sid + '">Active directions</p><ul class="sidebar__projects" aria-labelledby="' + sid + '">'
    else:
        sec = '<p class="sidebar__section" aria-hidden="true">Active directions</p><ul class="sidebar__projects" aria-label="Active directions">'
    side = ('<div class="sidebar" style="min-height: 0;"><div class="sidebar__brand">' + wordmark("", "#overview", "Hewn, go to dashboard") + "</div>"
            '<div class="sidebar__cta">' + btn("New direction", "primary", "", "plus", attrs='style="width: 100%;"') + "</div>"
            '<nav class="sidebar__nav" aria-label="Primary, menu">' + links + "</nav>" + sec + projs + "</ul>"
            '<div class="sidebar__foot"><div class="conn"><span class="conn__state"><span class="dot"></span>Live</span><span class="tabular text-subtle">3 of 4 workers</span></div>'
            '<div class="user"><span class="avatar" aria-hidden="true">QB</span><div class="truncate"><div class="user__name truncate">quinntynebrown</div><div class="user__role">Owner</div></div></div></div></div>')
    close = '<button class="btn btn--ghost btn--icon btn--touch drawer__close" type="button" aria-label="Close menu">' + icon("x", "icon--lg") + "</button>"
    return ('<div class="drawer drawer--static' + (" drawer--end" if end else "") + '" role="dialog" aria-label="Menu">' + close + side + "</div>")


def _drawer_stage(inner, end=False):
    return ('<div style="display: flex; justify-content: ' + ("flex-end" if end else "flex-start") + '; width: 100%; overflow: hidden; '
            'background: var(--color-bg-backdrop); border-radius: var(--radius-md);">' + inner + "</div>")


SPECS["drawer"] = {
    "lead": "The drawer is the app’s navigation below 992px: the sidebar, slid in from the start edge over a backdrop, opened by the top bar’s menu button.",
    "readme_variants": "start (navigation), end",
    "readme_states": "closed, open; nav link hover and current inside",
    "pills": ["APG Dialog (Modal)", "Below lg only"],
    "overview": f"""<p>Use the drawer for the primary navigation on phones and tablets, where the {page('components/sidebar-nav')} does not fit. It holds exactly the sidebar: the New direction button, the primary links, active directions, connection state and the signed-in user. Do not use it for forms or confirmations: those are {page('components/dialog', 'dialogs')}.</p>
{ul(["<b>Start</b> (default): slides in from the left edge; the navigation drawer.",
     "<b>End</b> (<code>.drawer--end</code>): slides in from the right edge; available for a future detail panel, unused by the mocks."])}""",
    "anatomy": ('<div style="width: 100%;">' + _drawer_stage(_drawer()) + "</div>", [(70, 7), (30, 7), (30, 40), (30, 92), (60, 50)],
                [("Close button", "<code>.drawer__close</code>: 44px ghost icon button, top end; first focus."),
                 ("Brand", "The wordmark, linking to the dashboard."),
                 ("Navigation", "The sidebar’s CTA, primary links and active directions."),
                 ("Footer", "Connection state, worker count and the user."),
                 ("Panel", "<code>--layout-drawer-width</code> (18rem), max 85vw, full height, <code>--shadow-4</code>, hairline on the inner edge.")]),
    "variants": f"""{ex(_drawer_stage(_drawer()), "Start drawer (navigation). <code>role=&quot;dialog&quot;</code> named <i>Menu</i>.", _drawer(), "ds-example__canvas--stack")}
{ex(_drawer_stage(_drawer(end=True), end=True), "End drawer (<code>.drawer--end</code>): the hairline moves to the start edge.", _drawer(end=True), "ds-example__canvas--stack")}""",
    "sizes": NA("One width: --layout-drawer-width (18rem), capped at 85vw so a strip of the page stays visible."),
    "states": f"""<p>Closed, the drawer is not rendered (or <code>hidden</code>). Open, it is modal: the backdrop covers the page, the page is <code>inert</code>, focus starts on Close. The links inside have their own states: hover (shown on <i>Projects</i>) and current (<i>Dashboard</i>, <code>aria-current=&quot;page&quot;</code>).</p>
{ex(_drawer_stage(_drawer(hover=True)), "Open, with a hovered and a current link.", _drawer(hover=True), "ds-example__canvas--stack")}
{themes(_drawer_stage(_drawer(labelled=False)), stack=True)}""",
    "responsive": ul([
        "Base to md: the top bar shows the menu button (44px, <code>.btn--touch</code>); the drawer is 18rem or 85vw, whichever is smaller.",
        "md to lg: same drawer; the page behind keeps its layout.",
        "From <code>--layout-breakpoint-lg</code> (992px): the sidebar is permanently visible, the menu button is hidden, and an open drawer closes."]),
    "theming": """<p>The drawer reads <code>--drawer-width</code> (default <code>--layout-drawer-width</code>), <code>--color-bg-surface</code>, <code>--color-border-default</code> and <code>--shadow-4</code>; it sits on <code>--z-modal</code> above the <code>--color-bg-backdrop</code> scrim on <code>--z-overlay</code>. The sidebar inside keeps its own <code>--nav-*</code> tokens.</p>
<p>In dark the panel is the surface tone and the backdrop deepens, so the drawer separates from the page without a visible shadow.</p>""",
    "a11y": {
        "pattern": "<p><a href='https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/'>APG Dialog (Modal)</a>: <code>role=&quot;dialog&quot;</code>, <code>aria-modal=&quot;true&quot;</code>, <code>aria-label=&quot;Menu&quot;</code>; the page behind is <code>inert</code>. The menu button in the top bar has <code>aria-expanded</code> and <code>aria-controls</code> pointing at the drawer. Inside, the links are a <code>&lt;nav aria-label=&quot;Primary, menu&quot;&gt;</code>, distinct from the desktop sidebar’s <i>Primary</i>.</p>",
        "keys": [(kbd("Enter") + " / " + kbd("Space"), "On the menu button: opens the drawer, focus moves to Close."),
                 (kbd("Tab") + " / " + kbd("Shift", "Tab"), "Cycles through the drawer only."),
                 (kbd("Esc"), "Closes the drawer; focus returns to the menu button."),
                 (kbd("Enter"), "On a link: navigates and closes the drawer.")],
        "focus": "<p>Focus starts on Close, is trapped while open and returns to the menu button on close. Links show the shared ring.</p>",
        "labelling": "<p>The drawer is named <i>Menu</i>; Close is named <i>Close menu</i>. Status icons in the project list are paired with visually hidden status words (<i>Parcel Post, Blocked, 24%</i>).</p>",
        "pairs": [("Nav link", "--color-fg-muted", "--color-bg-surface", 4.5), ("Current link", "--color-fg-default", "--color-bg-surface-raised", 4.5),
                  ("Current icon", "--color-fg-accent", "--color-bg-surface-raised", 4.5), ("Section label and %", "--color-fg-subtle", "--color-bg-surface", 4.5),
                  ("Hovered link", "--color-fg-default", "--color-bg-subtle", 4.5), ("Focus ring", "--color-focus-ring", "--color-bg-surface", 3)],
        "motion": "<p>Slides in from its edge (<code>slide-in-start</code>, <code>--duration-slow</code>, <code>--ease-enter</code>); reduced motion zeroes it.</p>",
        "touch": "<p>Links and project rows are 44px tall below lg; Close is 44px. Tapping the backdrop closes the drawer.</p>",
    },
    "content": ul(["The drawer repeats the sidebar word for word; it never adds or renames items.",
                   "Close is an icon button named <i>Close menu</i>, not a text link."]),
    "dodont": [
        (_drawer_stage('<div class="drawer drawer--static" role="dialog" aria-label="Menu" style="min-height: 8rem;">' + '<button class="btn btn--ghost btn--icon btn--touch drawer__close" type="button" aria-label="Close menu">' + icon("x", "icon--lg") + "</button></div>"),
         "Close is a <code>&lt;button&gt;</code> that closes the drawer and returns focus.",
         _drawer_stage('<div class="drawer drawer--static" role="dialog" aria-label="Menu" style="min-height: 8rem;">' + '<a class="btn btn--ghost btn--icon btn--touch drawer__close" href="#do-dont" aria-label="Close menu">' + icon("x", "icon--lg") + "</a></div>"),
         "The mobile-nav mock’s Close is a link that reloads the dashboard, so focus lands at the top of a new page instead of on the menu button."),
        ('<div class="sidebar" style="min-height: 0; width: 100%;"><nav class="sidebar__nav" aria-label="Primary, menu"><a class="nav-link" href="#do-dont" aria-current="page">' + icon("layout-grid", "icon--lg") + "Dashboard</a></nav></div>",
         "Give the drawer’s nav its own name (<i>Primary, menu</i>), so two Primary landmarks never coexist.",
         '<div class="sidebar" style="min-height: 0; width: 100%;"><nav class="sidebar__nav" aria-label="Primary"><a class="nav-link" href="#do-dont" aria-current="page">' + icon("layout-grid", "icon--lg") + "Dashboard</a></nav></div>",
         "Copying the sidebar with the same label gives screen readers two identical navigation landmarks."),
    ],
    "tokens": [("Panel background", "--color-bg-surface"), ("Inner edge", "--border-width-hairline / --color-border-default"), ("Shadow", "--shadow-4"),
               ("Backdrop", "--color-bg-backdrop"), ("Width", "--layout-drawer-width"), ("Layers", "--z-overlay / --z-modal"),
               ("Close button", "--target-comfortable"), ("Enter motion", "--duration-slow / --ease-enter")],
    "code": {"snippet": """<button class="btn btn--ghost btn--icon btn--touch" type="button" aria-label="Open navigation"
        aria-expanded="true" aria-controls="menu">…</button>
<div class="backdrop"></div>
<div class="drawer" id="menu" role="dialog" aria-modal="true" aria-label="Menu">
  <button class="btn btn--ghost btn--icon btn--touch drawer__close" type="button" aria-label="Close menu">…</button>
  <div class="sidebar">…<nav class="sidebar__nav" aria-label="Primary, menu">…</nav>…</div>
</div>""",
             "classes": [("<code>.drawer</code>", "Fixed full-height panel at the start edge, <code>--z-modal</code>."),
                         ("<code>.drawer--end</code>", "At the end edge."),
                         ("<code>.drawer__close</code>", "Close button, top end."),
                         ("<code>.drawer--static</code>", "Documentation only: in the flow, no animation.")]},
    "sources": {"mocks": [("dialogs/mobile-nav/default", "navigation drawer"), ("pages/dashboard/default", "the sidebar it repeats")],
                "drift": "Close becomes a button that returns focus (the mock linked to the dashboard); width is <code>--layout-drawer-width</code>; motion uses <code>--duration-slow</code>/<code>--ease-enter</code>."},
}

# ============================================================== tooltip
def _tip(text, kind="label", state="open", ic="refresh", target_label="Refresh workers", tid=None, shortcut="", wrap=True, disabled_reason=False):
    """kind=label: the tooltip names an icon button (aria-labelledby); kind=desc: it describes (aria-describedby)."""
    tid = tid or _uid("tooltip")
    st = ' data-state="' + state + '"' if state in ("open",) else ""
    kb = ('<span class="kbd">' + shortcut + "</span>") if shortcut else ""
    tipel = '<span class="tooltip" role="tooltip" id="' + tid + '"' + st + ">" + text + kb + "</span>"
    if kind == "label":
        ctl = '<button class="btn btn--icon btn--ghost" type="button" aria-labelledby="' + tid + '">' + icon(ic) + "</button>"
    else:
        dis = ' aria-disabled="true"' if disabled_reason else ""
        ctl = ('<button class="icon-action" type="button" aria-label="' + target_label + '" aria-describedby="' + tid + '"' + dis + ">" + icon(ic) + "</button>")
    html = '<span class="tooltip-anchor">' + ctl + tipel + "</span>"
    return '<span style="display: inline-block; padding-top: var(--space-10);">' + html + "</span>" if wrap else html


def _tip_plain(text, ic="refresh", label="Refresh workers"):
    """For themes(): no ids (the tooltip is aria-hidden; the button carries aria-label)."""
    return ('<span style="display: inline-block; padding-top: var(--space-10);"><span class="tooltip-anchor"><button class="btn btn--icon btn--ghost" type="button" aria-label="' + label + '">'
            + icon(ic) + '</button><span class="tooltip" aria-hidden="true" data-state="open">' + text + "</span></span></span>")


def _tip_state(state):
    # pointer states forced on the anchor's button; the tooltip shown with data-state="open"
    tid = _uid("tooltip")
    bstate = {"hover": ' data-state="hover"', "focus": ' data-state="focus"'}.get(state, "")
    tstate = ' data-state="open"' if state in ("hover", "focus") else ""
    return ('<span style="display: inline-block; padding-top: var(--space-10);"><span class="tooltip-anchor"><button class="btn btn--icon btn--ghost" type="button" aria-labelledby="' + tid + '"' + bstate + ">"
            + icon("refresh") + '</button><span class="tooltip" role="tooltip" id="' + tid + '"' + tstate + ">Refresh workers</span></span></span>")


SPECS["tooltip"] = {
    "lead": "A tooltip is a short label or description that appears above a control on hover and on keyboard focus. It names icon-only buttons and explains why an action is unavailable.",
    "readme_variants": "label (names an icon button), description (adds context or a disabled reason), with shortcut",
    "readme_states": "hidden, hover (open after 300ms), focus (open), dismissed",
    "pills": ["APG Tooltip", "Core set (not in the mocks)"],
    "overview": f"""<p>Use a tooltip to name an icon-only {page('components/button')} (<i>Refresh workers</i>), to explain a disabled action (<i>Cancel the running direction first</i>) or to show a keyboard shortcut. A tooltip holds a few words of plain text, never links, buttons or anything the person must read to complete a task. Use an {page('components/inline-message')} or the dialog text for anything essential, since touch users never see a tooltip.</p>
{ul(["<b>Label</b>: the tooltip text is the button’s name (<code>aria-labelledby</code>).",
     "<b>Description</b>: the button has its own name and the tooltip adds to it (<code>aria-describedby</code>), for example a disabled reason.",
     "<b>With shortcut</b>: a <code>.kbd</code> after the text (<i>Resize Spend</i> <kbd>Shift</kbd> + arrows)."])}
<p>The mocks use the native <code>title</code> attribute for these 54 times (row actions on Projects, design-state links, width pickers); <code>title</code> never shows on keyboard focus or touch, so the system replaces it with this component.</p>""",
    "anatomy": (_tip("Cancel the running direction first", "desc", ic="archive", target_label="Archive Ledgerline", disabled_reason=True, wrap=False),
                [(50, -40), (50, 50)],
                [("Tooltip", "<code>.tooltip</code>: <code>--color-bg-inverse</code>, <code>--color-fg-inverse</code>, <code>--text-caption</code>, padding 6 × 10px, <code>--radius-sm</code>, <code>--shadow-3</code>, max 16rem; 8px above the anchor, centred."),
                 ("Anchor", "<code>.tooltip-anchor</code> wraps the control; hover or focus within it shows the tooltip.")]),
    "variants": f"""{ex(_tip("Refresh workers") + _tip("Open navigation", ic="menu"), "Label tooltips on icon-only buttons: the tooltip is the name.")}
{ex(_tip("Cancel the running direction first", "desc", ic="archive", target_label="Archive Ledgerline", disabled_reason=True) + _tip("Cancel the running direction first", "desc", ic="trash", target_label="Delete Ledgerline", disabled_reason=True), "Description tooltips on the Projects row actions while a direction runs (the buttons are <code>aria-disabled</code> and stay focusable).")}
{ex(_tip("Resize Spend", "desc", ic="resize", target_label="Resize Spend", shortcut="Shift + arrows"), "With a shortcut, from dashboard edit mode.")}""",
    "sizes": NA("Tooltips have one size: caption text, 16rem maximum width, wrapping onto a second line if needed."),
    "states": f"""<p>Hidden by default (<code>opacity: 0</code>, no pointer events). Hover shows it after <code>--delay-tooltip</code> (300ms); focus shows it with the same delay; leaving or blurring hides it at once. <code>data-state=&quot;open&quot;</code> forces it open for documentation.</p>
{matrix(["Hidden", "Hover", "Focus"], [("Label tooltip", [_tip_state("default"), _tip_state("hover"), _tip_state("focus")])])}
{themes('<div class="cluster" style="gap: var(--space-16); padding-inline: var(--space-12);">' + _tip_plain("Refresh workers") + _tip_plain("Copy token", "copy", "Copy token") + "</div>")}
<p><b>Dismissed</b>: <kbd>Esc</kbd> hides an open tooltip without moving focus (SC 1.4.13); it stays hidden until the pointer or focus leaves and comes back. Moving the pointer onto the tooltip keeps it open (it is hoverable), though it holds nothing to click.</p>""",
    "responsive": ul([
        "All breakpoints: above the anchor, centred, 8px gap. Keep anchors at least 8rem from the viewport edge (or start-align the tooltip) so it never overflows at 360px.",
        "Touch (<code>hover: none</code>): tooltips do not appear on tap; anything a tooltip says must also be available another way (the button’s name, a row note, the dialog that opens).",
        "Text wraps at 16rem; it never truncates."]),
    "theming": """<p>The tooltip uses the inverse pair (<code>--color-bg-inverse</code> / <code>--color-fg-inverse</code>) so it reads against any surface, with <code>--shadow-3</code> and <code>--z-tooltip</code> (above dialogs and toasts). The shortcut key inside drops its fill and takes a <code>--color-border-inverse</code> ring.</p>
<p>In dark the inverse pair flips to a light tooltip with dark text, which keeps it the highest-contrast element on the page.</p>""",
    "a11y": {
        "pattern": "<p><a href='https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/'>APG Tooltip</a>: the tooltip has <code>role=&quot;tooltip&quot;</code> and an id; the control references it with <code>aria-labelledby</code> (label tooltip) or <code>aria-describedby</code> (description tooltip). It appears on hover <b>and</b> focus, is dismissible with Escape, hoverable and persistent until dismissed (SC 1.4.13). The anchor control keeps focus; the tooltip never takes it.</p>",
        "keys": [(kbd("Tab"), "Focusing the control shows its tooltip."),
                 (kbd("Esc"), "Hides the tooltip; focus stays on the control."),
                 (kbd("Shift", "Tab"), "Moving focus away hides it.")],
        "focus": "<p>Focus stays on the anchor control and shows the shared ring; the tooltip is never focusable. Disabled-reason tooltips need the control to stay focusable, so the control uses <code>aria-disabled=&quot;true&quot;</code>, not <code>disabled</code>.</p>",
        "labelling": "<p>Label tooltips replace <code>aria-label</code>: one source of text, seen and heard. Description tooltips add to a name the control already has (<i>Archive Ledgerline</i>, described by <i>Cancel the running direction first</i>).</p>",
        "pairs": [("Tooltip text", "--color-fg-inverse", "--color-bg-inverse", 4.5), ("Focus ring on surface", "--color-focus-ring", "--color-bg-surface", 3)],
        "motion": "<p>Fades in over <code>--duration-fast</code> after <code>--delay-tooltip</code>; hides with no delay. Reduced motion zeroes the fade but keeps the delay, so a passing pointer does not flash tooltips.</p>",
        "touch": "<p>Tooltips are not a touch affordance. The anchors themselves meet the 24px minimum (row actions are 44px).</p>",
    },
    "content": ul(["Label tooltips are the control’s verb and object, sentence case, no full stop: <i>Refresh workers</i>, <i>Copy token</i>.",
                   "Disabled reasons say what to do first: <i>Cancel the running direction first</i>.",
                   "At most one short sentence; never repeat a visible label."]),
    "dodont": [
        (_tip("Cancel the running direction first", "desc", ic="trash", target_label="Delete Ledgerline", disabled_reason=True), "A real tooltip, shown on focus as well as hover, linked with <code>aria-describedby</code>.",
         '<span class="tooltip-anchor"><span class="icon-action" role="button" aria-disabled="true" tabindex="0" aria-label="Delete Ledgerline: cancel the running direction first" title="Cancel the running direction first">' + icon("trash") + "</span></span>",
         "The Projects mock: a <code>title</code> attribute on a span with <code>role=&quot;button&quot;</code>. Keyboard and touch users never see the reason."),
        (_tip("Refresh workers"), "The tooltip text is the name; nothing interactive inside.",
         '<span style="display: inline-block; padding-top: var(--space-12);"><span class="tooltip-anchor"><button class="btn btn--icon btn--ghost" type="button" aria-label="Open in Magic Patterns">' + icon("external") + '</button><span class="tooltip" aria-hidden="true" data-state="open">Open in Magic Patterns · see all 7 states</span></span></span>',
         "A tooltip with more than the name, or a link inside it, is a popover. Put extra detail on the page."),
    ],
    "tokens": [("Background", "--color-bg-inverse"), ("Text", "--color-fg-inverse"), ("Type", "--text-caption"), ("Padding", "--space-1-5 / --space-2-5"),
               ("Gap to anchor", "--space-2"), ("Radius", "--radius-sm"), ("Shadow", "--shadow-3"), ("Layer", "--z-tooltip"),
               ("Show delay", "--delay-tooltip"), ("Fade", "--duration-fast / --ease-standard"), ("Shortcut ring", "--color-border-inverse")],
    "code": {"snippet": """<!-- label tooltip: names an icon-only button -->
<span class="tooltip-anchor">
  <button class="btn btn--icon btn--ghost" type="button" aria-labelledby="tip-refresh">…</button>
  <span class="tooltip" role="tooltip" id="tip-refresh">Refresh workers</span>
</span>
<!-- description tooltip: a disabled reason -->
<span class="tooltip-anchor">
  <button class="icon-action" type="button" aria-label="Archive Ledgerline" aria-disabled="true"
          aria-describedby="tip-archive">…</button>
  <span class="tooltip" role="tooltip" id="tip-archive">Cancel the running direction first</span>
</span>""",
             "classes": [("<code>.tooltip-anchor</code>", "Positioning context; shows the tooltip on <code>:hover</code> and <code>:focus-within</code>."),
                         ("<code>.tooltip</code>", "The bubble, above and centred."),
                         ("<code>.kbd</code> inside", "Shortcut key on the inverse surface."),
                         ("<code>data-state=&quot;open&quot;</code>", "Documentation only: shows the tooltip with no delay.")]},
    "sources": {"mocks": [("pages/projects/default", "title attributes on row actions"), ("pages/designs/default", "title on width picker"),
                          ("pages/dashboard/edit", "keyboard resize shortcut")],
                "drift": "no tooltip existed in the mocks; 54 <code>title</code> attributes (row actions, state links, width options) are replaced by <code>.tooltip</code> with <code>aria-describedby</code> or <code>aria-labelledby</code>."},
}

# ============================================================== divider
_DIV_H = '<div style="width: 100%;"><p class="text-sm">Live work</p><hr class="divider"><p class="text-sm">Needs attention</p></div>'
_DIV_V = ('<div class="cluster" style="align-items: stretch;"><span class="text-sm">3 of 4 workers</span><span class="divider--vertical" role="separator" aria-orientation="vertical"></span>'
          '<span class="text-sm tabular">$86.40 today</span><span class="divider--vertical" role="separator" aria-orientation="vertical"></span><span class="text-sm">Live</span></div>')
_DIV_L = '<div style="width: 100%;"><div class="divider divider--label">Earlier today</div></div>'
_DIV_LIST = ('<ul class="divided" style="width: 100%;"><li class="text-sm" style="padding-block: var(--space-2-5);">#27 Split a transaction</li>'
             '<li class="text-sm" style="padding-block: var(--space-2-5);">#41 Reschedule a firing</li><li class="text-sm" style="padding-block: var(--space-2-5);">#25 Match a receipt by photo</li></ul>')

SPECS["divider"] = {
    "lead": "Dividers are hairlines that separate groups when spacing alone is not enough: between list rows, around tile headers and footers, between a main column and its rail.",
    "readme_variants": "horizontal, vertical, with label, divided list",
    "readme_states": "none (static)",
    "pills": ["<code>&lt;hr&gt;</code>", "Decorative hairline"],
    "overview": f"""<p>Reach for space first (see {page('foundations/spacing')}); add a divider when items of the same kind sit close together and need a boundary (rows of a list, a header bar above content). Most Hewn dividers are built into components: <code>.divided</code> lists in tiles, <code>.card__header</code>/<code>__footer</code>, <code>.sidebar__foot</code>, <code>.split--aside &gt; .rail</code>. Use the standalone classes only between page sections.</p>
{ul(["<b>Horizontal</b> (<code>&lt;hr class=&quot;divider&quot;&gt;</code>): between sections; 24px above and below.",
     "<b>Vertical</b> (<code>.divider--vertical</code>): between inline groups in a cluster.",
     "<b>With label</b> (<code>.divider--label</code>): a caption between two rules, for a time group in a long list.",
     "<b>Divided list</b> (<code>.divided</code>): a hairline between every child, none above the first."])}""",
    "anatomy": (_DIV_L, [(20, 50), (50, 50), (80, 50)],
                [("Rule", "1px (<code>--border-width-hairline</code>) <code>--color-border-default</code>."),
                 ("Label (optional)", "<code>--text-caption</code>, <code>--color-fg-subtle</code>, 12px from each rule."),
                 ("Rule", "Flexes to fill the remaining width.")]),
    "variants": f"""{ex(_DIV_H, "Horizontal: <code>&lt;hr class=&quot;divider&quot;&gt;</code>, margin <code>--space-6</code> above and below.", cls="ds-example__canvas--stack")}
{ex(_DIV_V, "Vertical: <code>role=&quot;separator&quot; aria-orientation=&quot;vertical&quot;</code>; stretches to the cluster’s height.")}
{ex(_DIV_L, "With label: the label is text, so it is read; the rules are pseudo-elements.", cls="ds-example__canvas--stack")}
{ex(_DIV_LIST, "Divided list: the pull request and live work tiles use <code>.tile__body.divided</code>.", cls="ds-example__canvas--stack")}""",
    "sizes": NA("One weight: the 1px hairline. The 2px --border-width-thick is reserved for the stage rail and current-tab underline, which are indicators, not dividers."),
    "states": NA("Dividers are static: they have no hover, focus or selected state."),
    "responsive": ul([
        "Horizontal dividers span their container at every breakpoint.",
        "Rails: <code>.split--form &gt; .rail</code> gains a vertical hairline from lg and <code>.split--aside &gt; .rail</code> from xl, when the rail moves beside the main column; below that the rail stacks and the hairline disappears (space separates it).",
        "Vertical dividers in a cluster disappear when the cluster wraps onto two lines; prefer a gap at 360px."]),
    "theming": """<p>Dividers read <code>--color-border-default</code> and <code>--border-width-hairline</code>. In dark the border token is a light step above the surface, so hairlines stay faint but visible. Forced-colours mode maps them to <code>CanvasText</code> via the border, so they stay visible there too.</p>""",
    "a11y": {
        "pattern": "<p>A section divider is <code>&lt;hr&gt;</code> (implicit <code>role=&quot;separator&quot;</code>). A purely visual hairline (list rows, header bars) is a border, not an element, so it is not announced. A vertical divider between groups is <code>role=&quot;separator&quot; aria-orientation=&quot;vertical&quot;</code>. See <a href='https://www.w3.org/TR/wai-aria-1.2/#separator'>WAI-ARIA separator</a>; a static separator is not focusable.</p>",
        "keys": [(kbd("Tab"), "Not focusable; focus passes over dividers.")],
        "focus": "<p>Dividers never take focus.</p>",
        "labelling": "<p>A labelled divider’s label is plain text and is read as such. Do not put meaning only in the line: a group needs its own heading or label.</p>",
        "pairs": [("Divider label", "--color-fg-subtle", "--color-bg-surface", 4.5), ("Divider label on canvas", "--color-fg-subtle", "--color-bg-canvas", 4.5)],
        "motion": "<p>None.</p>",
        "touch": "<p>Not interactive. The hairline is decorative (exempt from 1.4.11); it does not need 3:1.</p>",
    },
    "content": ul(["Divider labels are short time or group names in sentence case: <i>Earlier today</i>, <i>Yesterday</i>.",
                   "Never a divider label as a heading for content that needs navigation: use a real heading."]),
    "dodont": [
        (_DIV_LIST, "Use <code>.divided</code> for rows of the same kind.",
         '<ul style="width: 100%;"><li class="text-sm" style="padding-block: var(--space-2-5); border-top: 1px solid var(--color-border-default);">#27 Split a transaction</li><li class="text-sm" style="padding-block: var(--space-2-5); border-top: 1px solid var(--color-border-default);">#41 Reschedule a firing</li></ul>',
         "Fourteen mock components drew their own 1px <code>border-top</code>; the system routes every hairline through <code>--border-width-hairline</code> and <code>.divided</code>."),
        ('<div class="stack" style="width: 100%;"><p class="text-sm">Ledgerline</p><p class="text-sm">Tidewater</p></div>', "Between unlike blocks that already have space, let the space separate them.",
         '<div style="width: 100%;"><p class="text-sm">Ledgerline</p><hr class="divider"><p class="text-sm">Tidewater</p><hr class="divider"><p class="text-sm">Kiln Booking</p></div>', "A rule between every block adds noise and announces a separator for each."),
    ],
    "tokens": [("Rule colour", "--color-border-default"), ("Rule width", "--border-width-hairline"), ("Horizontal margin", "--space-6"),
               ("Vertical margin", "--space-2"), ("Label gap", "--space-3"), ("Label type / colour", "--text-caption / --color-fg-subtle")],
    "code": {"snippet": """<hr class="divider">
<span class="divider--vertical" role="separator" aria-orientation="vertical"></span>
<div class="divider divider--label">Earlier today</div>
<ul class="divided">…</ul>""",
             "classes": [("<code>.divider</code>", "Horizontal rule with section margins."),
                         ("<code>.divider--vertical</code>", "Vertical rule in a flex row."),
                         ("<code>.divider--label</code>", "Caption between two flexible rules."),
                         ("<code>.divided</code>", "Hairline between every child.")]},
    "sources": {"mocks": [("pages/dashboard/default", "divided tile lists"), ("pages/settings/default", "settings sections"), ("pages/increment/default", "aside rail")],
                "drift": "the 1px hairline is <code>--border-width-hairline</code> everywhere; standalone divider classes were added (the mocks only had borders inside components)."},
}

# ============================================================== layout primitives
_GRID12 = '<div class="grid ds-grid-demo" style="width: 100%;">' + "".join("<span>" + str(i) + "</span>" for i in range(1, 13)) + "</div>"
_GRID_SPANS = ('<div class="grid ds-grid-demo" style="width: 100%;"><span style="grid-column: 1 / -1;">1 / -1 (full)</span>'
               '<span style="grid-column: span 2;">span 2</span><span style="grid-column: span 2;">span 2</span>'
               '<span style="grid-column: span 1;">1</span><span style="grid-column: span 1;">1</span><span style="grid-column: span 2;">span 2</span></div>')
_BOX = lambda t: '<div class="card text-sm">' + t + "</div>"
_STACK = '<div class="stack" style="width: 100%;">' + _BOX("Page header") + _BOX("Live work") + _BOX("Needs attention") + "</div>"
_CLUSTER = '<div class="cluster">' + btn("Retry stage", "", "sm", "rotate-ccw") + btn("View log", "ghost", "sm") + status("Blocked") + "</div>"
_CLUSTER_B = '<div class="cluster cluster--between" style="width: 100%;"><span class="text-sm">Increment 7 of 12 · Reconcile a card statement</span><span class="text-mono-xs text-subtle">journey 4 · L2-018, L2-019</span></div>'
_SPLIT = ('<div class="split split--aside" style="width: 100%;"><div class="card text-sm">Main column: increment video</div>'
          '<div class="rail"><div class="card text-sm">Rail (24rem from xl): pull request, checks</div></div></div>')

SPECS["layout"] = {
    "lead": "Five primitives place everything in Hewn: container, grid, stack, cluster and split. They own the space between things, so components only own the space inside themselves.",
    "readme_variants": "container, pad, grid, grid--cards, stack (sm, lg), cluster (lg, end, between), split (pipeline, nav, trace, form, aside), narrow, form-col",
    "readme_states": "none (static)",
    "pills": ["Mobile first", "Token-driven"],
    "overview": f"""<p>Compose pages from these instead of writing margins on components. The column count, gutter and margin come from tokens that step up at md and lg (see {page('foundations/layout')}).</p>
{ul(["<b>Container</b> (<code>.container</code>): centres content up to <code>--layout-container-max</code> with <code>--layout-margin</code> on each side. <code>.pad</code> gives only the side margin.",
     "<b>Grid</b> (<code>.grid</code>): <code>--layout-columns</code> equal columns (4 / 8 / 12) with <code>--layout-gutter</code>. <code>.grid--cards</code> auto-fills 18rem cards.",
     "<b>Stack</b> (<code>.stack</code>): a vertical flow with one gap (16px; <code>--sm</code> 8px, <code>--lg</code> 32px).",
     "<b>Cluster</b> (<code>.cluster</code>): a wrapping row with an 8px gap; <code>--lg</code>, <code>--end</code>, <code>--between</code>.",
     "<b>Split</b> (<code>.split--*</code>): a stack that becomes a two-column page layout at lg or xl: pipeline stage rail, settings nav, traceability, form with rail, aside.",
     "<b>Measures</b>: <code>.narrow</code> (56rem), <code>.form-col</code> (<code>--layout-form-max</code>), <code>.max-measure</code> (<code>--layout-measure</code>, 65ch)."])}""",
    "anatomy": (_GRID12, [(2, 50), (12, 50), (16, 50)],
                [("Margin", "<code>--layout-margin</code>: 16px, 32px from lg."),
                 ("Column", "<code>--layout-columns</code>: 4, 8 from md, 12 from lg; equal <code>minmax(0, 1fr)</code>."),
                 ("Gutter", "<code>--layout-gutter</code>: 16px, 24px from md, 32px from lg.")]),
    "variants": f"""<h3>Grid</h3>
{ex(_GRID12, "Twelve cells: they wrap to 4 per row on phones, 8 from md and sit on one row from lg. Resize the window to watch the tokens change.", cls="ds-example__canvas--stack")}
{ex(_GRID_SPANS, "Spans: <code>grid-column: 1 / -1</code> is always full width; a span must not exceed 4, the phone column count, or the grid adds implicit columns.", cls="ds-example__canvas--stack")}
{ex('<div class="grid grid--cards" style="width: 100%;">' + _BOX("Ledgerline") + _BOX("Tidewater") + _BOX("Parcel Post") + _BOX("Kiln Booking") + "</div>", "<code>.grid--cards</code>: as many 18rem columns as fit.", cls="ds-example__canvas--stack")}
<h3>Stack</h3>
{ex(_STACK, "<code>.stack</code>: 16px between children.", cls="ds-example__canvas--stack")}
<h3>Cluster</h3>
{ex(_CLUSTER, "<code>.cluster</code>: the Needs attention actions; items wrap with an 8px gap.")}
{ex(_CLUSTER_B, "<code>.cluster--between</code>: title and tags at opposite ends, wrapping on phones.", cls="ds-example__canvas--stack")}
<h3>Split</h3>
{ex(_SPLIT, "<code>.split--aside</code>: one column until xl, then main + 24rem rail with a hairline.", cls="ds-example__canvas--stack")}
{table(["Split", "From", "Columns", "Used on"], [
    ["<code>.split--pipeline</code>", "lg / xl", "18rem then <code>--layout-rail-pipeline</code> (20rem) + main", "Project pipeline stage list"],
    ["<code>.split--nav</code>", "lg", "<code>--layout-rail-nav</code> (15rem) + main", "Settings"],
    ["<code>.split--trace</code>", "lg", "17rem + main, 32px gap", "Traceability"],
    ["<code>.split--form</code>", "lg / xl", "main + 20rem, then main + <code>--layout-rail-aside</code>", "New direction"],
    ["<code>.split--aside</code>", "xl", "main + <code>--layout-rail-aside</code> (24rem)", "Increment"]])}""",
    "sizes": table(["Primitive", "Small", "Default", "Large"], [
        ["Stack gap", "<code>.stack--sm</code> 8px", "16px", "<code>.stack--lg</code> 32px"],
        ["Cluster gap", "8px (default)", "8px", "<code>.cluster--lg</code> 16 × 24px"],
        ["Split gap", "", "24px", "32px (trace, aside), 40px (form)"]]),
    "states": NA("Layout primitives are static; they have no interactive states."),
    "responsive": ul([
        "Base (0–575px): 4 columns, 16px gutter, 16px margin; every split is one column; clusters wrap.",
        "<code>--layout-breakpoint-sm</code> (576px): no grid change; components switch (dialogs centre, toasts move to the corner).",
        "<code>--layout-breakpoint-md</code> (768px): 8 columns, 24px gutter.",
        "<code>--layout-breakpoint-lg</code> (992px): 12 columns, 32px gutter, 32px margin; the sidebar appears; pipeline, nav, trace and form splits go two-column.",
        "<code>--layout-breakpoint-xl</code> (1200px): the aside split and the wider pipeline and form rails.",
        "Above <code>--layout-container-max</code> (90rem) the container stops growing and centres."]),
    "theming": "<p>Layout has no colour except the rail hairline (<code>--color-border-default</code>). Re-skin spacing by changing the layout tokens, never by overriding the primitives: <code>--layout-columns</code>, <code>--layout-gutter</code>, <code>--layout-margin</code>, <code>--layout-container-max</code>, the rails and the measures. Theme switches do not change layout.</p>",
    "a11y": {
        "pattern": "<p>No roles: layout primitives are plain <code>&lt;div&gt;</code>s. Landmarks (<code>header</code>, <code>nav</code>, <code>main</code>, <code>aside</code>) go on the content, not the primitive. DOM order is reading order: splits put the rail first in the DOM only when it is read first (the pipeline stage list); never reorder with <code>order</code> or <code>row-reverse</code>. The one exception is the dialog footer’s <code>column-reverse</code> on phones, which keeps Cancel first in the DOM and focus order.</p>",
        "keys": [(kbd("Tab"), "Follows DOM order through every column, top to bottom, start to end.")],
        "focus": "<p>Primitives are never focusable. <code>html</code> sets <code>scroll-padding-top: --layout-topbar-height</code> so the sticky top bar never covers a focused element (SC 2.4.11).</p>",
        "labelling": "<p>Nothing to label. A split’s rail that is a landmark (<code>&lt;aside&gt;</code>) gets an <code>aria-label</code>.</p>",
        "pairs": [("Text on canvas", "--color-fg-default", "--color-bg-canvas", 4.5), ("Muted text on canvas", "--color-fg-muted", "--color-bg-canvas", 4.5)],
        "motion": "<p>None. Layout changes at breakpoints are instant.</p>",
        "touch": "<p>Clusters keep at least 8px between targets; at 400% zoom (320 CSS px) every split is a single column and nothing scrolls sideways (SC 1.4.10).</p>",
    },
    "content": ul(["Prose stays within <code>.max-measure</code> (65ch); forms within <code>.form-col</code> (42rem).",
                   "Do not justify text or centre long paragraphs; centre only empty states and short error pages."]),
    "dodont": [
        (_CLUSTER, "Use the cluster’s gap.",
         '<div class="cluster" style="gap: var(--space-1-5)">' + btn("Retry stage", "", "sm", "rotate-ccw") + btn("View log", "ghost", "sm") + "</div>",
         "The mocks overrode the gap inline (<code>style=&quot;gap: var(--space-1-5)&quot;</code>) 32 times; use a modifier so the scale stays consistent."),
        ('<div style="width: 100%; max-width: 16rem;">' + '<button class="btn btn--danger btn--sm btn--block" type="button">' + icon("octagon-x", "icon--sm") + "Stop all workers</button>" + "</div>",
         "Full-width buttons use <code>.btn--block</code>.",
         '<div style="width: 100%; max-width: 16rem;">' + btn("Stop all workers", "danger", "sm", "octagon-x", attrs='style="width:100%; margin-top: var(--space-3);"') + "</div>",
         "The sidebar mock set <code>style=&quot;width:100%; margin-top: …&quot;</code> on 42 buttons."),
    ],
    "tokens": [("Columns", "--layout-columns"), ("Gutter", "--layout-gutter"), ("Margin", "--layout-margin"), ("Container max", "--layout-container-max"),
               ("Measure / form", "--layout-measure / --layout-form-max"), ("Rails", "--layout-rail-nav / --layout-rail-pipeline / --layout-rail-aside"),
               ("Stack gaps", "--space-2 / --space-4 / --space-8"), ("Cluster gaps", "--space-2 / --space-4 / --space-6"), ("Split gaps", "--space-6 / --space-8 / --space-10"),
               ("Breakpoints", "--layout-breakpoint-sm / --layout-breakpoint-md / --layout-breakpoint-lg / --layout-breakpoint-xl")],
    "code": {"snippet": """<div class="container">
  <div class="split split--aside">
    <section class="stack">…</section>
    <aside class="rail" aria-label="Pull request">…</aside>
  </div>
  <div class="grid">
    <div style="grid-column: 1 / -1">Full width</div>
  </div>
  <div class="cluster cluster--between">…</div>
</div>""",
             "classes": [("<code>.container</code> / <code>.pad</code>", "Centred max-width with margins / margins only."),
                         ("<code>.grid</code> / <code>.grid--cards</code>", "Token columns / auto-fill 18rem cards."),
                         ("<code>.stack</code> <code>--sm</code> <code>--lg</code>", "Vertical flow, 8 / 16 / 32px."),
                         ("<code>.cluster</code> <code>--lg</code> <code>--end</code> <code>--between</code>", "Wrapping row."),
                         ("<code>.split</code> <code>--pipeline</code> <code>--nav</code> <code>--trace</code> <code>--form</code> <code>--aside</code>", "Two-column page layouts from lg/xl."),
                         ("<code>.narrow</code> <code>.form-col</code> <code>.max-measure</code>", "Readable widths.")]},
    "sources": {"mocks": [("pages/increment/default", "split--aside"), ("pages/project-pipeline/default", "split--pipeline"), ("pages/settings/default", "split--nav"),
                          ("pages/new-direction/default", "split--form"), ("pages/traceability/default", "split--trace"), ("pages/projects/default", "container and clusters")],
                "drift": "breakpoints are min-width only (the mocks had <code>max-width: 61.99rem</code> queries); grid columns, gutter and margin come from tokens; inline gap and width overrides map to modifiers."},
}
