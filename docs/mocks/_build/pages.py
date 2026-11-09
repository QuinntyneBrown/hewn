"""Page mocks. Each function returns (body_html, description) for one state."""
from __future__ import annotations

from common import (ACTIVE, AUDIT, CUR, DECISIONS, DEFERRED, FULL, INCREMENTS, LOG, PROJECTS, STAGE_NAMES, STAGES, WORKERS,
                    btn, dialog_link, icon, money, note, page_header, page_link, project_header, shell, status,
                    status_icon, wordmark)


def sk(cls: str = "skeleton--line", style: str = "") -> str:
    st = f' style="{style}"' if style else ""
    return f'<span class="skeleton {cls}"{st} aria-hidden="true"></span>'


def loading_region(label: str, inner: str) -> str:
    return f'<div aria-busy="true" aria-live="polite"><p class="visually-hidden">{label}</p>{inner}</div>'


def error_block(title: str, text: str, retry: str = "Try again", back: tuple[str, str] | None = None) -> str:
    back_html = f'<a class="btn btn--ghost" href="{back[1]}">{back[0]}</a>' if back else ""
    return (f'<div class="empty empty--error" role="alert">{icon("alert-triangle")}<div><h2 class="empty__title">{title}</h2>'
            f'<p class="empty__text">{text}</p></div><div class="cluster">{btn(retry, "", "", "refresh")}{back_html}</div></div>')


def empty_block(ic: str, title: str, text: str, action: str = "") -> str:
    return (f'<div class="empty">{icon(ic)}<div><h2 class="empty__title">{title}</h2><p class="empty__text">{text}</p></div>'
            f'{action}</div>')


# ===========================================================================
# Sign in (SignIn frame)
# ===========================================================================
def sign_in(state):
    alerts = {
        "denied": ('<div class="callout callout--danger" role="alert">' + icon("shield-alert", "icon--lg") +
                   '<div><p class="callout__title">This account doesn’t have access</p><p class="callout__body">@devon-park isn’t on this Hewn’s allow list. Ask the Owner to add your GitHub login.</p></div></div>'),
        "expired": ('<div class="callout" role="status">' + icon("clock", "icon--lg") +
                    '<div><p class="callout__body" style="margin-top:0">Your session ended after 8 hours. Work kept running while you were away; sign in to catch up.</p></div></div>'),
        "error": ('<div class="callout callout--danger" role="alert">' + icon("alert-triangle", "icon--lg") +
                  '<div><p class="callout__title">GitHub didn’t answer</p><p class="callout__body">Sign-in timed out after 30 seconds. GitHub may be having trouble; your projects are unaffected. Try again in a moment.</p></div></div>'),
        "signed-out": ('<div class="callout callout--ok" role="status">' + icon("check-circle", "icon--lg") +
                       '<div><p class="callout__title">You’re signed out</p><p class="callout__body">Agents keep running on your workers. Sign in again to watch them.</p></div></div>'),
    }
    busy = state == "loading"
    button = (f'<button class="btn btn--stone auth__btn" type="button" aria-busy="true" disabled>{icon("loader", "icon--lg")}Waiting for GitHub…</button>'
              if busy else
              f'<a class="btn btn--stone auth__btn" href="{page_link("dashboard")}">{icon("github", "icon--lg")}{"Try again with GitHub" if state == "error" else "Continue with GitHub"}</a>')
    stages = "".join(
        f'<li><span class="n">{n:02d}</span><span>{name}</span><span class="out">{out}</span></li>'
        for n, name, _s, out, _d in STAGES)
    body = f"""<div class="auth">
<main id="main" class="auth__main">
  {wordmark("lg")}
  <div class="auth__center">
    <h1 class="auth__headline">Give it a direction.<br><span>Get back merged code.</span></h1>
    <p class="auth__lede">Mission Control is where you give Hewn direction and watch every stage, decision, pull request and dollar as it happens.</p>
    {alerts.get(state, "")}
    {button}
    <p class="text-caption mt-4">Only GitHub accounts on the allow list can sign in.</p>
  </div>
  <p class="text-caption">Hewn 0.9.2 · MIT</p>
</main>
<aside class="auth__aside" aria-label="The pipeline">
  <p class="text-sm text-muted" style="font-weight: var(--font-weight-medium)">Every direction runs the same pipeline</p>
  <ol class="auth__stages mt-6">{stages}</ol>
  <p class="text-sm text-muted mt-6" style="max-width: 24rem">Nothing waits for approval. Each increment ends in a video, a pull request and a merge.</p>
</aside>
</div>"""
    if busy:
        body += note("GitHub’s OAuth page opens in the same tab; this state shows while the redirect back is being verified.", "top: 1rem; right: 1rem;")
    desc = {
        "default": "GitHub sign-in with the pipeline beside it.",
        "loading": "Waiting for GitHub to hand the session back.",
        "error": "GitHub timed out; retry in place.",
        "denied": "A GitHub account that is not on the allow list.",
        "expired": "The 8-hour session ended; work kept running.",
        "signed-out": "Confirmation after signing out.",
    }[state]
    return body, desc


# ===========================================================================
# Dashboard (Dashboard frame with its six tiles)
# ===========================================================================
def _tile(cls: str, title: str, meta: str, body: str, open_href: str | None = None, open_label: str = "Open",
          edit: bool = False, locked: bool = False) -> str:
    open_html = (f'<a class="tile__open" href="{open_href}">{open_label} {icon("arrow-up-right", "icon--xs")}</a>'
                 if open_href and not edit else "")
    lock = f'<span class="tile__lock">{icon("lock", "icon--sm", "Locked tile")}</span>' if (edit and locked) else ""
    handle = (f'<button class="tile__handle" type="button" aria-label="Resize {title}">{icon("resize", "icon--xs")}</button>'
              if edit and not locked else "")
    tcls = "tile" + (" tile--edit" if edit and not locked else "") + (" tile--locked" if edit and locked else "")
    tab = ' tabindex="0" aria-roledescription="movable tile"' if edit and not locked else ""
    return (f'<section class="{tcls} {cls}" aria-label="{title}"{tab}><div class="tile__header"><h2 class="tile__title">{title}</h2>'
            f'<span class="tile__meta">{meta}</span>{open_html}{lock}</div>{body}{handle}</section>')


def _strip(stage: int, current: str = "run") -> str:
    segs = "".join(
        f'<span class="pstrip__seg pstrip__seg--{"ok" if i < stage else (current if i == stage else "pend")}"></span>'
        for i in range(11))
    label = ", ".join(f"{STAGE_NAMES[i]} {'Succeeded' if i < stage else ('Running' if i == stage else 'Pending')}" for i in range(11))
    return f'<div class="pstrip" role="img" aria-label="{label}">{segs}</div>'


def _live_tile(edit=False, empty=False, stopped=False):
    if empty:
        body = ('<div class="tile__body"><div class="empty empty--center empty--tight">' + icon("circle-dot") +
                '<div><p class="empty__title" style="font: var(--text-h3)">Nothing running</p><p class="empty__text">Give Hewn a direction and its stages appear here live.</p></div>' +
                btn("New direction", "primary", "sm", "plus", href=page_link("new-direction")) + '</div></div>')
        return _tile("dash__live", "Live work", "0 running", body, edit=edit)
    runs = [
        ("Ledgerline", 10, "Increments", "Increment 7 of 12 · Reconcile a card statement", "Implementing, iteration 3 of 10",
         "quinn-mbp.local · Local", 62, 184.20, 400, "Iteration 3 · Normalise posting dates to account time zone", ("project-pipeline", "default")),
        ("Tidewater", 3, "Design system", "Extracting tokens from 46 exported mocks", "Step 4 of 6 · colour tokens, light and dark",
         "hewn-cloud-eus-01 · Cloud", 18, 41.80, 300, "Matched 212 of 219 colour values to tokens", ("project-pipeline", "past-stage")),
    ]
    items = ""
    for name, stage, sname, step, detail, worker, pct, spend, budget, line, href in runs:
        stage_html = (f'<span class="run__stage" style="color: var(--color-warning-fg)">{icon("pause-circle", "icon--sm")}Paused at checkpoint · stage {stage}</span>'
                      if stopped else f'<span class="run__stage">{icon("loader", "icon--sm icon--spin")}Stage {stage} · {sname}</span>')
        items += f"""<li class="run">
  <div class="run__head"><a class="run__name" href="{page_link(*href)}">{name}</a>{stage_html}
    <span class="run__money">{pct}% · {money(spend)} <span class="text-subtle">of {money(budget)}</span></span></div>
  {_strip(stage, "paused" if stopped else "run")}
  <div><div class="text-sm">{step}</div><div class="text-sm text-muted">{detail}</div></div>
  <div class="run__line"><span class="dot"></span><span class="truncate">{line}</span><span class="ml-auto text-subtle sm-only">{worker}</span></div>
</li>"""
    return _tile("dash__live", "Live work", "0 running · 2 held" if stopped else "2 running",
                 f'<ul class="tile__body divided">{items}</ul>', page_link("project-pipeline"), "Pipeline", edit=edit)


def _attention_tile(role="owner", edit=False, empty=False):
    owner = role == "owner"
    if empty:
        return _tile("dash__attention", "Needs attention", "0",
                     '<div class="tile__body"><div class="empty empty--center empty--tight">' + icon("check-circle") +
                     '<div><p class="empty__title" style="font: var(--text-h3)">All clear</p><p class="empty__text">Blocked stages and budget stops show up here.</p></div></div></div>', edit=edit)
    acts1 = (f'<div class="cluster mt-1">{btn("Retry stage", "", "sm", "rotate-ccw")}{btn("View log", "ghost", "sm", href=page_link("project-pipeline", "blocked"))}</div>' if owner else "")
    acts2 = (f'<div class="cluster mt-1">{btn("Raise budget", "", "sm", "wallet", href=dialog_link("raise-budget"))}</div>' if owner else "")
    body = f"""<ul class="tile__body divided">
<li class="attn"><div class="attn__head"><a class="attn__name" href="{page_link('project-pipeline', 'blocked')}">Parcel Post</a>{status("Blocked")}</div>
  <p class="text-sm text-muted">Requirements failed 3 times: L2-014 has no acceptance criteria the brief can support.</p>
  <p class="text-mono-xs text-subtle">Stage 5 · last retry 18 min ago</p>{acts1}</li>
<li class="attn"><div class="attn__head"><a class="attn__name" href="{page_link('project-pipeline', 'budget-reached')}">Kiln Booking</a>{status("Paused", "Budget reached")}</div>
  <div class="meter meter--warn" role="meter" aria-label="Kiln Booking spend" aria-valuenow="250" aria-valuemin="0" aria-valuemax="250"><span class="meter__bar" style="--value: 100%"></span></div>
  <p class="text-sm text-muted tabular">$250.00 of $250.00 · increment 9 of 11 waiting</p>{acts2}</li>
</ul>"""
    return _tile("dash__attention", "Needs attention", "2", body, edit=edit)


EVENTS = [
    ("48,213", "14:31:07", "Ledgerline", "merge", "ok", "#27 Split a transaction · squash-merged"),
    ("48,212", "14:30:44", "Tidewater", "spend", "", "+$0.42 · claude-sonnet · 18.2k tokens"),
    ("48,211", "14:28:51", "Ledgerline", "log", "", "Frontend: lint clean, 236 unit tests passed"),
    ("48,210", "14:27:30", "Ledgerline", "log", "", "dotnet test · 412 passed"),
    ("48,209", "14:27:12", "Tidewater", "artifact", "", "docs/design-system/tokens/type.md @ 3f9a0d1"),
    ("48,208", "14:26:58", "Kiln Booking", "stage", "warn", "Paused · Budget reached"),
    ("48,207", "14:26:40", "Ledgerline", "spend", "", "+$0.88 · claude-opus · 21.4k tokens"),
    ("48,206", "14:26:02", "Ledgerline", "decision", "accent", "Normalise posting dates to account time zone"),
    ("48,205", "14:25:48", "Ledgerline", "check", "ok", "#27 e2e · passed (148 tests)"),
    ("48,204", "14:24:15", "Tidewater", "log", "", "Matched 212 of 219 colour values"),
]


def _events_tile(edit=False, empty=False):
    if empty:
        return _tile("dash__events", "Event stream", "#0",
                     '<div class="tile__body"><p class="trace__empty" style="padding: var(--space-4)">Events stream in here as soon as a worker leases a run.</p></div>', edit=edit)
    rows = "".join(
        f'<li class="event"><span class="text-subtle">{t}</span><span class="event__project">{p}</span>'
        f'<span class="truncate"><span class="event__kind{" event__kind--" + tone if tone else ""}">{k}</span>{txt}</span></li>'
        for _seq, t, p, k, tone, txt in EVENTS)
    return _tile("dash__events", "Event stream", '<span class="mono">#48,213</span>', f'<ol class="tile__body events" aria-live="off">{rows}</ol>', edit=edit)


def _prs_tile(edit=False, empty=False):
    if empty:
        return _tile("dash__prs", "Pull requests", "0 merged today",
                     '<div class="tile__body"><p class="trace__empty" style="padding: var(--space-4)">The first pull request opens after the scaffold stage.</p></div>', edit=edit)
    prs = [(27, "Ledgerline", "Split a transaction", True, "14 min ago"),
           (41, "Kiln Booking", "Reschedule a firing", True, "51 min ago"), (25, "Ledgerline", "Match a receipt by photo", True, "1 h ago"),
           (40, "Kiln Booking", "Waitlist for a full kiln", True, "2 h ago")]
    items = "".join(
        f'<li><a class="pr" href="{page_link("increment", "merged" if merged else "default")}">'
        f'{icon("git-merge" if merged else "git-pr", "s-icon--ok" if merged else "s-icon--run", "Merged" if merged else "Open")}'
        f'<span class="truncate"><span class="pr__title">{title}</span><span class="pr__meta">{proj} #{n} · {"Merged " + when if merged else when}</span></span></a></li>'
        for n, proj, title, merged, when in prs)
    return _tile("dash__prs", "Pull requests", "9 merged today", f'<ul class="tile__body divided">{items}</ul>', edit=edit)


def _spend_tile(edit=False, empty=False):
    week = [52.1, 71.4, 38.9, 94.2, 66.0, 103.7, 86.4]
    days = ["M", "T", "W", "T", "F", "S", "S"]
    if empty:
        week = [0, 0, 0, 0, 0, 0, 0]
    mx = max(week) or 1
    bars = "".join(
        f'<span class="bars__bar{" bars__bar--today" if i == 6 else ""}"><span class="bars__fill" style="--h: {max(2, round(v / mx * 36)) / 16:.3f}rem"></span>{d}</span>'
        for i, (v, d) in enumerate(zip(week, days)))
    today = "$0.00" if empty else "$86.40"
    wk = "$0.00 this week" if empty else "$512.70 this week"
    body = (f'<div class="spend"><div><div class="spend__value">{today}</div><div class="text-xs text-muted">{wk}</div></div>'
            f'<div class="bars" role="img" aria-label="Spend for the last 7 days, {wk}">{bars}</div></div>')
    return _tile("dash__spend tile--compact", "Spend", "Today", body, edit=edit)


def _workers_tile(edit=False, stopped=False, empty=False):
    items = "".join(
        f'<li>{status_icon("Idle" if (stopped or empty) and st == "Leased" else st, "icon--xs")}<span class="truncate mono text-muted" style="flex:1">{host}</span>'
        f'<span class="text-subtle">{("Idle" if empty else "Holding" if stopped else proj) if proj else st}</span></li>'
        for _id, host, _loc, _v, st, proj, _hb, _since in WORKERS)
    return _tile("dash__workers tile--compact", "Workers", "Stopped" if stopped else "3 of 4 online",
                 f'<ul class="tile__body mini-list">{items}</ul>', page_link("workers"), edit=edit, locked=True)


def dashboard(state):
    role = "viewer" if state == "viewer" else "owner"
    conn = "reconnecting" if state == "reconnecting" else "live"
    stopped = state == "stopped"
    edit = state == "edit"
    desc_line = {"empty": "Nothing running yet", "stopped": "All workers stopped · 2 directions held at their checkpoints"}.get(
        state, "2 directions running · 2 need attention · $86.40 spent today")
    actions = ""
    if state not in ("loading", "error", "empty", "viewer"):
        actions = (f'<span class="lg-only">{btn("Reset layout", "ghost", "sm", "rotate-ccw")}</span><span class="lg-only">{btn("Done", "primary", "sm", "check")}</span>'
                   if edit else f'<span class="lg-only">{btn("Edit layout", "", "sm", "layout-grid", href=page_link("dashboard", "edit"))}</span>')
    head = page_header("Dashboard", desc_line if state not in ("loading", "error") else ("Loading live work…" if state == "loading" else "Live work couldn’t load"), actions)
    if state == "loading":
        tiles = "".join(f'<div class="tile {c}" aria-hidden="true"><div class="tile__header">{sk("skeleton--w33")}</div><div style="padding: var(--space-4)" class="stack">{sk()}{sk("skeleton--w75")}{sk("skeleton--w50")}</div></div>'
                        for c in ["dash__live", "dash__attention", "dash__events", "dash__prs", "dash__spend", "dash__workers"])
        grid = loading_region("Loading the dashboard", f'<div class="dash">{tiles}</div>')
    elif state == "error":
        grid = error_block("The dashboard couldn’t load", "Mission Control couldn’t reach the Hewn API (503). Agents keep working; nothing is lost. Try again, or check Workers.",
                           back=("Open workers", page_link("workers")))
    else:
        empty = state == "empty"
        events = _events_tile(edit, empty)
        if state == "partial":
            events = _tile("dash__events", "Event stream", "Unavailable",
                           '<div class="tile__body"><div class="empty empty--error empty--center empty--tight" role="alert">' + icon("alert-triangle") +
                           '<div><p class="empty__title" style="font: var(--text-h3)">Events didn’t load</p><p class="empty__text">The event store timed out. Other tiles are live.</p></div>' +
                           btn("Retry", "", "sm", "refresh") + '</div></div>')
        grid = (f'<div class="dash{" dash--edit" if edit else ""}">{_live_tile(edit, empty, stopped)}{_attention_tile(role, edit, empty)}'
                f'{events}{_prs_tile(edit, empty)}{_spend_tile(edit, empty)}{_workers_tile(edit, stopped, empty)}</div>')
    hint = ""
    if edit:
        hint = ('<p class="text-sm text-muted lg-only pad" style="margin-bottom: var(--space-4)">Drag a tile to move it, or its corner to resize. Arrow keys move the focused tile; '
                'Shift + arrow resizes. Occupied cells refuse the drop. Workers is locked.</p>')
    main = f'{head}{hint}<div class="pad" style="padding-bottom: var(--space-10)">{grid}</div>'
    body = shell("dashboard", main, role, conn, stopped)
    if edit:
        body += note("Layout edit is desktop-only (≥ 992 px). Below that, tiles stack in reading order and the Edit layout button is hidden.", "top: 6rem; right: 1rem;")
    if state == "default":
        body += note("Event stream prepends live; Live work rotates the latest log line every 2.6 s. Neither announces to screen readers (aria-live off); status changes do, via the throttled region.", "top: 6rem; right: 1rem;")
    desc = {
        "default": "Live work, attention items, event stream, pull requests, spend and workers.",
        "loading": "Tile skeletons matching the grid.",
        "empty": "First run: no directions yet.",
        "error": "The API is unreachable; retry and a way to workers.",
        "partial": "Event stream failed; the other tiles stay live.",
        "edit": "Edit layout mode on the 12-column grid.",
        "reconnecting": "SignalR reconnecting banner over the live dashboard.",
        "stopped": "All workers stopped; directions held at checkpoints.",
        "viewer": "Viewer: no direction, stop, retry or layout controls.",
    }[state]
    return body, desc


# ===========================================================================
# Projects (Projects frame, the linked design)
# ===========================================================================
FILTERS = ["All", "Running", "Paused", "Blocked", "Idle", "Complete", "Cancelled", "Archived"]


def _project_rows(items, owner=True):
    out = ""
    for p in items:
        active = p["status"] in ACTIVE
        stage = f'{p["stage"]} · {STAGE_NAMES[p["stage"]]}'
        n = f'<span class="row__note">{p["note"]}</span>' if p["note"] else ""
        actions = ""
        if owner:
            if active:
                actions = (f'<span class="row__actions"><span class="icon-action" role="button" aria-disabled="true" tabindex="0" aria-label="Archive {p["name"]}: cancel the running direction first" title="Cancel the running direction first">{icon("archive")}</span>'
                           f'<span class="icon-action" role="button" aria-disabled="true" tabindex="0" aria-label="Delete {p["name"]}: cancel the running direction first" title="Cancel the running direction first">{icon("trash")}</span></span>')
            else:
                actions = (f'<span class="row__actions"><button class="icon-action" type="button" aria-label="Archive {p["name"]}" title="Archive">{icon("archive")}</button>'
                           f'<a class="icon-action" href="{dialog_link("delete-project")}" aria-label="Delete {p["name"]}" title="Delete">{icon("trash")}</a></span>')
        out += f"""<li class="row">
  <span class="truncate"><a class="row__title" href="{page_link(*p['href'])}">{p['name']}</a><span class="row__sub">{p['idea']}</span></span>
  <span class="row__end lg-hide">{status(p['status'])}</span>
  <span class="row__span truncate"><span>{stage}</span>{n}</span>
  <span class="lg-only">{status(p['status'])}</span>
  <span class="pct"><span class="meter meter--muted meter--inline" role="meter" aria-label="{p['name']} complete" aria-valuenow="{p['percent']}" aria-valuemin="0" aria-valuemax="100"><span class="meter__bar" style="--value: {p['percent']}%"></span></span>{p['percent']}%</span>
  <span class="row__end tabular">{money(p['spend'])}</span>
  <span class="row__end text-subtle lg-only">{p['last']}</span>
  {actions}
</li>"""
    return out


ARCHIVED = [dict(name="Saltmarsh Survey", idea="Bird-count logging for estuary volunteers", stage=10, percent=100, spend=288.15, last="12 Oct")]


def projects(state):
    role = "viewer" if state in ("viewer", "viewer-empty") else "owner"
    owner = role == "owner"
    active_filter = {"filtered": "Blocked", "no-results": "Archived", "archived": "Archived"}.get(state, "All")
    new_btn = btn("New product", "primary", "sm", "plus", href=page_link("new-direction")) if owner and state != "empty" else ""
    desc = {"loading": "Loading projects…", "error": "", "empty": ""}.get(state, "7 projects · sorted by last activity")
    head = page_header("Projects", desc, new_btn)
    if state in ("empty", "viewer-empty"):
        action = btn("New product", "primary", "", "plus", href=page_link("new-direction")) if owner else ""
        text = ("Describe a product in plain language. Hewn takes it from brief to merged pull requests without stopping to ask." if owner
                else "Nothing is being built yet. When an Owner gives Hewn a direction, the project appears here and you can watch it live.")
        content = f'<div class="pad">{empty_block("folder-open", "No projects yet", text, action)}</div>'
        return shell("projects", head + content, role), ("First run: no projects, one action." if owner else "Viewer first run: empty state without New product (L2-002 AC3).")
    if state == "error":
        content = f'<div class="pad">{error_block("Projects couldn’t load", "The Hewn API returned 503 Service Unavailable. Your directions are still running on their workers.", back=("Go to dashboard", page_link("dashboard")))}</div>'
        return shell("projects", head + content), "The list failed to load; chrome stays, retry offered."
    counts = {f: sum(1 for p in PROJECTS if p["status"] == f) for f in FILTERS}
    tabs = "".join(
        f'<a class="tab" href="{page_link("projects", {"Blocked": "filtered", "Archived": "archived"}.get(f, "default"))}"{CUR if f == active_filter else ""}>{f}'
        f'{"" if f in ("All", "Archived") else "<span class=" + chr(34) + "count" + chr(34) + ">" + str(counts[f]) + "</span>"}</a>'
        for f in FILTERS)
    filt = f'<div class="pad"><nav aria-label="Filter by status"><div class="tabs">{tabs}</div></nav></div>'
    cols = '<span>Project</span><span>Stage</span><span>Status</span><span>Complete</span><span class="row__end">Spend</span><span class="row__end">Activity</span>' + ('<span class="visually-hidden">Actions</span>' if owner else "")
    rows_cls = "rows rows--projects" if owner else "rows rows--projects-viewer"
    if state == "loading":
        skel = "".join(f'<li class="row" aria-hidden="true"><span class="stack stack--sm">{sk("skeleton--w33")}{sk("skeleton--w66 skeleton--sm")}</span>{sk("skeleton--w75")}<span class="lg-only">{sk()}</span><span class="lg-only">{sk()}</span><span class="lg-only">{sk()}</span><span class="lg-only">{sk()}</span></li>' for _ in range(6))
        listing = loading_region("Loading projects", f'<div class="{rows_cls}"><div class="rows__head" aria-hidden="true">{cols}</div><ul>{skel}</ul></div>')
    else:
        items = PROJECTS if active_filter == "All" else [p for p in PROJECTS if p["status"] == active_filter]
        if state == "archived":
            arows = "".join(f"""<li class="row">
  <span class="truncate"><span class="row__title">{a['name']}</span><span class="row__sub">{a['idea']}</span></span>
  <span class="row__end lg-hide">{status("Archived")}</span>
  <span class="row__span truncate"><span>{a['stage']} · {STAGE_NAMES[a['stage']]}</span></span>
  <span class="lg-only">{status("Archived")}</span>
  <span class="pct"><span class="meter meter--muted meter--inline" role="meter" aria-label="{a['name']} complete" aria-valuenow="{a['percent']}" aria-valuemin="0" aria-valuemax="100"><span class="meter__bar" style="--value: {a['percent']}%"></span></span>{a['percent']}%</span>
  <span class="row__end tabular">{money(a['spend'])}</span>
  <span class="row__end text-subtle lg-only">{a['last']}</span>
  <span class="row__actions">{btn("Restore", "", "sm", "rotate-ccw", attrs='aria-label="Restore ' + a['name'] + '"')}</span>
</li>""" for a in ARCHIVED)
            listing = f'<div class="{rows_cls}"><div class="rows__head" aria-hidden="true">{cols}</div><ul>{arows}</ul></div>'
        elif not items:
            listing = (f'<div class="empty empty--tight">{icon("archive")}<div><h2 class="empty__title">No archived projects</h2>'
                       f'<p class="empty__text">Archive a project you’ve finished with to keep this list short. Archived projects can be restored.</p></div>'
                       f'<a class="btn" href="{page_link("projects")}">Show all projects</a></div>')
        else:
            listing = f'<div class="{rows_cls}"><div class="rows__head" aria-hidden="true">{cols}</div><ul>{_project_rows(items, owner)}</ul></div>'
    main = f'{head}{filt}<div class="pad" style="padding-bottom: var(--space-10)">{listing}</div>'
    body = shell("projects", main, role)
    if state == "default":
        body += note("Archive and Delete are disabled while a direction is Running, Paused or Blocked; the tooltip and accessible name say why. Rows update in place within 1 s (L2-002).", "top: 9rem; right: 1rem;")
    d = {"default": "Every project with stage, status, percent complete, spend and last activity.",
         "loading": "Row skeletons under the filter tabs.", "no-results": "Archived filter with nothing archived; clear the filter.",
         "filtered": "Blocked filter showing one project.", "viewer": "Viewer: no New product, archive or delete.",
         "archived": "Archived filter: an archived project with Restore (L2-003 AC1)."}[state]
    return body, d


# ===========================================================================
# New direction (NewDirection frame)
# ===========================================================================
IDEA = ("A web app for small accounting teams (2–10 people) to reconcile bank and card statements against receipts. Connect a bank feed "
        "or import a CSV, match each transaction to a receipt photo, split transactions across categories, and close a month once a second "
        "person reviews it. Export the closed period to the general ledger.")
FEATURE = "Add a CSV export to the shift report so supervisors can open it in Excel. One row per shift, with crew, hours and incidents."


def _field(fid, label, control, hint="", error="", optional=False):
    opt = ' <span class="optional">(optional)</span>' if optional else ""
    help_html = ""
    if error:
        help_html = f'<span class="field__error" id="{fid}-err">{icon("alert-circle", "icon--sm")}{error}</span>'
    elif hint:
        help_html = f'<span class="field__hint" id="{fid}-hint">{hint}</span>'
    return f'<div class="field"><label class="field__label" for="{fid}">{label}{opt}</label><div class="field__control">{control}</div>{help_html}</div>'


def new_direction(state):
    if state == "forbidden":
        main = (f'<div class="pad" style="padding-block: var(--space-16)"><div class="stack" style="align-items:flex-start">{icon("lock", "icon--xl text-subtle")}'
                f'<h1>You don’t have permission</h1><p class="text-sm text-muted max-measure">Viewers can watch every project but can’t give direction. Ask an Owner to change your role.</p>'
                f'{btn("Back to projects", "", "", href=page_link("projects"))}</div></div>')
        return shell("projects", main, "viewer"), "Viewer opens New direction: 403 with a way back."
    feature = state == "feature"
    invalid = state == "invalid"
    noaccess = state == "repo-no-access"
    busy = state == "submitting"
    ro = " readonly" if busy else ""
    seg = "".join(
        f'<a class="segmented__opt" role="radio" href="{page_link("new-direction", "feature" if k == "feature" else "default")}" aria-checked="{"true" if (k == "feature") == feature else "false"}">{lbl}</a>'
        for k, lbl in [("product", "New product"), ("feature", "Feature for a product")])
    fields = []
    if feature:
        if state == "loading":
            fields.append(f'<div class="field"><span class="field__label">Product</span><div class="field__control">{sk("skeleton--btn", "width:100%; height: var(--control-height-md)")}</div><span class="field__hint">Loading your products…</span></div>')
        else:
            fields.append(_field("product", "Product", '<select class="select" id="product"><option>Northwind Ops · northwind/ops-portal</option><option>Field Notes · hewn-builds/field-notes</option>'
                                 '<option>Ledgerline · queues behind the running direction</option><option>Kiln Booking · queues behind the paused direction</option></select>',
                                 "A product whose first direction isn’t complete queues the feature behind it"))
        fields.append(_field("idea", "Feature", f'<textarea class="textarea" id="idea" rows="4" aria-describedby="idea-hint">{FEATURE}</textarea>', f"{len(FEATURE)} of 20,000 characters"))
    else:
        name_err = "Name is already used by another project. Pick a different name." if invalid else ""
        idea_err = "The idea must be 10 to 20,000 characters. This one has 8." if invalid else ""
        repo_err = ("Use a https://github.com/{owner}/{repo} URL." if invalid else
                    "Hewn’s GitHub App can’t write to northwind/handover. Install the app on that repository, or leave this empty to create one." if noaccess else "")
        inv = ' aria-invalid="true"'
        fields.append(_field("name", "Name", f'<input class="input" id="name" value="{"Ledgerline" if not invalid else "Field Notes"}"{inv + " aria-describedby=" + chr(34) + "name-err" + chr(34) if invalid else " aria-describedby=" + chr(34) + "name-hint" + chr(34)}{ro} autocomplete="off">', "1–100 characters, unique among your projects", name_err))
        idea_val = "Expenses" if invalid else IDEA
        fields.append(_field("idea", "Idea", f'<textarea class="textarea" id="idea" rows="7"{inv + " aria-describedby=" + chr(34) + "idea-err" + chr(34) if invalid else " aria-describedby=" + chr(34) + "idea-hint" + chr(34)}{ro}>{idea_val}</textarea>', f"{len(IDEA):,} of 20,000 characters", idea_err))
        repo_val = ' value="gitlab.com/ledgerline"' if invalid else (' value="https://github.com/northwind/handover"' if noaccess else "")
        fields.append('<div class="form-grid form-grid--2">' +
                      _field("stack", "Stack", f'<input class="input" id="stack" placeholder=".NET + Angular" aria-describedby="stack-hint"{ro}>', "Default: .NET backend, Angular frontend", optional=True) +
                      _field("repo", "Existing repository", f'<input class="input" id="repo"{repo_val} placeholder="Creates hewn-builds/ledgerline"{inv + " aria-describedby=" + chr(34) + "repo-err" + chr(34) if invalid else " aria-describedby=" + chr(34) + "repo-hint" + chr(34)}{ro}>', "https://github.com/{owner}/{repo}", repo_err, optional=True) + "</div>")
        if noaccess:
            fields[-1] = fields[-1].replace('id="repo"', 'id="repo" aria-invalid="true"', 1).replace('aria-describedby="repo-hint"', 'aria-describedby="repo-err"', 1)
    fields.append(_field("budget", "Budget", f'<div class="prefix prefix--money"><span class="prefix__sym" aria-hidden="true">$</span><input class="input" id="budget" inputmode="decimal" value="{"60.00" if feature else "400.00"}" aria-describedby="budget-hint"{ro}></div>',
                         "Pauses at 100%, warns at 80%. Project default is $300."))
    summary = ""
    if invalid:
        summary = ('<div class="callout callout--danger form-summary" role="alert" tabindex="-1" id="summary">' + icon("alert-triangle", "icon--lg") +
                   '<div><p class="callout__title">3 things to fix before Hewn can start</p><ul>'
                   '<li><a href="#name">Name is already used by another project</a></li><li><a href="#idea">The idea must be 10 to 20,000 characters</a></li>'
                   '<li><a href="#repo">Existing repository must be a GitHub URL</a></li></ul></div></div>')
    if noaccess:
        summary = ('<div class="callout callout--danger form-summary" role="alert" tabindex="-1">' + icon("alert-triangle", "icon--lg") +
                   '<div><p class="callout__title">1 thing to fix before Hewn can start</p><ul><li><a href="#repo">Hewn can’t write to this repository</a></li></ul></div></div>')
    if state == "error":
        summary = ('<div class="callout callout--danger" role="alert">' + icon("alert-triangle", "icon--lg") +
                   '<div><p class="callout__title">Hewn couldn’t queue this direction</p><p class="callout__body">The API returned 503. Nothing was created; your text is kept below. Try again.</p></div></div>')
    if state == "rate-limited":
        summary = ('<div class="callout callout--warn" role="alert">' + icon("clock", "icon--lg") +
                   '<div><p class="callout__title">Too many directions in a minute</p><p class="callout__body">You’ve submitted 10 in the last minute. You can submit again in 42 seconds; nothing you typed is lost.</p></div></div>')
    submit = (f'<button class="btn btn--primary" type="submit" aria-busy="true" disabled>{icon("loader")}Queuing direction…</button>' if busy else
              f'<button class="btn btn--primary" type="submit"{" disabled" if state == "rate-limited" else ""}>{icon("arrow-right")}Start direction</button>')
    skipped = [0, 4, 6] if feature else []
    plan = "".join(
        f'<li>{status_icon("Skipped" if n in skipped else "Pending", "icon--sm")}<span class="{"skip" if n in skipped else ""}">{name}</span>'
        f'<span class="out">{"skipped" if n in skipped else out}</span></li>' for n, name, _s, out, _d in STAGES)
    plan_text = ("Bootstrap, stack and scaffold are skipped. Designs are skipped too if there is no UI change." if feature
                 else "All eleven stages, in order. The first pull request lands after scaffold.")
    main = f"""<div class="pad" style="padding-block: var(--space-6) var(--space-12)"><div class="split split--form">
<form class="form-col" action="{page_link('project-pipeline', 'empty')}" novalidate>
  <h1>New direction</h1>
  <p class="text-sm text-muted mt-1">Once you submit, Hewn runs to merged code without asking you anything.</p>
  <div class="segmented segmented--lg mt-8" role="radiogroup" aria-label="Direction type">{seg}</div>
  <div class="stack mt-8" style="gap: var(--space-6)">{summary}{"".join(fields)}</div>
  <div class="form-actions">{submit}{btn("Cancel", "ghost", "", href=page_link("projects"))}</div>
</form>
<aside class="rail" aria-labelledby="plan-title">
  <h2 id="plan-title" style="font: var(--text-h3)">What runs next</h2>
  <p class="text-sm text-muted mt-1">{plan_text}</p>
  <ol class="plan mt-4">{plan}</ol>
</aside></div></div>"""
    body = shell("projects", main)
    if invalid:
        body += note("On submit, focus moves to the error summary; each item links to its field. Errors also sit under each field, wired with aria-describedby.", "top: 6rem; right: 1rem;")
    d = {"default": "Product direction form with the pipeline it will run.", "feature": "Feature direction: pick a product; stages 0, 4, 6 skipped; unfinished products queue it.",
         "loading": "Feature form while the product list loads.", "error": "Queuing failed (503); input kept.", "invalid": "Inline errors plus a linked error summary.",
         "repo-no-access": "A valid GitHub URL the GitHub App can’t write to (L2-001 AC4).",
         "submitting": "Start direction busy; fields read-only.", "rate-limited": "429 after 10 directions in a minute."}[state]
    return body, d


# ===========================================================================
# Project pipeline (ProjectPipeline frame)
# ===========================================================================
INCOMING_NOTE = "New log lines append every few seconds and the view follows them. Scroll up and it stays put, offering “n new lines — Jump to latest” (L2-033)."


def _stage_list(statuses, selected, live_text=None, durations=True, page_for=None):
    items = ""
    for (n, name, _s, _o, dur), st in zip(STAGES, statuses):
        cur = ' aria-current="step"' if n == selected else ""
        live = ""
        if live_text and n == 10:
            live = f'<span class="stage__live"><span class="stage__live-step">{live_text[0]}</span><span class="stage__live-line">{live_text[1]}</span></span>'
        dur_html = f'<span class="stage__dur tabular">{dur if st in ("Succeeded", "Running", "Failed", "Paused", "Cancelled") else "—"}</span>' if durations else ""
        href = page_link("project-pipeline", "past-stage") if page_for is None and n != 10 else (page_for or page_link("project-pipeline"))
        if n == 10 and page_for is None:
            href = page_link("project-pipeline")
        items += (f'<li><a class="stage" href="{href}"{cur}><span class="stage__row">{status_icon(st, "icon--sm")}<span class="stage__n">{n}</span>'
                  f'<span class="stage__name{" stage__name--skip" if st == "Skipped" else ""}">{name}</span>{dur_html}</span>'
                  f'<span class="visually-hidden">{st}</span>{live}</a></li>')
    return f'<ol class="stages" aria-label="Pipeline">{items}</ol>'


def _log(lines, live=True, jump=0):
    out = "".join(
        f'<div class="log__line"><span class="log__t">{t}</span><span class="log__lvl log__lvl--{lvl}">{lvl}</span><span class="log__text">{txt}</span></div>'
        for t, lvl, txt in lines)
    cursor = '<span class="log__cursor" aria-hidden="true"></span>' if live else ""
    jump_html = f'<button class="log__jump" type="button">{icon("arrow-down", "icon--xs")} {jump} new lines — Jump to latest</button>' if jump else ""
    return f'<div class="log"><div class="log__box" role="log" aria-label="Run log" tabindex="0">{out}{cursor}</div>{jump_html}</div>'


def _subtabs(active="log"):
    return '<div class="tabs mt-6" role="tablist" aria-label="Stage detail">' + "".join(
        f'<a class="tab tab--sm" role="tab" href="{page_link("project-pipeline", "runs" if k == "runs" else "default")}" aria-selected="{"true" if k == active else "false"}">{lbl}</a>'
        for k, lbl in [("log", "Log"), ("runs", "Runs"), ("artifacts", "Artifacts"), ("decisions", "Decisions")]) + "</div>"


def _increment_card(step_tone="run", sub="iteration 3 of 10", label="Increment 7 of 12 · Reconcile a card statement", tags="journey 4 · L2-018, L2-019", href=None):
    steps = ["Tests written", "Implement", "Video", "Pull request", "Merge"]
    cells = ""
    for i, s in enumerate(steps):
        bar = "ok" if i == 0 else (step_tone if i == 1 else "")
        lab_cls = "steps__label steps__label--now" if i == 1 else "steps__label"
        chk = icon("check", "icon--xs s-icon--ok") if i == 0 else ""
        subl = f'<span class="steps__sub">{sub}</span>' if i == 1 else ""
        cells += f'<li><div class="steps__bar{" steps__bar--" + bar if bar else ""}"></div><div class="{lab_cls}">{chk}<span class="truncate">{s}</span></div>{subl}</li>'
    return (f'<div class="card mt-6"><div class="cluster cluster--between"><a class="text-sm" style="font-weight: var(--font-weight-medium); color: inherit" href="{href or page_link("increment")}">{label}</a>'
            f'<span class="text-mono-xs text-subtle">{tags}</span></div><ol class="steps" aria-label="Increment steps">{cells}</ol></div>')


def _meta(skill, output, duration, worker):
    return (f'<dl class="meta"><div><dt>Skill</dt><dd class="mono">{skill}</dd></div><div><dt>Output</dt><dd class="mono">{output}</dd></div>'
            f'<div><dt>Duration</dt><dd>{duration}</dd></div><div><dt>Worker</dt><dd>{worker}</dd></div></dl>')


def project_pipeline(state):
    role = "viewer" if state == "viewer" else "owner"
    conn = "offline" if state == "offline" else "live"
    base = ["Succeeded"] * 10 + ["Running"]
    st_project, spend, budget, pct = "Running", 184.20, 400, 62
    name, repo, kind = "Ledgerline", "hewn-builds/ledgerline", "Product direction · started 7 Nov"
    selected, banner, title_status = 10, "", "Running"
    live_text = ("Increment 7 · implementing, iteration 3", LOG[-1][2])
    log_html = _log(LOG, True)
    show_card, step_tone = True, "run"
    meta = _meta("implementing-incrementally", "Test → Code → Video → PR", "3:12:48", "quinn-mbp.local · Local")
    stage_title = (10, "Increments")
    subtab = "log"
    extra_notes = ""
    card_args = {}

    if state == "loading":
        head = project_header("pipeline", role)
        left = loading_region("Loading the pipeline", '<div class="stack" aria-hidden="true">' + "".join(f'<div class="cluster">{sk("skeleton--w75")}</div>' for _ in range(11)) + "</div>")
        right = f'<div class="stack" aria-hidden="true">{sk("skeleton--title")}{sk("skeleton--w50")}{sk("skeleton--block", "height: 6rem")}{sk("skeleton--log")}</div>'
        main = f'{head}<div class="pad section"><div class="split split--pipeline">{left}<section aria-label="Stage detail">{right}</section></div></div>'
        return shell("projects", main), "Stage list and detail skeletons under the project header."
    if state == "error":
        head = project_header("pipeline", role)
        main = f'{head}<div class="pad">{error_block("The pipeline couldn’t load", "Ledgerline’s stages didn’t load (timeout after 10 s). The run itself is unaffected and keeps going on quinn-mbp.local.", back=("Back to projects", page_link("projects")))}</div>'
        return shell("projects", main), "Pipeline data failed to load; header stays."

    if state == "empty":
        base = ["Pending"] * 11
        st_project, spend, pct = "Running", 0.0, 0
        name, repo, kind = "Ledgerline", "hewn-builds/ledgerline", "Product direction · submitted just now"
        selected, title_status = 0, "Pending"
        live_text, show_card = None, False
        log_html = (f'<div class="empty empty--tight">{icon("circle-dashed")}<div><h2 class="empty__title">Waiting for a worker</h2>'
                    '<p class="empty__text">The direction is queued. Stage 0 starts as soon as a worker leases it, usually within 2 seconds. Nothing to do here.</p></div></div>')
        meta = _meta("Copy from Greenlit", ".hewn/skills.lock", "—", "Not leased yet")
        stage_title = (0, "Bootstrap")
    elif state == "blocked":
        name, repo, kind = "Parcel Post", "hewn-builds/parcel-post", "Product direction · started 8 Nov"
        st_project, spend, budget, pct = "Blocked", 58.10, 300, 24
        base = ["Succeeded"] * 5 + ["Failed"] + ["Pending"] * 5
        selected, title_status = 5, "Failed"
        live_text, show_card = None, False
        stage_title = (5, "Requirements")
        meta = _meta("engineering-requirements", "docs/specs/", "11:44", "hewn-cloud-eus-02 · Cloud")
        retry = btn("Retry stage", "", "sm", "rotate-ccw") if role == "owner" else ""
        banner = ('<div class="callout callout--danger" role="alert">' + icon("alert-triangle", "icon--lg") +
                  '<div><p class="callout__title">Stage failed after 3 retries</p><p class="callout__body">Validation failed: L2-014 has no Given/When/Then the brief can support. '
                  'Retried after 30 s, 2 min and 10 min. Other projects keep running. The last 200 log lines are below.</p>'
                  f'<div class="callout__actions">{retry}</div></div></div>')
        log_html = _log([("13:58:02", "info", "Retry 3 of 3 · engineering-requirements"), ("13:58:40", "info", "Wrote docs/specs/L1.md (11 requirements)"),
                         ("14:06:12", "info", "Wrote docs/specs/L2.md (38 requirements)"), ("14:06:13", "tool", "validate-requirements docs/specs/"),
                         ("14:06:14", "error", "L2-014 has no Given/When/Then acceptance criterion"), ("14:06:14", "error", "Validation failed: 1 requirement without criteria"),
                         ("14:06:14", "warn", "Stage 5 Failed after 3 retries · direction Blocked")], live=False)
    elif state == "budget-reached":
        name, repo, kind = "Kiln Booking", "hewn-builds/kiln-booking", "Product direction · started 5 Nov"
        st_project, spend, budget, pct = "Paused", 250.0, 250, 81
        base = ["Succeeded"] * 10 + ["Paused"]
        title_status = "Paused"
        live_text = None
        step_tone = "paused"
        raise_html = (f'<div class="callout__actions"><div class="prefix" style="width: 8rem"><span class="prefix__sym" aria-hidden="true">$</span>'
                      f'<input class="input input--sm" aria-label="New budget" value="350.00"></div>{btn("Raise budget and resume", "", "sm", href=dialog_link("raise-budget"))}</div>') if role == "owner" else ""
        banner = ('<div class="callout callout--warn" role="status">' + icon("pause-circle", "icon--lg") +
                  '<div><p class="callout__title">Paused · Budget reached</p><p class="callout__body">Spend hit $250.00 of $250.00 after the current model call. '
                  f'Raise the budget, then Resume. This is a safety stop, not an approval.</p>{raise_html}</div></div>')
        log_html = _log([("13:48:02", "info", "Increment 9 of 11 · Reschedule a firing (journey 5, L2-022)"), ("13:49:30", "info", "Red recorded: 3 failing, 0 passing"),
                         ("13:49:55", "info", "Iteration 1 · FiringSchedule.Move"), ("13:51:12", "warn", "Spend at 80% of budget ($200.00 of $250.00)"),
                         ("13:52:40", "warn", "Spend reached 100% ($250.00). Pausing after this model call."), ("13:52:41", "info", "Checkpoint committed: 4c1e0b2 · direction Paused")], live=False)
        meta = _meta("implementing-incrementally", "Test → Code → Video → PR", "3:12:48", "hewn-cloud-eus-02 · Cloud")
        card_args = dict(sub="iteration 1 of 10", label="Increment 9 of 11 · Reschedule a firing", tags="journey 5 · L2-022", href="#")
    elif state == "paused":
        st_project, base, title_status = "Paused", ["Succeeded"] * 10 + ["Paused"], "Paused"
        live_text = None
        step_tone = "paused"
        banner = ('<div class="callout callout--warn" role="status">' + icon("pause-circle", "icon--lg") +
                  '<div><p class="callout__title">Paused by quinntynebrown at 14:29</p><p class="callout__body">The step in progress finished and was checkpointed. Nothing new starts until Resume.</p></div></div>')
        log_html = _log(LOG + [("14:29:04", "info", "Pause requested by quinntynebrown"), ("14:29:40", "info", "Step finished · checkpoint a8d2e41 · direction Paused")], live=False)
    elif state == "cancelled":
        name, repo, kind = "Harbor CRM", "hewn-builds/harbor-crm", "Product direction · cancelled 8 Nov"
        st_project, spend, budget, pct = "Cancelled", 96.30, 300, 38
        base = ["Succeeded"] * 7 + ["Cancelled"] + ["Pending"] * 3
        selected, title_status = 7, "Cancelled"
        live_text, show_card = None, False
        stage_title = (7, "Detailed designs")
        meta = _meta("writing-software-design-documents", "docs/detailed-designs/", "22:16", "build-box-01 · Local")
        banner = ('<div class="callout" role="status">' + icon("ban", "icon--lg") +
                  '<div><p class="callout__title">Cancelled by quinntynebrown on 8 Nov at 17:01</p><p class="callout__body">The active run stopped within 4 seconds. '
                  'Pull request #9 is open and labelled <code>hewn:cancelled</code>. Merged work is kept. Submit a new direction to continue.</p></div></div>')
        log_html = _log([("17:01:36", "info", "Cancel requested by quinntynebrown"), ("17:01:40", "info", "Run stopped at step 3 of 4"), ("17:01:41", "tool", "gh pr edit 9 --add-label hewn:cancelled")], live=False)
    elif state == "complete":
        name, repo, kind = "Field Notes", "hewn-builds/field-notes", "Product direction · completed yesterday"
        st_project, spend, budget, pct = "Complete", 341.90, 400, 100
        base = ["Succeeded"] * 11
        title_status, live_text = "Succeeded", None
        show_card = False
        banner = ('<div class="callout callout--ok" role="status">' + icon("check-circle", "icon--lg") +
                  f'<div><p class="callout__title">Direction complete</p><p class="callout__body">14 increments merged, 2 deferred with reasons. $341.90 of $400.00 spent. '
                  f'Give a feature direction to keep building.</p><div class="callout__actions">{btn("Add a feature", "", "sm", "plus", href=page_link("new-direction", "feature"))}</div></div></div>')
        log_html = _log([("16:40:12", "info", "Increment 14 of 14 merged · #52"), ("16:40:13", "info", "docs/estimates/ updated · 100% complete"), ("16:40:14", "info", "Direction Complete")], live=False)
        meta = _meta("implementing-incrementally", "Test → Code → Video → PR", "9:48:02", "hewn-cloud-eus-01 · Cloud")
    elif state == "past-stage":
        name, repo, kind = "Tidewater", "hewn-builds/tidewater", "Product direction · started 9 Nov"
        st_project, spend, budget, pct = "Running", 41.80, 300, 18
        base = ["Succeeded"] * 3 + ["Running"] + ["Pending"] * 7
        selected, title_status = 2, "Succeeded"
        live_text, show_card = None, False
        stage_title = (2, "Designs")
        meta = _meta("Magic Patterns MCP", "docs/mocks/", "48:30", "hewn-cloud-eus-01 · Cloud")
        log_html = _log([("12:10:02", "info", "Stage 2 · Designs in Magic Patterns"), ("12:10:05", "tool", "magic-patterns.create_os_file kind=frame (14 screens)"),
                         ("12:51:44", "info", "46 states designed across 14 screens"), ("12:57:10", "tool", "export → docs/mocks/ (46 HTML files)"),
                         ("12:58:02", "info", "Validated: parses, no horizontal scroll at 375/768/1280"), ("12:58:32", "info", "Committed 5a1fe37 · stage Succeeded")], live=False)
    elif state == "feature-direction":
        name, repo, kind = "Northwind Ops", "northwind/ops-portal", "Feature direction · CSV export for the shift report · completed 2 h ago"
        st_project, spend, budget, pct = "Idle", 612.45, 800, 100
        base = ["Skipped", "Succeeded", "Skipped", "Skipped", "Skipped", "Succeeded", "Skipped", "Succeeded", "Succeeded", "Succeeded", "Succeeded"]
        selected, title_status = 9, "Succeeded"
        live_text, show_card = None, False
        stage_title = (9, "Estimates")
        meta = _meta("estimating-designs", "docs/estimates/", "5:37", "hewn-cloud-eus-02 · Cloud")
        banner = ('<div class="callout callout--info" role="status">' + icon("info", "icon--lg") +
                  '<div><p class="callout__title">Feature direction complete</p><p class="callout__body">Bootstrap, stack and scaffold were skipped. Designs and design system were skipped too: '
                  'the agent decided the CSV export adds no screen or state (decision 2f81c07). Northwind Ops is Idle until the next direction.</p></div></div>')
        log_html = _log([("12:22:10", "info", "Estimating 1 new design: shift-report/csv-export"), ("12:22:58", "info", "csv-export: 1.5 ideal days (under the 3-day threshold)"),
                         ("12:23:04", "tool", "git commit -m \"Estimate CSV export for the shift report\"")], live=False)
    elif state == "runs":
        subtab = "runs"
    elif state == "queued-direction":
        banner = ('<div class="callout callout--info" role="status">' + icon("info", "icon--lg") +
                  '<div><p class="callout__title">1 direction queued</p><p class="callout__body">Feature direction “Export a reconciled period as PDF”, submitted by quinntynebrown at 14:12, '
                  'starts when this direction is Complete or Cancelled. One direction runs per project, first in, first out.</p></div></div>')
    elif state == "log-scrolled":
        log_html = _log(LOG[:9], True, jump=12)

    head = project_header("pipeline", role, st_project, spend, budget, pct, name, repo, kind, skills=state not in ("cancelled", "complete"))
    stages = _stage_list(base, selected, live_text)
    n, sname = stage_title
    card = _increment_card(step_tone, **card_args) if show_card and selected == 10 else ""
    if subtab == "runs":
        detail = ('<div class="table-wrap mt-4"><table class="table"><caption class="visually-hidden">Runs of stage 10</caption><thead><tr><th scope="col">Run</th><th scope="col">Status</th>'
                  '<th scope="col" class="col-sm">Worker</th><th scope="col" class="num">Duration</th></tr></thead><tbody>'
                  f'<tr><td class="mono">run-0412</td><td>{status("Running")}</td><td class="mono col-sm text-muted">quinn-mbp.local</td><td class="num tabular text-muted">3:12:48</td></tr>'
                  f'<tr><td class="mono">run-0398</td><td>{status("Failed")}</td><td class="mono col-sm text-muted">build-box-02</td><td class="num tabular text-muted">0:04:12</td></tr>'
                  '</tbody></table></div><p class="text-caption mt-3">run-0398 lost its lease when build-box-02 stopped heartbeating; run-0412 resumed from its last checkpoint.</p>')
    else:
        detail = log_html
    main = f"""{head}
<div class="pad section"><div class="split split--pipeline">
{stages}
<section aria-label="Stage {n} detail" class="truncate" style="overflow: visible; white-space: normal">
  {banner}
  <div class="stage-title"><h2><span class="n">{n}</span> {sname}</h2>{status(title_status)}</div>
  {meta}
  {card}
  {_subtabs(subtab)}
  {detail}
</section>
</div></div>"""
    body = shell("projects", main, role, conn)
    if state == "default":
        body += note(INCOMING_NOTE, "top: 30rem; right: 1rem;")
    d = {"default": "Ledgerline running stage 10 with the live log.", "empty": "Just submitted: all stages pending, waiting for a worker.",
         "blocked": "Parcel Post: stage 5 failed after 3 retries; Retry stage.", "budget-reached": "Kiln Booking paused at 100% of budget.",
         "paused": "Paused by the Owner at a checkpoint.", "cancelled": "Harbor CRM cancelled; PR labelled hewn:cancelled.",
         "complete": "Field Notes complete; add a feature.", "past-stage": "Tidewater: a finished earlier stage selected.",
         "feature-direction": "Northwind Ops: completed feature direction with skipped stages.", "runs": "Runs tab: a lease lost and resumed.",
         "viewer": "Viewer: no pause, cancel or retry.", "offline": "Connection lost banner over the pipeline.",
         "queued-direction": "A second direction waits behind the active one (L2-004 AC4).",
         "log-scrolled": "Scrolled up in the live log: “12 new lines — Jump to latest” (L2-033 AC2)."}[state]
    return body, d


# ===========================================================================
# Backlog
# ===========================================================================
def backlog(state):
    head = project_header("backlog")
    if state == "loading":
        rows = "".join(f'<li class="row" aria-hidden="true">{sk("skeleton--w50")}{sk("skeleton--w66")}{sk("skeleton--w33")}</li>' for _ in range(8))
        main = f'{head}<div class="pad section">{sk("skeleton--title")}<div class="rows rows--backlog mt-6">{loading_region("Loading the backlog", "<ul>" + rows + "</ul>")}</div></div>'
        return shell("projects", main), "Row skeletons for the backlog."
    if state == "error":
        main = f'{head}<div class="pad">{error_block("The backlog couldn’t load", "docs/estimates/ couldn’t be read from hewn-builds/ledgerline (GitHub returned 502).", back=("Open the pipeline", page_link("project-pipeline")))}</div>'
        return shell("projects", main), "Backlog failed to load."
    if state == "empty":
        main = f'{head}<div class="pad section">{empty_block("inbox", "No backlog yet", "The backlog is produced by stage 9, Estimates. Increments appear here, in journey order, as soon as estimates finish.", btn("Open the pipeline", "", "", href=page_link("project-pipeline")))}</div>'
        return shell("projects", main), "Before stage 9: explains when the backlog appears."
    blocked = state == "blocked-increment"
    rows = ""
    for n, title, journey, l2, st, est, pr in INCREMENTS:
        if blocked and n == 7:
            st = "Blocked"
        cur = st in ("In progress", "Blocked")
        pr_html = (f'<a class="quiet-link mono" href="https://github.com/hewn-builds/ledgerline/pull/{pr}">{icon("git-merge", "icon--xs s-icon--ok")} #{pr}</a>' if pr else
                   (f'<span class="quiet-link mono">{icon("git-pr", "icon--xs")} soon</span>' if st == "In progress" else '<span class="text-subtle lg-only">—</span>'))
        rows += f"""<li class="row{" row--current" if cur else ""}">
  <span class="text-mono-xs text-subtle tabular">{n}</span>
  <a class="truncate" style="color: inherit; text-decoration: none;{" font-weight: var(--font-weight-medium)" if cur else ""}" href="{page_link("increment", "blocked" if blocked and n == 7 else "default")}">{title}</a>
  <span class="lg-hide">{status(st)}</span>
  <span class="col2 text-xs text-muted">Journey {journey}</span>
  <span class="col2 truncate text-mono-xs text-subtle">{l2}</span>
  <span class="lg-only tabular text-muted row__end">{est} d</span>
  <span class="lg-only">{status(st)}</span>
  <span class="col2 text-xs row__end">{pr_html}</span>
</li>"""
    defs = "".join(
        f'<li class="file" style="grid-template-columns: minmax(0,1fr)"><span class="cluster">{status("Deferred", "")}<span class="text-sm">{t}</span><span class="text-mono-xs text-subtle">{l2}</span><span class="text-xs text-muted tabular">{e} d</span></span><span class="text-sm text-muted">{r}</span></li>'
        for t, l2, e, r in DEFERRED)
    blocked_banner = ""
    if blocked:
        blocked_banner = ('<div class="callout callout--danger mt-6" role="status">' + icon("x-circle", "icon--lg") +
                          '<div><p class="callout__title">Increment 7 is blocked after 10 iterations</p><p class="callout__body">1 acceptance test still fails (matches-across-midnight). '
                          'Hewn moved on to increment 8, which doesn’t depend on it.</p></div></div>')
    main = f"""{head}<div class="pad section">
<div class="cluster cluster--between" style="align-items: flex-end"><div><h2 class="section__title">Active backlog</h2>
<p class="section__desc">Ordered by journey; nothing comes before an increment it depends on.</p></div>
<p class="text-sm text-muted tabular"><span style="color: var(--color-fg-default)">6 of 12</span> merged · <span style="color: var(--color-fg-default)">12.5 of 24</span> ideal days</p></div>
{blocked_banner}
<div class="rows rows--backlog mt-6"><div class="rows__head" aria-hidden="true"><span>#</span><span>Increment</span><span>Journey</span><span>Requirements</span><span class="row__end">Estimate</span><span>Status</span><span class="row__end">PR</span></div>
<ol>{rows}</ol></div>
<section class="mt-12" aria-labelledby="deferred-title"><h2 class="section__title" id="deferred-title">Deferred</h2>
<p class="section__desc">Descoped during estimates. Each L2 carries <code>Status: Deferred</code> with this reason.</p>
<ul class="files mt-4">{defs}</ul></section>
</div>"""
    d = {"default": "Twelve increments in journey order plus three deferred with reasons.", "blocked-increment": "Increment 7 blocked; the agent moved to increment 8."}[state]
    return shell("projects", main), d


# ===========================================================================
# Increment
# ===========================================================================
def _video():
    rows = [("Nov 30", "Harbour Coffee", "-$14.25", "Receipt #2214", True), ("Nov 30", "Translink", "-$3.15", "Receipt #2215", True),
            ("Dec 1", "AWS EMEA", "-$212.48", "Statement line 18", True), ("Dec 1", "Staples 0412", "-$58.90", "Suggest: Receipt #2219", False)]
    trs = "".join(f'<div class="video__tr{"" if ok else " video__tr--focus"}"><span>{d}</span><span class="truncate">{m}</span><span class="tabular" style="text-align:right">{a}</span><span class="truncate {"video__ok" if ok else "video__sug"}">{r}</span></div>' for d, m, a, r, ok in rows)
    return f"""<div class="video">
  <div class="video__frame" aria-hidden="true"><div class="video__side"><span></span><span></span><span></span><span></span></div>
    <div class="video__content"><div class="video__h">Visa ···4410 · November statement</div><div class="video__s">38 of 41 lines matched · 3 to review</div><div class="video__table">{trs}</div></div></div>
  <div class="video__caption"><span>A transaction posted at 11:58 pm still matches the November statement.</span></div>
  <div class="video__controls"><button class="video__btn" type="button" aria-label="Play">{icon("play")}</button><span class="tabular">1:22 / 2:14</span>
    <div class="video__track" role="slider" aria-label="Seek" aria-valuemin="0" aria-valuemax="134" aria-valuenow="82" aria-valuetext="1 minute 22 of 2 minutes 14" tabindex="0"><span></span></div>
    <button class="video__btn" type="button" aria-label="Captions on" aria-pressed="true">{icon("captions")}</button>
    <button class="video__btn sm-only" type="button" aria-label="Full screen">{icon("maximize")}</button></div>
</div>"""


def increment(state):
    crumbs = (f'<nav aria-label="Breadcrumb"><ol class="breadcrumb"><li><a href="{page_link("projects")}">Projects</a></li><li aria-hidden="true">{icon("chevron-right")}</li>'
              f'<li><a href="{page_link("project-pipeline")}">Ledgerline</a></li><li aria-hidden="true">{icon("chevron-right")}</li>'
              f'<li><a href="{page_link("backlog")}">Backlog</a></li><li aria-hidden="true">{icon("chevron-right")}</li><li aria-current="page">Increment 7</li></ol></nav>')
    if state == "loading":
        main = f'<div class="pad section">{crumbs}<h1 class="visually-hidden">Increment 7</h1><div class="stack mt-4" aria-hidden="true">{sk("skeleton--title", "width: 20rem")}{sk("skeleton--w50")}</div><div class="split split--aside mt-8">{loading_region("Loading increment 7", sk("skeleton--video"))}<div class="stack">{sk("skeleton--block")}{sk()}{sk()}{sk()}</div></div></div>'
        return shell("projects", main), "Video and checks skeletons."
    if state == "error":
        main = f'<div class="pad section">{crumbs}<h1 class="mt-2">Increment 7</h1>{error_block("This increment couldn’t load", "Pull request #28 and its checks couldn’t be fetched from GitHub (rate limit, resets in 2 min). Hewn keeps polling every 60 s.", back=("Back to backlog", page_link("backlog")))}</div>'
        return shell("projects", main), "GitHub fetch failed; retry and a way back."
    merged = state == "merged"
    implementing = state == "implementing"
    blocked = state == "blocked"
    vfail = state == "video-failed"
    early = state == "green-first"
    st = "Merged" if merged else ("Blocked" if blocked else "In progress")
    if implementing or blocked:
        msg = ("Blocked after 10 iterations; no video is recorded until every test is green." if blocked
               else "The walkthrough records once every test is green. Implementing, iteration 3 of 10.")
        video = f'<div class="video video--placeholder">{icon("video", "icon--xl")}<p class="max-measure">{msg}</p></div>'
    elif vfail:
        video = (f'<div class="video video--placeholder">{icon("alert-triangle", "icon--xl s-icon--warn")}<p style="color: var(--color-fg-default); font-weight: var(--font-weight-medium)">Video failed: browser crashed during capture</p>'
                 '<p class="max-measure">The capture failed, was retried once and failed again. The pull request went ahead with this noted under Notes.</p></div>')
    else:
        video = _video() + '<div class="cluster cluster--between mt-3 text-sm"><span class="text-muted">Captioned walkthrough · 1080p · 2:14</span><span class="text-mono-xs text-subtle">docs/videos/reconcile-card-statement/</span></div>'
    tl = [("Succeeded", "Failing tests committed" if not early else "Acceptance tests committed", "4 acceptance tests · traces to L2-018, L2-019", "14:03"),
          ("Failed", "Red recorded", "4 failing, 0 passing", "14:03") if not early else
          ("Skipped", "Tests passed before implementation", "4 of 4 passed on the test commit; flagged in the PR Notes", "14:03")]
    if blocked:
        tl += [("Blocked", "Blocked after 10 iterations", "1 of 4 failing: matches-across-midnight. Moved on to increment 8.", "15:48"),
               ("Pending", "Video", "Waits for green", ""), ("Pending", "Pull request", "Not opened", ""), ("Pending", "Squash-merge", "Not reached", "")]
    else:
        tl += [("Running" if implementing else "Succeeded", "Implementing · iteration 3 of 10" if implementing else "Green after 3 iterations",
                "Backend, frontend, increment tests and full e2e pass in the worker", "now" if implementing else "14:31"),
               ("Pending" if implementing else ("Failed" if vfail else "Succeeded"), "Video",
                "Records when every test is green" if implementing else ("Failed, retried once, failed again" if vfail else "2:14, captioned"), "" if implementing else "14:36"),
               ("Pending" if implementing else ("Succeeded" if merged else "Running"), "Pull request" if implementing else "Pull request #28",
                "Opens after the video step" if implementing else ("All required checks passed" if merged else "Waiting on required checks"), "" if implementing else "14:37"),
               ("Merged" if merged else "Pending", "Squash-merge", "Branch deleted · 62% → 68% complete" if merged else "Automatic when checks pass", "14:44" if merged else "")]
    timeline = "".join(f'<li class="timeline__item"><span class="timeline__icon">{status_icon(s, "icon--sm")}</span><span class="timeline__t">{t}<span class="visually-hidden"> ({s})</span></span>'
                       f'<span class="timeline__time tabular">{tm}</span><span class="timeline__d">{d}</span></li>' for s, t, d, tm in tl)
    if implementing or blocked:
        aside = f'<h2 style="font: var(--text-h3)">Pull request</h2><p class="text-sm text-muted mt-3">{"Not opened while the increment is blocked." if blocked else "Opens after the video step."}</p>'
        if blocked:
            aside += ('<h3 class="subhead mt-6">Failing test</h3><pre class="pre mt-2">matches-across-midnight\n  Expected: Matched (Visa ···4410, Nov)\n  Received: Unmatched\n  at e2e/reconcile-card-statement.spec.ts:88</pre>')
    else:
        checks = [("backend · dotnet test", "Succeeded", "412 passed · 1m 48s"), ("frontend · lint + unit", "Succeeded", "236 passed · 52s"),
                  ("e2e · behavior", "Succeeded" if merged else "Running", "152 passed · 4m 10s" if merged else "96 of 152 · 2m 41s"),
                  ("e2e · a11y (axe-core)", "Succeeded" if merged else "Pending", "0 violations" if merged else "queued"),
                  ("e2e · visual parity", "Succeeded" if merged else "Pending", "31 screens match" if merged else "queued")]
        ch = "".join(f'<li>{status_icon(s, "icon--sm")}<span class="visually-hidden">{s}:</span><span class="checks__name">{n}</span><span class="checks__d">{d}</span></li>' for n, s, d in checks)
        notes = ("Video failed: browser crashed during capture." if vfail else
                 "Tests passed before implementation: all 4 acceptance tests were green on the test commit." if early else "Red recorded before implementation.")
        kv = [("What", "Match card transactions to statement lines with a ±$0.50 tolerance and account-time-zone dates."),
              ("Design and decisions", "Posting dates use the account’s time zone (decision a41c9e2)."),
              ("API", "<code>POST /api/statements/{id}/match-suggestions</code> returns suggested receipt matches; <code>PUT /api/statement-lines/{id}/match</code> confirms one."),
              ("Tests", "<code>dotnet test backend/Ledgerline.sln</code> 412 passed · <code>npm run lint &amp;&amp; npm test</code> 236 passed · "
                        "<code>npx playwright test</code> 152 passed, 4 of them new acceptance tests."),
              ("Deferred", "Multi-currency (L2-031, L2-032)."),
              ("Notes", notes)]
        kvh = "".join(f"<div><dt>{k}</dt><dd>{v}</dd></div>" for k, v in kv)
        kvh += '<div><dt class="visually-hidden">Attribution</dt><dd class="text-caption">Built by Hewn · direction 7 Nov · run-0412</dd></div>'
        aside = f"""<h2 style="font: var(--text-h3)">Pull request</h2>
<a class="card card--link mt-3" href="https://github.com/hewn-builds/ledgerline/pull/28">{icon("git-merge" if merged else "git-pr", "icon--lg " + ("s-icon--ok" if merged else "s-icon--run"))}
<span class="truncate" style="white-space: normal"><span class="text-sm" style="display:block; font-weight: var(--font-weight-medium); color: var(--color-fg-default)">Reconcile a card statement (journey 4, L2-018, L2-019)</span>
<span class="text-mono-xs text-subtle" style="display:block; margin-top: var(--space-1)">#28 · {"squash-merged" if merged else "open"} · +612 −48 · 14 files</span></span></a>
<h3 class="subhead mt-6">Required checks</h3><ul class="checks mt-2" aria-live="polite">{ch}</ul>
<h3 class="subhead mt-6">Body</h3><dl class="kv mt-2">{kvh}</dl>"""
    main = f"""<div class="pad section" style="padding-bottom: var(--space-12)">{crumbs}
<div class="cluster cluster--lg mt-2"><h1>Reconcile a card statement</h1>{status(st)}</div>
<p class="phead__meta"><span>Journey 4 · Close the month</span><span class="text-mono-xs">L2-018, L2-019</span><span>Estimate 2.5 ideal days</span>
<span class="text-mono-xs cluster" style="gap: var(--space-1)">{icon("git-branch", "icon--xs")} feature/reconcile-card-statement</span></p>
<div class="split split--aside mt-8">
<section aria-label="Increment video" class="truncate" style="white-space: normal; overflow: visible">{video}
<h2 class="mt-10" style="font: var(--text-h3)">Test first</h2><ol class="timeline">{timeline}</ol></section>
<aside class="rail" aria-label="Pull request">{aside}</aside>
</div></div>"""
    d = {"default": "Video, test-first timeline and PR #28 waiting on checks.", "implementing": "Still implementing; video and PR not yet.",
         "merged": "All checks passed; squash-merged.", "video-failed": "Video capture failed; PR went ahead with a note.",
         "blocked": "Blocked after 10 iterations with the failing test.",
         "green-first": "The new tests passed before any code: flagged in the PR Notes (L2-021 AC3)."}[state]
    return shell("projects", main), d


# ===========================================================================
# Designs (Designs frame + MockPreview)
# ===========================================================================
SCREENS = [("Statements", ["Default", "Loading", "Empty", "Error"]), ("Reconcile statement", ["Default", "Review", "Loading", "Error"]),
           ("Receipts", ["Default", "Empty", "Upload error"]), ("Close period", ["Default", "Awaiting review", "Locked"]),
           ("Sign in", ["Default", "Error"]), ("Settings", ["Default"])]


MP_OS = "https://www.magicpatterns.com/os/c9upyFcFm8ZTUr3n843kZW"


def designs(state):
    head = project_header("designs")
    if state == "loading":
        main = f'{head}<div class="pad section"><div class="split split--nav">{loading_region("Loading designs", "<div class=" + chr(34) + "stack" + chr(34) + ">" + sk() * 8 + "</div>")}<div class="stack">{sk("skeleton--w50")}{sk("skeleton--block", "height: 24rem")}</div></div></div>'
        return shell("projects", main), "Screen list and preview skeletons."
    if state == "error":
        main = f'{head}<div class="pad">{error_block("Designs couldn’t load", "docs/mocks/manifest.json couldn’t be read at 5a1fe37. The exported mocks are still in the repository.", back=("Open in Magic Patterns", "https://www.magicpatterns.com/os/c9upyFcFm8ZTUr3n843kZW"))}</div>'
        return shell("projects", main), "Manifest unreadable; link to Magic Patterns."
    if state == "empty":
        main = f'{head}<div class="pad section">{empty_block("layout-template", "No designs yet", "Stage 2 designs every screen and state in Magic Patterns and exports them to docs/mocks/. Ledgerline hasn’t reached it yet.", btn("Open the pipeline", "", "", href=page_link("project-pipeline", "empty")))}</div>'
        return shell("projects", main), "Before stage 2."
    xs = state == "xs-dark"
    nav = ""
    for sname, states in SCREENS:
        links = "".join(
            f'<li class="state-item"><a class="state-link" href="#preview"{" aria-current=" + chr(34) + "true" + chr(34) if (sname == "Reconcile statement" and s == "Review") else ""}>'
            f'<span class="state-thumb" aria-hidden="true"><span></span><span></span><span></span></span>{s}</a>'
            f'<a class="state-mp" href="{MP_OS}" aria-label="Open {sname} · {s} in Magic Patterns" title="Open in Magic Patterns">{icon("external", "icon--xs")}</a></li>'
            for s in states)
        nav += f'<li><div class="text-sm" style="font-weight: var(--font-weight-medium)">{sname}</div><ul class="state-list">{links}</ul></li>'
    widths = "".join(f'<a class="segmented__opt" role="radio" href="{page_link("designs", "xs-dark" if k == "XS" else "default")}" aria-checked="{"true" if (k == "XS") == xs and k in ("XS", "L") else "false"}" title="{w} px">{k}</a>'
                     for k, w in [("XS", 375), ("S", 576), ("M", 768), ("L", 992), ("XL", 1200)])
    themes = "".join(f'<a class="segmented__opt" role="radio" href="{page_link("designs", "xs-dark" if k == "Dark" else "default")}" aria-checked="{"true" if (k == "Dark") == xs else "false"}" aria-label="{k}">{icon(ic, "icon--sm")}</a>'
                     for k, ic in [("Light", "sun"), ("Dark", "moon")])
    rows = "".join(f'<div class="mini-app__row{" mini-app__row--focus" if i == 3 else ""}"><span class="mini-app__cell"></span><span class="mini-app__cell"></span><span class="mini-app__cell"></span><span class="mini-app__cell {"mini-app__cell--accent" if i == 3 else "mini-app__cell--ok"}"></span></div>' for i in range(6))
    frame_cls = "preview__frame" + (" preview__frame--dark preview__frame--narrow" if xs else "")
    w = "23.4375rem" if xs else "62rem"
    main = f"""{head}<div class="pad section"><div class="split split--nav">
<nav aria-label="Screens and states" class="truncate" style="white-space: normal"><p class="text-caption">{len(SCREENS)} screens · {sum(len(x) for _n, x in SCREENS)} states · exported to docs/mocks/</p><ul class="stack mt-3">{nav}</ul></nav>
<section aria-label="Preview" class="truncate" style="white-space: normal; overflow: visible" id="preview">
<div class="cluster"><h2 class="section__title" style="margin-right: auto">Reconcile statement <span class="text-muted" style="font-weight: var(--font-weight-regular)">· Review</span></h2>
<div class="segmented" role="radiogroup" aria-label="Width">{widths}</div><div class="segmented" role="radiogroup" aria-label="Theme">{themes}</div>
{btn("Open in Magic Patterns", "outline-accent", "sm", "external", href="https://www.magicpatterns.com/os/c9upyFcFm8ZTUr3n843kZW", icon_after=True)}</div>
<div class="preview"><div class="{frame_cls}" style="--w: {w}" role="img" aria-label="Exported mock: Reconcile statement, Review state, {"375 px, dark" if xs else "992 px, light"}">
<div class="mini-app"><div class="mini-app__side"><div class="mini-app__bar mini-app__bar--title"></div><div class="mini-app__bar"></div><div class="mini-app__bar mini-app__bar--accent"></div><div class="mini-app__bar"></div></div>
<div class="mini-app__main"><div class="mini-app__bar mini-app__bar--title"></div><div class="mini-app__bar" style="width: 35%"></div>{rows}</div></div></div></div>
<p class="text-caption cluster mt-3">{icon("shield-check", "icon--xs")} Served from mocks.hewn.dev in a sandboxed frame · {"375" if xs else "992"} px · <span class="mono">docs/mocks/reconcile-statement/review.html</span></p>
</section></div></div>"""
    body = shell("projects", main)
    body += note("The real preview is an iframe on a separate origin with sandbox=&quot;allow-scripts&quot; and no allow-same-origin, so a mock can’t read Mission Control’s cookies or storage (L2-011).", "top: 18rem; right: 1rem;")
    return body, {"default": "Screen and state list beside a sandboxed preview at L, light.", "xs-dark": "Preview switched to XS (375 px) and dark."}[state]


DS_SECTIONS = [("Foundations", ["Colour", "Typography", "Spacing", "Radius", "Elevation", "Motion"]),
               ("Components", ["Button", "Input", "Status badge", "Table", "Receipt card", "Dialog", "Toast"])]


def design_system(state):
    head = project_header("design-system")
    if state == "loading":
        main = f'{head}<div class="pad section"><div class="split split--nav">{loading_region("Loading the design system", "<div class=" + chr(34) + "stack" + chr(34) + ">" + sk() * 8 + "</div>")}<div class="stack">{sk("skeleton--w50")}{sk("skeleton--block", "height: 24rem")}</div></div></div>'
        return shell("projects", main), "Page list and preview skeletons."
    if state == "error":
        main = f'{head}<div class="pad">{error_block("The design system couldn’t load", "docs/design-system/ couldn’t be read at 8e2290a (GitHub returned 502). The files are still in the repository.", back=("Open the pipeline", page_link("project-pipeline")))}</div>'
        return shell("projects", main), "docs/design-system/ unreadable; retry."
    if state == "empty":
        main = f'{head}<div class="pad section">{empty_block("layout-grid", "No design system yet", "Stage 3 extracts tokens and one page per component from the exported mocks into docs/design-system/. It appears here once that stage succeeds.", btn("Open the pipeline", "", "", href=page_link("project-pipeline", "empty")))}</div>'
        return shell("projects", main), "Before stage 3."
    nav = ""
    for sec, items in DS_SECTIONS:
        links = "".join(f'<li><a class="state-link" href="#preview"{" aria-current=" + chr(34) + "true" + chr(34) if i == "Colour" else ""}>{i}</a></li>' for i in items)
        nav += f'<li><div class="text-sm" style="font-weight: var(--font-weight-medium)">{sec}</div><ul class="state-list">{links}</ul></li>'
    widths = "".join(f'<a class="segmented__opt" role="radio" href="#preview" aria-checked="{"true" if k == "L" else "false"}" title="{w} px">{k}</a>'
                     for k, w in [("XS", 375), ("S", 576), ("M", 768), ("L", 992), ("XL", 1200)])
    themes = "".join(f'<a class="segmented__opt" role="radio" href="#preview" aria-checked="{"true" if k == "Light" else "false"}" aria-label="{k}">{icon(ic, "icon--sm")}</a>'
                     for k, ic in [("Light", "sun"), ("Dark", "moon")])
    rows = "".join(f'<div class="mini-app__row"><span class="mini-app__cell"></span><span class="mini-app__cell"></span><span class="mini-app__cell"></span><span class="mini-app__cell {"mini-app__cell--accent" if i % 2 else "mini-app__cell--ok"}"></span></div>' for i in range(6))
    main = f"""{head}<div class="pad section"><div class="split split--nav">
<nav aria-label="Design system pages" class="truncate" style="white-space: normal"><p class="text-caption">6 foundations · 7 components · docs/design-system/ at 8e2290a</p><ul class="stack mt-3">{nav}</ul></nav>
<section aria-label="Preview" class="truncate" style="white-space: normal; overflow: visible" id="preview">
<div class="cluster"><h2 class="section__title" style="margin-right: auto">Colour <span class="text-muted" style="font-weight: var(--font-weight-regular)">· 38 tokens, light and dark</span></h2>
<div class="segmented" role="radiogroup" aria-label="Width">{widths}</div><div class="segmented" role="radiogroup" aria-label="Theme">{themes}</div></div>
<div class="preview"><div class="preview__frame" style="--w: 62rem" role="img" aria-label="Design system page: Colour, 992 px, light">
<div class="mini-app"><div class="mini-app__main"><div class="mini-app__bar mini-app__bar--title"></div><div class="mini-app__bar" style="width: 35%"></div>{rows}</div></div></div></div>
<p class="text-caption cluster mt-3">{icon("shield-check", "icon--xs")} Served from mocks.hewn.dev in the same sandboxed frame as Designs · 992 px · <span class="mono">docs/design-system/foundations/colour.html</span></p>
</section></div></div>"""
    body = shell("projects", main)
    body += note("Same sandboxed, separate-origin preview as Designs (L2-012 AC4, L2-011 AC2).", "top: 18rem; right: 1rem;")
    return body, "Token and component pages browsed in the sandboxed preview."


# ===========================================================================
# Decisions
# ===========================================================================
def decisions(state):
    head = project_header("decisions")
    filt = {"filtered": "Stack", "no-results": "Design system"}.get(state, "All stages")
    opts = "".join(f'<option{" selected" if o == filt else ""}>{o}</option>' for o in ["All stages", "Idea", "Design system", "Stack", "Estimates", "Increments"])
    intro = (f'<div class="cluster cluster--between" style="align-items:flex-end"><div><h2 class="section__title">Decisions</h2><p class="section__desc">Every question a skill would have asked you, answered by the agent from the '
             f'direction and the artifacts. Recorded in <code>docs/decisions.md</code>.</p></div>'
             f'<label class="inline-label">Stage <select class="select select--auto input--sm">{opts}</select></label></div>')
    if state == "loading":
        inner = loading_region("Loading decisions", "".join(f'<div class="decision" aria-hidden="true"><span class="stack stack--sm">{sk("skeleton--w75")}{sk("skeleton--w50")}</span><span class="stack stack--sm">{sk()}{sk("skeleton--w75")}{sk("skeleton--w66")}</span></div>' for _ in range(4)))
    elif state == "error":
        inner = error_block("Decisions couldn’t load", "docs/decisions.md couldn’t be read from hewn-builds/ledgerline. Decisions are still being recorded in the repository.")
    elif state == "empty":
        inner = empty_block("git-commit", "No decisions yet", "When a skill would ask you something, the agent answers it and records the answer here with its reasoning. None so far.")
    else:
        items = [d for d in DECISIONS if filt == "All stages" or d[1] == filt]
        if not items:
            inner = (f'<div class="empty empty--tight">{icon("search")}<div><h2 class="empty__title">No decisions in Design system</h2><p class="empty__text">The agent didn’t need to decide anything during that stage.</p></div>'
                     f'<a class="btn" href="{page_link("decisions")}">Show all stages</a></div>')
        else:
            inner = '<ol class="mt-6">' + "".join(
                f'<li class="decision"><div class="decision__when"><span class="text-muted">{dt}</span><span class="text-subtle">{stg}</span></div><div class="truncate" style="white-space: normal">'
                f'<p class="decision__q">{q}</p><p class="decision__a">{a}</p><p class="decision__why">{why}</p><div class="decision__links">'
                f'<a class="quiet-link mono" href="https://github.com/hewn-builds/ledgerline/commit/{sha}">{icon("git-commit", "icon--xs")} {sha}</a>'
                f'{"<a class=" + chr(34) + "quiet-link" + chr(34) + " href=" + chr(34) + "https://github.com/hewn-builds/ledgerline/blob/main/docs/adr/0001-stack.md" + chr(34) + ">" + icon("file-text", "icon--xs") + " ADR 0001</a>" if stg == "Stack" else ""}</div></div></li>'
                for dt, stg, q, a, why, sha in items) + "</ol>"
    main = f'{head}<div class="pad section"><div class="narrow">{intro}{inner}</div></div>'
    d = {"default": "Five decisions, newest first, with commits.", "loading": "Decision skeletons.", "error": "docs/decisions.md unreadable.",
         "empty": "No decisions recorded yet.", "filtered": "Filtered to the Stack stage.", "no-results": "A stage filter with no decisions."}[state]
    return shell("projects", main), d


# ===========================================================================
# Artifacts
# ===========================================================================
GROUPS = [(10, "Increments", [("docs/videos/split-a-transaction/", "7be0d13", "14 min ago", True), ("docs/estimates/README.md", "7be0d13", "14 min ago", False)]),
          (9, "Estimates", [("docs/estimates/README.md", "19f4a8c", "8 Nov, 16:44", False), ("docs/estimates/reconciliation.md", "19f4a8c", "8 Nov, 16:44", False), ("docs/estimates/ledger-export.md", "19f4a8c", "8 Nov, 16:44", False)]),
          (8, "User journeys", [("docs/journeys.md", "2d77e01", "8 Nov, 16:21", False)]),
          (7, "Detailed designs", [("docs/detailed-designs/reconciliation/", "0b3c4f9", "8 Nov, 16:02", True), ("docs/detailed-designs/receipts/", "0b3c4f9", "8 Nov, 16:02", True)]),
          (5, "Requirements", [("docs/specs/L1.md", "f61a2d8", "8 Nov, 11:30", False), ("docs/specs/L2.md", "f61a2d8", "8 Nov, 11:30", False)]),
          (4, "Stack", [("docs/adr/0001-stack.md", "c03e57b", "8 Nov, 09:12", False)]),
          (3, "Design system", [("docs/design-system/", "8e2290a", "8 Nov, 08:51", True)]),
          (2, "Designs", [("docs/mocks/", "5a1fe37", "8 Nov, 08:36", True), ("docs/mocks/manifest.json", "5a1fe37", "8 Nov, 08:36", False)]),
          (1, "Idea", [("docs/brief.md", "e8812fa", "7 Nov, 17:58", False)]),
          (0, "Bootstrap", [(".hewn/skills.lock", "91c0b4e", "7 Nov, 17:51", False)])]


def artifacts(state):
    head = project_header("artifacts")
    intro = '<h2 class="section__title">Artifacts</h2><p class="section__desc">Each version is the commit that holds it in <code>hewn-builds/ledgerline</code>.</p>'
    if state == "loading":
        inner = loading_region("Loading artifacts", "".join(f'<div class="stack stack--sm mt-6" aria-hidden="true">{sk("skeleton--w25")}{sk()}{sk()}</div>' for _ in range(4)))
    elif state == "error":
        inner = error_block("Artifacts couldn’t load", "GitHub returned 502 while listing commits. Try again in a moment.")
    elif state == "empty":
        inner = empty_block("folder", "No artifacts yet", "Every stage writes its output to the repository and it appears here with the commit that holds it. Stage 0 starts as soon as a worker leases the direction.")
    else:
        inner = ""
        for n, sname, files in GROUPS:
            items = "".join(
                f'<li class="file"><span class="file__path">{icon("folder" if d else "file-text", "icon--sm")}<span class="truncate">{p}</span></span>'
                f'<span class="file__sha">{sha}</span><span class="file__when">{when}</span>'
                f'<a class="file__open" href="https://github.com/hewn-builds/ledgerline/tree/{sha}/{p}" aria-label="Open {p} on GitHub at {sha}">{icon("external", "icon--sm")}</a></li>'
                for p, sha, when, d in files)
            inner += (f'<section class="mt-8" aria-labelledby="st-{n}"><h3 class="group-title" id="st-{n}">{status_icon("Running" if n == 10 else "Succeeded", "icon--sm")}'
                      f'<span class="n">{n}</span><strong>{sname}</strong></h3><ul class="files mt-2">{items}</ul></section>')
    main = f'{head}<div class="pad section">{intro}{inner}</div>'
    d = {"default": "Artifacts grouped by stage with commit and GitHub link.", "loading": "Artifact list skeletons.", "error": "GitHub listing failed.", "empty": "Nothing written yet."}[state]
    return shell("projects", main), d


# ===========================================================================
# Traceability
# ===========================================================================
REQS = [("L2-013", "Match a receipt by photo", "L1-004 Receipt capture", ["Receipts · Default", "Receipts · Upload error"], ["3 · Review unmatched"], ["e2e/match-receipt-photo.spec.ts"], [(25, "Match a receipt by photo", True)], None),
        ("L2-018", "Match card lines to transactions within a tolerance", "L1-006 Statement reconciliation", ["Reconcile statement · Default", "Reconcile statement · Review"], ["4 · Close the month"], ["e2e/reconcile-card-statement.spec.ts", "backend/tests/StatementMatcherTests.cs"], [(28, "Reconcile a card statement", False)], None),
        ("L2-019", "Use the account’s time zone for posting dates", "L1-006 Statement reconciliation", ["Reconcile statement · Default"], ["4 · Close the month"], ["e2e/reconcile-card-statement.spec.ts"], [(28, "Reconcile a card statement", False)], None),
        ("L2-020", "Close a period after review", "L1-007 Period close", ["Close period · Default", "Close period · Awaiting review"], ["4 · Close the month"], [], [], None),
        ("L2-027", "Invite a reviewer by email", "L1-009 Team", ["Settings · Default"], ["6 · Bring in a reviewer"], [], [], None),
        ("L2-031", "Reconcile in a second currency", "L1-006 Statement reconciliation", [], [], [], [], "Estimated 7 days; could not be split below 3.")]


def traceability(state):
    head = project_header("trace")
    sel = {"no-test": "L2-020", "deferred": "L2-031"}.get(state, "L2-018")
    query = ' value="L2-099"' if state == "no-results" else ""
    search = f'<label class="prefix prefix--search" style="display:block"><span class="visually-hidden">Find an L2</span>{icon("search", "icon--sm")}<input class="input input--sm" type="search" placeholder="Find an L2"{query}></label>'
    if state == "loading":
        main = f'{head}<div class="pad section"><div class="split split--trace">{loading_region("Loading requirements", "<div class=" + chr(34) + "stack" + chr(34) + ">" + sk() * 6 + "</div>")}<div class="stack">{sk("skeleton--w25")}{sk("skeleton--title", "width: 24rem")}{sk("skeleton--block", "height: 10rem")}</div></div></div>'
        return shell("projects", main), "Requirement list and trace skeletons."
    if state == "error":
        main = f'{head}<div class="pad">{error_block("Traceability couldn’t load", "docs/specs/L2.md couldn’t be parsed at f61a2d8 (unexpected heading on line 412). The repository is unchanged.")}</div>'
        return shell("projects", main), "Specs unreadable."
    if state == "empty":
        main = f'{head}<div class="pad section">{empty_block("route", "No requirements yet", "Traceability links each L2 to its designs, journeys, acceptance tests and pull requests. It fills in once stage 5 writes docs/specs/.", btn("Open the pipeline", "", "", href=page_link("project-pipeline", "empty")))}</div>'
        return shell("projects", main), "Before stage 5."
    if state == "no-results":
        listing = '<p class="text-sm text-muted mt-3" role="status">No requirement matches “L2-099”. Ledgerline has L2-001 to L2-035.</p>'
    else:
        state_for = {"L2-020": "no-test", "L2-031": "deferred"}
        listing = '<ul class="req-list">' + "".join(
            f'<li><a class="req-link" href="{page_link("traceability", state_for.get(rid, "default"))}"{" aria-current=" + chr(34) + "true" + chr(34) if rid == sel else ""}>'
            f'<span class="req-link__id">{rid}</span><span class="req-link__title">{t}</span>'
            f'{icon("alert-circle", "icon--xs s-icon--warn", "No acceptance test") if (not tests and not dfr) else ""}'
            f'{"<span class=" + chr(34) + "req-link__flag" + chr(34) + ">Deferred</span>" if dfr else ""}</a></li>'
            for rid, t, _l1, _d, _j, tests, _p, dfr in REQS) + "</ul>"
    r = next(x for x in REQS if x[0] == sel)
    rid, title, l1, des, jrn, tests, prs, dfr = r
    flag = ""
    if not tests and not dfr:
        flag = f'<p class="pill pill--warn mt-4">{icon("alert-circle", "icon--sm")} No acceptance test</p>'
    if dfr:
        flag = f'<p class="text-sm text-muted mt-4"><strong style="color: var(--color-fg-default)">Deferred.</strong> {dfr}</p>'

    def col(ic, name, items, empty, mono=False):
        lis = "".join(f'<li class="{"text-mono-xs" if mono else ""}">{i}</li>' for i in items)
        body = f'<ul class="trace__items">{lis}</ul>' if items else f'<p class="trace__empty">{empty}</p>'
        return f'<li class="trace__col"><h3 class="trace__head">{icon(ic, "icon--sm")}<span>{name}</span><span>{len(items)}</span></h3>{body}</li>'
    pr_items = [f'<span class="cluster" style="gap: var(--space-1-5); display:inline-flex">{icon("git-merge" if m else "git-pr", "icon--xs " + ("s-icon--ok" if m else "s-icon--run"))}<span class="text-mono-xs text-muted">#{n}</span></span> {t}' for n, t, m in prs]
    grid = ('<ol class="trace">' + col("layout-template", "Designs", des, "No design covers it") + col("route", "Journeys", [f"Journey {j}" for j in jrn], "In no journey") +
            col("file-code", "Acceptance tests", tests, "Not needed while deferred" if dfr else "None yet", True) + col("git-pr", "Pull requests", pr_items, "None yet") + "</ol>")
    detail = (f'<section aria-label="Trace for {rid}" class="truncate" style="white-space: normal; overflow: visible"><p class="text-mono-xs text-accent" style="font-size: var(--font-size-sm)">{rid}</p>'
              f'<h2 class="mt-1" style="font: var(--text-h1); font-size: var(--font-size-xl)">{title}</h2><p class="text-sm text-muted mt-1">Traces to {l1}</p>{flag}{grid}</section>')
    main = f'{head}<div class="pad section"><div class="split split--trace"><nav aria-label="Requirements" class="truncate" style="white-space: normal">{search}{listing}</nav>{detail}</div></div>'
    d = {"default": "L2-018 traced to designs, journeys, tests and PR #28.", "no-test": "L2-020 flagged: no acceptance test yet.",
         "deferred": "L2-031 deferred with its reason.", "no-results": "Search for an L2 that doesn’t exist."}[state]
    return shell("projects", main), d


# ===========================================================================
# Workers
# ===========================================================================
def workers(state):
    role = "viewer" if state == "viewer" else "owner"
    owner = role == "owner"
    stopped = state == "stopped"
    action = btn("New worker token", "primary", "sm", "key", href=dialog_link("worker-token")) if owner else ""
    head = page_header("Workers", "One container image, local or cloud. At most one worker leases a project at a time.", action)
    cols = '<span>Host</span><span>Location</span><span>Version</span><span>Status</span><span>Working on</span><span class="row__end">Heartbeat</span><span class="row__end">Connected</span>' + ('<span class="visually-hidden">Actions</span>' if owner else "")
    rows_cls = "rows rows--workers" if owner else "rows rows--workers-viewer"
    if state == "loading":
        skel = "".join(f'<li class="row" aria-hidden="true"><span class="stack stack--sm">{sk("skeleton--w50")}{sk("skeleton--w25 skeleton--sm")}</span>{sk("skeleton--w66")}</li>' for _ in range(4))
        inner = loading_region("Loading workers", f'<div class="{rows_cls}"><div class="rows__head" aria-hidden="true">{cols}</div><ul>{skel}</ul></div>')
    elif state == "error":
        inner = error_block("Workers couldn’t load", "The worker registry didn’t answer (timeout after 10 s). Connected workers keep their leases and heartbeats.")
    elif state == "empty":
        inner = empty_block("server", "No workers yet", "A worker runs the agents. Create a token, then start the container on your machine or in the cloud; it needs no inbound ports.",
                            btn("New worker token", "primary", "", "key", href=dialog_link("worker-token")) if owner else "")
    else:
        rows = ""
        for wid, host, loc, ver, st, proj, hb, since in WORKERS:
            if stopped and st == "Leased":
                st, proj_html = "Idle", '<span class="text-subtle">Holding at checkpoint</span>'
            elif proj:
                proj_html = f'<a style="color: inherit" href="{page_link("project-pipeline", "default" if proj == "Ledgerline" else "past-stage")}">{proj}</a>'
            else:
                proj_html = f'<span class="text-subtle">{"Lease released" if st == "Offline" else "Waiting for work"}</span>'
            revoke = f'<span class="row__actions">{btn("Revoke", "ghost", "sm", href=dialog_link("revoke-worker"))}</span>' if owner else ""
            rows += f"""<li class="row">
  <span class="truncate"><span class="mono truncate" style="display:block; font-size: 0.8125rem">{host}</span><span class="text-mono-xs text-subtle">{wid}</span></span>
  <span class="lg-hide">{status(st)}</span>
  <span class="cluster text-muted" style="gap: var(--space-1-5)">{icon("laptop" if loc == "Local" else "cloud", "icon--sm")}{loc}<span class="text-mono-xs text-subtle lg-hide">· {ver}</span></span>
  <span class="lg-only text-mono-xs text-muted">{ver}</span>
  <span class="lg-only">{status(st)}</span>
  <span class="row__span truncate">{proj_html}</span>
  <span class="tabular {"text-danger" if st == "Offline" else "text-muted"} lg-row-end">{hb}</span>
  <span class="lg-only tabular text-subtle row__end">{since}</span>
  {revoke}
</li>"""
        inner = (f'<div class="{rows_cls}"><div class="rows__head" aria-hidden="true">{cols}</div><ul>{rows}</ul></div>'
                 '<p class="text-caption mt-4">A worker that misses heartbeats for 60 seconds loses its lease; the run resumes elsewhere from its last checkpoint.</p>')
    main = f'{head}<div class="pad" style="padding-bottom: var(--space-10)">{inner}</div>'
    d = {"default": "Four workers: two leased, one idle, one offline.", "loading": "Worker row skeletons.", "error": "Registry timeout.",
         "empty": "No workers registered; create a token.", "viewer": "Viewer: no token or revoke.", "stopped": "All workers stopped; leases held."}[state]
    return shell("workers", main, role, stopped=stopped), d


# ===========================================================================
# Audit
# ===========================================================================
def audit(state):
    if state == "forbidden":
        main = page_header("Audit", "Only Owners can read the audit log.") + f'<div class="pad">{empty_block("lock", "You don’t have access", "The audit log records who did what and from where, so only Owners can read it. Ask an Owner if you need an entry.", btn("Back to dashboard", "", "", href=page_link("dashboard")))}</div>'
        return shell("audit", main, "viewer"), "Viewer: 403 with a way back."
    act = "Stop all workers" if state == "no-results" else "All actions"
    proj = "Ledgerline" if state == "no-results" else "All projects"
    p_opts = "".join(f'<option{" selected" if o == proj else ""}>{o}</option>' for o in ["All projects", "Ledgerline", "Tidewater", "Northwind Ops", "Harbor CRM"])
    a_opts = "".join(f'<option{" selected" if o == act else ""}>{o}</option>' for o in ["All actions", "Sign in", "Direction submitted", "Pause", "Resume", "Cancel", "Merge", "Token created", "Token revoked", "Stop all workers", "Start workers"])
    filters = (f'<label class="inline-label"><span class="visually-hidden">Project</span><select class="select select--auto input--sm">{p_opts}</select></label>'
               f'<label class="inline-label"><span class="visually-hidden">Action</span><select class="select select--auto input--sm">{a_opts}</select></label>')
    head = page_header("Audit", "Who did what, when and from where. Entries can’t be edited.", filters)
    thead = '<thead><tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">Action</th><th scope="col" class="col-sm">Target</th><th scope="col" class="col-md num">IP</th></tr></thead>'
    if state == "loading":
        rows = "".join(f'<tr aria-hidden="true"><td>{sk()}</td><td>{sk()}</td><td>{sk()}</td><td class="col-sm">{sk()}</td><td class="col-md">{sk()}</td></tr>' for _ in range(8))
        inner = loading_region("Loading the audit log", f'<div class="table-wrap"><table class="table"><caption class="visually-hidden">Audit log</caption>{thead}<tbody>{rows}</tbody></table></div>')
    elif state == "error":
        inner = error_block("The audit log couldn’t load", "The audit store returned 500. Entries are still being written; nothing has been lost.")
    elif state == "empty":
        inner = empty_block("scroll-text", "No entries yet", "Sign-ins, directions, pauses, cancels, stops, tokens and merges are recorded here as they happen.")
    elif state == "no-results":
        inner = (f'<div class="empty empty--tight">{icon("search")}<div><h2 class="empty__title">No entries match these filters</h2><p class="empty__text">Nobody stopped all workers from Ledgerline. Stop all is recorded against All projects.</p></div>'
                 f'<a class="btn" href="{page_link("audit")}">Clear filters</a></div>')
    else:
        warn = ("Stop all workers", "Cancel", "Token revoked")
        rows = "".join(
            f'<tr><td class="mono text-muted tabular">{w}</td><td>{who}</td><td><span class="{"text-warn" if a in warn else ""}">{a}</span><span class="text-caption sm-hide" style="display:block">{t}</span></td>'
            f'<td class="col-sm text-muted">{t}</td><td class="col-md num mono text-subtle">{ip}</td></tr>' for w, who, a, t, ip in AUDIT)
        inner = f'<div class="table-wrap"><table class="table"><caption class="visually-hidden">Audit log, newest first</caption>{thead}<tbody>{rows}</tbody></table></div>'
    main = f'{head}<div class="pad" style="padding-bottom: var(--space-10)">{inner}</div>'
    d = {"default": "Ten entries newest first with filters.", "loading": "Table skeleton.", "error": "Audit store error.", "empty": "No entries yet.", "no-results": "Filters that match nothing."}[state]
    return shell("audit", main), d


# ===========================================================================
# Settings (theme L2-048, allow list L2-038, defaults L2-053/L2-019, secrets L2-040)
# ===========================================================================
def settings(state):
    viewer = state == "viewer"
    role = "viewer" if viewer else "owner"
    head = page_header("Settings", "Your preferences, who can sign in, and the defaults every direction starts with.")
    if state == "loading":
        main = head + f'<div class="pad">{loading_region("Loading settings", "".join("<div class=" + chr(34) + "settings-section" + chr(34) + "><div class=" + chr(34) + "stack stack--sm" + chr(34) + ">" + sk("skeleton--w50") + sk("skeleton--w75") + "</div><div class=" + chr(34) + "stack" + chr(34) + ">" + sk() + sk() + sk("skeleton--w66") + "</div></div>" for _ in range(4)))}</div>'
        return shell("settings", main), "Section skeletons."
    if state == "error":
        main = head + f'<div class="pad">{error_block("Settings couldn’t load", "The settings service returned 500. Your theme still follows your last choice on this device.")}</div>'
        return shell("settings", main), "Settings failed to load."
    busy = state == "submitting"
    invalid = state == "invalid"
    ro = " readonly" if (busy or viewer) else ""
    theme = "".join(f'<label class="choice"><input type="radio" name="theme"{" checked" if k == "System" else ""}{" disabled" if busy else ""}><span>{icon(ic, "icon--sm")}</span><span>{k}<small>{s}</small></span></label>'
                    for k, ic, s in [("Light", "sun", "Stone canvas, slate ink"), ("Dark", "moon", "The Mission Control default at night"), ("System", "monitor", "Follow your operating system")])
    users = [("quinntynebrown", "Owner", "Today, 08:02"), ("ama-osei", "Viewer", "Today, 10:15"), ("devon-park", "Viewer", "Never")]
    user_rows = "".join(
        f'<li class="row"><span class="cluster"><span class="avatar" aria-hidden="true">{u[:2].upper()}</span><span class="mono">{u}</span></span>'
        f'<span class="text-sm">{r}</span><span class="text-xs text-subtle lg-only">Last sign-in: {seen}</span>'
        f'<span class="row__actions">{"" if (viewer or r == "Owner") else btn("Remove", "ghost", "sm")}</span></li>' for u, r, seen in users)
    add_user = "" if viewer else btn("Add a GitHub login", "", "sm", "plus", href=dialog_link("add-user"))
    budget_err = "Default budget must be between $10.00 and $10,000.00." if invalid else ""
    thr_err = "Descope threshold must be a whole number of days from 1 to 20." if invalid else ""
    inv = ' aria-invalid="true"'
    summary = ""
    if invalid:
        summary = ('<div class="callout callout--danger form-summary" role="alert" tabindex="-1">' + icon("alert-triangle", "icon--lg") +
                   '<div><p class="callout__title">2 things to fix</p><ul><li><a href="#default-budget">Default budget is out of range</a></li><li><a href="#threshold">Descope threshold must be 1 to 20 days</a></li></ul></div></div>')
    if state == "success":
        summary = ('<div class="callout callout--ok" role="status">' + icon("check-circle", "icon--lg") +
                   '<div><p class="callout__title">Defaults saved</p><p class="callout__body">New directions start with a $350.00 budget and a 3-day descope threshold. Directions already running keep theirs.</p></div></div>')
    if viewer:
        summary = ('<div class="callout callout--info" role="status">' + icon("lock", "icon--lg") +
                   '<div><p class="callout__title">Read-only for Viewers</p><p class="callout__body">You can change your own theme. Defaults, sign-in access and integrations are managed by an Owner.</p></div></div>')
    budget_val = "5.00" if invalid else ("350.00" if state == "success" else "300.00")
    thr_val = "0.5" if invalid else "3"
    budget_field = _field("default-budget", "Default budget per direction", f'<div class="prefix prefix--money"><span class="prefix__sym" aria-hidden="true">$</span><input class="input" id="default-budget" inputmode="decimal" value="{budget_val}"{inv + " aria-describedby=" + chr(34) + "default-budget-err" + chr(34) if invalid else " aria-describedby=" + chr(34) + "default-budget-hint" + chr(34)}{ro}></div>',
                          "Warns at 80%, pauses at 100%. Can be changed on each direction.", budget_err)
    thr_field = _field("threshold", "Descope threshold", f'<div class="cluster"><input class="input" style="width: 6rem" id="threshold" inputmode="numeric" value="{thr_val}"{inv + " aria-describedby=" + chr(34) + "threshold-err" + chr(34) if invalid else " aria-describedby=" + chr(34) + "threshold-hint" + chr(34)}{ro}><span class="text-sm text-muted">ideal days</span></div>',
                       "Designs estimated above this are split, or deferred with a reason.", thr_err)
    save = "" if viewer else (f'<div class="form-actions">' + (f'<button class="btn btn--primary" type="submit" aria-busy="true" disabled>{icon("loader")}Saving…</button>' if busy else '<button class="btn btn--primary" type="submit">Save defaults</button>') + "</div>")
    integrations = [("GitHub App", "hewn-factory · installed on hewn-builds, northwind", "Connected", "ok"), ("Anthropic API", "ANTHROPIC_API_KEY", "Connected", "ok"),
                    ("Magic Patterns MCP", "HEWN_MAGIC_PATTERNS_TOKEN", "Connected", "ok"), ("GitHub webhook", "HEWN_GITHUB_WEBHOOK_SECRET", "Last delivery 12 s ago", "ok")]
    integ = "".join(f'<li class="integration"><span class="integration__name">{n}<small>{k}</small></span><span class="secret" aria-label="Secret hidden">••••••••</span>{status("Succeeded", s, sm=True)}</li>' for n, k, s, _t in integrations)
    main = f"""{head}<div class="pad" style="padding-bottom: var(--space-12)">
<section class="settings-section" aria-labelledby="s-appearance"><div class="settings-section__intro"><h2 id="s-appearance" style="font: var(--text-h3)">Appearance</h2><p>Only on this device. Saved immediately.</p></div>
<div class="settings-section__body"><fieldset style="border:0; margin:0; padding:0"><legend class="visually-hidden">Theme</legend>{theme}</fieldset></div></section>
<section class="settings-section" aria-labelledby="s-access"><div class="settings-section__intro"><h2 id="s-access" style="font: var(--text-h3)">Who can sign in</h2><p>GitHub logins on the allow list. Owners give direction and stop work; Viewers watch.</p></div>
<div class="settings-section__body"><div class="rows rows--users"><div class="rows__head" aria-hidden="true"><span>Login</span><span>Role</span><span>Last sign-in</span><span class="visually-hidden">Actions</span></div><ul>{user_rows}</ul></div><div class="mt-4">{add_user}</div></div></section>
<form class="settings-section" aria-labelledby="s-defaults" novalidate><div class="settings-section__intro"><h2 id="s-defaults" style="font: var(--text-h3)">Direction defaults</h2><p>What every new direction starts with.</p></div>
<div class="settings-section__body stack" style="gap: var(--space-6)">{summary}{budget_field}{thr_field}{save}</div></form>
<section class="settings-section" aria-labelledby="s-int"><div class="settings-section__intro"><h2 id="s-int" style="font: var(--text-h3)">Integrations</h2><p>Secrets are encrypted at rest and never shown again after they’re set.</p></div>
<div class="settings-section__body"><ul>{integ}</ul></div></section>
</div>"""
    d = {"default": "Theme, allow list, direction defaults and integrations.", "invalid": "Out-of-range defaults with inline errors and a summary.",
         "submitting": "Saving defaults; fields read-only.", "success": "Defaults saved and what changes next.", "viewer": "Viewer: read-only except theme."}[state]
    return shell("settings", main, role), d


# ===========================================================================
# Error pages
# ===========================================================================
def not_found(state):
    main = (f'<div class="errpage"><div class="errpage__inner"><p class="errpage__code">404</p><h1>That project isn’t here</h1>'
            f'<p>It may have been deleted, or it belongs to a Hewn you can’t see. Nothing about other projects is shown on purpose.</p>'
            f'<div class="cluster">{btn("Go to projects", "primary", "", href=page_link("projects"))}{btn("Dashboard", "ghost", "", href=page_link("dashboard"))}</div></div></div>')
    return shell("projects", main), "Unknown or inaccessible project: 404 that reveals nothing (L2-039)."


def server_error(state):
    main = (f'<div class="errpage"><div class="errpage__inner"><p class="errpage__code">500 · ref 7c2e-91af</p><h1>Mission Control hit a problem</h1>'
            f'<p>The page couldn’t be built. Your directions keep running on their workers; this only affects what you can see. Try again, or share the reference with whoever runs this Hewn.</p>'
            f'<div class="cluster">{btn("Try again", "primary", "", "refresh")}{btn("Dashboard", "ghost", "", href=page_link("dashboard"))}</div></div></div>')
    return shell("dashboard", main), "Unexpected server error with a reference and reassurance."
