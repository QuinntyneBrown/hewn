"""Component specs: Navigation (top bar, sidebar, tabs, breadcrumb, pagination, stepper, skip link, page header).

Live examples link to fragments of the documentation page itself (#overview, #states, ...) so every
href resolves. Examples repeated inside themes() carry no ids.
"""
from common import (NA, code, ex, icon, kbd, mk, mock, page, status, status_icon, table, themes, ul, wordmark)

SPECS = {}

# Headings inside examples are demoted: the documentation page owns the only <h1>.
_H1 = 'style="font: var(--text-h1); letter-spacing: var(--letter-spacing-tight);"'
_NOTE = '<span class="text-caption">{}</span>'
_FRAGS = ["overview", "anatomy", "variants", "sizes", "states", "responsive", "theming", "accessibility", "content", "tokens"]


def matrix(cols, rows):
    """common.matrix with each cell in a positioned box, so visually hidden text inside a horizontally
    scrolling matrix is contained by the scroller instead of widening the page."""
    from common import matrix as _m
    return _m(cols, [(r, ['<div style="position: relative;">' + c + "</div>" for c in cells]) for r, cells in rows])


def _na(text):
    return _NOTE.format(text)


# ============================================================== shared shell builders
_NAV = [("dashboard", "Dashboard", "layout-grid", False), ("projects", "Projects", "folder-kanban", False),
        ("workers", "Workers", "server", False), ("audit", "Audit", "scroll-text", True), ("settings", "Settings", "settings", False)]
_ACTIVE = [p for p in mk.PROJECTS if p["status"] in ("Running", "Paused", "Blocked")]


def _nav_link(label, ic, frag, current=False, state="", badge=""):
    cur = ' aria-current="page"' if current else ""
    st = f' data-state="{state}"' if state else ""
    b = f'<span class="nav-link__badge" aria-label="{badge}">{badge.split()[0]}</span>' if badge else ""
    return f'<a class="nav-link" href="#{frag}"{cur}{st}>{icon(ic, "icon--lg")}{label}{b}</a>'


def _side_project(p, stopped=False, state="", current=False):
    st = "Paused" if stopped else p["status"]
    ds = f' data-state="{state}"' if state else ""
    cur = ' aria-current="page"' if current else ""
    return (f'<a class="side-project" href="#variants"{ds}{cur}>{status_icon(st, "icon--sm")}<span class="side-project__name">{p["name"]}</span>'
            f'<span class="visually-hidden">, {st},</span><span class="side-project__pct">{p["percent"]}%</span></a>')


def _conn(conn):
    if conn == "reconnecting":
        return '<span class="conn__state"><span class="dot dot--warn pulse"></span>Reconnecting…</span>'
    if conn == "offline":
        return '<span class="conn__state"><span class="dot dot--danger"></span>Offline</span>'
    return '<span class="conn__state"><span class="dot"></span>Live</span>'


def _sidebar(role="owner", conn="live", stopped=False, current="dashboard", uid=None, brand=True, foot=True):
    owner = role == "owner"
    nav = "".join(_nav_link(label, ic, _FRAGS[i], k == current) for i, (k, label, ic, owner_only) in enumerate(_NAV) if owner or not owner_only)
    projects = "".join(f"<li>{_side_project(p, stopped)}</li>" for p in _ACTIVE)
    if uid:
        sec = f'<p class="sidebar__section" id="{uid}">Active directions</p><ul class="sidebar__projects" aria-labelledby="{uid}">'
    else:
        sec = '<p class="sidebar__section" aria-hidden="true">Active directions</p><ul class="sidebar__projects" aria-label="Active directions">'
    cta = (f'<div class="sidebar__cta"><a class="btn btn--primary btn--block" href="#overview">{icon("plus")}New direction</a></div>' if owner else "")
    stop = ""
    if owner:
        stop = (f'<button class="btn btn--sm btn--block mt-3" type="button">{icon("play", "icon--sm")}Start workers</button>' if stopped else
                f'<button class="btn btn--danger btn--sm btn--block mt-3" type="button" aria-haspopup="dialog">{icon("octagon-x", "icon--sm")}Stop all workers</button>')
    who, rl, ini = ("quinntynebrown", "Owner", "QB") if owner else ("ama-osei", "Viewer", "AO")
    b = f'<div class="sidebar__brand">{wordmark("", "#overview", "Hewn, go to dashboard")}</div>' if brand else ""
    f = (f'<div class="sidebar__foot"><div class="conn">{_conn(conn)}<span class="tabular text-subtle">{"0" if stopped else "3"} of 4 workers</span></div>{stop}'
         f'<div class="user"><span class="avatar" aria-hidden="true">{ini}</span><div class="truncate"><div class="user__name truncate">{who}</div><div class="user__role">{rl}</div></div></div></div>') if foot else ""
    label = "Primary"
    return (f'<div class="sidebar" style="min-height: 0;">{b}{cta}<nav class="sidebar__nav" aria-label="{label}">{nav}</nav>'
            f'{sec}{projects}</ul>{f}</div>')


def _frame(inner, width="var(--layout-sidebar-width)"):
    """A fixed-width bordered box so a sidebar reads as a rail inside the canvas."""
    return (f'<div style="width: 100%; max-width: {width}; flex: 0 1 {width}; overflow: hidden; border-radius: var(--radius-lg); '
            f'box-shadow: inset 0 0 0 var(--border-width-hairline) var(--color-border-default);">{inner}</div>')


def _topbar(conn="live", state="", expanded=False):
    dot = {"live": ("dot", "Live"), "reconnecting": ("dot dot--warn pulse", "Reconnecting"), "offline": ("dot dot--danger", "Offline")}[conn]
    st = f' data-state="{state}"' if state else ""
    ex_ = "true" if expanded else "false"
    return (f'<header class="topbar topbar--always">'
            f'<button class="btn btn--ghost btn--icon btn--touch" type="button" aria-label="Open menu" aria-haspopup="dialog" aria-expanded="{ex_}"{st}>{icon("menu", "icon--lg")}</button>'
            f'{wordmark("sm", "#overview", "Hewn, go to dashboard")}'
            f'<span class="topbar__slot" role="img" aria-label="Connection: {dot[1]}"><span class="{dot[0]}"></span></span></header>')


# ============================================================== top-bar
_TB_MENU = lambda extra="": f'<button class="btn btn--ghost btn--icon btn--touch" type="button" aria-label="Open menu" aria-haspopup="dialog"{extra}>{icon("menu", "icon--lg")}</button>'
_TB_DOTS = "".join(f'<span class="topbar__slot" role="img" aria-label="Connection: {w}"><span class="{c}"></span></span>'
                   for c, w in [("dot", "Live"), ("dot dot--warn pulse", "Reconnecting"), ("dot dot--danger", "Offline")])

SPECS["top-bar"] = {
    "lead": "The phone and tablet header: a menu button that opens the navigation drawer, the wordmark home link and the live connection dot. From lg the sidebar takes over and the top bar disappears.",
    "readme_variants": "live, reconnecting, offline connection; always-visible (docs and embeds)",
    "readme_states": "menu button default, hover, focus, active, expanded",
    "pills": ["Below lg only", "<code>&lt;header&gt;</code> banner"],
    "overview": f"""<p>Every shell page renders the top bar above its strips and <code>&lt;main&gt;</code>. Below <code>--layout-breakpoint-lg</code> (992px) it is the only navigation chrome on screen: the {page('components/sidebar-nav', 'sidebar')} is hidden and the menu button opens the same sidebar inside a {page('components/drawer')}. From lg it is <code>display: none</code>, because the sidebar is always visible.</p>
{ul(["<b>Menu button</b>: icon-only, 44px, opens the navigation drawer (the <i>mobile-nav</i> dialog). It is the main target on a phone.",
     "<b>Wordmark</b>: the small Hewn wordmark, a link to the Dashboard named <i>Hewn, go to dashboard</i>.",
     "<b>Connection dot</b>: the same Live / Reconnecting / Offline state the sidebar footer shows, as a dot with an accessible name. The wording lives in the strip below the bar when the connection is not live."])}
<p>The top bar holds nothing else: no search, no tabs, no page actions. Page actions stay in the {page('components/page-header')}; project sections stay in the {page('components/project-header')} tabs.</p>""",
    "anatomy": (_frame(_topbar(), "20rem"), [(14, 12), (48, 12), (86, 12), (50, 90)],
                [("Menu button", "<code>.btn--ghost.btn--icon.btn--touch</code>, 44px, <code>aria-label=\"Open menu\"</code>, <code>aria-haspopup=\"dialog\"</code>, <code>aria-expanded</code>."),
                 ("Wordmark", "<code>.wordmark--sm</code> (18px) inside an <code>&lt;a&gt;</code> to the Dashboard; the SVG and text are hidden, the link is named."),
                 ("Connection slot", "<code>.topbar__slot</code>: a 44px cell, <code>role=\"img\"</code> with <code>aria-label=\"Connection: Live\"</code>, holding a <code>.dot</code>."),
                 ("Bar", "<code>.topbar</code>: <code>--layout-topbar-height</code> (56px), sticky at <code>--z-sticky</code>, surface background, hairline bottom border, <code>--space-3</code> side padding.")]),
    "variants": f"""<p>The bar has one layout; what varies is the connection state it reports.</p>
{ex(_topbar("live"), "Live: green dot. Events are streaming.", cls="ds-example__canvas--stack")}
{ex(_topbar("reconnecting"), "Reconnecting: amber dot, pulsing. A warning strip under the bar says when the next attempt is.", cls="ds-example__canvas--stack")}
{ex(_topbar("offline"), "Offline: red dot. A danger strip with <i>Retry now</i> sits under the bar.", cls="ds-example__canvas--stack")}
<p><code>.topbar--always</code> keeps the bar visible from lg too, with <code>--space-8</code> side padding. Only documentation and embedded previews use it; the product hides the bar from lg.</p>""",
    "sizes": NA("The top bar has one height, --layout-topbar-height (56px), at every width where it shows."),
    "states": f"""<p>The bar itself has no interactive states; its menu button and wordmark link do. Pointer and focus states are forced with <code>data-state</code>.</p>
{matrix(["Default", "Hover", "Focus", "Active", "Expanded", "Disabled"], [
    ("Menu button", [_TB_MENU(' aria-expanded="false"'), _TB_MENU(' aria-expanded="false" data-state="hover"'), _TB_MENU(' aria-expanded="false" data-state="focus"'),
                     _TB_MENU(' aria-expanded="false" data-state="active"'), _TB_MENU(' aria-expanded="true"'), _na("Never disabled")]),
    ("Wordmark link", [wordmark("sm", "#overview", "Hewn, go to dashboard"), _na("No change; cursor only"),
                       wordmark("sm", "#overview", "Hewn, go to dashboard").replace('class="wordmark wordmark--sm"', 'class="wordmark wordmark--sm" data-state="focus"'),
                       _na("No change"), _na("—"), _na("—")]),
])}
<h3>Connection</h3>
{ex(_TB_DOTS, "Live, Reconnecting (pulses) and Offline. The dot is never the only signal: the sidebar footer and the strip under the bar say it in words.")}
{themes(_topbar("live") + _topbar("offline"), stack=True)}
{ul(["<b>Expanded</b>: while the drawer is open the button reports <code>aria-expanded=&quot;true&quot;</code> and the shell behind is <code>inert</code>, so the button is not reachable again until the drawer closes; Close inside the drawer returns focus to it.",
     "<b>Reconnecting</b> pulses at <code>--duration-pulse</code>; under reduced motion the pulse stops and the dot stays amber."])}""",
    "responsive": ul([
        "Below <code>--layout-breakpoint-sm</code> (576px) and from sm to md (768px): the bar shows, full width, sticky at the top; strips stack under it; the page scrolls under the sticky bar (<code>scroll-padding-top: var(--layout-topbar-height)</code> keeps anchored headings visible).",
        "From md to lg (992px): unchanged. Tablets still use the drawer, because the 15rem sidebar plus the pipeline rail would squeeze the stage detail below its measure.",
        "From lg: <code>display: none</code>. The sidebar is visible and carries the same three things (brand, navigation, connection).",
        "xl (1200px) changes nothing. The bar never grows extra content as the screen widens."]),
    "theming": f"""<p>The bar uses only semantic tokens: <code>--color-bg-surface</code> for the background, <code>--color-border-default</code> for the bottom hairline, the ghost button's tokens for the menu button and the status solids for the dot. In dark the surface lifts above the canvas and the hairline darkens, so the bar still reads as a separate layer without a shadow.</p>
<pre><code>/* An embedded preview that keeps the bar at every width */
.preview-shell .topbar {{ display: flex; }}</code></pre>""",
    "a11y": {
        "pattern": "<p>A <code>&lt;header&gt;</code> outside <code>&lt;main&gt;</code>, so it is the page's <a href=\"https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/\">banner landmark</a>. The menu button follows the <a href=\"https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/\">APG modal dialog</a> pattern for its trigger: a real <code>&lt;button&gt;</code> with <code>aria-haspopup=\"dialog\"</code>, <code>aria-expanded</code> and <code>aria-controls</code> pointing at the drawer.</p>",
        "keys": [(kbd("Tab"), "From the skip link, moves to the menu button, then the wordmark, then into the strips and page."),
                 (kbd("Enter") + ", " + kbd("Space"), "On the menu button: opens the drawer and moves focus to its Close button."),
                 (kbd("Esc"), "Inside the drawer: closes it and returns focus to the menu button."),
                 (kbd("Enter"), "On the wordmark: goes to the Dashboard.")],
        "focus": "<p>The shared 2px ring with 2px offset on <code>:focus-visible</code>. The bar is sticky, so a focused element in the page is never hidden under it: <code>scroll-padding-top</code> equals the bar height (WCAG 2.4.11 Focus Not Obscured).</p>",
        "labelling": "<p><i>Open menu</i> on the button (not <i>Menu</i> or <i>Hamburger</i>); <i>Hewn, go to dashboard</i> on the wordmark link; <i>Connection: Live</i> / <i>Reconnecting</i> / <i>Offline</i> on the dot. Changes in connection are announced by the strip (<code>role=\"status\"</code> for reconnecting, <code>role=\"alert\"</code> for offline), not by the dot.</p>",
        "pairs": [("Menu icon on bar", "--color-fg-muted", "--color-bg-surface", 4.5), ("Wordmark on bar", "--color-fg-default", "--color-bg-surface", 4.5),
                  ("Live dot", "--color-success-solid", "--color-bg-surface", 3), ("Reconnecting dot", "--color-warning-solid", "--color-bg-surface", 3),
                  ("Offline dot", "--color-danger-icon", "--color-bg-surface", 3), ("Focus ring on bar", "--color-focus-ring", "--color-bg-surface", 3)],
        "motion": "<p>Only the reconnecting dot moves (opacity pulse at <code>--duration-pulse</code>); reduced motion zeroes it. The drawer's slide-in belongs to the drawer.</p>",
        "touch": "<p>The menu button and the connection slot are 44 × 44px (<code>--target-comfortable</code>); the wordmark link is 18px tall but sits alone in the middle with at least 24px of clear space on each side (WCAG 2.5.8 spacing exception).</p>",
    },
    "content": ul(["The bar has no visible text other than the wordmark. Do not add page titles: the page header below already has the <code>&lt;h1&gt;</code>.",
                   "Accessible names are verb first for actions (<i>Open menu</i>) and say the destination for the brand link (<i>Hewn, go to dashboard</i>).",
                   "Connection names use the same three words as the sidebar footer: <i>Live</i>, <i>Reconnecting</i>, <i>Offline</i>."]),
    "dodont": [
        (_TB_MENU(' aria-expanded="false"'), "The menu trigger is a <code>&lt;button&gt;</code> with <code>aria-haspopup=\"dialog\"</code> and <code>aria-expanded</code>, so a screen reader says it opens something and whether it is open.",
         f'<a class="btn btn--ghost btn--icon btn--touch" href="#overview" aria-label="Open menu">{icon("menu", "icon--lg")}</a>',
         "Every shell mock makes it a link to the <i>mobile-nav</i> dialog page. In the product it does not navigate; a link announces the wrong thing and gives no open/closed state."),
        (_frame(_topbar("live"), "20rem"), "Three things only: menu, brand, connection.",
         _frame('<header class="topbar topbar--always">' + _TB_MENU() + '<span class="text-sm">Ledgerline · Pipeline</span>' + '<a class="btn btn--primary btn--sm" href="#overview">Pause</a></header>', "20rem"),
         "Do not put the page title or page actions in the bar. At 360px they crowd out the wordmark and duplicate the page header and project header."),
    ],
    "tokens": [("Background", "--color-bg-surface"), ("Bottom border", "--color-border-default"), ("Menu icon", "--color-fg-muted"),
               ("Menu button hover", "--color-bg-subtle"), ("Connection dot live / reconnecting / offline", "--color-success-solid / --color-warning-solid / --color-danger-icon"),
               ("Focus ring", "--color-focus-ring"), ("Height", "--layout-topbar-height"), ("Target size", "--target-comfortable"),
               ("Side padding below lg / --always from lg", "--space-3 / --space-8"), ("Stacking", "--z-sticky"), ("Border width", "--border-width-hairline"),
               ("Reconnecting pulse", "--duration-pulse")],
    "code": {"snippet": """<header class="topbar">
  <button class="btn btn--ghost btn--icon btn--touch" type="button" aria-label="Open menu"
          aria-haspopup="dialog" aria-expanded="false" aria-controls="mobile-nav">
    <svg class="icon icon--lg" viewBox="0 0 24 24" aria-hidden="true">…menu…</svg>
  </button>
  <a class="wordmark wordmark--sm" href="/dashboard" aria-label="Hewn, go to dashboard">…</a>
  <span class="topbar__slot" role="img" aria-label="Connection: Live"><span class="dot"></span></span>
</header>""",
             "classes": [("<code>.topbar</code>", "Sticky 56px bar; hidden from lg."), ("<code>.topbar--always</code>", "Keeps the bar from lg (documentation and previews)."),
                         ("<code>.topbar__slot</code>", "44px cell for the connection dot."),
                         ("<code>.dot</code> <code>.dot--warn</code> <code>.dot--danger</code> + <code>.pulse</code>", "Live, Reconnecting (pulsing), Offline."),
                         ("<code>aria-expanded</code>", "true while the navigation drawer is open."),
                         ("<code>data-state=\"hover|focus|active\"</code>", "Documentation only: forces a state on the menu button.")]},
    "sources": {"mocks": [("pages/dashboard/default", "live, at 360px"), ("pages/dashboard/reconnecting", "amber dot and warning strip"),
                          ("pages/project-pipeline/offline", "red dot and danger strip"), ("dialogs/mobile-nav/default", "the drawer the menu button opens")],
                "drift": "the menu trigger was a link to the mobile-nav mock page; it is a <code>&lt;button&gt;</code> with <code>aria-haspopup=\"dialog\"</code>, <code>aria-expanded</code> and <code>aria-controls</code>. The reconnecting dot did not pulse in the bar while the sidebar's did; both pulse now. The mocks' extra 39.99rem chrome breakpoint is gone (all queries are min-width lg)."},
}


# ============================================================== sidebar-nav
_SB_ANAT = _frame(_sidebar(uid="sbnav-anat"))

_SB_STATES = matrix(["Default", "Hover", "Focus", "Active", "Current", "Disabled"], [
    ("Nav link", [_nav_link("Workers", "server", "variants"), _nav_link("Workers", "server", "variants", state="hover"),
                  _nav_link("Workers", "server", "variants", state="focus"), _nav_link("Workers", "server", "variants", state="active"),
                  _nav_link("Workers", "server", "variants", current=True), _na("Not used: Viewers do not see Audit at all")]),
    ("Active direction", [_side_project(_ACTIVE[0]), _side_project(_ACTIVE[0], state="hover"), _side_project(_ACTIVE[0], state="focus"),
                          _side_project(_ACTIVE[0], state="active"), _side_project(_ACTIVE[0], current=True), _na("—")]),
    ("With count", [_nav_link("Projects", "folder-kanban", "variants", badge="1 blocked"), _nav_link("Projects", "folder-kanban", "variants", state="hover", badge="1 blocked"),
                    _nav_link("Projects", "folder-kanban", "variants", state="focus", badge="1 blocked"), _nav_link("Projects", "folder-kanban", "variants", state="active", badge="1 blocked"),
                    _nav_link("Projects", "folder-kanban", "variants", current=True, badge="1 blocked"), _na("—")]),
])

_SB_VARIANTS = (
    '<div class="cluster" style="align-items: flex-start; gap: var(--space-6);">'
    + _frame(_sidebar(uid="sbnav-v1")) + _frame(_sidebar("viewer", uid="sbnav-v2", current="projects")) + "</div>")
_SB_FOOTS = ('<div class="cluster" style="align-items: flex-start; gap: var(--space-6);">'
             + "".join(_frame(f'<div class="sidebar" style="min-height: 0;"><div class="sidebar__foot" style="margin-top: 0;">'
                              f'<div class="conn">{_conn(c)}<span class="tabular text-subtle">{n} of 4 workers</span></div>{b}</div></div>')
                          for c, n, b in [("live", "3", f'<button class="btn btn--danger btn--sm btn--block mt-3" type="button" aria-haspopup="dialog">{icon("octagon-x", "icon--sm")}Stop all workers</button>'),
                                          ("live", "0", f'<button class="btn btn--sm btn--block mt-3" type="button">{icon("play", "icon--sm")}Start workers</button>'),
                                          ("reconnecting", "3", ""), ("offline", "3", "")]) + "</div>")

SPECS["sidebar-nav"] = {
    "lead": "The app sidebar: brand, the one primary action, five destinations, the active directions with live status, and a footer with the connection, the worker count, Stop all workers and the signed-in user.",
    "readme_variants": "Owner, Viewer, workers stopped; connection live, reconnecting, offline; in drawer",
    "readme_states": "nav link default, hover, focus, current; active direction default, hover, current",
    "pills": ["<code>&lt;nav aria-label=\"Primary\"&gt;</code>", "From lg; drawer below"],
    "overview": f"""<p>The sidebar is the product's primary navigation and its at-a-glance health panel. It is always visible from lg in <code>.shell__sidebar</code> (sticky, full height, scrolls on its own) and rendered unchanged inside the {page('components/drawer')} below lg, opened from the {page('components/top-bar')}.</p>
{ul(["<b>Brand</b>: the wordmark, linking to the Dashboard.",
     "<b>New direction</b>: the one primary button (Owners only). It is the product's main verb, so it sits above the navigation, not in a page header.",
     "<b>Primary navigation</b>: Dashboard, Projects, Workers, Audit (Owners only), Settings. Icon plus label; the current page is <code>aria-current=&quot;page&quot;</code>.",
     "<b>Active directions</b>: every Running, Paused or Blocked project, with its status icon, name and percent complete (Ledgerline 62%, Tidewater 18%, Parcel Post 24%, Kiln Booking 81%). Idle, Complete and Cancelled projects live on the Projects page.",
     "<b>Footer</b>: connection (Live / Reconnecting… / Offline), <i>3 of 4 workers</i>, Stop all workers (Owners) and the user's initials, name and role."])}
<p>There are no collapsible groups and no icon-only collapsed mode: five destinations and a handful of projects fit at 15rem, and labels are faster to scan than icons.</p>""",
    "anatomy": (_SB_ANAT, [(30, 6), (50, 14), (50, 30), (40, 52), (50, 66), (50, 90)],
                [("Brand", "<code>.sidebar__brand</code>: 64px tall, <code>--space-5</code> inline padding, the wordmark link."),
                 ("Primary action", "<code>.sidebar__cta</code>: a block primary button, Owners only."),
                 ("Navigation", "<code>&lt;nav class=\"sidebar__nav\" aria-label=\"Primary\"&gt;</code> of <code>.nav-link</code>s: 20px icon, label, optional count badge."),
                 ("Section label", "<code>.sidebar__section</code>, overline type, labels the list with <code>aria-labelledby</code>."),
                 ("Active directions", "<code>.sidebar__projects</code> of <code>.side-project</code>: status icon, truncating name, hidden status word, tabular percent."),
                 ("Footer", "<code>.sidebar__foot</code>: <code>.conn</code>, Stop all workers, <code>.user</code> with avatar, name and role.")]),
    "variants": f"""<p>The role decides what is shown. Owners get the primary action, Audit and Stop all workers; Viewers get neither the actions nor Audit, rather than disabled copies of them.</p>
{ex(_SB_VARIANTS, "Owner (quinntynebrown) on the Dashboard; Viewer (ama-osei) on Projects: no New direction, no Audit, no Stop all workers.")}
<h3>Footer states</h3>
{ex(_SB_FOOTS, "Live with Stop all workers; all workers stopped (0 of 4, Start workers, every active direction shows Paused); Reconnecting…; Offline.")}
<h3>In the drawer</h3>
<p>Below lg the same markup sits inside the navigation drawer with <code>aria-label=&quot;Primary, menu&quot;</code> and a Close button in the corner; see {mock('dialogs/mobile-nav/default')}. Nothing is removed for the small screen.</p>""",
    "sizes": NA("The sidebar has one width, --layout-sidebar-width (15rem); its rows change height with the breakpoint (see Responsive)."),
    "states": f"""<p>Pointer and focus states are forced with <code>data-state</code>; the current page is the real <code>aria-current=&quot;page&quot;</code> attribute.</p>
{_SB_STATES}
{themes(_frame(_sidebar(current="workers")), stack=True)}
{ul(["<b>Current</b>: raised background, default text colour, medium weight, accent icon. It is the only place accent appears in the navigation.",
     "<b>Active</b> has no separate style: navigation is instant and the new current state is the feedback.",
     "<b>Count badge</b> (<code>.nav-link__badge</code>) is reserved for things that need the Owner: blocked projects. It carries an <code>aria-label</code> with the meaning (<i>1 blocked</i>), not just the number.",
     "<b>Active directions</b> show status as icon plus a visually hidden word (<i>, Running,</i>), never colour alone. They update live; their list is not a live region, because the toast and dashboard already announce changes."])}""",
    "responsive": ul([
        "Below <code>--layout-breakpoint-lg</code> (992px), at every smaller size (xs, sm 576px, md 768px): <code>.shell__sidebar</code> is <code>display: none</code>; the sidebar is reached through the top bar's menu button and rendered in the drawer. Rows are 44px (<code>--target-comfortable</code>) for touch.",
        "From lg: the sidebar is visible, 15rem wide, sticky at the top with its own scroll (<code>height: 100dvh; overflow-y: auto</code>), so a long project list never pushes the footer off screen. Nav links drop to 40px (<code>--control-height-md</code>) and active directions to 32px (<code>--control-height-sm</code>).",
        "xl (1200px) and wider: unchanged. The extra width goes to the page, not the rail.",
        "Long project names truncate with an ellipsis; the percent never wraps."]),
    "theming": f"""<p>The sidebar declares its own component tokens so a re-skin does not touch the CSS: <code>--nav-fg</code>, <code>--nav-fg-hover</code>, <code>--nav-bg-hover</code>, <code>--nav-bg-current</code>, <code>--nav-icon-current</code>. They alias <code>--color-fg-muted</code>, <code>--color-fg-default</code>, <code>--color-bg-subtle</code>, <code>--color-bg-surface-raised</code> and <code>--color-fg-accent</code>.</p>
<pre><code>/* A tinted current item for a demo workspace */
.sidebar--demo {{ --nav-bg-current: var(--color-accent-subtle); }}</code></pre>
<p>In dark the sidebar surface sits one step above the canvas and the current item one step above that, so the hierarchy survives without borders. The danger Stop all workers button becomes the dark red tint described on {page('components/button')}.</p>""",
    "a11y": {
        "pattern": "<p>A <code>&lt;nav aria-label=\"Primary\"&gt;</code> of plain links inside an <code>&lt;aside&gt;</code>; see the <a href=\"https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/\">APG landmark regions</a> guidance. It is <em>not</em> an ARIA menu: no <code>role=\"menu\"</code>, no arrow-key handling, Tab moves through the links. The current page uses <code>aria-current=\"page\"</code>. The active-directions list is a labelled <code>&lt;ul&gt;</code> outside the nav, because it lists objects, not destinations.</p>",
        "keys": [(kbd("Tab") + " / " + kbd("Shift", "Tab"), "Brand, New direction, the five links, each active direction, Stop all workers, in that order."),
                 (kbd("Enter"), "Follows a link; on Stop all workers opens the confirmation dialog."),
                 (kbd("Esc"), "In the drawer: closes it and returns focus to the menu button.")],
        "focus": "<p>The shared ring on <code>:focus-visible</code>, drawn outside the 8px-radius row so it is not clipped by the rail (the rail has <code>--space-3</code> inline padding for it). After navigation focus moves to the new page's <code>&lt;h1&gt;</code>, not back to the sidebar.</p>",
        "labelling": "<p>Navigation: <i>Primary</i> (and <i>Primary, menu</i> in the drawer, so the two landmarks differ if both are ever present). Active directions: labelled by the visible <i>Active directions</i> text via <code>aria-labelledby</code>. Each project link reads <i>Ledgerline, Running, 62%</i>. Icons are <code>aria-hidden</code>; the avatar is decorative because the name sits beside it.</p>",
        "pairs": [("Nav label on rail", "--color-fg-muted", "--color-bg-surface", 4.5), ("Hovered label", "--color-fg-default", "--color-bg-subtle", 4.5),
                  ("Current label", "--color-fg-default", "--color-bg-surface-raised", 4.5), ("Current icon", "--color-fg-accent", "--color-bg-surface-raised", 4.5),
                  ("Section label and percent", "--color-fg-subtle", "--color-bg-surface", 4.5), ("Count badge", "--color-danger-fg", "--color-danger-bg", 4.5),
                  ("Live dot", "--color-success-solid", "--color-bg-surface", 3), ("Focus ring on rail", "--color-focus-ring", "--color-bg-surface", 3)],
        "motion": "<p>Background and colour transition over <code>--duration-fast</code> on hover. The reconnecting dot pulses; reduced motion stops it. Running project icons spin through <code>.icon--spin</code> and also stop under reduced motion.</p>",
        "touch": "<p>Every row is 44px below lg, where the sidebar is in the drawer and used with a thumb. From lg (pointer) rows are 40px and 32px, still above the 24px minimum, with 2px gaps.</p>",
    },
    "content": ul(["Destinations are single nouns in sentence case: <i>Dashboard</i>, <i>Projects</i>, <i>Workers</i>, <i>Audit</i>, <i>Settings</i>. No verbs, no <i>My</i>.",
                   "The section label is <i>Active directions</i>: the product calls a running piece of work a direction.",
                   "Worker count is <i>3 of 4 workers</i> (connected of registered), tabular.",
                   "Project names are shown as entered and truncate; the percent is a whole number with %.",
                   "The footer shows the GitHub login (<i>quinntynebrown</i>) and the role (<i>Owner</i> / <i>Viewer</i>)."]),
    "dodont": [
        (_frame(_sidebar("viewer", current="projects", brand=False, foot=False)), "Viewers do not see Audit or the owner actions at all.",
         _frame(f'<div class="sidebar" style="min-height: 0;"><nav class="sidebar__nav" aria-label="Primary, disabled example">{_nav_link("Projects", "folder-kanban", "variants", True)}'
                f'<a class="nav-link" aria-disabled="true" style="color: var(--color-fg-disabled);">{icon("scroll-text", "icon--lg")}Audit</a></nav></div>'),
         "Do not show a greyed-out Audit link. It cannot be explained in a 15rem rail and invites a click that leads to 403."),
        (f'<div class="user"><span class="avatar" aria-hidden="true">AO</span><div><div class="user__name">ama-osei</div><div class="user__role">Viewer</div></div></div>',
         "Initials come from the signed-in user.",
         f'<div class="user"><span class="avatar" aria-hidden="true">QB</span><div><div class="user__name">ama-osei</div><div class="user__role">Viewer</div></div></div>',
         "The Viewer mocks show ama-osei with quinntynebrown's initials (QB)."),
        (f'<button class="btn btn--danger btn--sm btn--block" type="button" aria-haspopup="dialog">{icon("octagon-x", "icon--sm")}Stop all workers</button>',
         "Full-width footer buttons use <code>.btn--block</code> and a spacing utility.",
         f'<button class="btn btn--danger btn--sm" type="button" style="width: 100%;">{icon("octagon-x", "icon--sm")}Stop all workers</button>',
         "The mocks size them with inline <code>style=\"width:100%; margin-top: var(--space-3)\"</code>, which a re-skin cannot reach."),
    ],
    "tokens": [("Rail background", "--color-bg-surface"), ("Rail edge (from lg)", "--color-border-default"), ("Link label", "--color-fg-muted"),
               ("Link hover background / label", "--color-bg-subtle / --color-fg-default"), ("Current background / icon", "--color-bg-surface-raised / --color-fg-accent"),
               ("Section label, percent, worker count", "--color-fg-subtle"), ("Count badge", "--color-danger-bg / --color-danger-fg"),
               ("Width", "--layout-sidebar-width"), ("Row height below lg / link from lg / project from lg", "--target-comfortable / --control-height-md / --control-height-sm"),
               ("Row radius", "--radius-md"), ("Link and project type", "--text-body-sm"), ("Section label type", "--text-overline"),
               ("Footer type", "--text-caption"), ("Brand height", "--space-16"), ("Rail padding", "--space-3"), ("Hover transition", "--duration-fast / --ease-standard")],
    "code": {"snippet": """<aside class="shell__sidebar" aria-label="Sidebar">
  <div class="sidebar">
    <div class="sidebar__brand"><a class="wordmark" href="/dashboard" aria-label="Hewn, go to dashboard">…</a></div>
    <div class="sidebar__cta"><a class="btn btn--primary btn--block" href="/new">…New direction</a></div>
    <nav class="sidebar__nav" aria-label="Primary">
      <a class="nav-link" href="/dashboard" aria-current="page"><svg class="icon icon--lg" aria-hidden="true">…</svg>Dashboard</a>
      <a class="nav-link" href="/projects">…Projects</a>
    </nav>
    <p class="sidebar__section" id="active-directions">Active directions</p>
    <ul class="sidebar__projects" aria-labelledby="active-directions">
      <li><a class="side-project" href="/projects/ledgerline">…<span class="side-project__name">Ledgerline</span>
        <span class="visually-hidden">, Running,</span><span class="side-project__pct">62%</span></a></li>
    </ul>
    <div class="sidebar__foot">
      <div class="conn"><span class="conn__state"><span class="dot"></span>Live</span><span class="tabular text-subtle">3 of 4 workers</span></div>
      <button class="btn btn--danger btn--sm btn--block mt-3" type="button" aria-haspopup="dialog">…Stop all workers</button>
      <div class="user"><span class="avatar" aria-hidden="true">QB</span>…</div>
    </div>
  </div>
</aside>""",
             "classes": [("<code>.shell__sidebar</code>", "The rail: hidden below lg, sticky and scrolling from lg."),
                         ("<code>.sidebar</code> + <code>__brand</code> <code>__cta</code> <code>__nav</code> <code>__section</code> <code>__projects</code> <code>__foot</code>", "Regions, top to bottom."),
                         ("<code>.nav-link</code> + <code>aria-current=\"page\"</code>", "Destination link; current page."),
                         ("<code>.nav-link__badge</code>", "Count pill; give it an <code>aria-label</code> with the meaning."),
                         ("<code>.side-project</code> + <code>__name</code> <code>__pct</code>", "Active direction row."),
                         ("<code>.conn</code> <code>.conn__state</code> <code>.user</code>", "Footer parts."),
                         ("<code>--nav-fg</code> <code>--nav-bg-current</code> …", "Component tokens for re-skins."),
                         ("<code>data-state=\"hover|focus|active\"</code>", "Documentation only.")]},
    "sources": {"mocks": [("pages/dashboard/default", "Owner sidebar, Dashboard current"), ("pages/dashboard/viewer", "Viewer sidebar"),
                          ("pages/dashboard/stopped", "0 of 4 workers, Start workers"), ("pages/dashboard/reconnecting", "Reconnecting… footer"),
                          ("pages/project-pipeline/offline", "Offline footer"), ("dialogs/mobile-nav/default", "the sidebar in the drawer")],
                "drift": "36px side-project rows mapped to 44px below lg and <code>--control-height-sm</code> from lg (logged); footer buttons used inline width and margin styles (now <code>.btn--block</code> + <code>.mt-3</code>); Viewer mocks showed the Owner's initials. <code>.nav-link__badge</code> is defined but unused in the mocks; it is documented here for blocked counts."},
}


# ============================================================== tabs
_PROJECT_TABS = [t[1] for t in mk.TABS]


def _link_tabs(labels, current, label, flush=False, counts=None, states=None):
    states = states or {}
    counts = counts or {}
    items = ""
    for i, l in enumerate(labels):
        cur = ' aria-current="page"' if l == current else ""
        st = f' data-state="{states[l]}"' if l in states else ""
        c = f'<span class="count">{counts[l]}</span>' if l in counts else ""
        items += f'<a class="tab" href="#{_FRAGS[i % len(_FRAGS)]}"{cur}{st}>{l}{c}</a>'
    return f'<nav aria-label="{label}"><div class="tabs{" tabs--flush" if flush else ""}">{items}</div></nav>'


def _apg_tabs(uid, selected="Log", disabled=()):
    tabs, panels = "", ""
    bodies = {"Log": '<p class="text-mono-xs text-muted">14:27:31  tool  npx playwright test e2e/reconcile-card-statement.spec.ts</p>',
              "Runs": '<p class="text-sm">run-0412 Running on quinn-mbp.local · run-0398 Failed on build-box-02</p>',
              "Artifacts": '<p class="text-sm">e2e/reconcile-card-statement.spec.ts, StatementMatcher.cs</p>',
              "Decisions": '<p class="text-sm">Compare posting dates in the account time zone (a41c9e2)</p>'}
    for name in ["Log", "Runs", "Artifacts", "Decisions"]:
        sel = name == selected
        k = name.lower()
        dis = ' aria-disabled="true"' if name in disabled else ""
        tabs += (f'<button class="tab tab--sm" type="button" role="tab" id="{uid}-tab-{k}" aria-selected="{"true" if sel else "false"}" '
                 f'aria-controls="{uid}-panel-{k}" tabindex="{"0" if sel else "-1"}"{dis}>{name}</button>')
        panels += (f'<div class="mt-4" role="tabpanel" id="{uid}-panel-{k}" aria-labelledby="{uid}-tab-{k}" tabindex="0"{"" if sel else " hidden"}>{bodies[name]}</div>')
    return f'<div style="width: 100%;"><div class="tabs" role="tablist" aria-label="Stage detail">{tabs}</div>{panels}</div>'


def _one_tab(attrs, label="Runs", sm=True):
    return f'<div class="tabs tabs--flush" role="tablist" aria-label="Example {label}"><button class="tab{" tab--sm" if sm else ""}" type="button" role="tab"{attrs}>{label}</button></div>'


def _one_link(attrs, label="Backlog", count=""):
    c = f'<span class="count">{count}</span>' if count else ""
    return f'<a class="tab" href="#states"{attrs}>{label}{c}</a>'


_TABS_STATES = matrix(["Default", "Hover", "Focus", "Active", "Disabled", "Selected / current"], [
    ("Project section link", [_one_link(""), _one_link(' data-state="hover"'), _one_link(' data-state="focus"'), _one_link(' data-state="active"'),
                              _na("Not used: sections a role cannot use are hidden"), _one_link(' aria-current="page"', "Pipeline")]),
    ("Filter link with count", [_one_link("", "Running", "2"), _one_link(' data-state="hover"', "Running", "2"), _one_link(' data-state="focus"', "Running", "2"),
                                _one_link(' data-state="active"', "Running", "2"), _na("—"), _one_link(' aria-current="page"', "All")]),
    ("Stage detail tab (APG)", [_one_tab(' aria-selected="false" tabindex="-1"'), _one_tab(' aria-selected="false" tabindex="-1" data-state="hover"'),
                                _one_tab(' aria-selected="false" data-state="focus"'), _one_tab(' aria-selected="false" tabindex="-1" data-state="active"'),
                                _one_tab(' aria-selected="false" tabindex="-1" aria-disabled="true"', "Artifacts"), _one_tab(' aria-selected="true"', "Log")]),
])

SPECS["tabs"] = {
    "lead": "Underline tabs switch between views of one object. Hewn has two kinds that look the same: navigation tabs, which are links to separate pages, and APG tabs, which swap a panel in place.",
    "readme_variants": "navigation tabs (project sections, status filters with counts); APG tabs (stage detail); bordered, flush",
    "readme_states": "default, hover, focus, active, disabled, selected / current",
    "pills": ["Two semantics, one look"],
    "overview": f"""<p>Choose the semantics by what activating a tab does, not by how it looks.</p>
{table(["Kind", "Where", "Markup", "Pattern"], [
    ["<b>Project sections</b>", "Project header on every project page: " + ", ".join(_PROJECT_TABS), "<code>&lt;nav aria-label=&quot;Project sections&quot;&gt;</code> of <code>&lt;a class=&quot;tab&quot;&gt;</code>, current is <code>aria-current=&quot;page&quot;</code>", "Navigation links. Each tab is its own route with its own URL, history entry and <code>&lt;h1&gt;</code>."],
    ["<b>Status filter</b>", "Projects page: All, Running 2, Paused 1, Blocked 1, Idle 1, Complete 1, Cancelled 1, Archived", "<code>&lt;nav aria-label=&quot;Filter by status&quot;&gt;</code> of links with <code>.count</code>, <code>aria-current=&quot;page&quot;</code>", "Navigation links: the filter is in the URL so it can be shared and survives reload."],
    ["<b>Stage detail</b>", "Project pipeline, under the stage title: Log, Runs, Artifacts, Decisions", "<code>role=&quot;tablist&quot;</code> of <code>&lt;button role=&quot;tab&quot;&gt;</code> with <code>aria-selected</code>, <code>aria-controls</code> and a <code>role=&quot;tabpanel&quot;</code>", "<b>The only APG Tabs in the product.</b> The panels belong to the stage on screen and swap in place."]])}
<p>Use a {page('components/button-group', 'segmented control')} instead for two to four options that change a setting (width, theme), and a {page('components/select')} when there are more options than fit on a phone.</p>""",
    "anatomy": (_link_tabs(["Pipeline", "Backlog", "Running"], "Pipeline", "Anatomy example", counts={"Running": "2"}), [(14, 30), (45, 50), (88, 50), (14, 92), (60, 96)],
                [("Selected tab", "<code>aria-current=\"page\"</code> or <code>aria-selected=\"true\"</code>: default text, medium weight, 2px accent underline."),
                 ("Tab", "<code>.tab</code>: label in <code>--text-body-sm</code>, muted, <code>--space-3</code> inline padding, 44px tall below lg."),
                 ("Count (optional)", "<code>.count</code>: caption size, subtle, tabular, read as part of the name."),
                 ("Underline", "<code>--border-width-thick</code> on the tab, overlapping the list rule by 1px."),
                 ("List rule", "<code>.tabs</code>: hairline bottom border; <code>.tabs--flush</code> drops it where the container already draws one.")]),
    "variants": f"""<h3>Navigation tabs: project sections</h3>
{ex(_link_tabs(_PROJECT_TABS, "Pipeline", "Project sections", flush=True), "Seven links under the project header; <code>.tabs--flush</code> because the header draws the rule. They scroll sideways on phones.")}
<h3>Navigation tabs with counts: status filter</h3>
{ex(_link_tabs(["All", "Running", "Paused", "Blocked", "Idle", "Complete", "Cancelled", "Archived"], "All", "Filter by status", counts={"Running": "2", "Paused": "1", "Blocked": "1", "Idle": "1", "Complete": "1", "Cancelled": "1"}), "Counts are tabular and omitted when they are not meaningful (All, Archived).")}
<h3>APG tabs: stage detail</h3>
{ex(_apg_tabs("tabs-v"), "Small tabs (<code>.tab--sm</code>) with real panels. Only the Log panel is shown; the others are <code>hidden</code> until selected.")}""",
    "sizes": f"""<p>Two sizes that differ only from lg; below lg both are 44px (<code>--target-comfortable</code>) for touch.</p>
{ex(_link_tabs(["Pipeline", "Backlog", "Designs"], "Pipeline", "Medium size example", flush=True) + _one_tab(' aria-selected="true"', "Log"), "Medium: 40px from lg (<code>--control-height-md</code>), for page-level sections. Small, <code>.tab--sm</code>: 32px from lg (<code>--control-height-sm</code>), for tabs inside a pane.")}""",
    "states": f"""<p>Pointer and focus states are forced with <code>data-state</code>; selection uses the real attribute (<code>aria-current=&quot;page&quot;</code> for links, <code>aria-selected=&quot;true&quot;</code> for APG tabs).</p>
{_TABS_STATES}
{themes(_link_tabs(["Pipeline", "Backlog", "Designs"], "Pipeline", "Themed example", flush=True) + '<div class="tabs" role="tablist" aria-label="Themed stage detail"><button class="tab tab--sm" type="button" role="tab" aria-selected="true">Log</button><button class="tab tab--sm" type="button" role="tab" aria-selected="false" tabindex="-1">Runs</button></div>', stack=True)}
{ul(["<b>Active</b> has no separate style; the underline moving is the feedback.",
     "<b>Disabled</b> (<code>aria-disabled=&quot;true&quot;</code>, stays focusable) is for an APG tab whose panel has nothing yet, such as Artifacts before the stage has written any. Navigation tabs are never disabled: a section a role cannot use is not rendered.",
     "<b>Overflow</b>: when tabs do not fit, the list scrolls horizontally with the scrollbar hidden; the selected tab is scrolled into view on load."])}""",
    "responsive": ul([
        "Below <code>--layout-breakpoint-sm</code> (576px): tabs stay one row and scroll sideways (<code>overflow-x: auto</code>, hidden scrollbar); they never wrap or turn into a select. 44px tall. The project header's seven tabs show about four at 360px; the half-visible fifth signals the scroll.",
        "sm (576px) to md (768px): more tabs fit; behaviour is the same.",
        "From lg (992px): heights drop to 40px (medium) and 32px (small) for pointer use; the project header pads the tab row to <code>--space-8</code>.",
        "xl (1200px): unchanged; tabs never stretch to fill the width."]),
    "theming": f"""<p>Tabs read <code>--color-fg-muted</code>, <code>--color-fg-default</code>, <code>--color-accent</code> (underline), <code>--color-border-default</code> (list rule) and <code>--color-fg-disabled</code>. There are no component tokens; to change the underline colour for a surface, override the semantic token in that scope.</p>
<pre><code>/* Tabs on an inverse banner */
.banner--inverse {{ --color-fg-muted: var(--color-fg-inverse); --color-accent: var(--color-focus-ring); }}</code></pre>
<p>In dark the underline uses the lighter dark-theme accent, which keeps its 3:1 against the surface.</p>""",
    "a11y": {
        "pattern": "<p><b>Stage detail</b> follows the <a href=\"https://www.w3.org/WAI/ARIA/apg/patterns/tabs/\">APG Tabs pattern</a> with <b>automatic activation</b>: moving focus with the arrow keys selects the tab and shows its panel, because every panel is already loaded with the stage (the log is streaming, runs and decisions are small). Tabs are <code>&lt;button role=\"tab\"&gt;</code> with a roving <code>tabindex</code>, <code>aria-selected</code> and <code>aria-controls</code>; panels are <code>role=\"tabpanel\"</code>, <code>aria-labelledby</code> their tab, <code>tabindex=\"0\"</code>.</p><p><b>Project sections and status filters are not APG tabs.</b> They are links in a labelled <code>&lt;nav&gt;</code> with <code>aria-current=\"page\"</code>; Tab moves through them and Enter follows them. Giving links <code>role=\"tab\"</code> promises arrow keys and an in-place panel that do not exist.</p>",
        "keys": [(kbd("Tab"), "APG tabs: into the tablist (to the selected tab), then out to the panel. Navigation tabs: through each link in turn."),
                 (kbd("←") + " / " + kbd("→"), "APG tabs: previous / next tab, wrapping; selects it (automatic activation). Disabled tabs are focused but not selected."),
                 (kbd("Home") + " / " + kbd("End"), "APG tabs: first / last tab."),
                 (kbd("Enter"), "Navigation tabs: follows the link. APG tabs: no extra effect (already selected).")],
        "focus": "<p>The shared ring on <code>:focus-visible</code>, drawn around the tab including the underline area. In a scrolling tab row, a focused tab is scrolled fully into view. After a navigation tab is followed, focus goes to the new page's heading.</p>",
        "labelling": "<p>Every tab list has a name: <i>Project sections</i>, <i>Filter by status</i> (on the <code>&lt;nav&gt;</code>), <i>Stage detail</i> (on the <code>tablist</code>). A count reads as part of the tab name (<i>Running 2</i>); if the number needs context, add it visually hidden (<i>Running, 2 projects</i>).</p>",
        "pairs": [("Tab label", "--color-fg-muted", "--color-bg-surface", 4.5), ("Tab label on canvas", "--color-fg-muted", "--color-bg-canvas", 4.5),
                  ("Selected label", "--color-fg-default", "--color-bg-surface", 4.5), ("Selected underline", "--color-accent", "--color-bg-surface", 3),
                  ("Underline on canvas", "--color-accent", "--color-bg-canvas", 3), ("Count", "--color-fg-subtle", "--color-bg-surface", 4.5),
                  ("Focus ring", "--color-focus-ring", "--color-bg-surface", 3)],
        "motion": "<p>Colour changes over <code>--duration-fast</code> and the underline colour over <code>--duration-base</code>; the underline does not slide between tabs. Reduced motion zeroes both.</p>",
        "touch": "<p>44px tall below lg with <code>--space-3</code> inline padding, so even <i>Log</i> is a 44 × 44px target. Sideways scrolling uses the native gesture; no arrow buttons are needed.</p>",
    },
    "content": ul(["One or two words, sentence case, nouns: <i>Pipeline</i>, <i>Design system</i>, <i>Traceability</i>, <i>Runs</i>.",
                   "Keep the same order everywhere; the project header order follows the pipeline (Pipeline, Backlog, Designs, Design system, Decisions, Artifacts, Traceability).",
                   "Counts are bare numbers, never in brackets, and only when they help the choice.",
                   "Do not use tabs for steps in a sequence; that is a {0}.".format(page("components/stepper"))]),
    "dodont": [
        (_one_tab(' aria-selected="true"', "Log"), "Stage detail tabs are buttons with <code>role=\"tab\"</code>, <code>aria-controls</code> and roving <code>tabindex</code>, and arrow keys move between them.",
         '<div class="tabs tabs--flush" role="tablist" aria-label="Broken example"><a class="tab tab--sm" role="tab" href="#states" aria-selected="true">Log</a><a class="tab tab--sm" role="tab" href="#variants" aria-selected="false">Runs</a></div>',
         "The pipeline mocks give links <code>role=\"tab\"</code> and <code>aria-selected</code> with no panel and no arrow keys, and activating one navigates."),
        (_link_tabs(["Pipeline", "Backlog"], "Pipeline", "Correct project sections", flush=True), "Project sections are links with <code>aria-current=\"page\"</code> in a named <code>&lt;nav&gt;</code>.",
         '<div class="tabs tabs--flush" role="tablist" aria-label="Wrong project sections"><a class="tab" role="tab" href="#overview" aria-selected="true">Pipeline</a><a class="tab" role="tab" href="#anatomy" aria-selected="false">Backlog</a></div>',
         "Do not make page-level sections a tablist. Each one is a separate route with its own heading; tab semantics would hide that."),
    ],
    "tokens": [("Label", "--color-fg-muted"), ("Label hover / selected", "--color-fg-default"), ("Underline", "--color-accent"), ("List rule", "--color-border-default"),
               ("Disabled label", "--color-fg-disabled"), ("Count", "--color-fg-subtle"), ("Height below lg / md from lg / sm from lg", "--target-comfortable / --control-height-md / --control-height-sm"),
               ("Padding / gap", "--space-3 / --space-1"), ("Underline width / rule width", "--border-width-thick / --border-width-hairline"),
               ("Label type / selected weight", "--text-body-sm / --font-weight-medium"), ("Transitions", "--duration-fast / --duration-base")],
    "code": {"snippet": """<!-- Navigation tabs: separate pages -->
<nav class="phead__tabs" aria-label="Project sections">
  <div class="tabs tabs--flush">
    <a class="tab" href="/projects/ledgerline" aria-current="page">Pipeline</a>
    <a class="tab" href="/projects/ledgerline/backlog">Backlog</a>
  </div>
</nav>

<!-- APG tabs: panels in place, automatic activation -->
<div class="tabs" role="tablist" aria-label="Stage detail">
  <button class="tab tab--sm" type="button" role="tab" id="t-log" aria-selected="true" aria-controls="p-log">Log</button>
  <button class="tab tab--sm" type="button" role="tab" id="t-runs" aria-selected="false" aria-controls="p-runs" tabindex="-1">Runs</button>
</div>
<div role="tabpanel" id="p-log" aria-labelledby="t-log" tabindex="0">…</div>
<div role="tabpanel" id="p-runs" aria-labelledby="t-runs" tabindex="0" hidden>…</div>""",
             "classes": [("<code>.tabs</code>", "Scrolling row with a hairline rule."), ("<code>.tabs--flush</code>", "No rule; width fits content (inside a header that draws its own)."),
                         ("<code>.tab</code>", "A tab; works on <code>&lt;a&gt;</code> and <code>&lt;button&gt;</code>."), ("<code>.tab--sm</code>", "32px from lg."),
                         ("<code>aria-current=\"page\"</code>", "Current navigation tab."), ("<code>aria-selected=\"true\"</code>", "Selected APG tab."),
                         ("<code>aria-disabled=\"true\"</code>", "Disabled APG tab (still focusable)."), ("<code>.count</code>", "Count after the label."),
                         ("<code>data-state=\"hover|focus|active\"</code>", "Documentation only.")]},
    "sources": {"mocks": [("pages/project-pipeline/default", "project sections and the stage detail tablist"), ("pages/project-pipeline/runs", "Runs tab selected"),
                          ("pages/projects/default", "status filter tabs with counts"), ("pages/backlog/default", "Backlog section current"),
                          ("pages/traceability/default", "last tab current, scrolled into view on phones")],
                "drift": "36px small tabs mapped to 44px below lg and <code>--control-height-sm</code> from lg (logged). The stage detail tabs were links with <code>role=\"tab\"</code> and <code>aria-selected</code> but no <code>aria-controls</code>, no tabpanel, no roving tabindex and no arrow keys, and activating one navigated; they are now real APG tabs (buttons, automatic activation)."},
}


# ============================================================== breadcrumb
_SEP = f'<li aria-hidden="true">{icon("chevron-right")}</li>'


def _crumbs(trail, current, label="Breadcrumb", states=None):
    states = states or {}
    items = ""
    for i, t in enumerate(trail):
        st = f' data-state="{states[t]}"' if t in states else ""
        items += f'<li><a href="#{_FRAGS[i]}"{st}>{t}</a></li>{_SEP}'
    return f'<nav aria-label="{label}"><ol class="breadcrumb">{items}<li aria-current="page">{current}</li></ol></nav>'


SPECS["breadcrumb"] = {
    "lead": "A one-line trail above a project page's title that says where the page sits: Projects, then the project, then any parent, then the page.",
    "readme_variants": "two levels (project header), four levels (increment)",
    "readme_states": "link default, hover, focus, active; current",
    "pills": ["<code>&lt;nav aria-label=\"Breadcrumb\"&gt;</code>"],
    "overview": f"""<p>Breadcrumbs appear only where the hierarchy is deeper than the sidebar shows: inside a project. The {page('components/project-header')} starts with <i>Projects › Ledgerline</i> on every project section; the increment page shows <i>Projects › Ledgerline › Backlog › Increment 7</i>. Top-level pages (Dashboard, Projects, Workers, Audit, Settings) have no breadcrumb: the sidebar's current item already says where you are.</p>
<p>The trail is navigation, not a history: it lists ancestors, never the pages you came through. The last item is the current page and is not a link.</p>""",
    "anatomy": (_crumbs(["Projects", "Ledgerline", "Backlog"], "Increment 7", "Anatomy breadcrumb"), [(10, 25), (27, 25), (68, 25), (90, 25)],
                [("Ancestor link", "Plain <code>&lt;a&gt;</code> inheriting the subtle caption colour; underlines on hover."),
                 ("Separator", "A 12px <code>chevron-right</code> in its own <code>&lt;li aria-hidden=\"true\"&gt;</code>; never typed as <i>&gt;</i> or <i>/</i>."),
                 ("Parent", "As many levels as the route has; Hewn's deepest is four."),
                 ("Current page", "<code>&lt;li aria-current=\"page\"&gt;</code>, muted (one step stronger than the links), not a link.")]),
    "variants": f"""{ex(_crumbs(["Projects"], "Ledgerline"), "Two levels: the start of every project header.")}
{ex(_crumbs(["Projects", "Ledgerline", "Backlog"], "Increment 7"), "Four levels: an increment, reached from the backlog.")}
<p>There is no collapsed variant with an ellipsis menu: four short levels fit at 360px on two lines at most. If a future route goes deeper, collapse the middle levels into a {page('components/menu')} rather than truncating names.</p>""",
    "sizes": NA("Breadcrumbs have one size: caption type (12px) with 12px separators."),
    "states": f"""<p>Pointer and focus states are forced with <code>data-state</code>; the current item uses the real <code>aria-current=&quot;page&quot;</code>.</p>
{matrix(["Default", "Hover", "Focus", "Active", "Current", "Disabled"], [
    ("Ancestor link", [_crumbs(["Projects"], "Ledgerline", "State default"), _crumbs(["Projects"], "Ledgerline", "State hover", {"Projects": "hover"}),
                       _crumbs(["Projects"], "Ledgerline", "State focus", {"Projects": "focus"}), _crumbs(["Projects"], "Ledgerline", "State active", {"Projects": "active"}),
                       _na("The last item, Ledgerline, in every cell"), _na("Never disabled; every ancestor exists")])])}
{themes(_crumbs(["Projects", "Ledgerline", "Backlog"], "Increment 7", "Themed breadcrumb"), stack=True)}
<p><b>Active</b> has no separate style. The current item is not interactive: no hover, no focus.</p>""",
    "responsive": ul([
        "Below <code>--layout-breakpoint-sm</code> (576px): the trail wraps (<code>flex-wrap</code>) onto a second line rather than truncating; at 360px <i>Projects › Ledgerline › Backlog › Increment 7</i> fits on one line, and long project names wrap.",
        "sm to lg (576–992px): one line.",
        "From lg (992px): unchanged; it aligns with the page padding (<code>--space-8</code>) because it sits inside the project header or the page's <code>.pad</code>.",
        "Link targets are 16px tall; see Touch for why that is acceptable."]),
    "theming": "<p>The breadcrumb uses <code>--color-fg-subtle</code> for links and separators, <code>--color-fg-muted</code> for the current page and <code>--color-fg-default</code> on hover. In dark the order is the same; subtle is lightened enough to keep 4.5:1 on the dark surface. Override those semantic tokens in a scope to re-skin it; the component has no tokens of its own.</p>",
    "a11y": {
        "pattern": "<p>The <a href=\"https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/\">APG Breadcrumb pattern</a>: a <code>&lt;nav aria-label=\"Breadcrumb\"&gt;</code> containing an ordered list; the current page has <code>aria-current=\"page\"</code>. Separators are <code>aria-hidden</code> so they are not read and the list length counts only real levels.</p>",
        "keys": [(kbd("Tab"), "Moves through the ancestor links; the current item is skipped."), (kbd("Enter"), "Follows the link.")],
        "focus": "<p>The shared ring on <code>:focus-visible</code> around the link text. Because the links are small, the ring's 2px offset keeps it clear of the separators.</p>",
        "labelling": "<p>The landmark is named <i>Breadcrumb</i>, so a screen reader lists it as <i>Breadcrumb navigation</i>. Link text is the page name exactly as its <code>&lt;h1&gt;</code> says it.</p>",
        "pairs": [("Ancestor link", "--color-fg-subtle", "--color-bg-surface", 4.5), ("Ancestor link on canvas", "--color-fg-subtle", "--color-bg-canvas", 4.5),
                  ("Current page", "--color-fg-muted", "--color-bg-surface", 4.5), ("Hovered link", "--color-fg-default", "--color-bg-surface", 4.5),
                  ("Focus ring", "--color-focus-ring", "--color-bg-surface", 3)],
        "motion": "<p>No motion: link colour changes on hover are instant.</p>",
        "touch": "<p>Links are text-height (about 16px), below 24px, so they rely on the WCAG 2.5.8 inline exception and on spacing: each link has at least 24px of clear target space thanks to the separators and gaps. Every ancestor is also reachable through larger targets: the sidebar's Projects link and the project tabs.</p>",
    },
    "content": ul(["Use the destination page's own title: <i>Projects</i>, <i>Ledgerline</i>, <i>Backlog</i>, <i>Increment 7</i>.",
                   "Do not add <i>Home</i> or <i>Dashboard</i> at the start; the trail starts at the top-level section.",
                   "The last item matches the <code>&lt;h1&gt;</code> below it.", "No trailing separator after the current page."]),
    "dodont": [
        (_crumbs(["Projects"], "Ledgerline", "Do separators"), "Separators are aria-hidden chevron icons, so a screen reader hears <i>Projects, link; Ledgerline, current page</i>.",
         '<nav aria-label="Typed separator example"><ol class="breadcrumb"><li><a href="#overview">Projects</a></li><li>&gt;</li><li aria-current="page">Ledgerline</li></ol></nav>',
         "A typed <i>&gt;</i> in its own list item is read as <i>greater than</i> and counted as a level."),
        (_crumbs(["Projects", "Ledgerline"], "Backlog", "Do current"), "The current page is plain text with <code>aria-current=\"page\"</code>.",
         '<nav aria-label="Linked current example"><ol class="breadcrumb"><li><a href="#overview">Projects</a></li>' + _SEP + '<li><a href="#anatomy">Ledgerline</a></li>' + _SEP + '<li><a href="#variants">Backlog</a></li></ol></nav>',
         "Do not link the current page to itself; it adds a tab stop that goes nowhere."),
    ],
    "tokens": [("Link and separator", "--color-fg-subtle"), ("Current page", "--color-fg-muted"), ("Link hover", "--color-fg-default"),
               ("Type", "--text-caption"), ("Separator icon", "--size-icon-xs"), ("Gap", "--space-1")],
    "code": {"snippet": """<nav aria-label="Breadcrumb">
  <ol class="breadcrumb">
    <li><a href="/projects">Projects</a></li>
    <li aria-hidden="true"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true">…chevron-right…</svg></li>
    <li><a href="/projects/ledgerline">Ledgerline</a></li>
    <li aria-hidden="true">…</li>
    <li aria-current="page">Backlog</li>
  </ol>
</nav>""",
             "classes": [("<code>.breadcrumb</code>", "On the <code>&lt;ol&gt;</code>: wrapping row, caption type, subtle colour; shrinks icons to 12px."),
                         ("<code>&lt;li aria-hidden=\"true\"&gt;</code>", "Separator item."), ("<code>aria-current=\"page\"</code>", "Current page item."),
                         ("<code>data-state=\"hover|focus\"</code>", "Documentation only.")]},
    "sources": {"mocks": [("pages/project-pipeline/default", "Projects › Ledgerline in the project header"), ("pages/increment/default", "four levels"),
                          ("pages/backlog/default", "project header breadcrumb"), ("pages/increment/error", "breadcrumb kept on an error state")],
                "drift": "none; the mocks already used a labelled <code>&lt;nav&gt;</code>, an ordered list, hidden separators and <code>aria-current</code>."},
}


# ============================================================== pagination
def _pg_link(n, frag="states", current=False, state=""):
    cur = ' aria-current="page"' if current else ""
    st = f' data-state="{state}"' if state else ""
    return f'<a class="pagination__page" href="#{frag}"{cur}{st}><span class="visually-hidden">Page </span>{n}</a>'


def _pg_prev(disabled=False, state=""):
    st = f' data-state="{state}"' if state else ""
    if disabled:
        return '<a class="pagination__page" role="link" aria-disabled="true">Previous</a>'
    return f'<a class="pagination__page" href="#states"{st}>Previous</a>'


def _pg_next(state=""):
    st = f' data-state="{state}"' if state else ""
    return f'<a class="pagination__page" href="#variants"{st}>Next</a>'


def _pagination(page_n=1, label="Pagination, audit log", size=False):
    first = page_n == 1
    nums = [1, 2, 3] if page_n <= 3 else [1, page_n - 1, page_n, page_n + 1]
    links = ""
    prev_n = None
    for n in nums:
        if prev_n is not None and n - prev_n > 1:
            links += '<span class="pagination__page" aria-hidden="true">…</span>'
        links += _pg_link(n, _FRAGS[n % len(_FRAGS)], n == page_n)
        prev_n = n
    links += '<span class="pagination__page" aria-hidden="true">…</span>' + _pg_link(25, "tokens", page_n == 25)
    start, end = (page_n - 1) * 10 + 1, min(page_n * 10, 248)
    sz = ('<label class="inline-label text-sm">Per page <select class="select select--auto input--sm"><option selected>10</option><option>25</option><option>50</option></select></label>'
          if size else "")
    return (f'<nav class="pagination" aria-label="{label}"><p class="tabular">Showing {start}–{end} of 248 entries</p>{sz}'
            f'<div class="pagination__pages">{_pg_prev(first)}<span class="sm-only"><span class="pagination__pages">{links}</span></span>'
            f'<span class="sm-hide tabular">Page {page_n} of 25</span>{_pg_next()}</div></nav>')


def _pg_simple(page_n=1, label="Pagination, simple"):
    return (f'<nav class="pagination" aria-label="{label}"><p class="tabular">Page {page_n} of 25</p>'
            f'<div class="pagination__pages">{_pg_prev(page_n == 1)}{_pg_next()}</div></nav>')


SPECS["pagination"] = {
    "lead": "Pagination moves through a long, ordered list a page at a time. It is in the core set but no mock uses it yet; the audit log is the first list that needs it.",
    "readme_variants": "numbered with first, last and ellipsis; simple previous / next; with page size",
    "readme_states": "default, hover, focus, active, disabled, current",
    "status": "proposed",
    "pills": ["Not yet in the mocks", "<code>&lt;nav aria-label=\"Pagination\"&gt;</code>"],
    "overview": f"""<p><b>No Hewn mock paginates today.</b> Every list in the mocks is short: 7 projects, 4 workers, 12 increments, 5 decisions, and the {mock('pages/audit/default', '10 audit entries')}. The audit log is the exception waiting to happen: L2-044 records every sign-in, direction, pause, resume, cancel, stop, token and merge, newest first, and entries are never deleted, so it grows without bound. This page specifies the component that list will use, built from the CSS already in <code>components.css</code>.</p>
{ul(["Use pagination for <b>append-only records people search back through</b>: the audit log, a project's run history.",
     "Do not paginate <b>live streams</b> (the worker log, the event feed); they follow the newest line and offer <i>Jump to latest</i>.",
     "Do not paginate <b>short working lists</b> (projects, workers, backlog); filter them instead.",
     "Pagination sits below the table, after the last row, and keeps the filters above in the {0}.".format(page("components/page-header"))])}""",
    "anatomy": (_pagination(1, "Anatomy pagination"), [(14, 50), (52, 50), (60, 50), (80, 50), (96, 50)],
                [("Range", "<i>Showing 1–10 of 248 entries</i>: body-small, muted, tabular."),
                 ("Previous", "<code>.pagination__page</code> link; on page 1 it is <code>aria-disabled=\"true\"</code> with no <code>href</code>."),
                 ("Current page", "<code>aria-current=\"page\"</code>: raised background, strong edge, medium weight."),
                 ("Ellipsis", "An <code>aria-hidden</code> <i>…</i> between non-adjacent pages."),
                 ("Next and last", "The last page (25) is always shown, so the length is visible.")]),
    "variants": f"""<h3>Numbered</h3>
{ex(_pagination(1), "Page 1 of 25. From sm: first, two neighbours, ellipsis, last; below sm: <i>Page 1 of 25</i>. Previous is disabled.", cls="ds-example__canvas--stack")}
{ex(_pagination(12, "Pagination, page 12"), "Page 12, from sm: first, ellipsis, 11 12 13, ellipsis, last.", cls="ds-example__canvas--stack")}
<h3>Simple</h3>
{ex(_pg_simple(), "Previous and next with the position in words. Use it when the total is unknown or the list is short (run history).", cls="ds-example__canvas--stack")}
<h3>With page size</h3>
{ex(_pagination(1, "Pagination with page size", size=True), "A native select for 10, 25 or 50 per page; changing it returns to page 1 and keeps the filters.", cls="ds-example__canvas--stack")}""",
    "sizes": NA("Pagination has one size: 44px targets below lg, 32px from lg (see Responsive)."),
    "states": f"""<p>Pointer and focus states are forced with <code>data-state</code>; disabled and current use the real attributes.</p>
{matrix(["Default", "Hover", "Focus", "Active", "Disabled", "Current"], [
    ("Page number", [_pg_link(2), _pg_link(2, state="hover"), _pg_link(2, state="focus"), _pg_link(2, state="active"), _na("Never: pages that do not exist are not shown"), _pg_link(1, current=True)]),
    ("Previous / next", [_pg_next(), _pg_next("hover"), _pg_next("focus"), _pg_next("active"), _pg_prev(True), _na("—")]),
])}
{themes(_pagination(12, "Themed pagination"), stack=True)}
{ul(["<b>Disabled</b> Previous on page 1 and Next on the last page keep their place (so the row does not jump) and use <code>aria-disabled=&quot;true&quot;</code> without <code>href</code>, so they are announced but not followed.",
     "<b>Active</b> has no separate style; the page load is the feedback.",
     "<b>Loading</b> the next page keeps the bar and replaces the rows with skeleton rows; the range text updates when the rows arrive."])}""",
    "responsive": ul([
        "Below <code>--layout-breakpoint-sm</code> (576px): the numbered pages are hidden and replaced by <i>Page 1 of 25</i> between Previous and Next (<code>.sm-only</code> / <code>.sm-hide</code>); the range text wraps above.",
        "From sm (576px): numbered pages show; the range sits left and the controls right (<code>justify-content: space-between</code>), wrapping if the table is narrow.",
        "Below lg targets are 44 × 44px (<code>--target-comfortable</code>); from lg (992px) they are 32px (<code>--control-height-sm</code>).",
        "xl (1200px): unchanged; at most seven page items are ever shown."]),
    "theming": "<p>Pagination reads <code>--color-fg-muted</code> for labels, <code>--color-bg-subtle</code> on hover, <code>--color-bg-surface-raised</code> and <code>--color-border-strong</code> for the current page and <code>--color-fg-disabled</code> for disabled ends. The current page's edge uses the strong border so it passes 3:1 as a boundary in both themes; in dark the raised fill steps up from the canvas.</p>",
    "a11y": {
        "pattern": "<p>No APG widget applies; pagination is a set of links in a <code>&lt;nav&gt;</code> landmark (<a href=\"https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/\">APG landmark regions</a>) named for the list it pages, with <code>aria-current=\"page\"</code> on the current page. Links, not buttons: each page has a URL (<code>/audit?page=12</code>) that can be shared and survives reload.</p>",
        "keys": [(kbd("Tab"), "Previous, each page, Next, in order; disabled ends are skipped (no href)."), (kbd("Enter"), "Loads that page.")],
        "focus": "<p>The shared ring on <code>:focus-visible</code>. After a page loads, focus moves to the table caption (<i>Audit log, newest first, page 12 of 25</i>) so keyboard and screen-reader users start at the new rows, not at the bottom of the page.</p>",
        "labelling": "<p>Name the landmark for the list: <i>Pagination, audit log</i>. Page links read <i>Page 2</i> (the word <i>Page</i> is visually hidden). The range text is plain text; it is not a live region, because focus moving to the caption already announces the change.</p>",
        "pairs": [("Page label", "--color-fg-muted", "--color-bg-canvas", 4.5), ("Hovered page", "--color-fg-default", "--color-bg-subtle", 4.5),
                  ("Current page", "--color-fg-default", "--color-bg-surface-raised", 4.5), ("Current page edge", "--color-border-strong", "--color-bg-canvas", 3),
                  ("Focus ring", "--color-focus-ring", "--color-bg-canvas", 3)],
        "motion": "<p>No motion beyond the hover background change.</p>",
        "touch": "<p>44 × 44px targets below lg with <code>--space-1</code> gaps; numbered pages are hidden on phones so the remaining two targets are large and far apart.</p>",
    },
    "content": ul(["Range: <i>Showing 1–10 of 248 entries</i> with an en dash and the list's own noun (<i>entries</i>, <i>runs</i>).",
                   "Controls: <i>Previous</i> and <i>Next</i>, in words. No <i>«</i>, <i>»</i> or bare arrows.",
                   "Position on phones: <i>Page 12 of 25</i>.", "Numbers are tabular so the bar does not shift between pages."]),
    "dodont": [
        (_pg_simple(1, "Do pagination ends"), "On page 1, Previous stays in place, disabled, so Next does not jump under the thumb.",
         '<nav class="pagination" aria-label="Missing previous example"><p class="tabular">Page 1 of 25</p><div class="pagination__pages">' + _pg_next() + "</div></nav>",
         "Do not remove Previous on the first page; the controls shift and people tap the wrong one."),
        (_pagination(1, "Do audit pagination"), "Page the audit log, whose entries are kept forever.",
         '<nav class="pagination" aria-label="Paginated log example"><p class="tabular">Lines 1–50 of 1,204</p><div class="pagination__pages">' + _pg_prev(True) + _pg_next() + "</div></nav>",
         "Do not page the live worker log. It follows the newest line; scrolled up, it offers <i>12 new lines — Jump to latest</i>."),
    ],
    "tokens": [("Label", "--color-fg-muted"), ("Hover background / label", "--color-bg-subtle / --color-fg-default"),
               ("Current background / edge", "--color-bg-surface-raised / --color-border-strong"), ("Disabled label", "--color-fg-disabled"),
               ("Target below lg / from lg", "--target-comfortable / --control-height-sm"), ("Radius", "--radius-md"),
               ("Type", "--text-body-sm"), ("Gaps", "--space-1 / --space-3"), ("Block padding", "--space-4")],
    "code": {"snippet": """<nav class="pagination" aria-label="Pagination, audit log">
  <p class="tabular">Showing 1–10 of 248 entries</p>
  <div class="pagination__pages">
    <a class="pagination__page" role="link" aria-disabled="true">Previous</a>
    <span class="sm-only"><span class="pagination__pages">
      <a class="pagination__page" href="/audit?page=1" aria-current="page"><span class="visually-hidden">Page </span>1</a>
      <a class="pagination__page" href="/audit?page=2"><span class="visually-hidden">Page </span>2</a>
      <span class="pagination__page" aria-hidden="true">…</span>
      <a class="pagination__page" href="/audit?page=25"><span class="visually-hidden">Page </span>25</a>
    </span></span>
    <span class="sm-hide tabular">Page 1 of 25</span>
    <a class="pagination__page" href="/audit?page=2">Next</a>
  </div>
</nav>""",
             "classes": [("<code>.pagination</code>", "The bar: range left, controls right, wraps."), ("<code>.pagination__pages</code>", "The row of controls."),
                         ("<code>.pagination__page</code>", "A page, Previous, Next or the ellipsis."), ("<code>aria-current=\"page\"</code>", "Current page."),
                         ("<code>aria-disabled=\"true\"</code> (no href)", "Disabled end."), ("<code>.sm-only</code> / <code>.sm-hide</code>", "Numbered pages from sm; <i>Page n of m</i> below."),
                         ("<code>data-state=\"hover|focus|active\"</code>", "Documentation only.")]},
    "sources": {"mocks": [("pages/audit/default", "the 10-entry audit log that will need it"), ("pages/audit/loading", "skeleton rows reused while a page loads"),
                          ("pages/project-pipeline/runs", "run history, a candidate for the simple variant")],
                "drift": "none: the component is specified from the core set and the existing <code>.pagination</code> CSS; it has no mock yet. Add an audit-log mock state with 248 entries when the next mock round runs."},
}


# ============================================================== stepper
_STAGES = mk.STAGES


def _stage(n, name, st, dur="", current=False, state="", live=None):
    cur = ' aria-current="step"' if current else ""
    ds = f' data-state="{state}"' if state else ""
    skip = " stage__name--skip" if st == "Skipped" else ""
    d = f'<span class="stage__dur tabular">{dur}</span>' if dur else ""
    lv = (f'<span class="stage__live"><span class="stage__live-step">{live[0]}</span><span class="stage__live-line">{live[1]}</span></span>' if live else "")
    return (f'<a class="stage" href="#{_FRAGS[n % len(_FRAGS)]}"{cur}{ds}><span class="stage__row">{status_icon(st, "icon--sm")}<span class="stage__n">{n}</span>'
            f'<span class="stage__name{skip}">{name}</span>{d}</span><span class="visually-hidden">{st}</span>{lv}</a>')


def _stage_list(statuses, selected, live=None, label="Pipeline"):
    items = ""
    for (n, name, _s, _o, dur), st in zip(_STAGES, statuses):
        show_dur = dur if st in ("Succeeded", "Running", "Failed", "Paused", "Cancelled") else "—"
        items += f"<li>{_stage(n, name, st, show_dur, n == selected, live=live if n == 10 else None)}</li>"
    return f'<ol class="stages" aria-label="{label}">{items}</ol>'


def _one_stage(st="Succeeded", current=False, state="", name="Estimates", n=9, dur="5:37"):
    return f'<ol class="stages" aria-label="Stage example" style="min-width: 12rem;"><li>{_stage(n, name, st, dur, current, state)}</li></ol>'


_STEP_WORDS = {"ok": "Done", "run": "In progress", "paused": "Paused", "fail": "Failed", "": "Not started"}


def _steps(tone="run", sub="iteration 3 of 10", label="Increment steps", current=1, fail_at=None):
    names = ["Tests written", "Implement", "Video", "Pull request", "Merge"]
    cells = ""
    for i, s in enumerate(names):
        bar = "ok" if i < current else (tone if i == current else "")
        cur = ' aria-current="step"' if i == current else ""
        lab = "steps__label steps__label--now" if i == current else "steps__label"
        chk = icon("check", "icon--xs s-icon--ok") if i < current else ""
        subl = f'<span class="steps__sub">{sub}</span>' if i == current and sub else ""
        cells += (f'<li{cur}><div class="steps__bar{(" steps__bar--" + bar) if bar else ""}"></div><div class="{lab}">{chk}<span class="truncate">{s}</span>'
                  f'<span class="visually-hidden">, {_STEP_WORDS[bar]}</span></div>{subl}</li>')
    return f'<ol class="steps" aria-label="{label}">{cells}</ol>'


_LIVE = ("Implementing · iteration 3 of 10", "npx playwright test e2e/reconcile-card-statement.spec.ts")
_ST_DEFAULT = ["Succeeded"] * 10 + ["Running"]
_ST_PAST = ["Succeeded"] * 3 + ["Running"] + ["Pending"] * 7
_ST_FEATURE = ["Skipped", "Succeeded", "Skipped", "Skipped", "Skipped", "Succeeded", "Skipped", "Succeeded", "Succeeded", "Succeeded", "Succeeded"]
_ST_BLOCKED = ["Succeeded"] * 5 + ["Failed"] + ["Pending"] * 5

_STAGE_MATRIX = matrix(["Default", "Hover", "Focus", "Active", "Current", "Disabled"], [
    ("Succeeded", [_one_stage(), _one_stage(state="hover"), _one_stage(state="focus"), _one_stage(state="active"), _one_stage(current=True), _na("Never: every stage can be opened")]),
    ("Running", [_one_stage("Running", name="Increments", n=10, dur="3:12:48"), _one_stage("Running", state="hover", name="Increments", n=10, dur="3:12:48"),
                 _one_stage("Running", state="focus", name="Increments", n=10, dur="3:12:48"), _one_stage("Running", state="active", name="Increments", n=10, dur="3:12:48"),
                 _one_stage("Running", True, name="Increments", n=10, dur="3:12:48"), _na("—")]),
    ("Failed", [_one_stage("Failed", name="Requirements", n=5, dur="11:44"), _one_stage("Failed", state="hover", name="Requirements", n=5, dur="11:44"),
                _one_stage("Failed", state="focus", name="Requirements", n=5, dur="11:44"), _one_stage("Failed", state="active", name="Requirements", n=5, dur="11:44"),
                _one_stage("Failed", True, name="Requirements", n=5, dur="11:44"), _na("—")]),
    ("Skipped", [_one_stage("Skipped", name="Stack", n=4, dur="—"), _one_stage("Skipped", state="hover", name="Stack", n=4, dur="—"),
                 _one_stage("Skipped", state="focus", name="Stack", n=4, dur="—"), _one_stage("Skipped", state="active", name="Stack", n=4, dur="—"),
                 _one_stage("Skipped", True, name="Stack", n=4, dur="—"), _na("—")]),
])

SPECS["stepper"] = {
    "lead": "Steppers show where work is in a fixed sequence. Hewn has two: the eleven-stage pipeline list you can open stage by stage, and the five-step progress bar of an increment.",
    "readme_variants": "pipeline stage list (vertical, horizontal scrolling, rail); progress steps (run, paused, failed)",
    "readme_states": "default, hover, focus, active, current; pending, running, succeeded, failed, paused, skipped, cancelled",
    "pills": ["<code>&lt;ol&gt;</code> + <code>aria-current=\"step\"</code>"],
    "overview": f"""<p><b>Pipeline stage list</b> (<code>.stages</code>): the eleven stages every direction runs, Bootstrap to Increments. Each stage is a link that opens its detail beside the list, with its number, name, duration and a status icon plus hidden word. It is the project page's main navigation and changes shape with the screen (L2-046).</p>
<p><b>Progress steps</b> (<code>.steps</code>): five bars under the current increment — Tests written, Implement, Video, Pull request, Merge — with the step in progress labelled (<i>iteration 3 of 10</i>). They are read-only: progress, not navigation.</p>
<p>Use the {page('components/pipeline-strip')} for a ten-segment summary of the same stages in a list row or tile, and a {page('components/timeline')} for what happened, in order, with times.</p>""",
    "anatomy": (_frame(_stage_list(["Succeeded", "Succeeded", "Running"], 2, label="Anatomy pipeline"), "18rem"),
                [(6, 70), (14, 70), (30, 70), (84, 70), (6, 88)],
                [("Status icon", "16px status icon (check, spinner, cross, pause, dashed, slash); the word is visually hidden after the name."),
                 ("Number", "<code>.stage__n</code>, code type, subtle: 0 to 10."),
                 ("Name", "<code>.stage__name</code>, truncates; skipped stages are struck through and subtle."),
                 ("Duration", "<code>.stage__dur</code>, tabular, from lg only; <i>—</i> for stages that have not run."),
                 ("Current marker", "<code>aria-current=\"step\"</code>: accent edge (left in the column, bottom in the row) and raised background.")]),
    "variants": f"""<h3>Pipeline stage list</h3>
{ex('<div style="width: 100%; max-width: var(--layout-rail-pipeline);">' + _stage_list(_ST_DEFAULT, 10, _LIVE) + "</div>", "Ledgerline: ten stages succeeded, Increments running and selected, with its live step and last command (from lg).")}
{ex('<div style="width: 100%; max-width: var(--layout-rail-pipeline);">' + _stage_list(_ST_FEATURE, 9, label="Pipeline, feature direction") + "</div>", "Northwind Ops feature direction: skipped stages are struck through; Estimates is open.")}
<h3>Progress steps</h3>
{ex('<div style="width: 100%;">' + _steps() + "</div>", "Increment 7 of 12 · Reconcile a card statement: tests written, implementing (iteration 3 of 10).", cls="ds-example__canvas--stack")}
{ex('<div style="width: 100%;">' + _steps("paused", "iteration 1 of 10", "Increment steps, paused") + "</div>", "Kiln Booking, Increment 9 of 11 · Reschedule a firing: paused at the budget.", cls="ds-example__canvas--stack")}
{ex('<div style="width: 100%;">' + _steps("fail", "blocked after 10 iterations", "Increment steps, failed") + "</div>", "An increment blocked in Implement: the bar is red and the sub-label says why.", cls="ds-example__canvas--stack")}""",
    "sizes": NA("Both steppers have one size; the stage list changes layout, not size, with the breakpoint."),
    "states": f"""<p>Each stage combines a <b>status</b> (from the run) with an <b>interaction state</b>. Pointer and focus states are forced with <code>data-state</code>; the open stage uses the real <code>aria-current=&quot;step&quot;</code>.</p>
{_STAGE_MATRIX}
<p>Paused, Pending and Cancelled stages follow the same rows with their own icons (pause, dashed circle, ban).</p>
<h3>Where you are vs where the pipeline is</h3>
<p><code>aria-current=&quot;step&quot;</code> marks the stage whose detail is open: where the reader is in the sequence. The running stage is told by its status word, not by <code>aria-current</code>. Usually they are the same stage; on Tidewater, below, stage 2 is open while stage 3 runs.</p>
{ex('<div style="width: 100%; max-width: var(--layout-rail-pipeline);">' + _stage_list(_ST_PAST, 2, label="Pipeline, earlier stage open") + "</div>", "Tidewater: Designs (2) open and marked current; Design system (3) Running.")}
{themes('<ol class="stages" aria-label="Themed pipeline">' + "".join("<li>" + _stage(n, nm, s, d, n == 5) + "</li>" for n, nm, s, d in [(4, "Stack", "Succeeded", "1:58"), (5, "Requirements", "Failed", "11:44"), (6, "Scaffold", "Pending", "—")]) + "</ol>" + _steps(label="Themed increment steps"), stack=True)}""",
    "responsive": ul([
        "Below <code>--layout-breakpoint-sm</code> (576px): the stage list is a <b>vertical list</b> above the stage detail, full width, accent edge on the left (L2-046 AC1). Durations and the live line are hidden.",
        "sm (576px) to lg (992px): a <b>horizontal, scrollable stepper</b> above the detail: each stage 11rem wide, accent edge on the bottom, bleeding to the screen edge (L2-046 AC2).",
        "From lg (992px): a <b>vertical rail</b> beside the detail (<code>.split--pipeline</code>, 18rem, then <code>--layout-rail-pipeline</code> 20rem from xl 1200px) with durations and, on the running stage, the live step and last command (L2-046 AC3).",
        "Progress steps stay one row of five at every width; the sub-label (<i>iteration 3 of 10</i>) shows from sm, and step names truncate on phones."]),
    "theming": "<p>Stages use <code>--color-border-default</code> for the resting edge, <code>--color-accent</code> for the current edge, <code>--color-bg-surface-raised</code> for the current fill and <code>--color-bg-subtle</code> on hover. Progress bars use the status solids: <code>--color-success-solid</code>, <code>--color-accent</code>, <code>--color-warning-solid</code>, <code>--color-danger-icon</code>, on a <code>--color-border-default</code> track. In dark the raised fill lifts the current stage above the canvas, and the solids are the lighter dark-theme values, so the bars keep 3:1 against the card.</p>",
    "a11y": {
        "pattern": "<p>No APG widget; both are ordered lists (<code>&lt;ol&gt;</code>) with an <code>aria-label</code>, and the current item uses <a href=\"https://www.w3.org/TR/wai-aria-1.2/#aria-current\"><code>aria-current=\"step\"</code></a>. The stage list's items are links (each stage has its own URL); the progress steps are static list items. Status is always an icon plus a word, never colour alone (L2-030).</p>",
        "keys": [(kbd("Tab"), "Stage list: through each stage link, 0 to 10. Progress steps: not focusable."), (kbd("Enter"), "Opens that stage's detail; focus moves to its heading (<i>9 Estimates</i>).")],
        "focus": "<p>The shared ring around the stage. In the horizontal stepper (sm–lg) a focused stage is scrolled into view, and on load the current stage is scrolled into view so the running stage is not off screen.</p>",
        "labelling": "<p>Lists are named <i>Pipeline</i> and <i>Increment steps</i>. A stage reads <i>9 Estimates 5:37 Succeeded, current step</i>. Each progress step reads its name and state (<i>Implement, In progress, current step</i>; <i>Video, Not started</i>). The live line on the running stage is not a live region; the log below is.</p>",
        "pairs": [("Stage name", "--color-fg-default", "--color-bg-canvas", 4.5), ("Number and duration", "--color-fg-subtle", "--color-bg-canvas", 4.5),
                  ("Current stage name", "--color-fg-default", "--color-bg-surface-raised", 4.5), ("Live step", "--color-fg-accent", "--color-bg-surface-raised", 4.5),
                  ("Current edge", "--color-accent", "--color-bg-canvas", 3), ("Done bar", "--color-success-solid", "--color-bg-surface", 3),
                  ("Running bar", "--color-accent", "--color-bg-surface", 3), ("Paused bar", "--color-warning-solid", "--color-bg-surface", 3),
                  ("Failed bar", "--color-danger-icon", "--color-bg-surface", 3), ("Focus ring", "--color-focus-ring", "--color-bg-canvas", 3)],
        "motion": "<p>The running stage's icon spins (<code>.icon--spin</code>, <code>--duration-spin</code>); hover backgrounds fade over <code>--duration-fast</code>. Reduced motion stops the spinner; the word <i>Running</i> still says it.</p>",
        "touch": "<p>Each stage is a full-width row at least 44px tall below lg, and an 11rem by 44px cell in the horizontal stepper, scrolled with the native gesture.</p>",
    },
    "content": ul(["Stage names are fixed: Bootstrap, Idea, Designs, Design system, Stack, Requirements, Scaffold, Detailed designs, User journeys, Estimates, Increments. Numbered from 0.",
                   "Durations are <i>m:ss</i> or <i>h:mm:ss</i>, tabular; <i>—</i> when a stage has not run.",
                   "Progress step names are nouns or short verb phrases: <i>Tests written</i>, <i>Implement</i>, <i>Video</i>, <i>Pull request</i>, <i>Merge</i>.",
                   "The sub-label says how far into the current step: <i>iteration 3 of 10</i>, <i>blocked after 10 iterations</i>."]),
    "dodont": [
        (_steps(label="Do steps"), "The current step has <code>aria-current=\"step\"</code> and every step carries a hidden state word.",
         '<ol class="steps" aria-label="Dont steps"><li><div class="steps__bar steps__bar--ok"></div><div class="steps__label"><span class="truncate">Tests written</span></div></li><li><div class="steps__bar steps__bar--run"></div><div class="steps__label steps__label--now"><span class="truncate">Implement</span></div></li><li><div class="steps__bar"></div><div class="steps__label"><span class="truncate">Video</span></div></li><li><div class="steps__bar"></div><div class="steps__label"><span class="truncate">Pull request</span></div></li><li><div class="steps__bar"></div><div class="steps__label"><span class="truncate">Merge</span></div></li></ol>',
         "In the pipeline and dialog mocks the state is only the bar colour and a styling class; a screen reader hears five names and nothing about progress."),
        (_one_stage("Skipped", name="Stack", n=4, dur="—"), "Skipped stages keep their place, struck through, with the word <i>Skipped</i>.",
         '<ol class="stages" aria-label="Dont stages" style="min-width: 12rem;"><li>' + _stage(5, "Requirements", "Succeeded", "11:44") + "</li><li>" + _stage(7, "Detailed designs", "Succeeded", "22:16") + "</li></ol>",
         "Do not drop skipped stages from the list; the numbers then jump (5, 7) and the reader cannot tell what was skipped."),
    ],
    "tokens": [("Resting edge / current edge", "--color-border-default / --color-accent"), ("Current fill / hover fill", "--color-bg-surface-raised / --color-bg-subtle"),
               ("Name / number and duration", "--color-fg-default / --color-fg-subtle"), ("Live step", "--color-fg-accent"),
               ("Bars: done / running / paused / failed / track", "--color-success-solid / --color-accent / --color-warning-solid / --color-danger-icon / --color-border-default"),
               ("Edge width", "--border-width-thick"), ("Stage padding", "--space-2-5 / --space-3"), ("Live line indent", "--space-12"),
               ("Rail width from xl", "--layout-rail-pipeline"), ("Bar height / radius", "--space-1 / --radius-full"), ("Name / code / caption type", "--text-body-sm / --text-code / --text-caption")],
    "code": {"snippet": """<ol class="stages" aria-label="Pipeline">
  <li><a class="stage" href="/projects/ledgerline/stages/9">
    <span class="stage__row"><svg class="icon s-icon--ok icon--sm" aria-hidden="true">…</svg>
      <span class="stage__n">9</span><span class="stage__name">Estimates</span><span class="stage__dur tabular">5:37</span></span>
    <span class="visually-hidden">Succeeded</span></a></li>
  <li><a class="stage" href="/projects/ledgerline/stages/10" aria-current="step">…Increments…
    <span class="stage__live"><span class="stage__live-step">Implementing · iteration 3 of 10</span><span class="stage__live-line">…</span></span></a></li>
</ol>

<ol class="steps" aria-label="Increment steps">
  <li><div class="steps__bar steps__bar--ok"></div><div class="steps__label">…<span class="truncate">Tests written</span><span class="visually-hidden">, Done</span></div></li>
  <li aria-current="step"><div class="steps__bar steps__bar--run"></div>
    <div class="steps__label steps__label--now"><span class="truncate">Implement</span><span class="visually-hidden">, In progress</span></div>
    <span class="steps__sub">iteration 3 of 10</span></li>
</ol>""",
             "classes": [("<code>.stages</code> / <code>.stage</code>", "Stage list and stage link; layout switches at sm and lg."),
                         ("<code>.stage__row</code> <code>__n</code> <code>__name</code> <code>__dur</code> <code>__live</code>", "Stage parts; duration and live line from lg."),
                         ("<code>.stage__name--skip</code>", "Struck-through skipped stage."), ("<code>aria-current=\"step\"</code>", "The open stage / the step in progress."),
                         ("<code>.steps</code> + <code>--steps</code>", "Progress row; <code>--steps</code> sets the column count (default 5)."),
                         ("<code>.steps__bar--ok</code> <code>--run</code> <code>--paused</code> <code>--fail</code>", "Bar status."),
                         ("<code>.steps__label--now</code> / <code>.steps__sub</code>", "Current label; sub-label from sm."),
                         ("<code>data-state=\"hover|focus|active\"</code>", "Documentation only.")]},
    "sources": {"mocks": [("pages/project-pipeline/default", "stage list with live line and increment steps"), ("pages/project-pipeline/past-stage", "earlier stage open while stage 3 runs"),
                          ("pages/project-pipeline/feature-direction", "skipped stages"), ("pages/project-pipeline/blocked", "failed stage 5"),
                          ("pages/project-pipeline/budget-reached", "paused increment steps"), ("dialogs/raise-budget/default", "steps behind a dialog")],
                "drift": "3.1rem live-line indent snapped to <code>--space-12</code> and 11px stage text raised to 12px (logged). Progress steps marked the current step only with <code>.steps__label--now</code> and showed state only by bar colour; they now carry <code>aria-current=\"step\"</code> and a hidden state word. The Kiln Booking increment card linked to <code>#</code>; it links to the increment page."},
}


# ============================================================== skip-link
_SKIP = '<a class="skip-link skip-link--static" href="#main">Skip to content</a>'
_SKIP_F = '<a class="skip-link skip-link--static" href="#main" data-state="focus">Skip to content</a>'

SPECS["skip-link"] = {
    "lead": "The first thing in every page: a link that jumps keyboard and screen-reader users past the sidebar and top bar to the main content. Invisible until it is focused.",
    "readme_variants": "Skip to content",
    "readme_states": "hidden, focused",
    "pills": ["WCAG 2.4.1 Bypass Blocks", "On every mock"],
    "overview": f"""<p>Every one of the 154 mock states, and every page of this design system, starts with <code>&lt;a class=&quot;skip-link&quot; href=&quot;#main&quot;&gt;Skip to content&lt;/a&gt;</code> as the first focusable element, pointing at <code>&lt;main id=&quot;main&quot;&gt;</code>. Pressing Tab once on load reveals it in the top-left corner; Enter moves focus past the sidebar's 15 or so stops (brand, New direction, five links, four projects, Stop all workers) or the top bar.</p>
<p>It is the only skip link. Hewn's landmarks (<code>banner</code>, <code>navigation</code>, <code>main</code>) and headings handle the rest; extra links such as <i>Skip to log</i> are not needed.</p>""",
    "anatomy": (_SKIP_F, [(8, 20), (50, 50)],
                [("Container", "<code>--color-bg-inverse</code> fill, <code>--radius-md</code>, <code>--space-2</code> / <code>--space-3</code> padding, at <code>--z-tooltip</code> so nothing covers it."),
                 ("Label", "<i>Skip to content</i> in <code>--text-label</code>, <code>--color-fg-inverse</code>.")]),
    "variants": f"""<p>One variant. It is shown here with <code>.skip-link--static</code>, which places it in the flow so it can be seen without focusing it; the product never uses that modifier.</p>
{ex(_SKIP, "Skip to content, linking to <code>#main</code>. On sign-in it targets the auth form's <code>&lt;main id=&quot;main&quot;&gt;</code>; on error pages, the error content.")}""",
    "sizes": NA("The skip link has one size."),
    "states": f"""{matrix(["Hidden (default)", "Focused", "Hover", "Active", "Disabled"], [
    ("Skip link", [_na("Off screen: <code>translateY(-200%)</code>, still in the tab order"), _SKIP_F, _na("Only reachable while focused; keeps the inverse colours"),
                   _na("Follows the link"), _na("Never disabled")])])}
<p>Try it on this page: reload and press <kbd>Tab</kbd>.</p>
{themes(_SKIP_F)}
<p>The link is moved off screen with a transform, not <code>display: none</code> or <code>visibility: hidden</code>, so it stays focusable; on focus the transform is removed and it appears instantly.</p>""",
    "responsive": ul(["Identical at every breakpoint (xs, sm 576px, md 768px, lg 992px, xl 1200px): pinned <code>--space-2</code> from the top-left corner of the viewport, above the sticky top bar.",
                      "Below lg it lands focus past the top bar; from lg, past the sidebar. The target is the same <code>#main</code>."]),
    "theming": "<p>It uses the inverse pair, <code>--color-fg-inverse</code> on <code>--color-bg-inverse</code>: dark on light pages and light on dark pages, so it always contrasts with whatever it overlaps. Nothing else is themeable; do not brand it.</p>",
    "a11y": {
        "pattern": "<p>A same-page link meeting <a href=\"https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html\">WCAG 2.4.1 Bypass Blocks</a>. The target <code>&lt;main id=\"main\"&gt;</code> takes focus when followed (browsers move the sequential focus start point to it; add <code>tabindex=\"-1\"</code> to <code>&lt;main&gt;</code> if a framework router intercepts the hash).</p>",
        "keys": [(kbd("Tab"), "First press on page load focuses and reveals it."), (kbd("Enter"), "Moves focus to the start of <code>&lt;main&gt;</code>; the next Tab is the first control in the page."),
                 (kbd("Tab") + " again", "Without pressing Enter: hides it and continues to the menu button or sidebar.")],
        "focus": "<p>The shared 2px ring with 2px offset around the inverse pill, against the page canvas. In an Angular app, re-focus the skip link's target (or the new <code>&lt;h1&gt;</code>) after route changes; the skip link itself stays first in the document.</p>",
        "labelling": "<p><i>Skip to content</i>: says what it does. Not <i>Skip navigation</i> (on phones there is no visible navigation to skip) and not <i>Main content</i> (no verb).</p>",
        "pairs": [("Label", "--color-fg-inverse", "--color-bg-inverse", 4.5), ("Focus ring on page", "--color-focus-ring", "--color-bg-canvas", 3),
                  ("Focus ring on surface", "--color-focus-ring", "--color-bg-surface", 3)],
        "motion": "<p>None: it appears and disappears instantly, so there is no transition to reduce.</p>",
        "touch": "<p>Touch users rarely meet it, since it is only shown on keyboard focus; when shown it is about 36px tall with nothing else within 24px.</p>",
    },
    "content": ul(["Exactly <i>Skip to content</i>, sentence case, on every page.", "Do not translate it into an instruction (<i>Press Enter to skip</i>)."]),
    "dodont": [
        (_SKIP_F, "First in the document, before the shell, targeting <code>#main</code>.",
         '<a class="skip-link skip-link--static" href="#sources" data-state="focus">Skip to content</a>',
         "On the dialog mocks the skip link sits outside the <code>inert</code> page and jumps into it. While a modal is open the skip link is inert with the rest of the page; only the dialog is reachable."),
        (_SKIP, "Hidden with a transform; still focusable.",
         '<span class="text-caption">&lt;a class="skip-link" hidden&gt; … nothing to focus</span>',
         "Do not hide it with <code>hidden</code>, <code>display: none</code> or <code>visibility: hidden</code>; keyboard users can never reach it."),
    ],
    "tokens": [("Background / label", "--color-bg-inverse / --color-fg-inverse"), ("Focus ring", "--color-focus-ring"), ("Offset from corner", "--space-2"),
               ("Padding", "--space-2 / --space-3"), ("Radius", "--radius-md"), ("Type", "--text-label"), ("Stacking", "--z-tooltip")],
    "code": {"snippet": """<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <div class="shell">
    <aside class="shell__sidebar" aria-label="Sidebar">…</aside>
    <div class="shell__body">
      <header class="topbar">…</header>
      <main id="main" class="shell__main" tabindex="-1">…</main>
    </div>
  </div>
</body>""",
             "classes": [("<code>.skip-link</code>", "Off screen until <code>:focus</code>."), ("<code>.skip-link--static</code>", "Documentation only: in flow and visible."),
                         ("<code>data-state=\"focus\"</code>", "Documentation only: shows the focused look.")]},
    "sources": {"mocks": [("pages/dashboard/default", "shell page"), ("pages/sign-in/default", "no shell; targets the auth main"),
                          ("pages/not-found/default", "error page keeps it"), ("dialogs/delete-project/default", "outside the inert page")],
                "drift": "on the dialog mocks the skip link precedes the <code>inert</code> page wrapper and targets <code>#main</code> inside it, so it is focusable but goes nowhere; while a modal is open the skip link is made inert with the page."},
}


# ============================================================== page-header
def _ph(title, desc="", actions="", tag="h2"):
    d = f'<p class="page-header__desc">{desc}</p>' if desc else ""
    a = f'<div class="cluster">{actions}</div>' if actions else ""
    return f'<div class="page-header" style="width: 100%;"><div><{tag} {_H1}>{title}</{tag}>{d}</div>{a}</div>'


_NEW_TOKEN = f'<a class="btn btn--primary btn--sm" href="#overview">{icon("key", "icon--sm")}New worker token</a>'
_NEW_PRODUCT = f'<a class="btn btn--primary btn--sm" href="#overview">{icon("plus", "icon--sm")}New product</a>'
_AUDIT_FILTERS = ('<label class="inline-label"><span class="visually-hidden">Project</span><select class="select select--auto input--sm"><option selected>All projects</option><option>Ledgerline</option><option>Tidewater</option><option>Northwind Ops</option><option>Harbor CRM</option></select></label>'
                  '<label class="inline-label"><span class="visually-hidden">Action</span><select class="select select--auto input--sm"><option selected>All actions</option><option>Sign in</option><option>Pause</option><option>Stop all workers</option></select></label>')
_DASH_EDIT = '<span class="lg-only"><a class="btn btn--sm" href="#overview">Edit layout</a></span>'

SPECS["page-header"] = {
    "desc": "The top of every top-level page: the page title, a line that says what the page holds, and the page actions or filters.",
    "lead": "The top of every top-level page: the page's one &lt;h1&gt;, a line that says what the page holds or how it stands, and the page's own actions or filters.",
    "readme_variants": "title + description; with primary action; with filters; with desktop-only action",
    "readme_states": "default, loading, forbidden",
    "pills": ["Holds the page's <code>&lt;h1&gt;</code>"],
    "overview": f"""<p>Dashboard, Projects, Workers, Audit and Settings open with a page header. Project pages use the richer {page('components/project-header')} instead (breadcrumb, status, spend, controls, section tabs); sign-in and the error pages have their own layouts.</p>
{ul(["<b>Title</b>: the page's <code>&lt;h1&gt;</code>, the same word as the sidebar item (<i>Workers</i>).",
     "<b>Description</b>: one line of live summary or purpose: <i>7 projects · sorted by last activity</i>, <i>2 directions running · 2 need attention · $86.40 spent today</i>, <i>One container image, local or cloud. At most one worker leases a project at a time.</i>",
     "<b>Actions</b>: at most one primary, small (<i>New product</i>, <i>New worker token</i>), or the page's filters (Audit's project and action selects), or a desktop-only tool (<i>Edit layout</i>)."])}
<p>Examples on this page use an <code>&lt;h2&gt;</code> styled as the title, because the documentation page owns its own <code>&lt;h1&gt;</code>. In the product it is always <code>&lt;h1&gt;</code>.</p>""",
    "anatomy": (_ph("Workers", "One container image, local or cloud. At most one worker leases a project at a time.", _NEW_TOKEN), [(10, 22), (30, 55), (86, 50), (50, 92)],
                [("Title", "The <code>&lt;h1&gt;</code> in <code>--text-h1</code> with tight letter spacing."),
                 ("Description", "<code>.page-header__desc</code>: <code>--text-body-sm</code>, muted, <code>--space-1</code> under the title; wraps."),
                 ("Actions", "A <code>.cluster</code> of small buttons or labelled filters, aligned to the title's baseline row from sm."),
                 ("Container", "<code>.page-header</code>: column below sm, row from sm; <code>--space-6</code> / <code>--space-4</code> padding, <code>--space-8</code> from lg.")]),
    "variants": f"""{ex(_ph("Settings", "Your preferences, who can sign in, and the defaults every direction starts with."), "Title and description: Settings.", cls="ds-example__canvas--stack ds-example__canvas--canvas")}
{ex(_ph("Projects", "7 projects · sorted by last activity", _NEW_PRODUCT), "With the page's primary action: Projects.", cls="ds-example__canvas--stack ds-example__canvas--canvas")}
{ex(_ph("Audit", "Who did what, when and from where. Entries can’t be edited.", _AUDIT_FILTERS), "With filters: Audit. Labels are visually hidden because the option text names the filter.", cls="ds-example__canvas--stack ds-example__canvas--canvas")}
{ex(_ph("Dashboard", "2 directions running · 2 need attention · $86.40 spent today", _DASH_EDIT), "With a desktop-only action: <i>Edit layout</i> shows from lg, where tiles can be dragged.", cls="ds-example__canvas--stack ds-example__canvas--canvas")}""",
    "sizes": NA("The page header has one size; only its padding grows at lg."),
    "states": f"""<p>The header has no interactive states of its own; its buttons and selects carry theirs. It does change with the page's state:</p>
{table(["Page state", "Header", "Example"], [
    ["Default", "Title, live description, actions.", mock("pages/workers/default")],
    ["Loading", "Title and actions render immediately; the description is a skeleton line until the summary arrives, so the <code>&lt;h1&gt;</code> is never missing.", mock("pages/projects/loading")],
    ["Empty / error", "Unchanged; the empty or error state sits below it. The primary action stays, because it is usually the way out (<i>New worker token</i> on an empty Workers page).", mock("pages/workers/empty")],
    ["Forbidden", "Title kept; the description says why (<i>Only Owners can read the audit log.</i>); actions and filters removed.", mock("pages/audit/forbidden")],
    ["Viewer", "Owner-only actions are not rendered.", mock("pages/workers/viewer")]])}
{ex(_ph("Audit", "Only Owners can read the audit log."), "Forbidden: no filters.", cls="ds-example__canvas--stack ds-example__canvas--canvas")}
{themes(_ph("Workers", "One container image, local or cloud.", _NEW_TOKEN), stack=True)}""",
    "responsive": ul([
        "Below <code>--layout-breakpoint-sm</code> (576px): one column. Title, description, then the actions under them, left aligned; padding <code>--space-6</code> top and bottom, <code>--space-4</code> sides (the page margin). The description wraps.",
        "From sm (576px) to lg: a row; the title block takes the space and the actions sit at the end, aligned to the bottom of the block.",
        "From lg (992px): padding <code>--space-8</code> top and sides, <code>--space-6</code> bottom, matching <code>--layout-margin</code>; desktop-only actions (<code>.lg-only</code>) appear.",
        "xl (1200px): unchanged; the header spans the main column."]),
    "theming": "<p>The header has no background or border of its own; it sits on the canvas and inherits <code>--color-fg-default</code> for the title and <code>--color-fg-muted</code> for the description. In dark both lighten with the canvas. If a page needs a banded header, put it on <code>--color-bg-surface</code> with a hairline <code>--color-border-default</code> bottom edge, as the project header does.</p>",
    "a11y": {
        "pattern": "<p>No widget: a heading and its context. The <code>&lt;h1&gt;</code> is the first heading inside <code>&lt;main&gt;</code> and matches the document <code>&lt;title&gt;</code> and the current sidebar item (WCAG 2.4.2, 2.4.6; see <a href=\"https://www.w3.org/WAI/ARIA/apg/practices/headings/\">APG headings</a>). Filters in the header are native <code>&lt;select&gt;</code>s, each with a label.</p>",
        "keys": [(kbd("Tab"), "Moves from the skip-link target through the header's actions, then into the page."), (kbd("H") + " (screen reader)", "The title is the first heading on the page.")],
        "focus": "<p>After a route change focus moves to the <code>&lt;h1&gt;</code> (with <code>tabindex=\"-1\"</code>, no visible ring for programmatic focus), so the new page is announced by name.</p>",
        "labelling": "<p>The title names the page. Filters have visually hidden labels (<i>Project</i>, <i>Action</i>) because the selected option reads as the visible label. A live description (<i>$86.40 spent today</i>) is not a live region; the dashboard's tiles announce changes.</p>",
        "pairs": [("Title", "--color-fg-default", "--color-bg-canvas", 4.5), ("Description", "--color-fg-muted", "--color-bg-canvas", 4.5),
                  ("Primary action label", "--color-fg-on-accent", "--color-accent", 4.5), ("Focus ring", "--color-focus-ring", "--color-bg-canvas", 3)],
        "motion": "<p>No motion.</p>",
        "touch": "<p>Small buttons in the header are 32px tall, alone in their cluster or 8px apart, above the 24px minimum; below lg they sit on their own line, away from the title.</p>",
    },
    "content": ul(["Title: the sidebar's word for the page, one or two words, no punctuation.",
                   "Description: one sentence or a dot-separated summary (<i>7 projects · sorted by last activity</i>); numbers are tabular and current.",
                   "Primary action: verb + object, matching the dialog or page it opens (<i>New worker token</i>).",
                   "Do not repeat the title in the description (<i>Workers: your workers</i>)."]),
    "dodont": [
        (_ph("Workers", "One container image, local or cloud. At most one worker leases a project at a time."), "The description wraps; the title block has no <code>.truncate</code>.",
         '<div class="page-header" style="width: 100%; max-width: 20rem;"><div class="truncate"><h2 ' + _H1 + '>Workers</h2><p class="page-header__desc">One container image, local or cloud. At most one worker leases a project at a time.</p></div></div>',
         "Every top-level mock wraps the title and description in <code>.truncate</code>, so at 360px the Workers, Settings and Audit descriptions are cut off mid-sentence."),
        (_ph("Projects", "7 projects · sorted by last activity", _NEW_PRODUCT), "One small primary action.",
         _ph("Projects", "7 projects", _NEW_PRODUCT + '<a class="btn btn--primary btn--sm" href="#overview">Import repo</a>'),
         "Two primary actions compete; make the second secondary or move it into a menu."),
    ],
    "tokens": [("Title", "--color-fg-default"), ("Description", "--color-fg-muted"), ("Title type", "--text-h1"), ("Title tracking", "--letter-spacing-tight"),
               ("Description type", "--text-body-sm"), ("Padding below lg", "--space-6 / --space-4"), ("Padding from lg", "--space-8 / --space-6"),
               ("Gap / description offset", "--space-4 / --space-1")],
    "code": {"snippet": """<div class="page-header">
  <div>
    <h1 tabindex="-1">Workers</h1>
    <p class="page-header__desc">One container image, local or cloud. At most one worker leases a project at a time.</p>
  </div>
  <div class="cluster">
    <a class="btn btn--primary btn--sm" href="/workers/new-token">…New worker token</a>
  </div>
</div>""",
             "classes": [("<code>.page-header</code>", "Column below sm, row from sm; padding grows at lg."), ("<code>.page-header__desc</code>", "Description line."),
                         ("<code>.cluster</code>", "Actions or filters."), ("<code>.lg-only</code>", "Desktop-only action wrapper.")]},
    "sources": {"mocks": [("pages/dashboard/default", "live summary and Edit layout"), ("pages/projects/default", "New product"),
                          ("pages/workers/default", "New worker token"), ("pages/audit/default", "filters"), ("pages/audit/forbidden", "forbidden"),
                          ("pages/settings/default", "title and description only")],
                "drift": "the title block was wrapped in <code>.truncate</code>, clipping descriptions on phones; it wraps now. Dashboard empty states restyled titles inline (logged, now <code>.empty--tight</code>)."},
}
