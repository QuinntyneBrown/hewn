"""Component specs: Data display (table, row list, list, description list, avatar, status and badge, chip,
stat, code block, timeline). Imitates the reference spec in comp_actions.py."""
from common import (NA, btn, code, ex, icon, icon_btn, kbd, matrix, mock, page, status, status_icon, themes, ul)

SPECS = {}

STACK = "ds-example__canvas--stack"
FULL = '<div style="width: 100%; min-width: 0; max-width: 100%;">'
END = "</div>"


def _sk(cls="skeleton--line"):
    return f'<span class="skeleton {cls}" aria-hidden="true"></span>'


def _busy(label, inner):
    return f'<div aria-busy="true" aria-live="polite" style="position: relative;"><p class="visually-hidden">{label}</p>{inner}</div>'


def _na(text):
    return f'<span class="text-caption">{text}</span>'


# ============================================================== table
_AUDIT = [("9 Nov 2026, 14:31:07", "quinntynebrown", "Merge", "Ledgerline #27", "—"),
          ("9 Nov 2026, 13:02:44", "quinntynebrown", "Resume", "Tidewater", "24.114.38.91"),
          ("9 Nov 2026, 10:15:22", "ama-osei", "Sign in", "—", "99.230.12.4"),
          ("8 Nov 2026, 17:01:36", "quinntynebrown", "Cancel", "Harbor CRM", "24.114.38.91"),
          ("8 Nov 2026, 08:30:00", "quinntynebrown", "Stop all workers", "All projects", "24.114.38.91")]


def _audit_head(sortable=False):
    if sortable:
        when = '<th scope="col" aria-sort="descending"><button type="button">When</button></th>'
        who = '<th scope="col" aria-sort="none"><button type="button">Who</button></th>'
    else:
        when, who = '<th scope="col">When</th>', '<th scope="col">Who</th>'
    return (f'<thead><tr>{when}{who}<th scope="col">Action</th><th scope="col" class="col-sm">Target</th>'
            '<th scope="col" class="col-md num">IP</th></tr></thead>')


def _audit_row(w, who, a, t, ip, attrs=""):
    return (f'<tr{attrs}><td class="mono text-muted tabular">{w}</td><td>{who}</td><td>{a}<span class="text-caption sm-hide" style="display: block;">{t}</span></td>'
            f'<td class="col-sm text-muted">{t}</td><td class="col-md num mono text-subtle">{ip}</td></tr>')


def _audit_table(rows, cls="table", caption="Audit log, newest first", sortable=False, wrap_attrs=""):
    body = "".join(_audit_row(*r) for r in rows)
    return (f'<div class="table-wrap"{wrap_attrs}><table class="{cls}"><caption class="visually-hidden">{caption}</caption>'
            f'{_audit_head(sortable)}<tbody>{body}</tbody></table></div>')


_RUNS = ('<div class="table-wrap"><table class="table"><caption class="visually-hidden">Runs of stage 10</caption><thead><tr>'
         '<th scope="col">Run</th><th scope="col">Status</th><th scope="col" class="col-sm">Worker</th><th scope="col" class="num">Duration</th></tr></thead><tbody>'
         f'<tr><td class="mono">run-0412</td><td>{status("Running")}</td><td class="mono col-sm text-muted">quinn-mbp.local</td><td class="num text-muted">3:12:48</td></tr>'
         f'<tr><td class="mono">run-0398</td><td>{status("Failed")}</td><td class="mono col-sm text-muted">build-box-02</td><td class="num text-muted">0:04:12</td></tr>'
         '</tbody></table></div><p class="text-caption mt-3">run-0398 lost its lease when build-box-02 stopped heartbeating; run-0412 resumed from its last checkpoint.</p>')


def _trace_col(ic, name, items, empty, mono=False):
    cls = ' class="text-mono-xs"' if mono else ""
    body = ('<ul class="trace__items">' + "".join(f"<li{cls}>{i}</li>" for i in items) + "</ul>") if items else f'<p class="trace__empty">{empty}</p>'
    return f'<li class="trace__col"><h4 class="trace__head">{icon(ic, "icon--sm")}<span>{name}</span><span>{len(items)}</span></h4>{body}</li>'


_PR28 = (f'<span class="cluster" style="gap: var(--space-1-5); display: inline-flex;">{icon("git-pr", "icon--xs s-icon--run")}'
         '<span class="text-mono-xs text-muted">#28</span></span> Reconcile a card statement')
_TRACE = ('<ol class="trace" style="margin-top: 0;">'
          + _trace_col("layout-template", "Designs", ["Reconcile statement · Default", "Reconcile statement · Review"], "No design covers it")
          + _trace_col("route", "Journeys", ["Journey 4 · Close the month"], "In no journey")
          + _trace_col("file-code", "Acceptance tests", ["e2e/reconcile-card-statement.spec.ts", "backend/tests/StatementMatcherTests.cs"], "None yet", True)
          + _trace_col("git-pr", "Pull requests", [_PR28], "None yet") + "</ol>")
_TRACE_EMPTY = ('<ol class="trace" style="margin-top: 0;">'
                + _trace_col("layout-template", "Designs", ["Close period · Default", "Close period · Awaiting review"], "No design covers it")
                + _trace_col("route", "Journeys", ["Journey 4 · Close the month"], "In no journey")
                + _trace_col("file-code", "Acceptance tests", [], "None yet", True)
                + _trace_col("git-pr", "Pull requests", [], "None yet") + "</ol>")


def _mini(row_attrs="", cell=None):
    first = cell or '<td class="mono">run-0412</td>'
    return f'<table class="table"><tbody><tr{row_attrs}>{first}<td>{status("Running")}</td></tr></tbody></table>'


def _mini_head(sort="none", attrs=""):
    return f'<table class="table"><thead><tr><th scope="col" aria-sort="{sort}"><button type="button"{attrs}>When</button></th></tr></thead></table>'


_TABLE_MATRIX = matrix(["Default", "Hover", "Focus", "Selected / sorted"], [
    ("Body row", [_mini(), _mini(' data-state="hover"'), _mini("", '<td class="mono"><a href="#states" data-state="focus">run-0412</a></td>'), _mini(' aria-selected="true"')]),
    ("Sortable header", [_mini_head(), _na("No change; the cursor shows it acts"), _mini_head("none", ' data-state="focus"'), _mini_head("descending")]),
])

_TABLE_LOADING = _busy("Loading the audit log", '<div class="table-wrap"><table class="table"><caption class="visually-hidden">Audit log</caption>' + _audit_head()
                       + "<tbody>" + "".join(f'<tr aria-hidden="true"><td>{_sk()}</td><td>{_sk()}</td><td>{_sk()}</td><td class="col-sm">{_sk()}</td><td class="col-md">{_sk()}</td></tr>' for _ in range(3))
                       + "</tbody></table></div>")
_TABLE_NORESULTS = (f'<div class="empty empty--tight">{icon("search")}<div><p class="empty__title">No entries match these filters</p>'
                    '<p class="empty__text">Nobody stopped all workers from Ledgerline. Stop all is recorded against All projects.</p></div>'
                    + btn("Clear filters") + "</div>")
_TABLE_ERROR = (f'<div class="empty empty--error" role="alert">{icon("alert-triangle")}<div><p class="empty__title">The audit log couldn’t load</p>'
                '<p class="empty__text">The audit store returned 500. Entries are still being written; nothing has been lost.</p></div>'
                f'<div class="cluster">{btn("Try again", ic="refresh")}</div></div>')

SPECS["table"] = {
    "lead": "Tables lay out records people scan and compare column by column: who did what in the audit log, which runs a stage needed. One row per record, one column per attribute.",
    "readme_variants": "default, runs (status cells), dense, sortable, sticky header, responsive columns, traceability matrix",
    "readme_states": "default, row hover, focus, selected, sorted, loading, empty, no results, error",
    "pills": ["Native <code>&lt;table&gt;</code>"],
    "overview": f"""<p>Use a table when the reader compares the same attribute down many rows: timestamps, actors and IPs in the audit log, statuses and durations of a stage's runs. Use a {page('components/row-list', 'row list')} when each row is an object people open or act on and it must read well stacked on a phone (projects, backlog, workers). Use a {page('components/list')} when a row has one or two attributes.</p>
{ul(["<b>Default</b>: the audit log. Absolute timestamps in mono, low-priority columns hidden on small screens with <code>.col-sm</code> / <code>.col-md</code>.",
     "<b>Runs</b>: a stage's attempts with a " + page('components/badge', 'status') + " cell and a right-aligned duration.",
     "<b>Dense</b>: <code>.table--dense</code> for long logs inside a tile or rail.",
     "<b>Sortable</b>: header buttons with <code>aria-sort</code>; one column sorted at a time.",
     "<b>Sticky header</b>: <code>.table--sticky</code> inside a height-capped wrapper.",
     "<b>Traceability matrix</b>: one requirement traced across four fixed columns (designs, journeys, acceptance tests, pull requests). It is a grid of lists, not a <code>&lt;table&gt;</code>, because each column has its own length."])}""",
    "anatomy": (FULL + _audit_table(_AUDIT[:2], caption="Audit log, newest first") + END,
                [(8, 18), (30, 52), (60, 52), (96, 52), (50, 92)],
                [("Caption", "<code>&lt;caption&gt;</code>, visually hidden when the page heading already says what the table is; it names the sort order."),
                 ("Header cell", "<code>&lt;th scope=\"col\"&gt;</code>, <code>--text-caption</code> medium in <code>--color-fg-subtle</code>, never wraps."),
                 ("Body cell", "<code>--text-body-sm</code>, padding <code>--space-3</code> block, <code>--space-4</code> trailing; mono for timestamps, IDs and IPs."),
                 ("Numeric cell", "<code>.num</code>: right-aligned, tabular figures, no trailing padding."),
                 ("Row rule", "Hairline <code>--color-border-default</code> under every row (decorative, exempt from 1.4.11).")]),
    "variants": f"""<h3>Default: audit log</h3>
{ex(_audit_table(_AUDIT), "Below sm the Target column folds into the Action cell as a caption line; the IP column appears from md.", cls=STACK)}
<h3>Runs, with status cells</h3>
{ex(_RUNS, "Status cells use the status component (icon + word); durations are right-aligned in <code>.num</code>.", cls=STACK)}
<h3>Dense</h3>
{ex(_audit_table(_AUDIT[:3], "table table--dense"), "<code>.table--dense</code> halves the block padding to <code>--space-1-5</code>.", cls=STACK)}
<h3>Sortable</h3>
{ex(_audit_table(_AUDIT[:3], sortable=True), "The sorted header shows ↓ or ↑ after its label; sortable but unsorted headers carry <code>aria-sort=&quot;none&quot;</code>.", cls=STACK)}
<h3>Sticky header</h3>
{ex(_audit_table(_AUDIT, "table table--sticky", wrap_attrs=' style="max-height: 11rem; overflow-y: auto;" tabindex="0" role="region" aria-label="Audit log, scrollable"'), "The wrapper caps the height and becomes the scroll container, so it is focusable and named.", cls=STACK)}
<h3>Traceability matrix</h3>
{ex(_TRACE, "L2-018 traced to its designs, journey, acceptance tests and pull request. One column below md, two from md, four from xl.", cls=STACK)}""",
    "sizes": f"""<p>Two densities. Default rows (cell padding <code>--space-3</code>) suit pages; dense rows (<code>--space-1-5</code>) suit tiles, rails and logs where more rows matter more than air.</p>
{ex(_audit_table(_AUDIT[:2]) + _audit_table(_AUDIT[:2], "table table--dense"), "Default, then dense. Type size does not change; only the block padding.", cls=STACK)}""",
    "states": f"""<p>Rows are not focusable; focus lands on the links and sort buttons inside them. Hover tints the row so the eye can follow it across columns. Pointer and focus states are forced with <code>data-state</code>.</p>
{_TABLE_MATRIX}
<h3>Loading, no results and error</h3>
{ex(_TABLE_LOADING, "Loading: the header stays, three skeleton rows; the wrapper has <code>aria-busy=&quot;true&quot;</code> and a hidden “Loading the audit log”.", cls=STACK)}
{ex(_TABLE_NORESULTS, "No results: say which filters matched nothing and offer to clear them. A table that has never had rows uses the first-run " + page('components/empty-state', 'empty state') + " instead.", cls=STACK)}
{ex(_TABLE_ERROR, "Error: the table is replaced by an error empty state with Try again; the page shell and filters stay.", cls=STACK)}
{themes(FULL + _RUNS + END)}
<h3>Traceability: an empty column</h3>
{ex(_TRACE_EMPTY, "L2-020: a column with nothing in it says what is missing (<i>None yet</i>) instead of showing a zero alone.", cls=STACK)}""",
    "responsive": ul([
        "Every table sits in <code>.table-wrap</code>, which scrolls horizontally inside its own box; the page never scrolls sideways at 360px.",
        "Base (phones): only the columns needed to identify and read the record. <code>.col-sm</code> cells appear from sm (36rem), <code>.col-md</code> from md (48rem).",
        "When a column is hidden, its value moves into a cell that stays: the audit log's Target becomes a caption line under the Action (<code>.sm-hide</code>).",
        "The traceability matrix is one column below md, two from md (48rem) and four from xl (75rem); it never scrolls.",
        "If a table has four or fewer columns and every row is something people open, use a " + page('components/row-list', 'row list') + " instead: it stacks rather than scrolls."]),
    "theming": """<p>The table reads semantic tokens directly: header ink <code>--color-fg-subtle</code>, rules <code>--color-border-default</code>, hover <code>--color-bg-subtle</code>, selected <code>--color-accent-subtle</code>. In dark the rules become <code>--palette-slate-700</code> and the hover tint lifts the row a step, so hover and selection read without borders getting brighter.</p>
<p>The sticky header paints <code>--color-bg-canvas</code> so rows slide under it. A sticky table placed on a card must paint the card's surface instead; set it on the wrapper's context rather than editing <code>.table</code>.</p>
<pre><code>/* A sticky table inside a tile body */
.tile .table--sticky thead th { background: var(--color-bg-surface); }</code></pre>""",
    "a11y": {
        "pattern": "<p>Native <code>&lt;table&gt;</code> with a <code>&lt;caption&gt;</code> and <code>&lt;th scope=\"col\"&gt;</code>; no ARIA grid, because cells are not individually interactive. Sort buttons live inside the header cell and the cell carries <code>aria-sort</code>, as in the <a href=\"https://www.w3.org/WAI/ARIA/apg/patterns/table/examples/sortable-table/\">APG sortable table example</a> of the <a href=\"https://www.w3.org/WAI/ARIA/apg/patterns/table/\">APG table pattern</a>. The traceability matrix is an <code>&lt;ol&gt;</code> of columns, each with a heading and a count.</p>",
        "keys": [(kbd("Tab") + " / " + kbd("Shift", "Tab"), "Moves between links and sort buttons inside the table, in reading order, then to the scroll wrapper when it can scroll."),
                 (kbd("Enter") + ", " + kbd("Space"), "On a sort button: sorts by that column; pressing again reverses the order."),
                 (kbd("←") + " " + kbd("→"), "With the scroll wrapper focused: scrolls hidden columns into view."),
                 ("Screen reader table keys", "Move cell by cell with headers announced, because the header cells are real <code>th</code> with scope.")],
        "focus": "<p>The shared focus ring on links and sort buttons. A wrapper that can scroll gets <code>tabindex=\"0\"</code>, <code>role=\"region\"</code> and a name, so keyboard users can reach columns that do not fit; it shows the same ring.</p>",
        "labelling": "<p>The caption names the table and its order (<i>Audit log, newest first</i>) and may be visually hidden when the page heading says the same. After sorting, the caption updates (<i>Audit log, sorted by who, A to Z</i>) so the change is announced. Empty cells hold an em dash (—), never nothing, so a screen reader does not read the next cell as this one. Status cells carry the word, not just the icon.</p>",
        "pairs": [("Cell text on page", "--color-fg-default", "--color-bg-canvas", 4.5), ("Header and IP text", "--color-fg-subtle", "--color-bg-canvas", 4.5),
                  ("Muted cell (timestamp, target)", "--color-fg-muted", "--color-bg-canvas", 4.5), ("Hovered row, faint text", "--color-fg-subtle", "--color-bg-subtle", 4.5),
                  ("Selected row text", "--color-fg-default", "--color-accent-subtle", 4.5), ("Running in a cell", "--color-fg-accent", "--color-bg-canvas", 4.5),
                  ("Failed in a cell", "--color-danger-strong", "--color-bg-canvas", 4.5), ("Focus ring on page", "--color-focus-ring", "--color-bg-canvas", 3)],
        "motion": "<p>Row hover fades its tint over <code>--duration-fast</code>; reduced motion makes it instant. The Running status icon spins and stops under reduced motion. Skeleton rows shimmer on <code>--duration-pulse</code>, which reduced motion sets to 0s.</p>",
        "touch": "<p>Rows are not tap targets; links inside cells are. Make the record's identifying text the link so the target is the full text width, at least 24px tall with the default row padding. Horizontal scroll in the wrapper uses the native swipe.</p>",
    },
    "content": ul(["Column headings are short nouns in sentence case: <i>When</i>, <i>Who</i>, <i>Action</i>, <i>Target</i>, <i>IP</i>, <i>Duration</i>.",
                   "Audit timestamps are absolute and complete (<i>9 Nov 2026, 14:31:07</i>) because entries are evidence; feeds may use relative time.",
                   "Numbers, durations and money are right-aligned with tabular figures: <i>3:12:48</i>, <i>$184.20</i>.",
                   "An empty value is an em dash (—). The Merge entry has no IP because the merge came from GitHub, not a browser.",
                   "Statuses are the status words (<i>Running</i>, <i>Failed</i>), never ad-hoc labels such as <i>Error</i> or <i>OK</i>."]),
    "dodont": [
        (FULL + _audit_table(_AUDIT[:2]) + END, "Wrap every table in <code>.table-wrap</code> and hide low-priority columns below sm and md, folding their values into a cell that stays.",
         FULL + '<div class="table-wrap"><table class="table"><thead><tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">Action</th><th scope="col">Target</th><th scope="col">IP</th></tr></thead><tbody><tr><td class="mono">9 Nov 2026, 14:31:07</td><td>quinntynebrown</td><td>Merge</td><td>Ledgerline #27</td><td class="mono"></td></tr></tbody></table></div>' + END,
         "All five columns at every width and a blank IP cell: at 360px the reader scrolls sideways to read one entry, and the blank reads as missing data."),
        (FULL + _RUNS + END, "Status cells are icon + word, so Failed reads without colour.",
         FULL + '<div class="table-wrap"><table class="table"><tbody><tr><td class="mono">run-0398</td><td><span class="text-danger">●</span></td><td class="num text-muted">0:04:12</td></tr></tbody></table></div>' + END,
         "A red dot alone fails 1.4.1 and says nothing to a screen reader. The audit log's warning-coloured actions are the near miss: the colour is extra emphasis, so the action word must carry the meaning."),
    ],
    "tokens": [("Header label", "--text-caption / --font-weight-medium"), ("Header ink", "--color-fg-subtle"), ("Cell text", "--text-body-sm"),
               ("Cell ink / muted", "--color-fg-default / --color-fg-muted"), ("Row rule", "--color-border-default"),
               ("Row hover / selected", "--color-bg-subtle / --color-accent-subtle"), ("Cell padding block / inline", "--space-3 / --space-4"),
               ("Header padding block", "--space-2-5"), ("Dense padding block", "--space-1-5"), ("Mono cell", "--text-code / --line-height-loose"),
               ("Sticky header", "--color-bg-canvas"), ("Sticky layer", "--z-raised"), ("Trace column / gap", "--color-bg-surface / --color-border-default"),
               ("Trace radius", "--radius-md"), ("Hover transition", "--duration-fast / --ease-standard")],
    "code": {"snippet": """<div class="table-wrap" tabindex="0" role="region" aria-label="Audit log, scrollable">
  <table class="table">
    <caption class="visually-hidden">Audit log, newest first</caption>
    <thead><tr>
      <th scope="col" aria-sort="descending"><button type="button">When</button></th>
      <th scope="col">Who</th><th scope="col">Action</th>
      <th scope="col" class="col-sm">Target</th><th scope="col" class="col-md num">IP</th>
    </tr></thead>
    <tbody><tr>
      <td class="mono text-muted tabular">9 Nov 2026, 14:31:07</td><td>quinntynebrown</td>
      <td>Merge<span class="text-caption sm-hide" style="display: block">Ledgerline #27</span></td>
      <td class="col-sm text-muted">Ledgerline #27</td><td class="col-md num mono text-subtle">—</td>
    </tr></tbody>
  </table>
</div>""",
             "classes": [("<code>.table-wrap</code>", "Horizontal scroll container; required around every table."),
                         ("<code>.table</code>", "Base table: full width, collapsed borders, body-sm type."),
                         ("<code>.table--dense</code>", "Halves the cell block padding."),
                         ("<code>.table--sticky</code>", "Sticky header row; give the wrapper a max height."),
                         ("<code>.num</code>", "Right-aligned tabular numeric cell."),
                         ("<code>.mono</code>", "Code type for IDs, timestamps, hosts and IPs."),
                         ("<code>.col-sm</code> / <code>.col-md</code>", "Column hidden below sm / md."),
                         ("<code>th[aria-sort] button</code>", "Sortable header; <code>ascending</code> / <code>descending</code> add ↑ / ↓."),
                         ("<code>tr[aria-selected=\"true\"]</code>", "Selected row tint (with a selection checkbox column)."),
                         ("<code>.trace</code> <code>.trace__col</code> <code>.trace__head</code> <code>.trace__items</code> <code>.trace__empty</code>", "Traceability matrix."),
                         ("<code>data-state=\"hover\"</code> on <code>tr</code>", "Documentation only: forces row hover.")]},
    "sources": {"mocks": [("pages/audit/default", "audit log"), ("pages/project-pipeline/runs", "runs table"), ("pages/traceability/default", "traceability matrix"),
                          ("pages/audit/loading", "skeleton rows"), ("pages/audit/no-results", "no results"), ("pages/audit/error", "error"),
                          ("pages/traceability/no-test", "empty matrix columns")],
                "drift": "13px mono cells snapped to <code>--font-size-sm</code> (see the drift log); the scroll wrapper is now focusable and named when it can scroll (the mocks' <code>.table-wrap</code> was not), and empty cells always carry an em dash."},
}


# ============================================================== row list
def _meter(name, pct):
    return (f'<span class="pct"><span class="meter meter--muted meter--inline" role="meter" aria-label="{name} complete" aria-valuenow="{pct}" aria-valuemin="0" aria-valuemax="100">'
            f'<span class="meter__bar" style="--value: {pct}%;"></span></span>{pct}%</span>')


def _proj_row(name, idea, st, stage, note, pct, spend, last, active, cls="row"):
    n = f'<span class="row__note">{note}</span>' if note else ""
    if active:
        acts = (f'<span class="row__actions"><span class="icon-action" role="button" aria-disabled="true" tabindex="0" aria-label="Archive {name}: cancel the running direction first" title="Cancel the running direction first">{icon("archive")}</span>'
                f'<span class="icon-action" role="button" aria-disabled="true" tabindex="0" aria-label="Delete {name}: cancel the running direction first" title="Cancel the running direction first">{icon("trash")}</span></span>')
    else:
        acts = (f'<span class="row__actions"><button class="icon-action" type="button" aria-label="Archive {name}" title="Archive">{icon("archive")}</button>'
                f'<button class="icon-action" type="button" aria-label="Delete {name}" title="Delete">{icon("trash")}</button></span>')
    return (f'<li class="{cls}"><span class="truncate"><a class="row__title" href="#overview">{name}</a><span class="row__sub">{idea}</span></span>'
            f'<span class="row__end lg-hide">{status(st)}</span><span class="row__span truncate"><span>{stage}</span>{n}</span>'
            f'<span class="lg-only">{status(st)}</span>{_meter(name, pct)}'
            f'<span class="row__end tabular"><span class="visually-hidden">Spend </span>{spend}</span>'
            f'<span class="row__end text-subtle lg-only"><span class="visually-hidden">Last activity </span>{last}</span>{acts}</li>')


_PROJ_HEAD = ('<div class="rows__head" aria-hidden="true"><span>Project</span><span>Stage</span><span>Status</span><span>Complete</span>'
              '<span class="row__end">Spend</span><span class="row__end">Activity</span><span class="visually-hidden">Actions</span></div>')
_PROJ_ROWS = (_proj_row("Ledgerline", "Expense reconciliation for small accounting teams", "Running", "10 · Increments", "Increment 7 of 12 · implementing, iteration 3", 62, "$184.20", "4s ago", True)
              + _proj_row("Kiln Booking", "Studio time booking for shared ceramics kilns", "Paused", "10 · Increments", "Budget reached", 81, "$250.00", "42m ago", True)
              + _proj_row("Field Notes", "Offline survey capture for ecology field teams", "Complete", "10 · Increments", None, 100, "$341.90", "Yesterday", False))
_PROJECTS = f'<div class="rows rows--projects">{_PROJ_HEAD}<ul>{_PROJ_ROWS}</ul></div>'


def _backlog_row(n, title, journey, l2, st, est, pr, cur=False):
    if pr:
        pr_html = f'<a class="quiet-link mono" href="#overview" aria-label="Pull request {pr}, merged">{icon("git-merge", "icon--xs s-icon--ok")} #{pr}</a>'
    elif st == "In progress":
        pr_html = f'<span class="quiet-link mono">{icon("git-pr", "icon--xs")} soon</span>'
    else:
        pr_html = '<span class="text-subtle lg-only">—</span>'
    return (f'<li class="row{" row--current" if cur else ""}"><span class="text-mono-xs text-subtle tabular">{n}</span>'
            f'<a class="row__title truncate" href="#overview">{title}</a><span class="lg-hide">{status(st)}</span>'
            f'<span class="col2 text-xs text-muted">Journey {journey}</span><span class="col2 truncate text-mono-xs text-subtle">{l2}</span>'
            f'<span class="lg-only tabular text-muted row__end">{est} d</span><span class="lg-only">{status(st)}</span>'
            f'<span class="col2 text-xs row__end">{pr_html}</span></li>')


_BACKLOG = ('<div class="rows rows--backlog"><div class="rows__head" aria-hidden="true"><span>#</span><span>Increment</span><span>Journey</span><span>Requirements</span>'
            '<span class="row__end">Estimate</span><span>Status</span><span class="row__end">PR</span></div><ol>'
            + _backlog_row(6, "Split a transaction", 3, "L2-015", "Merged", 1, 27)
            + _backlog_row(7, "Reconcile a card statement", 4, "L2-018, L2-019", "In progress", 2.5, None, True)
            + _backlog_row(8, "Close a period", 4, "L2-020, L2-021", "Queued", 2, None) + "</ol></div>")


def _worker_row(wid, host, loc, ver, st, proj, hb, since, owner=True):
    if proj:
        proj_html = f'<a href="#overview" style="color: inherit;">{proj}</a>'
    else:
        proj_html = f'<span class="text-subtle">{"Lease released" if st == "Offline" else "Waiting for work"}</span>'
    revoke = f'<span class="row__actions">{btn("Revoke", "ghost", "sm", attrs="aria-label=" + chr(34) + "Revoke " + host + chr(34))}</span>' if owner else ""
    hb_cls = "text-danger" if st == "Offline" else "text-muted"
    return (f'<li class="row"><span class="truncate"><span class="mono truncate" style="display: block;">{host}</span><span class="text-mono-xs text-subtle">{wid}</span></span>'
            f'<span class="lg-hide">{status(st)}</span>'
            f'<span class="cluster text-muted" style="gap: var(--space-1-5);">{icon("laptop" if loc == "Local" else "cloud", "icon--sm")}{loc}<span class="text-mono-xs text-subtle lg-hide">· {ver}</span></span>'
            f'<span class="lg-only text-mono-xs text-muted">{ver}</span><span class="lg-only">{status(st)}</span>'
            f'<span class="row__span truncate">{proj_html}</span>'
            f'<span class="tabular {hb_cls}"><span class="visually-hidden">Heartbeat </span>{hb}</span>'
            f'<span class="lg-only tabular text-subtle row__end"><span class="visually-hidden">Connected for </span>{since}</span>{revoke}</li>')


_WK_HEAD = ('<div class="rows__head" aria-hidden="true"><span>Host</span><span>Location</span><span>Version</span><span>Status</span><span>Working on</span>'
            '<span class="row__end">Heartbeat</span><span class="row__end">Connected</span><span class="visually-hidden">Actions</span></div>')
_WORKERS = (f'<div class="rows rows--workers">{_WK_HEAD}<ul>' + _worker_row("wk-7f3a", "quinn-mbp.local", "Local", "0.9.2", "Leased", "Ledgerline", "3s ago", "2h 14m")
            + _worker_row("wk-90bd", "hewn-cloud-eus-02", "Cloud", "0.9.2", "Idle", None, "8s ago", "5h 02m")
            + _worker_row("wk-4e18", "build-box-02", "Local", "0.9.1", "Offline", None, "4m ago", "—") + "</ul></div>")


def _user_row(login, initials, role, seen, removable):
    act = btn("Remove", "ghost", "sm", attrs='aria-label="Remove ' + login + '"') if removable else ""
    return (f'<li class="row"><span class="cluster"><span class="avatar" aria-hidden="true">{initials}</span><span class="mono">{login}</span></span>'
            f'<span class="text-sm">{role}</span><span class="text-xs text-subtle lg-only">Last sign-in: {seen}</span><span class="row__actions">{act}</span></li>')


_USERS = ('<div class="rows rows--users"><div class="rows__head" aria-hidden="true"><span>Login</span><span>Role</span><span>Last sign-in</span><span class="visually-hidden">Actions</span></div><ul>'
          + _user_row("quinntynebrown", "QB", "Owner", "Today, 08:02", False) + _user_row("ama-osei", "AO", "Viewer", "Today, 10:15", True)
          + _user_row("devon-park", "DP", "Viewer", "Never", True) + "</ul></div>")


def _plain_row(extra_cls="", attrs="", focus=False):
    f = ' data-state="focus"' if focus else ""
    return (f'<div class="rows"><ul><li class="row{extra_cls}"{attrs}><span class="truncate"><a class="row__title" href="#states"{f}>Tidewater</a>'
            f'<span class="row__sub">Tide and swell planner for small-boat charters</span></span><span class="row__end">{status("Running")}</span></li></ul></div>')


_DISABLED_ACT = (f'<div class="rows"><ul><li class="row"><span class="truncate"><span class="row__title">Ledgerline</span><span class="row__sub">Running</span></span>'
                 f'<span class="row__end"><span class="icon-action" role="button" aria-disabled="true" tabindex="0" aria-label="Delete Ledgerline: cancel the running direction first" title="Cancel the running direction first">{icon("trash")}</span></span></li></ul></div>')
_ROW_MATRIX = matrix(["Default", "Hover", "Focus", "Current", "Action unavailable"], [
    ("Row", [_plain_row(), _plain_row(" row--interactive", ' data-state="hover"'), _plain_row(focus=True), _plain_row(" row--current"), _DISABLED_ACT]),
])
_ROW_LOADING = _busy("Loading projects", '<div class="rows rows--projects"><ul>' + "".join(
    f'<li class="row" aria-hidden="true"><span class="stack stack--sm">{_sk("skeleton--w33")}{_sk("skeleton--w66 skeleton--sm")}</span>{_sk("skeleton--w75")}'
    f'<span class="lg-only">{_sk()}</span><span class="lg-only">{_sk()}</span><span class="lg-only">{_sk()}</span><span class="lg-only">{_sk()}</span></li>' for _ in range(3)) + "</ul></div>")
_ROW_ARCHIVED = ('<div class="rows rows--projects"><ul><li class="row"><span class="truncate"><span class="row__title">Saltmarsh Survey</span><span class="row__sub">Bird-count logging for estuary volunteers</span></span>'
                 f'<span class="row__end lg-hide">{status("Archived")}</span><span class="row__span truncate"><span>10 · Increments</span></span><span class="lg-only">{status("Archived")}</span>'
                 f'{_meter("Saltmarsh Survey", 100)}<span class="row__end tabular"><span class="visually-hidden">Spend </span>$288.15</span><span class="row__end text-subtle lg-only">12 Oct</span>'
                 f'<span class="row__actions">{btn("Restore", "", "sm", "rotate-ccw", attrs="aria-label=" + chr(34) + "Restore Saltmarsh Survey" + chr(34))}</span></li></ul></div>')

SPECS["row-list"] = {
    "lead": "Row lists show the objects people open and act on (projects, increments, workers, users) as rows that line up in columns on a laptop and stack into readable cards on a phone.",
    "readme_variants": "projects, projects (viewer), backlog, workers, workers (viewer), users",
    "readme_states": "default, hover, focus, current, action unavailable, loading, archived",
    "pills": ["<code>&lt;ul&gt;</code> / <code>&lt;ol&gt;</code> of rows"],
    "overview": f"""<p>Use a row list when each row is a thing with a name the reader opens, a status, a few facts and maybe row actions, and it must stay readable at 360px without sideways scrolling. Below lg every row is a small two-column card; from lg the same cells line up under a column head. Use a {page('components/table')} when people compare columns (the audit log) and scrolling is acceptable; use a {page('components/list')} for one-line items.</p>
{ul(["<b>Projects</b> (<code>.rows--projects</code>): name and idea, stage, status, percent complete, spend, last activity, archive and delete. Viewers get <code>.rows--projects-viewer</code> without the actions column.",
     "<b>Backlog</b> (<code>.rows--backlog</code>, an <code>&lt;ol&gt;</code>): number, increment, journey, requirements, estimate, status, PR. The increment in progress is <code>.row--current</code>.",
     "<b>Workers</b> (<code>.rows--workers</code>): host and ID, location, version, status, what it is working on, heartbeat, connected time, Revoke. Viewers get <code>.rows--workers-viewer</code>.",
     "<b>Users</b> (<code>.rows--users</code>): " + page('components/avatar', 'avatar') + " and login, role, last sign-in, Remove."])}""",
    "anatomy": (FULL + '<div class="rows">' + '<ul>' + _proj_row("Ledgerline", "Expense reconciliation for small accounting teams", "Running", "10 · Increments", "Increment 7 of 12 · implementing, iteration 3", 62, "$184.20", "4s ago", True) + "</ul></div>" + END,
                [(6, 14), (90, 14), (6, 48), (6, 72), (90, 72), (90, 92)],
                [("Title and sub", "<code>.row__title</code> (the link, body medium) over <code>.row__sub</code> (body-sm muted, truncates)."),
                 ("Status", "Below lg in the top-right cell (<code>.lg-hide</code>); from lg in its own column (<code>.lg-only</code>)."),
                 ("Spanning line", "<code>.row__span</code> takes the full width on phones: stage and <code>.row__note</code>."),
                 ("Facts", "Meter, money, times: tabular, with a visually hidden prefix (<i>Spend</i>) because the column head is hidden from screen readers."),
                 ("End cell", "<code>.row__end</code>: right-aligned numbers."),
                 ("Row actions", "<code>.row__actions</code>: 44px icon actions on phones, 32px from lg; a full-width bar below the facts on phones.")]),
    "variants": f"""<h3>Projects</h3>
{ex(_PROJECTS, "Archive and Delete are unavailable while a direction is Running, Paused or Blocked; their name and tooltip say why.", cls=STACK)}
<h3>Backlog</h3>
{ex(_BACKLOG, "An ordered list: the order is the journey order. Increment 7 is current.", cls=STACK)}
<h3>Workers</h3>
{ex(_WORKERS, "Offline workers show the heartbeat in danger ink and the status word Offline; the colour is never the only signal.", cls=STACK)}
<h3>Users</h3>
{ex(_USERS, "The Owner cannot be removed from here, so their row has no action.", cls=STACK)}""",
    "sizes": NA("Row lists have one density: 16px block padding stacked, 12px in columns (backlog rows are 12px at every width). Use a dense table for long logs."),
    "states": f"""<p>Rows are not focusable; the title link is. A row with <code>.row--interactive</code> tints on hover because the whole row opens its object; a row without it only underlines its title link. The current row (the increment being built) takes the accent tint.</p>
{_ROW_MATRIX}
<h3>Loading and archived</h3>
{ex(_ROW_LOADING, "Loading: skeleton rows in the same grid; the wrapper is <code>aria-busy</code> with a hidden “Loading projects”.", cls=STACK)}
{ex(_ROW_ARCHIVED, "Archived: the title is plain text (an archived project does not open) and the only action is Restore.", cls=STACK)}
{themes(FULL + _USERS + END)}""",
    "responsive": ul([
        "Base (below lg, 62rem): each row is a two-column grid, <code>minmax(0, 1fr) auto</code>: title and sub left, status right; <code>.row__span</code> and <code>.row__actions</code> take the full width; <code>.lg-only</code> cells are hidden and <code>.lg-hide</code> duplicates (the status) show.",
        "Backlog rows below lg: a 32px number column, the title, and the status; journey, requirements and PR stack under the title in column 2 (<code>.col2</code>).",
        "From lg: <code>.rows__head</code> appears and each variant applies its column template (projects: <code>2.2fr 1.3fr 8rem 7rem 7rem 6rem 6rem</code>, the last wide enough for Restore; workers: <code>1.6fr 6rem 5rem 7.5rem 1fr 6rem 6rem 5rem</code>; users: <code>1fr 8rem 10rem 6rem</code>), so cells line up as columns.",
        "Row actions are 44px (<code>--target-comfortable</code>) below lg and 32px (<code>--control-height-sm</code>) from lg.",
        "Text truncates with an ellipsis inside its cell; the row never scrolls horizontally."]),
    "theming": """<p>Rows read <code>--color-border-default</code> for the rule, <code>--color-bg-subtle</code> for hover and <code>--color-accent-subtle</code> for the current row; text inks are the semantic fg tokens. Column templates are layout geometry in rem and live with each variant; a new row list adds a <code>.rows--name</code> template, it does not restyle <code>.row</code>.</p>
<pre><code>/* A new row list: deployments */
@media (min-width: 62rem) {
  .rows--deploys .rows__head, .rows--deploys .row { grid-template-columns: minmax(0, 2fr) 8rem 6rem 6rem; }
}</code></pre>
<p>In dark the current-row tint is <code>--palette-blue-950</code>-deep and its text stays <code>--color-fg-default</code> (4.77:1 after the drift fix).</p>""",
    "a11y": {
        "pattern": "<p>A plain <code>&lt;ul&gt;</code> (or <code>&lt;ol&gt;</code> when order means something, as in the backlog) of <code>&lt;li class=\"row\"&gt;</code>; screen readers announce “list, 3 items”. The visual column head is <code>aria-hidden</code>, so every cell must make sense on its own: words in the cell (<i>Journey 4</i>, <i>2.5 d</i>, <i>Last sign-in: Today, 08:02</i>) or a visually hidden prefix (<i>Spend</i>, <i>Heartbeat</i>). See the APG note on <a href=\"https://www.w3.org/WAI/ARIA/apg/practices/structural-roles/\">structural roles</a> (list, listitem). Do not use <code>role=\"table\"</code> or <code>role=\"grid\"</code> on a row list.</p>",
        "keys": [(kbd("Tab") + " / " + kbd("Shift", "Tab"), "Title link, then each row action, then the next row."),
                 (kbd("Enter"), "Opens the row's object (the title link) or activates a focused action."),
                 (kbd("Space"), "Activates a focused row action button."),
                 ("Screen reader list keys", "Jump between rows as list items; each item reads title, sub, status, facts and actions in order.")],
        "focus": "<p>The shared ring on the title link and on each action. Unavailable actions (<code>aria-disabled=\"true\"</code> on <code>role=\"button\"</code>) stay focusable so their name can say why: <i>Delete Ledgerline: cancel the running direction first</i>. After Archive or Delete, focus moves to the next row's title, or to the list heading if it was the last row.</p>",
        "labelling": "<p>The title link's text is the object's name. Icon actions carry the verb and the object (<i>Archive Field Notes</i>). The percent meter has <code>aria-label=\"Ledgerline complete\"</code>. Duplicate status cells are fine: only one is displayed at a time and <code>display: none</code> removes the other from the accessibility tree.</p>",
        "pairs": [("Title on page", "--color-fg-default", "--color-bg-canvas", 4.5), ("Sub on page", "--color-fg-muted", "--color-bg-canvas", 4.5),
                  ("Note and activity", "--color-fg-subtle", "--color-bg-canvas", 4.5), ("Text on hovered row", "--color-fg-default", "--color-bg-subtle", 4.5),
                  ("Faint text on hovered row", "--color-fg-subtle", "--color-bg-subtle", 4.5), ("Text on current row", "--color-fg-default", "--color-accent-subtle", 4.5),
                  ("Muted text on current row", "--color-fg-muted", "--color-accent-subtle", 4.5), ("Focus ring on current row", "--color-focus-ring", "--color-accent-subtle", 3)],
        "motion": "<p>Hover tint fades over <code>--duration-fast</code>. Rows update in place as events arrive (status, percent, spend) without moving; a row that changes position (re-sorting by activity) does so on the next load, never under the pointer. Reduced motion stops the Running spinner and the skeleton shimmer.</p>",
        "touch": "<p>On phones the title is the main target; icon actions are 44px with 4px between them. Hover-only affordances do not exist: tooltips duplicate the accessible name and are not needed to understand the row.</p>",
    },
    "content": ul(["The title is the object's name as the person gave it (<i>Kiln Booking</i>); the sub is its one-line idea, cut with an ellipsis, never wrapped.",
                   "The spanning line says where it is and what is happening: <i>10 · Increments</i> then the note <i>Increment 7 of 12 · implementing, iteration 3</i>.",
                   "Relative times for activity and heartbeats (<i>4s ago</i>, <i>42m ago</i>, <i>Yesterday</i>); absolute dates once older than a week (<i>12 Oct</i>).",
                   "Empty facts say why: <i>Waiting for work</i>, <i>Lease released</i>, <i>Never</i>, not a blank.",
                   "Numbers are tabular; money always has two decimals (<i>$250.00</i>); estimates in ideal days with a unit (<i>2.5 d</i>)."]),
    "dodont": [
        (FULL + _plain_row() + END, "Make the object's name the link (<code>.row__title</code>), so the underline and focus ring sit on the text people read.",
         FULL + '<div class="rows"><ul><li class="row"><span class="truncate"><a href="#do-dont" style="color: inherit; text-decoration: none;">Reconcile a card statement</a></span><span class="row__end">' + status("In progress") + '</span></li></ul></div>' + END,
         "Backlog rows restyled their links inline (<code>color: inherit; text-decoration: none</code>): no hover underline, and the weight was set per row. Use <code>.row__title</code>; the current row's tint already marks it."),
        (FULL + '<div class="rows"><ul>' + _user_row("ama-osei", "AO", "Viewer", "Today, 10:15", True) + "</ul></div>" + END, "Avatars use the person's initials: <i>AO</i> for ama-osei, <i>QB</i> for quinntynebrown, matching the sidebar.",
         FULL + '<div class="rows"><ul>' + _user_row("ama-osei", "AM", "Viewer", "Today, 10:15", True) + "</ul></div>" + END, "Settings cut the first two letters of the login (<i>AM</i>, <i>QU</i>), so the Owner's avatar read QB in the sidebar and QU on the same screen."),
        (FULL + _PROJECTS.replace(_PROJ_HEAD, "") + END, "Hidden column heads mean each fact carries its own label for screen readers (<i>Spend $184.20</i>).",
         FULL + '<div class="rows"><ul><li class="row"><span class="row__title">Ledgerline</span><span class="row__end tabular">$184.20</span><span class="row__end text-subtle">4s ago</span></li></ul></div>' + END,
         "Bare figures under an <code>aria-hidden</code> head: a screen reader hears “Ledgerline, $184.20, 4s ago” with no idea what either is."),
    ],
    "tokens": [("Row rule", "--color-border-default"), ("Row padding stacked / columns", "--space-4 / --space-3"), ("Column gap / row gap", "--space-4 / --space-2"),
               ("Title", "--text-body / --font-weight-medium"), ("Title ink / hover", "--color-fg-default / --color-fg-accent"), ("Sub", "--text-body-sm / --color-fg-muted"),
               ("Note and head ink", "--color-fg-subtle"), ("Head type", "--text-caption"), ("Hover / current", "--color-bg-subtle / --color-accent-subtle"),
               ("Action size phone / desktop", "--target-comfortable / --control-height-sm"), ("Backlog number column", "--space-8"),
               ("Hover transition", "--duration-fast / --ease-standard")],
    "code": {"snippet": """<div class="rows rows--projects">
  <div class="rows__head" aria-hidden="true"><span>Project</span><span>Stage</span>…</div>
  <ul>
    <li class="row">
      <span class="truncate"><a class="row__title" href="/projects/ledgerline">Ledgerline</a>
        <span class="row__sub">Expense reconciliation for small accounting teams</span></span>
      <span class="row__end lg-hide"><span class="status status--run">…Running</span></span>
      <span class="row__span truncate"><span>10 · Increments</span><span class="row__note">Increment 7 of 12</span></span>
      <span class="lg-only"><span class="status status--run">…Running</span></span>
      <span class="pct">…62%</span>
      <span class="row__end tabular"><span class="visually-hidden">Spend </span>$184.20</span>
      <span class="row__end text-subtle lg-only"><span class="visually-hidden">Last activity </span>4s ago</span>
      <span class="row__actions"><button class="icon-action" type="button" aria-label="Archive Ledgerline">…</button></span>
    </li>
  </ul>
</div>""",
             "classes": [("<code>.rows</code> + <code>.rows--projects|projects-viewer|backlog|workers|workers-viewer|users</code>", "Container and column template from lg."),
                         ("<code>.rows__head</code>", "Column head, shown from lg; always <code>aria-hidden</code>."),
                         ("<code>.row</code>", "One record: two-column grid below lg, the variant's columns from lg."),
                         ("<code>.row--interactive</code>", "Whole row opens its object: pointer cursor and hover tint."),
                         ("<code>.row--current</code>", "The item being worked on (accent tint)."),
                         ("<code>.row__title</code> <code>.row__sub</code> <code>.row__note</code>", "Name link, one-line idea, small note."),
                         ("<code>.row__span</code>", "Full width below lg; one column from lg."),
                         ("<code>.row__end</code>", "Right-aligned cell."),
                         ("<code>.row__actions</code>", "Row action bar; full width below lg."),
                         ("<code>.lg-only</code> / <code>.lg-hide</code>", "Cell shown only from lg / only below lg."),
                         ("<code>.col2</code>", "Backlog: stack into the title column below lg.")]},
    "sources": {"mocks": [("pages/projects/default", "projects rows"), ("pages/projects/viewer", "viewer columns"), ("pages/projects/archived", "Restore"),
                          ("pages/projects/loading", "skeleton rows"), ("pages/backlog/default", "backlog"), ("pages/backlog/blocked-increment", "current row"),
                          ("pages/workers/default", "workers"), ("pages/settings/default", "users")],
                "drift": "13px host names snapped to <code>--font-size-sm</code>; the workers' heartbeat cell used an undefined <code>.lg-row-end</code> class; backlog titles restyled inline instead of <code>.row__title</code>; user avatars took the first two letters of the login; spend and activity figures had no label once the head is hidden. All corrected here."},
}


# ============================================================== list
_DEFERRED = [("Multi-currency reconciliation", "L2-031, L2-032 · 7 d", "Estimated 7 days; could not be split below 3. Single-currency covers every journey."),
             ("Slack digest of unmatched items", "L2-034 · 1.5 d", "Listed as nice-to-have in the brief."),
             ("Receipt OCR confidence tuning", "L2-035 · 2 d", "Off the main path of every journey.")]
_LIST_TWO = ('<ul class="list list--divided">' + "".join(
    f'<li>{status("Deferred", "")}<span class="list__text"><span class="list__title">{t}</span><span class="list__sub">{m} · {r}</span></span></li>' for t, m, r in _DEFERRED) + "</ul>")
_LIST_SIMPLE = ('<ul class="list">' + "".join(f'<li>{status_icon(s, "icon--sm")}<span class="list__text">{t}<span class="visually-hidden"> ({s})</span></span></li>'
                for s, t in [("Succeeded", "Backend tests"), ("Running", "End-to-end tests"), ("Pending", "Accessibility checks")]) + "</ul>")


def _llink(title, sub, attrs=""):
    return f'<a class="list__link" href="#variants"{attrs}>{icon("folder-kanban")}<span class="list__text"><span class="list__title">{title}</span><span class="list__sub">{sub}</span></span></a>'


_LIST_LINKS = ('<ul class="list">' + f'<li>{_llink("Ledgerline", "Stage 10 · Increments", " aria-current=" + chr(34) + "true" + chr(34))}</li>'
               + f'<li>{_llink("Tidewater", "Stage 3 · Design system")}</li><li>{_llink("Parcel Post", "Stage 5 · Requirements")}</li></ul>')
_EVENTS = [("14:31:07", "Ledgerline", "merge", "ok", "#27 Split a transaction · squash-merged"), ("14:30:44", "Tidewater", "spend", "", "+$0.42 · claude-sonnet · 18.2k tokens"),
           ("14:28:51", "Ledgerline", "log", "", "Frontend: lint clean, 236 unit tests passed"), ("14:26:58", "Kiln Booking", "stage", "warn", "Paused · Budget reached"),
           ("14:26:02", "Ledgerline", "decision", "accent", "Normalise posting dates to account time zone")]
_EVENT_LIST = ('<ol class="events" aria-live="off">' + "".join(
    f'<li class="event"><time class="text-subtle" datetime="2026-11-09T{t}">{t}</time><span class="event__project">{p}</span>'
    f'<span class="truncate"><span class="event__kind{" event__kind--" + k if k else ""}">{kind}</span>{txt}</span></li>' for t, p, kind, k, txt in _EVENTS) + "</ol>")


def _pr(n, proj, title, merged, when, attrs=""):
    ic = icon("git-merge" if merged else "git-pr", "s-icon--ok" if merged else "s-icon--run", "Merged" if merged else "Open")
    meta = ("Merged " + when) if merged else when
    return f'<a class="pr" href="#variants"{attrs}>{ic}<span class="truncate"><span class="pr__title">{title}</span><span class="pr__meta">{proj} #{n} · {meta}</span></span></a>'


_PRS = ('<ul class="divided">' + f'<li>{_pr(27, "Ledgerline", "Split a transaction", True, "14 min ago")}</li>'
        + f'<li>{_pr(41, "Kiln Booking", "Reschedule a firing", True, "51 min ago")}</li><li>{_pr(28, "Ledgerline", "Reconcile a card statement", False, "opened 9 min ago")}</li></ul>')


def _file(p, sha, when, folder=False):
    return (f'<li class="file"><span class="file__path">{icon("folder" if folder else "file-text", "icon--sm")}<span class="truncate">{p}</span></span>'
            f'<span class="file__sha">{sha}</span><span class="file__when">{when}</span>'
            f'<a class="file__open" href="#variants" aria-label="Open {p} on GitHub at {sha}">{icon("external", "icon--sm")}</a></li>')


_FILES = (f'<h4 class="group-title">{status_icon("Succeeded", "icon--sm")}<span class="visually-hidden">Succeeded:</span><span class="n">9</span><strong>Estimates</strong></h4>'
          '<ul class="files mt-2">' + _file("docs/estimates/README.md", "19f4a8c", "8 Nov, 16:44") + _file("docs/estimates/reconciliation.md", "19f4a8c", "8 Nov, 16:44")
          + _file("docs/detailed-designs/reconciliation/", "0b3c4f9", "8 Nov, 16:02", True) + "</ul>")
_CHECKS = [("backend · dotnet test", "Succeeded", "412 passed · 1m 48s"), ("frontend · lint + unit", "Succeeded", "236 passed · 52s"),
           ("e2e · behavior", "Running", "96 of 152 · 2m 41s"), ("e2e · a11y (axe-core)", "Pending", "queued")]
_CHECK_LIST = ('<ul class="checks" aria-live="polite">' + "".join(
    f'<li>{status_icon(s, "icon--sm")}<span class="visually-hidden">{s}:</span><span class="checks__name">{n}</span><span class="checks__d">{d}</span></li>' for n, s, d in _CHECKS) + "</ul>")
_PLAN_ITEMS = [("Bootstrap", ".hewn/skills.lock", True), ("Idea", "docs/brief.md", False), ("Stack", "docs/adr/0001-stack.md", True), ("Requirements", "docs/specs/", False),
               ("Increments", "Test → Code → Video → PR", False)]
_PLAN = ('<ol class="plan">' + "".join(
    f'<li>{status_icon("Skipped" if sk else "Pending", "icon--sm")}<span class="visually-hidden">{"Skipped" if sk else "Pending"}:</span>'
    f'<span class="{"skip" if sk else ""}">{n}</span><span class="out">{"skipped" if sk else o}</span></li>' for n, o, sk in _PLAN_ITEMS) + "</ol>")
_MINI = ('<ul class="mini-list">' + f'<li>{status_icon("Running", "icon--xs")}<span class="visually-hidden">Running:</span><span class="mono">quinn-mbp.local</span><span class="text-subtle">Ledgerline</span></li>'
         + f'<li>{status_icon("Running", "icon--xs")}<span class="visually-hidden">Running:</span><span class="mono">hewn-cloud-eus-01</span><span class="text-subtle">Tidewater</span></li>'
         + f'<li>{status_icon("Idle", "icon--xs")}<span class="visually-hidden">Idle:</span><span class="mono">hewn-cloud-eus-02</span><span class="text-subtle">Idle</span></li></ul>')


def _req(rid, title, attrs="", flag=""):
    return f'<a class="req-link" href="#variants"{attrs}><span class="req-link__id">{rid}</span><span class="req-link__title">{title}</span>{flag}</a>'


_REQS = ('<ul class="req-list" style="margin-top: 0;">' + f'<li>{_req("L2-013", "Match a receipt by photo")}</li>'
         + f'<li>{_req("L2-018", "Match card lines to transactions within a tolerance", " aria-current=" + chr(34) + "true" + chr(34))}</li>'
         + f'<li>{_req("L2-020", "Close a period after review", "", icon("alert-circle", "icon--xs s-icon--warn", "No acceptance test"))}</li>'
         + f'<li>{_req("L2-031", "Reconcile in a second currency", "", "<span class=" + chr(34) + "req-link__flag" + chr(34) + ">Deferred</span>")}</li></ul>')

_CUR = ' aria-current="true"'
_LIST_MATRIX = matrix(["Default", "Hover", "Focus", "Current"], [
    ("List link", [_llink("Tidewater", "Stage 3"), _llink("Tidewater", "Stage 3", ' data-state="hover"'), _llink("Tidewater", "Stage 3", ' data-state="focus"'), _llink("Tidewater", "Stage 3", _CUR)]),
    ("Pull request", [_pr(27, "Ledgerline", "Split a transaction", True, "14 min ago"), _pr(27, "Ledgerline", "Split a transaction", True, "14 min ago", ' data-state="hover"'),
                      _pr(27, "Ledgerline", "Split a transaction", True, "14 min ago", ' data-state="focus"'), _na("Not used: a PR opens its increment page")]),
    ("Requirement link", [_req("L2-019", "Use the account’s time zone"), _req("L2-019", "Use the account’s time zone", ' data-state="hover"'),
                          _req("L2-019", "Use the account’s time zone", ' data-state="focus"'), _req("L2-019", "Use the account’s time zone", _CUR)]),
])

SPECS["list"] = {
    "lead": "Lists stack short items of one kind: events as they stream in, pull requests, files in a commit, required checks, the stages that run next. Each item is a line or two, never a table row.",
    "readme_variants": "simple, two-line with dividers, interactive (link), event stream, pull requests, files, checks, plan, mini list, requirement links",
    "readme_states": "default, hover, focus, current, skipped, running, pending",
    "pills": ["<code>&lt;ul&gt;</code> / <code>&lt;ol&gt;</code>"],
    "overview": f"""<p>Use a list when items have one or two attributes and are read top to bottom. Use a {page('components/row-list', 'row list')} when items carry several facts and actions; a {page('components/table')} when people compare columns; a {page('components/timeline')} when the items are steps in time.</p>
{ul(["<b>Simple</b> and <b>two-line</b> (<code>.list</code>, <code>.list--divided</code>): an icon, a title, an optional sub line.",
     "<b>Interactive</b> (<code>.list__link</code>): each item is a link; the current one has <code>aria-current</code>.",
     "<b>Event stream</b> (<code>.events</code>): time, project, kind and text in mono, newest first.",
     "<b>Pull requests</b> (<code>.pr</code>): merged or open icon, title, project and number.",
     "<b>Files</b> (<code>.files</code>): path, commit, time and a GitHub link, grouped under a stage heading.",
     "<b>Checks</b> (<code>.checks</code>) and <b>plan</b> (<code>.plan</code>): a status icon per line with its output or duration on the right.",
     "<b>Mini list</b> (<code>.mini-list</code>): caption-size lines inside dialogs and tiles.",
     "<b>Requirement links</b> (<code>.req-list</code>): the traceability page's L2 picker."])}""",
    "anatomy": (FULL + '<ul class="list list--divided">' + f'<li>{status("Deferred", "")}<span class="list__text"><span class="list__title">Multi-currency reconciliation</span><span class="list__sub">L2-031, L2-032 · 7 d</span></span></li></ul>' + END,
                [(4, 50), (16, 30), (16, 72), (60, 98)],
                [("Leading icon", "A status icon (with its word, visually hidden), a file or folder icon, or a PR icon; 14–16px."),
                 ("Title", "<code>.list__title</code>, body-sm in <code>--color-fg-default</code>."),
                 ("Sub", "<code>.list__sub</code>, caption in <code>--color-fg-subtle</code>; metadata separated by middots."),
                 ("Divider", "<code>.list--divided</code> adds a hairline between items (decorative).")]),
    "variants": f"""<h3>Simple and two-line</h3>
{ex(_LIST_SIMPLE + _LIST_TWO, "Simple lines for checks; two-line items for the backlog's deferred increments with their reason.", cls=STACK)}
<h3>Interactive</h3>
{ex(_LIST_LINKS, "Each item is one link; the current project is marked with <code>aria-current=&quot;true&quot;</code>.", cls=STACK)}
<h3>Event stream</h3>
{ex(_EVENT_LIST, "Mono, newest first; the kind is coloured and is also the first word. The project column appears from sm.", cls=STACK)}
<h3>Pull requests</h3>
{ex(_PRS, "The icon names the state (Merged or Open) for screen readers.", cls=STACK)}
<h3>Files</h3>
{ex(_FILES, "Grouped by stage; the commit is the version. Below sm the time drops under the path.", cls=STACK)}
<h3>Checks, plan and mini list</h3>
{ex(_CHECK_LIST, "Required checks update in place in a polite live region.", cls=STACK)}
{ex(_PLAN, "What runs next: skipped stages are struck through and say <i>skipped</i>.", cls=STACK)}
{ex(_MINI, "Inside the stop-workers dialog: the workers that will stop.", cls=STACK)}
<h3>Requirement links</h3>
{ex(_REQS, "A horizontal strip of IDs below lg; a vertical list with titles from lg. Flags say <i>No acceptance test</i> or <i>Deferred</i>.", cls=STACK)}""",
    "sizes": f"""<p>Two text sizes. Lists default to body-sm (14px) with <code>--space-2-5</code> between items; the mini list and event stream use caption or code type (12px) with <code>--space-1</code> to <code>--space-1-5</code>, for dense surfaces.</p>
{ex(_LIST_SIMPLE + _MINI, "Default list, then the mini list.", cls=STACK)}""",
    "states": f"""<p>Only interactive items have pointer and focus states; the rest are static and change by content (a check goes from Pending to Running to Succeeded in place).</p>
{_LIST_MATRIX}
<h3>Item states by content</h3>
{ex(_CHECK_LIST + _PLAN, "Succeeded, Running (spinning), Pending and Skipped; the word is always present for screen readers.", cls=STACK)}
{themes(FULL + _PRS + END)}""",
    "responsive": ul([
        "Lists are one column at every width and never scroll sideways; long text truncates inside the item.",
        "Event stream: time and text below sm; a 6.5rem project column joins from sm (36rem).",
        "Files: path and commit on one line, time underneath, below sm; from sm a four-column grid (path, commit, time, open).",
        "Requirement links: a horizontally scrolling strip of IDs with 44px targets below lg; a vertical list with titles and 32px rows from lg (62rem).",
        "Interactive items stretch to the full width, so the whole line is the target on a phone."]),
    "theming": """<p>Lists read the fg tokens for text, <code>--color-border-default</code> for dividers, <code>--color-bg-subtle</code> (links) or <code>--color-bg-subtle-hover</code> (PRs) for hover and <code>--color-accent-subtle</code> for the current item. Event kinds use the status fg tokens (<code>--color-success-fg</code>, <code>--color-warning-fg</code>, <code>--color-fg-accent</code>, <code>--color-danger-strong</code>). The requirement link hovers to <code>--color-bg-surface-raised</code> because it sits on the page canvas.</p>""",
    "a11y": {
        "pattern": "<p><code>&lt;ul&gt;</code> for sets, <code>&lt;ol&gt;</code> for sequences (events, plan, timeline). Interactive items are native links, following the <a href=\"https://www.w3.org/WAI/ARIA/apg/patterns/link/\">APG link pattern</a>; the current one has <code>aria-current=\"true\"</code> (or <code>\"page\"</code> when it is the page). Live lists: checks are <code>aria-live=\"polite\"</code>; the event stream is <code>aria-live=\"off\"</code> because it changes several times a second.</p>",
        "keys": [(kbd("Tab") + " / " + kbd("Shift", "Tab"), "Moves through the links in the list, one per item."),
                 (kbd("Enter"), "Follows the focused link."),
                 ("Screen reader list keys", "Jump item to item; the list announces its length.")],
        "focus": "<p>The shared ring on each link. In the requirement strip the current ID scrolls into view on load so it is not hidden off the edge.</p>",
        "labelling": "<p>Icons that carry state are labelled: PR icons have <code>role=\"img\"</code> and <i>Merged</i> or <i>Open</i>; status icons are followed by a visually hidden word (<i>Running:</i>). File open links name the file and commit: <i>Open docs/estimates/README.md on GitHub at 19f4a8c</i>. Event times are <code>&lt;time datetime&gt;</code>.</p>",
        "pairs": [("Item text on surface", "--color-fg-default", "--color-bg-surface", 4.5), ("Sub and times on surface", "--color-fg-subtle", "--color-bg-surface", 4.5),
                  ("PR meta on hover", "--color-fg-subtle", "--color-bg-subtle-hover", 4.5), ("Current item text", "--color-fg-default", "--color-accent-subtle", 4.5),
                  ("Commit and accent kind", "--color-fg-accent", "--color-bg-surface", 4.5), ("Merge kind", "--color-success-fg", "--color-bg-surface", 4.5),
                  ("Stage kind", "--color-warning-fg", "--color-bg-surface", 4.5), ("Status icon, succeeded", "--color-success-icon", "--color-bg-surface", 3)],
        "motion": "<p>New events slide in at the top without animation; the list does not scroll under the reader. Running icons spin and stop under reduced motion; hover tints change over <code>--duration-fast</code>.</p>",
        "touch": "<p>List links fill the width with 8px padding (at least 36px tall with two lines); requirement links are 44px below lg. The file's GitHub link is 32px; on phones the path should also be a link (see Do and don't).</p>",
    },
    "content": ul(["Titles are names or outcomes, not sentences: <i>Split a transaction</i>, <i>backend · dotnet test</i>.",
                   "Sub lines are metadata joined with middots: <i>Ledgerline #27 · Merged 14 min ago</i>.",
                   "Event kinds are lower-case single words (<i>merge</i>, <i>spend</i>, <i>log</i>, <i>stage</i>, <i>decision</i>, <i>check</i>, <i>artifact</i>).",
                   "Check details give the count and duration: <i>412 passed · 1m 48s</i>; queued checks say <i>queued</i>.",
                   "Paths are repository-relative and folders end with a slash: <i>docs/detailed-designs/reconciliation/</i>."]),
    "dodont": [
        (FULL + _CHECK_LIST + END, "Status icons are followed by a visually hidden word, so “Running: e2e · behavior” is read.",
         FULL + '<ul class="checks"><li>' + icon("loader", "s-icon--run icon--spin icon--sm") + '<span class="checks__name">e2e · behavior</span><span class="checks__d">96 of 152</span></li></ul>' + END,
         "An unlabelled spinning icon: the state is colour and motion only, and silent to a screen reader."),
        (FULL + '<ul class="files">' + '<li class="file"><span class="file__path">' + icon("file-text", "icon--sm") + '<a class="truncate" href="#do-dont">docs/estimates/README.md</a></span><span class="file__sha">19f4a8c</span><span class="file__when">8 Nov, 16:44</span></li></ul>' + END,
         "Make the path itself the link on phones, so the file opens from any width.",
         FULL + '<ul class="files">' + _file("docs/estimates/README.md", "19f4a8c", "8 Nov, 16:44") + "</ul>" + END,
         "Artifacts hides <code>.file__open</code> below sm, so on a phone there is no way to open the file on GitHub."),
        (FULL + _LIST_TWO + END, "A two-line list for items with a reason: the deferred increments.",
         FULL + '<ul class="files"><li class="file" style="grid-template-columns: minmax(0, 1fr);"><span class="cluster">' + status("Deferred", "") + '<span class="text-sm">Multi-currency reconciliation</span></span><span class="text-sm text-muted">Estimated 7 days; could not be split below 3.</span></li></ul>' + END,
         "The backlog borrowed the file list and overrode its grid inline. Each list kind has one job; use <code>.list--divided</code>."),
    ],
    "tokens": [("Item text", "--text-body-sm / --color-fg-default"), ("Sub and times", "--text-caption / --color-fg-subtle"), ("Item gap / padding", "--space-3 / --space-2-5"),
               ("Divider", "--color-border-default"), ("Link hover / current", "--color-bg-subtle / --color-accent-subtle"), ("PR hover", "--color-bg-subtle-hover"),
               ("Requirement hover", "--color-bg-surface-raised"), ("Event and check type", "--text-code"), ("Commit ink", "--color-fg-accent"),
               ("Event kinds", "--color-success-fg / --color-warning-fg / --color-fg-accent / --color-danger-strong"), ("Mini list", "--text-caption / --space-1"),
               ("Link radius", "--radius-sm"), ("Requirement target phone / desktop", "--target-comfortable / --control-height-sm")],
    "code": {"snippet": """<ul class="list list--divided">
  <li><span class="status status--muted"><svg class="icon" aria-hidden="true">…</svg><span class="visually-hidden">Deferred</span></span>
    <span class="list__text"><span class="list__title">Multi-currency reconciliation</span>
      <span class="list__sub">L2-031, L2-032 · 7 d · Estimated 7 days; could not be split below 3.</span></span></li>
</ul>
<ol class="events" aria-live="off">
  <li class="event"><time class="text-subtle" datetime="2026-11-09T14:31:07">14:31:07</time><span class="event__project">Ledgerline</span>
    <span class="truncate"><span class="event__kind event__kind--ok">merge</span>#27 Split a transaction · squash-merged</span></li>
</ol>""",
             "classes": [("<code>.list</code> <code>.list--divided</code>", "Generic list; dividers between items."),
                         ("<code>.list__text</code> <code>.list__title</code> <code>.list__sub</code>", "Text column, title, sub line."),
                         ("<code>.list__link</code> + <code>aria-current</code>", "Interactive item; current tint."),
                         ("<code>.events</code> <code>.event</code> <code>.event__project</code> <code>.event__kind--ok|warn|accent|fail</code>", "Event stream."),
                         ("<code>.pr</code> <code>.pr__title</code> <code>.pr__meta</code>", "Pull request item (a link)."),
                         ("<code>.files</code> <code>.file</code> <code>.file__path</code> <code>.file__sha</code> <code>.file__when</code> <code>.file__open</code> <code>.group-title</code>", "Files grouped by stage."),
                         ("<code>.checks</code> <code>.checks__name</code> <code>.checks__d</code>", "Required checks."),
                         ("<code>.plan</code> <code>.out</code> <code>.skip</code>", "Stage plan; skipped stages."),
                         ("<code>.mini-list</code>", "Caption-size list in dialogs and tiles."),
                         ("<code>.req-list</code> <code>.req-link</code> <code>.req-link__id|title|flag</code>", "Requirement picker.")]},
    "sources": {"mocks": [("pages/dashboard/default", "events and pull requests"), ("pages/artifacts/default", "files"), ("pages/increment/default", "checks"),
                          ("pages/new-direction/feature", "plan with skipped stages"), ("dialogs/stop-workers/default", "mini list"), ("dialogs/update-skills/default", "mini list of commits"),
                          ("pages/traceability/default", "requirement links"), ("pages/backlog/default", "deferred list")],
                "drift": "13px file paths snapped to <code>--font-size-sm</code>; event times become <code>&lt;time&gt;</code>; the deferred list moves from an overridden <code>.file</code> grid to <code>.list--divided</code>; phone users get a link on the file path because <code>.file__open</code> is hidden below sm."},
}


# ============================================================== description list
_KV = [("What", "Match card transactions to statement lines with a ±$0.50 tolerance and account-time-zone dates."),
       ("Design and decisions", "Posting dates use the account’s time zone (decision a41c9e2)."),
       ("Deferred", "Multi-currency (L2-031, L2-032)."),
       ("Notes", "Red recorded before implementation.")]
_KV_HTML = '<dl class="kv">' + "".join(f"<div><dt>{k}</dt><dd>{v}</dd></div>" for k, v in _KV) + "</dl>"
_KV_ROW = ('<dl class="kv kv--row">' + "".join(f"<div><dt>{k}</dt><dd>{v}</dd></div>" for k, v in
           [("Repository", "hewn-builds/ledgerline"), ("Branch", "feature/reconcile-card-statement"), ("Estimate", "2.5 ideal days"), ("Requirements", "L2-018, L2-019")]) + "</dl>")


def _meta(skill, output, duration, worker):
    return (f'<dl class="meta"><div><dt>Skill</dt><dd class="mono">{skill}</dd></div><div><dt>Output</dt><dd class="mono">{output}</dd></div>'
            f'<div><dt>Duration</dt><dd>{duration}</dd></div><div><dt>Worker</dt><dd>{worker}</dd></div></dl>')


_META = _meta("implementing-incrementally", "Test → Code → Video → PR", "3:12:48", "quinn-mbp.local · Local")
_META_EMPTY = _meta("Copy from Greenlit", ".hewn/skills.lock", "—", "Not leased yet")
_META_LONG = _meta("writing-software-design-documents", "docs/detailed-designs/", "22:16", "build-box-01 · Local")
_DL_LOADING = _busy("Loading stage details", '<div class="meta">' + "".join(f'<div style="width: 7rem;">{_sk()}</div>' for _ in range(4)) + "</div>")

SPECS["description-list"] = {
    "lead": "Description lists pair a label with a value: a stage's skill, output, duration and worker; the sections of a pull request body. The label is quiet, the value is what people read.",
    "readme_variants": "vertical (kv), horizontal (kv--row), inline meta",
    "readme_states": "default, missing value, truncated, loading",
    "pills": ["Native <code>&lt;dl&gt;</code>"],
    "overview": f"""<p>Use a description list for facts about one object, where each fact has a name. Use a {page('components/table')} when the same facts repeat for many objects, and a {page('components/list')} when items have no labels.</p>
{ul(["<b>Vertical</b> (<code>.kv</code>): label above value, for long values such as the PR body's <i>What</i>, <i>Tests</i> and <i>Notes</i>.",
     "<b>Horizontal</b> (<code>.kv--row</code>): an 8rem label column beside the value, for short facts on a detail page.",
     "<b>Inline meta</b> (<code>.meta</code>): label and value pairs that wrap as a line under a heading: a stage's <i>Skill</i>, <i>Output</i>, <i>Duration</i>, <i>Worker</i>."])}""",
    "anatomy": (FULL + _META + END, [(4, 40), (22, 40), (2, 10)],
                [("Term", "<code>&lt;dt&gt;</code>: caption (kv) or body-sm (meta) in <code>--color-fg-subtle</code>."),
                 ("Value", "<code>&lt;dd&gt;</code>: <code>--color-fg-muted</code>; mono for skills, paths and hosts (<code>.mono</code>)."),
                 ("Group", "Each pair is wrapped in a <code>&lt;div&gt;</code> (valid inside <code>&lt;dl&gt;</code>) so it lays out as a unit.")]),
    "variants": f"""<h3>Vertical</h3>
{ex(_KV_HTML, "The pull request body on the increment page.", cls=STACK)}
<h3>Horizontal</h3>
{ex(_KV_ROW, "Label column 8rem, value fills the rest and wraps.", cls=STACK)}
<h3>Inline meta</h3>
{ex(_META, "Stage 10's facts under its title; pairs wrap onto new lines as space runs out.", cls=STACK)}""",
    "sizes": NA("One size each: kv uses body-sm values with caption labels; meta uses body-sm for both. Density comes from the variant, not a size modifier."),
    "states": f"""<p>Description lists are static; their states are about content.</p>
{ex(_META_EMPTY, "Missing value: an em dash (Duration) or a sentence that says why (<i>Not leased yet</i>), never an empty <code>&lt;dd&gt;</code>.", cls=STACK)}
{ex('<div style="max-width: 20rem;">' + _META_LONG + "</div>", "Truncated: a meta value longer than its line ends with an ellipsis; the full value is in the stage's artifact list.", cls=STACK)}
{ex(_DL_LOADING, "Loading: skeleton bars in the value positions; the container is <code>aria-busy</code>.", cls=STACK)}
{themes(FULL + _KV_ROW + END)}""",
    "responsive": ul([
        "<code>.kv</code> is one column at every width.",
        "<code>.kv--row</code> keeps the 8rem label column down to 360px; values wrap. If labels are longer than 8rem, use <code>.kv</code>.",
        "<code>.meta</code> wraps pairs onto new lines (gap <code>--space-1</code> by <code>--space-6</code>); each value truncates rather than pushing the line wider than the screen."]),
    "theming": "<p>Terms read <code>--color-fg-subtle</code> and values <code>--color-fg-muted</code>; both pass 4.5:1 on canvas and surface in both themes. Inline code inside values uses the code type at 0.92em. No component tokens: the list is pure type and colour.</p>",
    "a11y": {
        "pattern": "<p>Native <code>&lt;dl&gt;</code>, <code>&lt;dt&gt;</code>, <code>&lt;dd&gt;</code> with <code>&lt;div&gt;</code> groups; screen readers announce term and definition pairs. No widget pattern applies (see the APG note on <a href=\"https://www.w3.org/WAI/ARIA/apg/practices/structural-roles/\">structural roles</a>: term, definition).</p>",
        "keys": [(kbd("Tab"), "Reaches links inside values (a commit, an ADR); the list itself is not focusable.")],
        "focus": "<p>Only links inside values take focus, with the shared ring.</p>",
        "labelling": "<p>Every value has a visible term. A term may be visually hidden only when the value explains itself (the PR body's attribution line, <i>Built by Hewn · direction 7 Nov · run-0412</i>).</p>",
        "pairs": [("Term on page", "--color-fg-subtle", "--color-bg-canvas", 4.5), ("Value on page", "--color-fg-muted", "--color-bg-canvas", 4.5),
                  ("Term on surface", "--color-fg-subtle", "--color-bg-surface", 4.5), ("Value on surface", "--color-fg-muted", "--color-bg-surface", 4.5)],
        "motion": "<p>None. Values that change live (Duration while a stage runs) update in place without animation and are not live regions.</p>",
        "touch": "<p>Not interactive. Links in values follow the link rules (the text is the target).</p>",
    },
    "content": ul(["Terms are short nouns in sentence case: <i>Skill</i>, <i>Output</i>, <i>Duration</i>, <i>Worker</i>, <i>Design and decisions</i>.",
                   "Values are fragments or one sentence, ending with a full stop only when they are sentences.",
                   "Durations as h:mm:ss or m:ss (<i>3:12:48</i>, <i>22:16</i>); hosts with their location (<i>quinn-mbp.local · Local</i>).",
                   "Missing values say why or use an em dash."]),
    "dodont": [
        (FULL + _META_EMPTY + END, "Say why a value is missing: <i>Not leased yet</i>, or an em dash for a duration that has not started.",
         FULL + '<dl class="meta"><div><dt>Duration</dt><dd></dd></div><div><dt>Worker</dt><dd></dd></div></dl>' + END, "Empty values: the terms dangle and a screen reader reads “Duration, Worker” with nothing after."),
        (FULL + _KV_ROW + END, "Use <code>&lt;dl&gt;</code> for label-value pairs, so the pairing is announced.",
         FULL + '<p class="text-sm text-muted">Repository: hewn-builds/ledgerline · Branch: feature/reconcile-card-statement · Estimate: 2.5 ideal days</p>' + END, "One run-on paragraph of colon pairs: hard to scan and the structure is lost."),
    ],
    "tokens": [("Term (kv)", "--text-caption / --color-fg-subtle"), ("Value", "--text-body-sm / --color-fg-muted"), ("Term (meta)", "--color-fg-subtle"),
               ("Mono value", "--text-code / --line-height-loose"), ("Pair gap (kv)", "--space-2-5"), ("Label column gap (kv--row)", "--space-3"),
               ("Meta gaps", "--space-1 / --space-6"), ("Meta offset", "--space-2")],
    "code": {"snippet": """<dl class="meta">
  <div><dt>Skill</dt><dd class="mono">implementing-incrementally</dd></div>
  <div><dt>Output</dt><dd class="mono">Test → Code → Video → PR</dd></div>
  <div><dt>Duration</dt><dd>3:12:48</dd></div>
  <div><dt>Worker</dt><dd>quinn-mbp.local · Local</dd></div>
</dl>""",
             "classes": [("<code>.kv</code>", "Vertical pairs: term above value."),
                         ("<code>.kv--row</code>", "With <code>.kv</code>: 8rem term column."),
                         ("<code>.meta</code>", "Inline pairs that wrap; values truncate."),
                         ("<code>.mono</code> on <code>dd</code>", "Code type for skills, paths and hosts.")]},
    "sources": {"mocks": [("pages/project-pipeline/default", "stage meta"), ("pages/project-pipeline/empty", "missing values"), ("pages/increment/default", "PR body"),
                          ("pages/increment/merged", "PR body, merged")],
                "drift": "none specific; mono values follow the 13px to 14px snap and the loose code line height."},
}


# ============================================================== avatar
def _av(initials, cls="", status_dot=False, label=None):
    c = "avatar" + (" " + cls if cls else "")
    dot = '<span class="avatar__status"></span>' if status_dot else ""
    a = f' role="img" aria-label="{label}"' if label else ' aria-hidden="true"'
    return f'<span class="{c}"{a}>{initials}{dot}</span>'


_AV_SIZES = _av("QB", "avatar--sm") + _av("QB") + _av("QB", "avatar--lg")
_AV_USER = (f'<div class="cluster">{_av("QB")}<span class="truncate"><span class="text-sm" style="display: block;">quinntynebrown</span>'
            '<span class="text-caption">Owner</span></span></div>')
_AV_GROUP = ('<div class="cluster"><span class="avatar-group" role="img" aria-label="Signed in today: quinntynebrown, ama-osei">'
             + _av("QB") + _av("AO") + '</span><span class="text-caption">2 signed in today</span></div>')
_AV_ICON = f'<span class="avatar" role="img" aria-label="Hewn (automatic)">{icon("git-merge", "icon--sm")}</span>'

SPECS["avatar"] = {
    "lead": "Avatars mark a person with their initials in a small circle: the signed-in Owner in the sidebar, each login on the allow list. They sit beside the name, never instead of it.",
    "readme_variants": "initials, icon (system actor), group; with status dot",
    "readme_states": "default, signed in (status), never signed in, loading",
    "overview": f"""<p>Use an avatar next to a person's login to make lists of people quicker to scan. Hewn has no profile photos yet; avatars are initials. The image variant (a GitHub avatar in <code>&lt;img&gt;</code>) is reserved and shown under Code. Use a {page('components/badge', 'status')} for state, not the avatar's colour.</p>
{ul(["<b>Initials</b>: two letters from the person's name (<i>QB</i> for quinntynebrown, Quinntyne Brown), or from the login's two parts (<i>AO</i> for ama-osei, <i>DP</i> for devon-park).",
     "<b>Icon</b>: a system actor, such as Hewn itself merging a pull request.",
     "<b>Group</b> (<code>.avatar-group</code>): overlapping avatars for a few people at once.",
     "<b>Status dot</b> (<code>.avatar__status</code>): signed in now. Always paired with text that says so."])}""",
    "anatomy": ('<span class="avatar avatar--lg" aria-hidden="true">QB<span class="avatar__status"></span></span>', [(20, 20), (50, 50), (80, 80)],
                [("Container", "A circle (<code>--radius-full</code>), <code>--color-bg-surface-raised</code> with a hairline ring."),
                 ("Initials", "Two capital letters, semibold, <code>--color-fg-muted</code>."),
                 ("Status dot", "8px <code>--color-success-solid</code> with a 2px ring in the surface colour, bottom right.")]),
    "variants": f"""{ex(_AV_USER + _AV_ICON + _AV_GROUP, "Beside a name (decorative), a system actor (labelled), a group (labelled as a whole).")}
<h3>With status</h3>
{ex('<div class="cluster">' + _av("AO", status_dot=True) + '<span class="text-sm">ama-osei <span class="text-caption">· signed in</span></span></div>', "The dot repeats what the text says; it is never the only signal.")}""",
    "sizes": f"""{ex(_AV_SIZES, "Small 20px (<code>--space-5</code>) in dense lists, medium 28px (<code>--control-height-xs</code>) by default, large 40px (<code>--control-height-md</code>) in headers.")}""",
    "states": f"""<p>Avatars are not interactive, so they have no hover, focus or disabled state. Their states are about the person.</p>
{matrix(["Default", "Signed in now", "Never signed in", "Loading"], [
    ("Medium", [_av("AO"), _av("AO", status_dot=True), '<span class="cluster">' + _av("DP") + '<span class="text-caption">Never</span></span>', '<span class="skeleton skeleton--circle" aria-hidden="true"></span>'])])}
{themes('<div class="cluster" style="padding: var(--space-4);">' + _AV_SIZES + _av("AO", status_dot=True) + "</div>")}""",
    "responsive": ul(["Avatars keep their size at every breakpoint; they do not grow with the layout.",
                      "In the sidebar user block the avatar stays visible in the collapsed drawer; the name truncates beside it.",
                      "In row lists below lg the avatar and login share the first cell; the role moves to the right."]),
    "theming": """<p>The avatar reads <code>--color-bg-surface-raised</code>, <code>--color-fg-muted</code> and <code>--color-border-default</code> through <code>--avatar-size</code> for its size. Override <code>--avatar-size</code> for a new size rather than writing widths:</p>
<pre><code>.profile-card .avatar { --avatar-size: var(--control-height-lg); }</code></pre>
<p>In dark the raised surface is <code>--palette-slate-850</code> and the initials <code>--palette-slate-300</code>; the status dot's ring takes the dark surface, so the dot still reads as separate.</p>""",
    "a11y": {
        "pattern": "<p>Static content. Next to the person's name the avatar is decorative: <code>aria-hidden=\"true\"</code>. Alone (a group, a system actor) it is <code>role=\"img\"</code> with an <code>aria-label</code> naming who. An image avatar is <code>&lt;img alt=\"\"&gt;</code> beside the name or <code>alt=\"ama-osei\"</code> alone. No APG widget pattern; see the <a href=\"https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/\">APG naming guidance</a>.</p>",
        "keys": [(kbd("Tab"), "Skips the avatar; it is never focusable. A clickable profile is a link that contains the avatar and the name.")],
        "focus": "<p>None on the avatar itself. When it is inside a link, the link's ring wraps both avatar and name.</p>",
        "labelling": "<p>Never rely on initials alone to identify someone: two people can share them. The name is always next to it or in the label. The status dot has no text of its own; the adjacent text says <i>signed in</i>.</p>",
        "pairs": [("Initials", "--color-fg-muted", "--color-bg-surface-raised", 4.5), ("Status dot on surface", "--color-success-solid", "--color-bg-surface", 3),
                  ("Name beside it", "--color-fg-default", "--color-bg-surface", 4.5)],
        "motion": "<p>None.</p>",
        "touch": "<p>Not a target. When an avatar is part of a link, the link (name included) is the target and is at least 24px tall.</p>",
    },
    "content": ul(["Initials are two capitals. Use the person's name when known; otherwise the first letters of the login's two parts; otherwise its first two letters.",
                   "Labels for standalone avatars are the login (<i>ama-osei</i>) or the actor (<i>Hewn (automatic)</i>).",
                   "Groups name everyone in the label, or the first three and the count (<i>quinntynebrown, ama-osei and 3 others</i>)."]),
    "dodont": [
        (_AV_USER, "Initials beside the login, decorative, the same initials everywhere the person appears.",
         '<div class="cluster">' + _av("QU") + '<span class="text-sm">quinntynebrown</span></div>', "Settings derived <i>QU</i> from the login while the sidebar showed <i>QB</i>: the same person had two avatars on one screen."),
        ('<div class="cluster">' + _av("AO", status_dot=True) + '<span class="text-sm">ama-osei <span class="text-caption">· signed in</span></span></div>', "The status dot plus text.",
         _av("AO", status_dot=True), "A green dot alone: colour-only status that a screen reader never hears."),
    ],
    "tokens": [("Size sm / md / lg", "--space-5 / --control-height-xs / --control-height-md"), ("Background", "--color-bg-surface-raised"), ("Initials", "--color-fg-muted"),
               ("Ring", "--color-border-default"), ("Type", "--text-caption / --font-weight-semibold"), ("Radius", "--radius-full"),
               ("Status dot", "--color-success-solid"), ("Status dot size", "--space-2"), ("Dot and group ring", "--color-bg-surface / --border-width-thick"),
               ("Group overlap", "--space-1-5")],
    "code": {"snippet": """<span class="avatar" aria-hidden="true">QB</span>
<span class="avatar avatar--lg" aria-hidden="true">AO<span class="avatar__status"></span></span>
<!-- Reserved: GitHub avatar image beside the name -->
<span class="avatar"><img src="https://avatars.githubusercontent.com/u/…" alt=""></span>
<span class="avatar-group" role="img" aria-label="Signed in today: quinntynebrown, ama-osei">
  <span class="avatar" aria-hidden="true">QB</span><span class="avatar" aria-hidden="true">AO</span>
</span>""",
             "classes": [("<code>.avatar</code>", "Medium initials avatar (28px)."), ("<code>.avatar--sm</code> / <code>.avatar--lg</code>", "20px / 40px."),
                         ("<code>.avatar__status</code>", "Signed-in dot, bottom right."), ("<code>.avatar img</code>", "Image fills and crops to the circle."),
                         ("<code>.avatar-group</code>", "Overlapping row with surface rings."), ("<code>--avatar-size</code>", "Component token for a custom size.")]},
    "sources": {"mocks": [("pages/settings/default", "allow-list users"), ("pages/dashboard/default", "sidebar user block"), ("pages/settings/viewer", "Viewer's user block")],
                "drift": "settings derived initials from the first two letters of the login (<i>QU</i>, <i>AM</i>, <i>DE</i>) while the sidebar used <i>QB</i>; initials now come from the name or the login's parts."},
}


# ============================================================== badge (status)
_TONES = [("Running (run)", ["Running", "In progress", "Leased"]), ("Succeeded (ok)", ["Succeeded", "Merged", "Complete"]),
          ("Failed (fail)", ["Failed", "Blocked", "Offline"]), ("Paused (warn)", ["Paused"]), ("Idle", ["Idle"]),
          ("Muted", ["Pending", "Queued", "Skipped", "Cancelled", "Deferred", "Archived"])]
_ALL_STATUS = "".join(f'<div class="cluster" style="width: 100%;"><span class="text-caption" style="min-width: 8rem;">{t}</span>' + "".join(status(w) for w in ws) + "</div>" for t, ws in _TONES)
_PILLS = ('<span class="pill">Feature direction</span><span class="pill pill--info">' + icon("info", "icon--sm") + 'Queued behind the active direction</span>'
          '<span class="pill pill--ok">' + icon("check-circle", "icon--sm") + 'All checks passed</span>'
          '<span class="pill pill--warn">' + icon("alert-circle", "icon--sm") + 'No acceptance test</span>'
          '<span class="pill pill--danger">' + icon("x-circle", "icon--sm") + 'Failed after 3 retries</span>')
_COUNTS = ('<nav aria-label="Filter by status (example)"><div class="tabs">'
           '<a class="tab" href="#variants" aria-current="page">All</a>'
           '<a class="tab" href="#variants">Running<span class="count"><span class="visually-hidden">, </span>2</span></a>'
           '<a class="tab" href="#variants">Paused<span class="count"><span class="visually-hidden">, </span>1</span></a>'
           '<a class="tab" href="#variants">Blocked<span class="count"><span class="visually-hidden">, </span>1</span></a></div></nav>')
_DOTS = ('<span class="cluster"><span class="dot"></span>Live</span><span class="cluster"><span class="dot dot--warn pulse"></span>Reconnecting…</span>'
         '<span class="cluster"><span class="dot dot--danger"></span>Offline</span><span class="cluster"><span class="dot dot--accent"></span>Iteration 3</span>'
         '<span class="cluster"><span class="dot dot--idle"></span>Waiting for work</span>')


def _on(bg, inner):
    return f'<span style="display: inline-flex; padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm); background: var({bg});">{inner}</span>'


_SURF = [("--color-bg-canvas"), ("--color-bg-surface"), ("--color-bg-subtle"), ("--color-accent-subtle")]
_BADGE_MATRIX = matrix(["On canvas", "On surface", "On hovered row", "On selected row"],
                       [(w, [_on(bg, status(w)) for bg in _SURF]) for w in ["Running", "Succeeded", "Failed", "Paused", "Idle", "Pending"]]
                       + [("Pill (warn)", [_on(bg, '<span class="pill pill--warn pill--sm">No acceptance test</span>') for bg in _SURF])])

SPECS["badge"] = {
    "lead": "Status words tell people what a project, stage, run, worker or check is doing: always an icon and a word, in one of six tones. Pills, counts and dots are the smaller signals around them.",
    "readme_variants": "status (6 tones, 17 words, sm), status icon, pill (neutral, info, ok, warn, danger, sm), count, dot (ok, warn, danger, accent, idle)",
    "readme_states": "every status word; on canvas, surface, hovered and selected rows; live spin; reduced motion",
    "pills": ["Icon + word, never colour alone"],
    "overview": f"""<p>Every status in Hewn is one of seventeen fixed words, each with a fixed icon and tone (L2-030). Use the status component wherever one appears: project rows, stage titles, run tables, worker rows, the increment timeline. Use a pill for a flag or note that is not a status (<i>No acceptance test</i>), a count for a number beside a label (<i>Running 2</i>), and a dot only next to text that already says the state (<i>Live</i>). For filter or tag controls use a {page('components/chip')}.</p>
{ul(["<b>Run</b> (accent, spinning loader): Running, In progress, Leased.",
     "<b>Ok</b> (success, check): Succeeded, Merged, Complete.",
     "<b>Fail</b> (danger): Failed and Blocked (x in circle), Offline (no wifi).",
     "<b>Warn</b> (warning, pause): Paused, including <i>Budget reached</i> as a custom label.",
     "<b>Idle</b> (muted, dot in circle): Idle.",
     "<b>Muted</b> (subtle): Pending and Queued (dashed circle), Skipped (slashed circle), Cancelled (ban), Deferred (minus), Archived (archive box)."])}""",
    "anatomy": (status("Running") + '<span style="width: var(--space-8);"></span>' + '<span class="pill pill--warn">' + icon("alert-circle", "icon--sm") + "No acceptance test</span>",
                [(22, 30), (36, 30), (72, 30)],
                [("Status icon", "16px (12px small), the tone's icon colour; spins for the run tone."),
                 ("Status word", "<code>--text-label</code> in the tone's fg colour; it is the accessible text."),
                 ("Pill", "Tinted background, <code>--radius-sm</code>, body-sm text, optional 14px icon.")]),
    "variants": f"""<h3>Status: every word</h3>
{ex(_ALL_STATUS, "Generated from the product's status table: each word has exactly one icon and tone.", cls=STACK)}
<h3>Custom label, icon only, small</h3>
{ex(status("Paused", "Budget reached") + status("Deferred", "") + status("Succeeded", "Connected", sm=True) + status("Running", "Last delivery 12 s ago", sm=True),
    "A custom label keeps the word's icon and tone. With an empty label the word is still read (visually hidden). <code>.status--sm</code> is caption size for integrations and dense cells.")}
<h3>Pill</h3>
{ex(_PILLS + '<span class="pill pill--warn pill--sm">Budget reached</span>', "Neutral, info, ok, warn, danger, and small. Pills carry a flag or a note; they are not buttons.")}
<h3>Count</h3>
{ex(_COUNTS, "Counts sit after their label in tabs and headings, tabular and subtle.", cls=STACK)}
<h3>Dot</h3>
{ex(_DOTS, "Dots only beside text that names the state: the connection indicator, the live run line.")}""",
    "sizes": f"""{ex(status("Running") + status("Running", sm=True) + '<span class="pill pill--ok">All checks passed</span><span class="pill pill--ok pill--sm">All checks passed</span>',
                    "Status medium (label, 16px icon) and small (caption, 12px icon); pill medium and small. The dot is one size (8px); inside the run line it is 6px.")}""",
    "states": f"""<p>Status words are not interactive; they change by content. The matrix shows each tone on every surface a status sits on, including a hovered row and the selected (current) row.</p>
{_BADGE_MATRIX}
<p>Running, In progress and Leased spin their loader on <code>--duration-spin</code>; under reduced motion the loader stops and the word carries the state. <i>Reconnecting…</i> pulses its dot, which also stops.</p>
{themes('<div class="ds-example__canvas" style="padding: var(--space-4);">' + "".join(status(w) for w in ["Running", "Succeeded", "Failed", "Paused", "Idle", "Pending", "Offline"]) + _PILLS + "</div>")}""",
    "responsive": ul(["Status words never wrap or truncate (<code>white-space: nowrap</code>); they are short by design.",
                      "In row lists the status moves from the top-right cell (below lg) to its own column (from lg); it is the same component.",
                      "Pills wrap their text only when longer than the line, which a pill should not be."]),
    "theming": """<p>Each tone maps to semantic status tokens: text <code>--color-*-fg</code>, icons <code>--color-*-icon</code> (via <code>.s-icon--*</code>), pill backgrounds <code>--color-*-bg</code>, dots <code>--color-*-solid</code>. Run uses the accent (<code>--color-fg-accent</code>). In dark the fg tokens lighten (green-400, amber-400, red-400, blue-400) and the backgrounds deepen, so text keeps 4.5:1 and icons 3:1. The light warning fill moved to amber-600 so warning dots and meters reach 3:1 (see the drift log).</p>""",
    "a11y": {
        "pattern": "<p>Static text: a <code>&lt;span class=\"status\"&gt;</code> holding an <code>aria-hidden</code> icon and the word. No ARIA widget pattern applies; the rule is <a href=\"https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html\">WCAG 1.4.1 Use of Color</a> and the <a href=\"https://www.w3.org/WAI/ARIA/apg/practices/structural-roles/\">APG structural roles</a> guidance. Containers whose statuses change while people watch (required checks) are <code>aria-live=\"polite\"</code>; a page-level status change is announced by a toast, not by the badge.</p>",
        "keys": [(kbd("Tab"), "Skips status, pills, counts and dots; none is focusable.")],
        "focus": "<p>None. A status inside a link (a project row) is part of the link's name.</p>",
        "labelling": "<p>The word is the label. Icon-only uses keep the word visually hidden (<code>status(\"Deferred\", \"\")</code>, or a hidden <i>Running:</i> before a check name). Counts are preceded by a hidden comma, so <i>Running, 2</i> is read rather than <i>Running2</i>. Dots are decorative.</p>",
        "pairs": [("Running", "--color-fg-accent", "--color-bg-surface", 4.5), ("Succeeded", "--color-success-fg", "--color-bg-surface", 4.5),
                  ("Failed", "--color-danger-strong", "--color-bg-surface", 4.5), ("Paused", "--color-warning-fg", "--color-bg-surface", 4.5),
                  ("Idle", "--color-fg-muted", "--color-bg-surface", 4.5), ("Muted words", "--color-fg-subtle", "--color-bg-surface", 4.5),
                  ("Running on selected row", "--color-fg-accent", "--color-accent-subtle", 4.5), ("Success icon", "--color-success-icon", "--color-bg-surface", 3),
                  ("Danger icon", "--color-danger-icon", "--color-bg-surface", 3), ("Warning icon", "--color-warning-icon", "--color-bg-surface", 3),
                  ("Info pill", "--color-info-fg", "--color-info-bg", 4.5), ("Ok pill", "--color-success-fg", "--color-success-bg", 4.5),
                  ("Warn pill", "--color-warning-fg", "--color-warning-bg", 4.5), ("Danger pill", "--color-danger-fg", "--color-danger-bg", 4.5),
                  ("Neutral pill", "--color-fg-muted", "--color-bg-subtle", 4.5), ("Warning dot", "--color-warning-solid", "--color-bg-surface", 3)],
        "motion": "<p>The run loader spins (<code>--duration-spin</code>, linear); the reconnecting dot pulses (<code>--duration-pulse</code>). Both are zeroed under reduced motion.</p>",
        "touch": "<p>Not targets. Never make a status tappable on its own; make the row or its title the link.</p>",
    },
    "content": ul(["Use the seventeen words exactly; do not invent synonyms (<i>Done</i>, <i>Error</i>, <i>Working</i>).",
                   "A custom label replaces the word only when it is more specific and keeps the tone: <i>Budget reached</i> for Paused, <i>Connected</i> for Succeeded.",
                   "Pills are short noun phrases or facts in sentence case: <i>No acceptance test</i>, <i>Feature direction</i>.",
                   "Counts are bare numbers; the label beside them says what is counted."]),
    "dodont": [
        (status("Failed") + status("Paused"), "Icon and word in the tone colour.",
         '<span class="text-danger">●</span><span class="text-warn">●</span>', "Colour dots for status: invisible to colour-blind readers and to screen readers."),
        (_COUNTS, "Separate the count from its label for screen readers with a hidden comma.",
         '<nav aria-label="Filter by status (counterexample)"><div class="tabs"><a class="tab" href="#do-dont">Running<span class="count">2</span></a></div></nav>',
         "Projects' filter tabs ran the label and count together, so the tab's name was read as “Running2”."),
        ('<span class="pill pill--warn">' + icon("alert-circle", "icon--sm") + "No acceptance test</span>", "A pill for a flag that is not a status.",
         '<span class="pill pill--danger">Blocked</span>', "A status word in a pill: it loses its icon and disagrees with every other Blocked in the product."),
    ],
    "tokens": [("Run word", "--color-fg-accent"), ("Ok word / icon", "--color-success-fg / --color-success-icon"), ("Fail word / icon", "--color-danger-strong / --color-danger-icon"),
               ("Warn word / icon", "--color-warning-fg / --color-warning-icon"), ("Idle / muted word", "--color-fg-muted / --color-fg-subtle"),
               ("Status type md / sm", "--text-label / --text-caption"), ("Status icon md / sm", "--size-icon-md / --size-icon-xs"), ("Status gap", "--space-1-5"),
               ("Pill backgrounds", "--color-bg-subtle / --color-info-bg / --color-success-bg / --color-warning-bg / --color-danger-bg"),
               ("Pill padding md / sm", "--space-1-5 / --space-0-5"), ("Pill radius", "--radius-sm"), ("Count", "--text-caption / --color-fg-subtle"),
               ("Dots", "--color-success-solid / --color-warning-solid / --color-danger-icon / --color-accent / --color-fg-subtle"), ("Dot size", "--space-2"),
               ("Spin / pulse", "--duration-spin / --duration-pulse")],
    "code": {"snippet": """<span class="status status--run"><svg class="icon icon--spin" aria-hidden="true">…loader…</svg>Running</span>
<span class="status status--warn"><svg class="icon" aria-hidden="true">…pause-circle…</svg>Budget reached</span>
<span class="status status--muted"><svg class="icon" aria-hidden="true">…</svg><span class="visually-hidden">Deferred</span></span>
<span class="pill pill--warn"><svg class="icon icon--sm" aria-hidden="true">…</svg>No acceptance test</span>
<a class="tab" href="?status=running">Running<span class="count"><span class="visually-hidden">, </span>2</span></a>
<span class="cluster"><span class="dot dot--warn pulse"></span>Reconnecting…</span>""",
             "classes": [("<code>.status</code> + <code>.status--run|ok|fail|warn|idle|muted</code>", "Status word with icon; tone from the word."),
                         ("<code>.status--sm</code>", "Caption size, 12px icon."),
                         ("<code>.s-icon--run|ok|fail|warn|idle|muted</code>", "A status icon on its own (with a hidden word)."),
                         ("<code>.pill</code> + <code>.pill--info|ok|warn|danger</code>, <code>.pill--sm</code>", "Flag or note."),
                         ("<code>.count</code>", "Number after a label."),
                         ("<code>.dot</code> + <code>.dot--warn|danger|accent|idle</code>", "8px state dot, beside text."),
                         ("<code>.pulse</code>", "Pulsing loop (reduced motion stops it).")]},
    "sources": {"mocks": [("pages/projects/default", "status in rows, counts in tabs"), ("pages/project-pipeline/blocked", "stage status"), ("pages/traceability/no-test", "warning pill"),
                          ("pages/settings/default", "small status in integrations"), ("pages/dashboard/reconnecting", "pulsing dot"), ("pages/increment/default", "status icons in checks")],
                "drift": "light warning fills moved to amber-600 (2.0:1 to 3:1+); light accent darkened so Running text passes on raised surfaces; loops use <code>--duration-pulse</code>; tab counts gain a hidden separator."},
}


# ============================================================== chip
_STAGES = ["All stages", "Idea", "Design system", "Stack", "Estimates", "Increments"]


def _chip(label, pressed=None, attrs="", cls="chip"):
    p = "" if pressed is None else f' aria-pressed="{"true" if pressed else "false"}"'
    return f'<button class="{cls}" type="button"{p}{attrs}>{label}</button>'


def _rchip(label, remove_attrs="", cls="chip chip--static"):
    return (f'<span class="{cls}">{label}<button class="chip__remove" type="button" aria-label="Remove filter {label}"{remove_attrs}>'
            f'{icon("x", "icon--xs")}</button></span>')


_FILTER_CHIPS = ('<div class="cluster" role="group" aria-label="Filter decisions by stage">'
                 + "".join(_chip(s, s == "Stack") for s in _STAGES) + "</div>")
_REMOVABLE = ('<div class="cluster" role="group" aria-label="Active audit filters">' + _rchip("Project: Ledgerline") + _rchip("Action: Stop all workers")
              + btn("Clear filters", "link", "sm") + "</div>")
_STATIC = '<span class="chip chip--static">L2-018</span><span class="chip chip--static">Journey 4</span><span class="chip chip--static">implementing-incrementally</span>'
_CHIP_MATRIX = matrix(["Default", "Hover", "Focus", "Pressed", "Disabled"], [
    ("Filter", [_chip("Stack", False), _chip("Stack", False, ' data-state="hover"'), _chip("Stack", False, ' data-state="focus"'), _chip("Stack", True), _chip("Stack", False, " disabled")]),
    ("Filter, small", [_chip("Stack", False, cls="chip chip--sm"), _chip("Stack", False, ' data-state="hover"', "chip chip--sm"), _chip("Stack", False, ' data-state="focus"', "chip chip--sm"),
                       _chip("Stack", True, cls="chip chip--sm"), _chip("Stack", False, " disabled", "chip chip--sm")]),
    ("Removable", [_rchip("Project: Ledgerline"), _na("Remove button tints on real hover"), _rchip("Project: Ledgerline", ' data-state="focus"'), _na("Not a toggle"), _na("Remove the chip instead")]),
    ("Static", ['<span class="chip chip--static">L2-018</span>', _na("No change"), _na("Not focusable"), _na("Not a toggle"), _na("Not interactive")]),
])

SPECS["chip"] = {
    "status": "core set; not yet in the mocks",
    "lead": "Chips are compact, rounded controls for filtering a list by a few values, showing which filters are on, or tagging an item. They are the planned replacement for the stage and action selects on Decisions and Audit.",
    "readme_variants": "filter (toggle), removable, static tag",
    "readme_states": "default, hover, focus, pressed, disabled",
    "pills": ["Native <code>&lt;button aria-pressed&gt;</code>"],
    "overview": f"""<p>Use filter chips when a list has a handful of filter values (up to about seven) that people switch between often, such as the six stages on Decisions; a {page('components/select')} stays the right choice for longer lists, such as the eleven actions on Audit. Use removable chips to show the filters that are on, each with its own remove button. Use static chips as read-only tags (a requirement ID, a skill). For status use a {page('components/badge', 'status')}; for mutually exclusive view switches use a {page('components/button-group', 'segmented control')}.</p>
{ul(["<b>Filter</b>: a toggle button with <code>aria-pressed</code>; pressed chips show a check and the accent tint.",
     "<b>Removable</b>: a static chip with a <code>.chip__remove</code> button labelled with what it removes.",
     "<b>Static</b> (<code>.chip--static</code>): a tag, not interactive."])}""",
    "anatomy": ('<div class="cluster">' + _chip("Stack", True) + _rchip("Project: Ledgerline") + "</div>", [(12, 50), (28, 50), (70, 50), (92, 50)],
                [("Check (pressed)", "A ✓ in <code>--color-fg-accent</code>, drawn by CSS, only when pressed."),
                 ("Label", "Caption type, medium weight."),
                 ("Container", "32px tall (<code>--control-height-sm</code>), <code>--radius-full</code>, 1px <code>--color-border-strong</code> ring."),
                 ("Remove button", "24px (<code>--target-min</code>) round button with an x icon and an <code>aria-label</code>.")]),
    "variants": f"""<h3>Filter</h3>
{ex(_FILTER_CHIPS, "Decisions filtered to the Stack stage. A group label names what the chips filter.")}
<h3>Removable</h3>
{ex(_REMOVABLE, "The Audit filters that matched nothing, shown as chips with a way to clear them all.")}
<h3>Static</h3>
{ex(_STATIC, "Tags on an increment: requirement, journey, skill.")}""",
    "sizes": f"""{ex(_chip("Stack", False) + _chip("Stack", True) + _chip("Stack", False, cls="chip chip--sm") + _chip("Stack", True, cls="chip chip--sm"),
                    "Medium 32px (<code>--control-height-sm</code>) by default; small 24px (<code>--target-min</code>) inside dense rows, with at least 8px between chips.")}""",
    "states": f"""<p>Forced with <code>data-state</code> for pointer and focus; pressed and disabled use the real attributes.</p>
{_CHIP_MATRIX}
<p>A pressed chip keeps its tint on hover; there is no separate hover style for it yet (see Code). Removing a chip moves focus to the next chip, or to the group's first control when it was the last.</p>
{themes('<div class="cluster" style="padding: var(--space-4);">' + _chip("All stages", False) + _chip("Stack", True) + _rchip("Project: Ledgerline") + '<span class="chip chip--static">L2-018</span></div>')}""",
    "responsive": ul(["Chips wrap onto new lines in a <code>.cluster</code>; they never scroll sideways or truncate.",
                      "On phones (below sm) a group of more than four filter chips can scroll horizontally in one row inside its own container, like tabs; keep the pressed chip in view.",
                      "Sizes do not change with the breakpoint; use medium on phones so targets stay 32px."]),
    "theming": """<p>Chips read <code>--color-bg-surface</code>, <code>--color-fg-muted</code> and <code>--color-border-strong</code>; hover <code>--color-bg-subtle-hover</code>; pressed <code>--color-accent-subtle</code> with an <code>--color-accent</code> ring and <code>--color-fg-default</code> text. In dark the pressed tint is the deep blue selection colour and the ring the lighter dark accent.</p>""",
    "a11y": {
        "pattern": "<p>Filter chips are toggle buttons (<code>&lt;button aria-pressed&gt;</code>) inside a <code>role=\"group\"</code> with an <code>aria-label</code>, following the <a href=\"https://www.w3.org/WAI/ARIA/apg/patterns/button/\">APG button pattern</a>. When exactly one must be on, use a radio group instead. Removable chips are text plus a labelled button. Static chips are plain text.</p>",
        "keys": [(kbd("Tab") + " / " + kbd("Shift", "Tab"), "Moves chip to chip (each is a tab stop), and to each remove button."),
                 (kbd("Enter") + ", " + kbd("Space"), "Toggles a filter chip, or removes a removable chip."),
                 (kbd("Esc"), "No effect.")],
        "focus": "<p>The shared ring (2px, 2px offset) around the whole rounded chip, or around the remove button. After removing, focus goes to the next chip or the group's first control; it never drops to the page.</p>",
        "labelling": "<p>The label is the value (<i>Stack</i>). The group's label says what is filtered (<i>Filter decisions by stage</i>). Remove buttons say what goes: <i>Remove filter Project: Ledgerline</i>. When filtering changes the results, announce the new count in a polite status (<i>2 decisions in Stack</i>).</p>",
        "pairs": [("Label on surface", "--color-fg-muted", "--color-bg-surface", 4.5), ("Edge on surface", "--color-border-strong", "--color-bg-surface", 3),
                  ("Label on hover", "--color-fg-default", "--color-bg-subtle-hover", 4.5), ("Pressed label", "--color-fg-default", "--color-accent-subtle", 4.5),
                  ("Pressed ring", "--color-accent", "--color-bg-surface", 3), ("Pressed check", "--color-fg-accent", "--color-accent-subtle", 4.5),
                  ("Static tag", "--color-fg-muted", "--color-bg-subtle", 4.5), ("Focus ring", "--color-focus-ring", "--color-bg-surface", 3)],
        "motion": "<p>Background changes over <code>--duration-fast</code>; instant under reduced motion.</p>",
        "touch": "<p>Medium chips are 32px tall and small chips 24px, with the cluster's 8px gap between them. The remove button is 24px and sits inside the chip's end padding.</p>",
    },
    "content": ul(["Labels are the values themselves, in sentence case, one to three words: <i>Design system</i>, <i>Increments</i>.",
                   "Removable chips name the filter and value: <i>Project: Ledgerline</i>.",
                   "The first filter chip is the unfiltered option when it helps (<i>All stages</i>).",
                   "No counts inside chips unless every chip has one."]),
    "dodont": [
        (_FILTER_CHIPS, "Six stages as chips in a labelled group; one pressed.",
         '<div class="cluster">' + "".join('<span class="chip chip--static">' + s + "</span>" for s in _STAGES[:4]) + "</div>", "Static chips styled as filters: they look clickable but are not buttons, so nothing happens and nothing is announced."),
        (_REMOVABLE, "Remove buttons with a label that names the filter.",
         '<span class="chip chip--static">Project: Ledgerline<button class="chip__remove" type="button" aria-label="Remove">' + icon("x", "icon--xs") + "</button></span>",
         "A remove button labelled only <i>Remove</i> (or not at all): with two chips, nobody knows which one goes."),
    ],
    "tokens": [("Height md / sm", "--control-height-sm / --target-min"), ("Padding md / sm", "--space-3 / --space-2"), ("Background", "--color-bg-surface"),
               ("Label", "--color-fg-muted"), ("Edge", "--color-border-strong"), ("Hover", "--color-bg-subtle-hover"), ("Pressed tint / ring", "--color-accent-subtle / --color-accent"),
               ("Pressed check", "--color-fg-accent"), ("Static", "--color-bg-subtle"), ("Type", "--text-caption / --font-weight-medium"), ("Radius", "--radius-full"),
               ("Remove button", "--target-min / --color-fg-subtle"), ("Transition", "--duration-fast / --ease-standard")],
    "code": {"snippet": """<div class="cluster" role="group" aria-label="Filter decisions by stage">
  <button class="chip" type="button" aria-pressed="false">All stages</button>
  <button class="chip" type="button" aria-pressed="true">Stack</button>
</div>
<span class="chip chip--static">Project: Ledgerline
  <button class="chip__remove" type="button" aria-label="Remove filter Project: Ledgerline">…x…</button>
</span>""",
             "classes": [("<code>.chip</code> + <code>aria-pressed</code>", "Filter chip (toggle button)."), ("<code>.chip--sm</code>", "24px chip."),
                         ("<code>.chip--static</code>", "Tag, or the body of a removable chip."), ("<code>.chip__remove</code>", "Remove button inside a chip."),
                         ("<code>disabled</code>", "Native disabled: 50% opacity."), ("<code>data-state=\"hover|focus\"</code>", "Documentation only.")]},
    "sources": {"mocks": [("pages/decisions/filtered", "the stage filter chips would replace"), ("pages/audit/no-results", "the action and project filters removable chips would show"),
                          ("pages/decisions/no-results", "a filter with no results")],
                "drift": "not in the mocks; designed from the core set and the Decisions and Audit filters."},
}


# ============================================================== stat
_WEEK = [52.1, 71.4, 38.9, 94.2, 66.0, 103.7, 86.4]
_DAYS = [("T", "Tuesday"), ("W", "Wednesday"), ("T", "Thursday"), ("F", "Friday"), ("S", "Saturday"), ("S", "Sunday"), ("M", "Monday (today)")]


def _bars(values, label, days=None):
    days = days or _DAYS
    mx = max(values) or 1
    out = "".join(f'<span class="bars__bar{" bars__bar--today" if i == 6 else ""}"><span class="bars__fill" style="--h: {max(2, round(v / mx * 36)) / 16:.3f}rem;"></span>{d}</span>'
                  for i, (v, (d, _)) in enumerate(zip(values, days)))
    return f'<div class="bars" role="img" aria-label="{label}">{out}</div>'


_BARS_LABEL = "Spend for the last 7 days: " + ", ".join(f"{n} ${v:.2f}" for v, (_, n) in zip(_WEEK, _DAYS)) + "; $512.70 this week"
_SPEND = (f'<div class="spend"><div><div class="spend__value">$86.40</div><div class="text-xs text-muted">$512.70 this week</div></div>{_bars(_WEEK, _BARS_LABEL)}</div>')
_SPEND_EMPTY = (f'<div class="spend"><div><div class="spend__value">$0.00</div><div class="text-xs text-muted">$0.00 this week</div></div>'
                f'{_bars([0] * 7, "Spend for the last 7 days: nothing spent; $0.00 this week")}</div>')


def _run(stopped=False, focus=False):
    f = ' data-state="focus"' if focus else ""
    if stopped:
        stage = f'<span class="run__stage" style="color: var(--color-warning-fg);">{icon("pause-circle", "icon--sm")}Paused at checkpoint · stage 10</span>'
    else:
        stage = f'<span class="run__stage">{icon("loader", "icon--sm icon--spin")}Stage 10 · Increments</span>'
    return (f'<ul class="divided"><li class="run"><div class="run__head"><a class="run__name" href="#states"{f}>Ledgerline</a>{stage}'
            '<span class="run__money">62% · $184.20 <span class="text-subtle">of $400.00</span></span></div>'
            '<div><div class="text-sm">Increment 7 of 12 · Reconcile a card statement</div><div class="text-sm text-muted">Implementing, iteration 3 of 10</div></div>'
            '<div class="run__line"><span class="dot"></span><span class="truncate">Iteration 3 · Normalise posting dates to account time zone</span>'
            '<span class="ml-auto text-subtle sm-only">quinn-mbp.local · Local</span></div></li></ul>')


_RUN_LOADING = _busy("Loading live work", '<div class="run">' + _sk("skeleton--w33") + _sk() + _sk("skeleton--w66") + "</div>")
_RUN_EMPTY = (f'<div class="empty empty--center empty--tight">{icon("circle-dot")}<div><p class="empty__title">Nothing running</p>'
              '<p class="empty__text">Give Hewn a direction and its stages appear here live.</p></div>' + btn("New direction", "primary", "sm", "plus") + "</div>")


def _kpi(label, value, delta=None, up=False):
    d = ""
    if delta:
        cls = "stat__delta stat__delta--up" if up else "stat__delta stat__delta--down"
        d = f'<span class="{cls}">{icon("arrow-up-right" if up else "arrow-down", "icon--xs")}{delta}</span>'
    return f'<div class="stat"><span class="stat__label">{label}</span><span class="stat__value">{value}</span>{d}</div>'


_KPIS = ('<div class="cluster cluster--lg">' + _kpi("Spend today", "$86.40", "−$17.30 vs yesterday") + _kpi("Spend this week", "$512.70")
         + _kpi("Merged today", "9") + "</div>")


def _phead_spend(spend, budget, pct, cls="meter"):
    return (f'<div class="phead__spend"><div class="phead__label"><span>Spend</span><span class="tabular"><strong>{spend}</strong> of {budget}</span></div>'
            f'<div class="{cls} mt-2" role="meter" aria-label="Spend" aria-valuenow="{spend[1:]}" aria-valuemin="0" aria-valuemax="{budget[1:]}" aria-valuetext="{spend} of {budget}">'
            f'<span class="meter__bar" style="--value: {pct}%;"></span></div></div>')


_PH_OK = _phead_spend("$184.20", "$400.00", 46)
_PH_WARN = _phead_spend("$250.00", "$250.00", 100, "meter meter--warn")
_STAT_MATRIX = matrix(["Default", "Focus", "Loading", "Empty", "Needs attention"], [
    ("Live run", [_run(), _run(focus=True), _RUN_LOADING, _RUN_EMPTY, _run(stopped=True)]),
    ("Spend tile", [_SPEND, _na("Not interactive"), _busy("Loading spend", '<div class="spend">' + _sk("skeleton--title") + "</div>"), _SPEND_EMPTY, _na("Budget warnings live on the project header")]),
    ("Project spend", [_PH_OK, _na("Not interactive"), _busy("Loading spend", _sk("skeleton--w75")), _phead_spend("$0.00", "$300.00", 0), _PH_WARN]),
])

SPECS["stat"] = {
    "lead": "Stats show the numbers Mission Control is watched for: what is running and how far it has got, what it has cost today and this week, and how much of a project's budget is gone.",
    "readme_variants": "live run, spend tile with bars, KPI with delta, project-header spend",
    "readme_states": "default, focus, loading, empty, paused, budget reached",
    "overview": f"""<p>Use a stat when a number is the point. Put the figure first and large, its label and context small. Use a {page('components/progress-bar', 'meter')} for a share of a known total (budget, percent complete) and a {page('components/table')} when people compare many numbers.</p>
{ul(["<b>Live run</b> (<code>.run</code>): a project's name, live stage, percent and spend of budget, the current step and the latest log line, in the Live work tile.",
     "<b>Spend tile</b> (<code>.spend</code> + <code>.bars</code>): today's spend large, the week beside it, seven bars ending today.",
     "<b>KPI</b> (<code>.stat</code>): label, value, optional delta with arrow and sign.",
     "<b>Project spend</b> (<code>.phead__spend</code>): <i>$184.20 of $400.00</i> over a meter in the project header."])}""",
    "anatomy": (FULL + _run() + END, [(8, 16), (40, 16), (88, 16), (20, 50), (40, 82)],
                [("Name", "<code>.run__name</code>, <code>--text-h2</code>, links to the pipeline."),
                 ("Live stage", "<code>.run__stage</code>, accent with a spinning loader; warning ink and a pause icon when held."),
                 ("Money", "<code>.run__money</code>: percent, spend and <i>of</i> budget, tabular, pushed right."),
                 ("Step", "Two body-sm lines: what is being built and how far."),
                 ("Live line", "<code>.run__line</code>: the latest log line in code type on the sunken surface, worker on the right from sm.")]),
    "variants": f"""<h3>Live run</h3>
{ex(_run(), "The Ledgerline run on the dashboard. The pipeline strip that sits under the head is its own component: " + page('components/pipeline-strip') + ".", cls=STACK)}
<h3>Spend tile</h3>
{ex(_SPEND, "Today large, the week beside it; the last bar is today (Monday) in the accent. The bars' label lists every day.", cls=STACK)}
<h3>KPI with delta</h3>
{ex(_KPIS, "Spend deltas: down is good (success ink), up is a warning. Arrow, sign and unit are all present.", cls=STACK)}
<h3>Project spend</h3>
{ex('<div style="max-width: 16rem;">' + _PH_OK + "</div>", "In the project header beside percent complete; the meter's value text reads the money, not a percentage.", cls=STACK)}""",
    "sizes": NA("Figures take the size of their context, not a modifier: --text-h1 for tile figures and KPIs, --text-h2 for a run's name, --text-body-sm in the project header."),
    "states": f"""<p>Stats are read, not operated; the run's name is the only interactive part. Loading, empty and attention states come from data.</p>
{_STAT_MATRIX}
{themes(FULL + _SPEND + '<div style="padding: var(--space-4);">' + _PH_WARN + "</div>" + END)}""",
    "responsive": ul(["Live run: head items wrap (name, stage, then money pushed right); the worker in the live line appears from sm (36rem); padding grows from <code>--space-4</code> to <code>--space-5</code> at sm.",
                      "Spend tile: figure and bars stay side by side down to 360px; the bars are fixed width (7 × 10px plus gaps).",
                      "Project spend: a min-width of 11rem, wrapping under the title below xl with percent complete and the controls."]),
    "theming": """<p>Figures read <code>--color-fg-default</code>; context <code>--color-fg-muted</code> and <code>--color-fg-subtle</code>; the live stage <code>--color-fg-accent</code>; bars <code>--color-border-grid</code> with today in <code>--color-accent</code>; the live line sits on <code>--color-bg-surface-sunken</code>. Deltas use the warning and success fg tokens. In dark, past bars are the dark grid line and today the lighter accent; both stay visible on the dark surface.</p>""",
    "a11y": {
        "pattern": "<p>Text, with the meter following the <a href=\"https://www.w3.org/WAI/ARIA/apg/patterns/meter/\">APG meter pattern</a> (<code>role=\"meter\"</code>, <code>aria-valuenow/min/max</code> and an <code>aria-valuetext</code> in money). The bar chart is <code>role=\"img\"</code> whose label lists every day's amount. Figures are not live regions: they change several times a minute; budget warnings are announced by a toast.</p>",
        "keys": [(kbd("Tab"), "Reaches the run's name link; the rest is static."), (kbd("Enter"), "Opens the project's pipeline.")],
        "focus": "<p>The shared ring on the run's name.</p>",
        "labelling": "<p>Every figure has a visible label or unit nearby (<i>this week</i>, <i>of $400.00</i>). Deltas include a sign and a comparison (<i>−$17.30 vs yesterday</i>); the arrow is decorative. The spend meter's value text is <i>$184.20 of $400.00</i>.</p>",
        "pairs": [("Figure on surface", "--color-fg-default", "--color-bg-surface", 4.5), ("Context on surface", "--color-fg-muted", "--color-bg-surface", 4.5),
                  ("Live stage", "--color-fg-accent", "--color-bg-surface", 4.5), ("Live line", "--color-fg-default", "--color-bg-surface-sunken", 4.5),
                  ("Delta down (good)", "--color-success-fg", "--color-bg-surface", 4.5), ("Delta up (warning)", "--color-warning-fg", "--color-bg-surface", 4.5),
                  ("Today's bar", "--color-accent", "--color-bg-surface", 3), ("Meter fill on track", "--color-accent", "--color-border-default", 3),
                  ("Budget reached fill", "--color-warning-solid", "--color-border-default", 3)],
        "motion": "<p>The live stage loader spins and the figures update in place without counting animations. Reduced motion stops the loader.</p>",
        "touch": "<p>The run's name is the target (h2 text, well over 24px). Bars are not interactive; exact values are in the label and on the dashboard's spend detail.</p>",
    },
    "content": ul(["Money has a currency sign and two decimals: <i>$86.40</i>, <i>$250.00 of $250.00</i>.",
                   "Percent complete is a whole number: <i>62%</i>.",
                   "Deltas: sign, amount, comparison: <i>−$17.30 vs yesterday</i>. Use the minus sign (−), not a hyphen.",
                   "Bar day labels are single letters ending with today; the chart's label spells them out.",
                   "Held runs say why and where: <i>Paused at checkpoint · stage 10</i>."]),
    "dodont": [
        (FULL + _SPEND + END, "The last bar is today: Monday 9 November, labelled M.",
         FULL + '<div class="spend"><div><div class="spend__value">$86.40</div><div class="text-xs text-muted">$512.70 this week</div></div>'
         + _bars(_WEEK, "Spend for the last 7 days, $512.70 this week", [(d, d) for d in "MTWTFSS"]) + "</div>" + END,
         "The dashboard labelled the days M to S and highlighted S as today, although the mocks' today is a Monday, and its label only gave the week's total."),
        (_kpi("Spend today", "$86.40", "−$17.30 vs yesterday"), "A delta with arrow, sign and comparison.",
         '<div class="stat"><span class="stat__label">Spend today</span><span class="stat__value">$86.40</span><span class="stat__delta text-ok">17.30</span></div>', "A green number with no sign, unit or comparison: down or up, versus what?"),
    ],
    "tokens": [("Figure", "--text-h1"), ("Run name", "--text-h2 / --letter-spacing-tight"), ("Figure ink", "--color-fg-default"), ("Context", "--color-fg-muted / --color-fg-subtle"),
               ("Live stage", "--color-fg-accent"), ("Live line", "--color-bg-surface-sunken / --text-code"), ("Run padding", "--space-4 / --space-5"),
               ("Bars height / bar width", "--space-12 / --space-2-5"), ("Bar fill / today", "--color-border-grid / --color-accent"), ("Bar radius", "--radius-xs"),
               ("Delta up / down", "--color-warning-fg / --color-success-fg"), ("Header label", "--text-caption")],
    "code": {"snippet": """<div class="spend">
  <div><div class="spend__value">$86.40</div><div class="text-xs text-muted">$512.70 this week</div></div>
  <div class="bars" role="img" aria-label="Spend for the last 7 days: Tuesday $52.10, …, Monday (today) $86.40; $512.70 this week">
    <span class="bars__bar"><span class="bars__fill" style="--h: 1.125rem"></span>T</span>
    …
    <span class="bars__bar bars__bar--today"><span class="bars__fill" style="--h: 1.875rem"></span>M</span>
  </div>
</div>
<div class="stat"><span class="stat__label">Spend today</span><span class="stat__value">$86.40</span>
  <span class="stat__delta stat__delta--down"><svg class="icon icon--xs" aria-hidden="true">…</svg>−$17.30 vs yesterday</span></div>""",
             "classes": [("<code>.run</code> <code>.run__head</code> <code>.run__name</code> <code>.run__stage</code> <code>.run__money</code> <code>.run__line</code>", "Live run."),
                         ("<code>.spend</code> <code>.spend__value</code>", "Spend tile body."),
                         ("<code>.bars</code> <code>.bars__bar</code> <code>.bars__fill</code> (<code>--h</code>) <code>.bars__bar--today</code>", "Seven-day bars."),
                         ("<code>.stat</code> <code>.stat__label</code> <code>.stat__value</code> <code>.stat__delta--up|down</code>", "KPI."),
                         ("<code>.phead__spend</code> <code>.phead__label</code>", "Project header spend with a meter.")]},
    "sources": {"mocks": [("pages/dashboard/default", "live run and spend tiles"), ("pages/dashboard/stopped", "held runs"), ("pages/dashboard/empty", "nothing running, $0.00"),
                          ("pages/dashboard/loading", "tile skeletons"), ("pages/project-pipeline/default", "project spend"), ("pages/project-pipeline/budget-reached", "budget reached")],
                "drift": "the 0.6rem bar margin and 11px bar labels snapped to the scale; the warning fill reaches 3:1 in light; the held-run stage was recoloured with an inline style (a <code>.run__stage--paused</code> modifier is proposed); the spend bars now end on today (Monday) and label every day."},
}


# ============================================================== code block
_TOKEN = "hwt_live_8Qm2vR7xKc4pZ1nLw9sTj3dYf6aB0eHg"


def _codebox(btn_attrs="", copied=False):
    if copied:
        b = f'<button class="btn btn--ghost btn--icon btn--sm" type="button" aria-label="Copied"{btn_attrs}>{icon("check", "icon--sm text-ok")}</button>'
        live = '<span class="visually-hidden" role="status">Token copied</span>'
    else:
        b = f'<button class="btn btn--ghost btn--icon btn--sm" type="button" aria-label="Copy token"{btn_attrs}>{icon("copy", "icon--sm")}</button>'
        live = ""
    return f'<div class="codebox" style="width: 100%; position: relative;"><code class="mono">{_TOKEN}</code>{b}{live}</div>'


_DOCKER = ("docker run -d --name hewn-worker \\\n  -e HEWN_API_URL=https://hewn.quinntyne.dev \\\n"
           f"  -e HEWN_WORKER_TOKEN={_TOKEN} \\\n  ghcr.io/quinntynebrown/hewn-worker:0.9.2")
_FAILING = "matches-across-midnight\n  Expected: Matched (Visa ···4410, Nov)\n  Received: Unmatched\n  at e2e/reconcile-card-statement.spec.ts:88"


def _pre(text, label, attrs=""):
    return f'<pre class="pre" tabindex="0" role="region" aria-label="{label}"{attrs}>{text}</pre>'


_SECRET = ('<ul style="width: 100%;"><li class="integration"><span class="integration__name">Anthropic API<small>ANTHROPIC_API_KEY</small></span>'
           '<span class="secret"><span aria-hidden="true">••••••••</span><span class="visually-hidden">Secret set, hidden</span></span>'
           + status("Succeeded", "Connected", sm=True) + "</li></ul>")
_KBD = '<p class="text-sm">Press <kbd class="kbd">t</kbd> to switch theme; <kbd class="kbd">Esc</kbd> closes a dialog; <kbd class="kbd">Ctrl</kbd> + <kbd class="kbd">C</kbd> copies.</p>'
_INLINE = '<p class="text-sm">Recorded in <code>docs/decisions.md</code>; each L2 carries <code>Status: Deferred</code> with its reason.</p>'
_TEST_PRE = _pre("dotnet test backend/Ledgerline.sln\nnpx playwright test", "Test commands")
_CODE_MATRIX = matrix(["Default", "Hover", "Focus", "Active", "Copied"], [
    ("Codebox", [_codebox(), _codebox(' data-state="hover"'), _codebox(' data-state="focus"'), _codebox(' data-state="active"'), _codebox(copied=True)]),
    ("Pre", [_pre("dotnet test backend/Ledgerline.sln", "Test command"), _na("No change"), _pre("dotnet test backend/Ledgerline.sln", "Test command", ' data-state="focus"'), _na("No change"), _na("Copy via a codebox above it")]),
])

SPECS["code-block"] = {
    "lead": "Code blocks hold text people copy or read exactly: a worker token shown once, the docker command that starts a worker, a failing test's output. Keys and hidden secrets use the same mono family.",
    "readme_variants": "codebox (single line with copy), pre (multi-line), inline code, kbd, secret",
    "readme_states": "default, hover, focus, active, copied, overflowing",
    "pills": ["<code>&lt;code&gt;</code> / <code>&lt;pre&gt;</code>"],
    "overview": f"""<p>Use a codebox for one value to copy (a token, an ID), a pre block for multi-line commands and output, inline <code>code</code> for file names and identifiers in prose, <code>.kbd</code> for keys, and <code>.secret</code> for a value that exists but is never shown. Streaming output belongs in the {page('components/log-viewer', 'log viewer')}.</p>
{ul(["<b>Codebox</b> (<code>.codebox</code>): one line, truncated with an ellipsis, a copy button at the end.",
     "<b>Pre</b> (<code>.pre</code>): preformatted, scrolls horizontally, never wraps (commands must paste exactly).",
     "<b>Inline code</b>: <code>&lt;code&gt;</code> at 0.92em inside text.",
     "<b>Key</b> (<code>.kbd</code>): a keycap with a bottom edge.",
     "<b>Secret</b> (<code>.secret</code>): eight dots that stand for a value Hewn stores encrypted and will not show again."])}""",
    "anatomy": (FULL + _codebox() + END, [(4, 50), (50, 50), (94, 50)],
                [("Container", "<code>--color-bg-surface-sunken</code>, hairline ring, <code>--radius-md</code>, padding <code>--space-2</code> / <code>--space-3</code>."),
                 ("Value", "Mono at <code>--font-size-sm</code>, one line, ellipsis when long; selecting it selects the whole value."),
                 ("Copy button", "Small ghost icon button labelled <i>Copy token</i>; becomes <i>Copied</i> with a check.")]),
    "variants": f"""<h3>Codebox</h3>
{ex(_codebox(), "The worker token, shown once after creation. The full value is copied, not the truncated text.", cls=STACK)}
<h3>Pre</h3>
{ex(_pre(_DOCKER, "Docker command to start the worker"), "The command to paste on the worker machine; long lines scroll inside the block.", cls=STACK)}
{ex(_pre(_FAILING, "Failing test output"), "Failing test output on a blocked increment.", cls=STACK)}
<h3>Inline code, keys and secrets</h3>
{ex(_INLINE + _KBD, "Inline code in prose; keys as keycaps joined with +.", cls=STACK)}
{ex(_SECRET, "An integration's secret: dots shown, the meaning read.", cls=STACK)}""",
    "sizes": NA("One size each: codebox and pre use code type (14px in the codebox, 12px code text in pre with loose line height); kbd and secret follow the code token."),
    "states": f"""<p>The copy button has the button's states; the pre block is a focusable scroll region so keyboard users can scroll long lines.</p>
{_CODE_MATRIX}
<p><b>Copied</b>: the icon becomes a check and the button's name <i>Copied</i> for 2 seconds, and a polite status says <i>Token copied</i>. If the clipboard is blocked, select the value and say <i>Press Ctrl + C to copy</i>.</p>
{themes('<div style="width: 100%; padding: var(--space-4);">' + _codebox() + '<div class="mt-3">' + _TEST_PRE + "</div></div>")}""",
    "responsive": ul(["Codebox: the value truncates to the width; the copy button never wraps below it.",
                      "Pre: never wraps; scrolls horizontally inside its own box at every width, so the page does not scroll at 360px.",
                      "In the worker-token bottom sheet (below sm) both blocks take the full sheet width."]),
    "theming": """<p>Both blocks read <code>--color-bg-surface-sunken</code> and <code>--color-border-default</code>; codebox text is <code>--color-fg-default</code>, pre text <code>--color-fg-muted</code>. In light the sunken surface equals the canvas, so the ring is what separates it inside a dialog; in dark it is the deepest slate, below the dialog's raised surface.</p>""",
    "a11y": {
        "pattern": "<p><code>&lt;code&gt;</code> and <code>&lt;pre&gt;</code> are plain text. The copy control follows the <a href=\"https://www.w3.org/WAI/ARIA/apg/patterns/button/\">APG button pattern</a>. A pre that can overflow is a named scroll region: <code>tabindex=\"0\" role=\"region\" aria-label</code>.</p>",
        "keys": [(kbd("Tab"), "Moves to the copy button, then into the pre block."), (kbd("Enter") + ", " + kbd("Space"), "Copies."),
                 (kbd("←") + " " + kbd("→"), "With the pre focused: scrolls long lines."), (kbd("Ctrl", "A"), "With the pre focused, selects the page; select inside the block with the pointer or Shift + arrows.")],
        "focus": "<p>The shared ring on the copy button and the pre region. Focus stays on the copy button after copying.</p>",
        "labelling": "<p>Copy buttons say what they copy (<i>Copy token</i>, <i>Copy command</i>). The pre region's label says what the text is. Secrets replace the dots for screen readers with <i>Secret set, hidden</i>; the dots are <code>aria-hidden</code>.</p>",
        "pairs": [("Codebox value", "--color-fg-default", "--color-bg-surface-sunken", 4.5), ("Pre text", "--color-fg-muted", "--color-bg-surface-sunken", 4.5),
                  ("Key", "--color-fg-default", "--color-bg-surface", 4.5), ("Secret dots", "--color-fg-subtle", "--color-bg-surface", 4.5),
                  ("Copied check", "--color-success-fg", "--color-bg-surface", 4.5), ("Focus ring on raised", "--color-focus-ring", "--color-bg-surface-raised", 3)],
        "motion": "<p>None beyond the button's colour transition; the copied state is a swap, not an animation.</p>",
        "touch": "<p>The copy button is 32px; on a phone in the bottom sheet it is the main action next to Done, so keep 8px around it. Long-press on the value selects it as a fallback.</p>",
    },
    "content": ul(["Commands are exactly what runs, with line continuations, and no prompt character (<code>$</code>) so they paste cleanly.",
                   "Say once, next to a one-time value, that it will not be shown again: <i>Copy it now. Hewn stores only a hash and can’t show it again.</i>",
                   "Keys are named as printed on the keyboard: <kbd class=\"kbd\">Esc</kbd>, <kbd class=\"kbd\">Ctrl</kbd>, <kbd class=\"kbd\">t</kbd>.",
                   "Put file names, environment variables and IDs in inline code: <code>HEWN_WORKER_TOKEN</code>, <code>docs/specs/</code>."]),
    "dodont": [
        (_SECRET, "Hide the dots from screen readers and say what they mean.",
         '<span class="secret" aria-label="Secret hidden">••••••••</span>', "Settings put <code>aria-label</code> on a plain span; ARIA does not name generic elements, so readers say “bullet bullet bullet…” or nothing."),
        (FULL + _pre(_DOCKER, "Docker command (do)") + END, "A focusable, named scroll region for a command wider than the screen.",
         FULL + '<pre class="pre">' + _DOCKER + "</pre>" + END, "The worker-token dialog's command scrolled but could not be focused, so keyboard users could not reach the end of the token line."),
    ],
    "tokens": [("Container", "--color-bg-surface-sunken"), ("Ring", "--color-border-default"), ("Radius", "--radius-md"), ("Codebox value", "--color-fg-default / --font-size-sm"),
               ("Pre text", "--text-code / --line-height-loose"), ("Pre ink", "--color-fg-muted"), ("Padding", "--space-2 / --space-3"),
               ("Key", "--color-bg-surface / --color-border-strong"), ("Secret", "--color-fg-subtle / --letter-spacing-wide"), ("Mono family", "--font-family-mono")],
    "code": {"snippet": """<div class="codebox"><code class="mono">hwt_live_8Qm2…eHg</code>
  <button class="btn btn--ghost btn--icon btn--sm" type="button" aria-label="Copy token">…copy…</button></div>
<pre class="pre" tabindex="0" role="region" aria-label="Docker command to start the worker">docker run -d --name hewn-worker \\
  -e HEWN_WORKER_TOKEN=… \\
  ghcr.io/quinntynebrown/hewn-worker:0.9.2</pre>
<kbd class="kbd">Esc</kbd>
<span class="secret"><span aria-hidden="true">••••••••</span><span class="visually-hidden">Secret set, hidden</span></span>""",
             "classes": [("<code>.codebox</code>", "Single-line value with a copy button."), ("<code>.pre</code>", "Multi-line preformatted block; scrolls."),
                         ("<code>.kbd</code>", "Keycap."), ("<code>.secret</code>", "Masked value."), ("<code>code</code>", "Inline code at 0.92em."),
                         ("<code>tabindex=\"0\" role=\"region\" aria-label</code> on <code>.pre</code>", "Keyboard-scrollable, named block.")]},
    "sources": {"mocks": [("dialogs/worker-token/success", "codebox and docker command"), ("pages/increment/blocked", "failing test output"), ("pages/settings/default", "secrets"),
                          ("pages/decisions/default", "inline code")],
                "drift": "13px code boxes snapped to <code>--font-size-sm</code>; the pre block becomes a focusable named region; secrets hide their dots and carry hidden text instead of an <code>aria-label</code> on a span."},
}


# ============================================================== timeline
_TL = [("Succeeded", "Failing tests committed", "4 acceptance tests · traces to L2-018, L2-019", "14:03"),
       ("Failed", "Red recorded", "4 failing, 0 passing", "14:03"),
       ("Succeeded", "Green after 3 iterations", "Backend, frontend, increment tests and full e2e pass in the worker", "14:31"),
       ("Succeeded", "Video", "2:14, captioned", "14:36"),
       ("Running", "Pull request #28", "Waiting on required checks", "14:37"),
       ("Pending", "Squash-merge", "Automatic when checks pass", "")]


def _tl(items):
    out = ""
    for s, t, d, tm in items:
        time_html = f'<time class="timeline__time tabular" datetime="2026-11-09T{tm}">{tm}</time>' if tm else '<span class="timeline__time"></span>'
        out += (f'<li class="timeline__item"><span class="timeline__icon">{status_icon(s, "icon--sm")}</span><span class="timeline__t">{t}<span class="visually-hidden"> ({s})</span></span>'
                f'{time_html}<span class="timeline__d">{d}</span></li>')
    return f'<ol class="timeline">{out}</ol>'


_TIMELINE = _tl(_TL)
_TL_STATES = _tl([("Succeeded", "Failing tests committed", "4 acceptance tests", "14:03"), ("Failed", "Red recorded", "4 failing, 0 passing", "14:03"),
                  ("Skipped", "Tests passed before implementation", "4 of 4 passed on the test commit; flagged in the PR Notes", "14:03"),
                  ("Running", "Implementing · iteration 3 of 10", "Backend, frontend, increment tests and full e2e pass in the worker", "now"),
                  ("Blocked", "Blocked after 10 iterations", "1 of 4 failing: matches-across-midnight. Moved on to increment 8.", "15:48"),
                  ("Merged", "Squash-merge", "Branch deleted · 62% → 68% complete", "14:44"), ("Pending", "Video", "Waits for green", "")])


def _decision(dt, stg, q, a, why, sha, extra="", link_attrs=""):
    return (f'<li class="decision"><div class="decision__when"><span class="text-muted">{dt}</span><span class="text-subtle">{stg}</span></div><div>'
            f'<p class="decision__q">{q}</p><p class="decision__a">{a}</p><p class="decision__why">{why}</p><div class="decision__links">'
            f'<a class="quiet-link mono" href="#variants"{link_attrs}>{icon("git-commit", "icon--xs")} {sha}</a>{extra}</div></div></li>')


_ADR = f'<a class="quiet-link" href="#variants">{icon("file-text", "icon--xs")} ADR 0001</a>'
_D1 = _decision("9 Nov, 14:21", "Increments", "Which time zone decides whether a card transaction falls on a statement date?",
                "The account's time zone, set during bank-feed connection.", "Statements are issued in the account holder’s local day; UTC split 3 test transactions across two days.", "a41c9e2")
_D2 = _decision("8 Nov, 09:12", "Stack", "The direction mentions “works offline on site visits”. Add a PWA layer?", "No. Keep the default .NET + Angular stack; offline is out of scope in the brief.",
                "The brief’s users reconcile at a desk; site visits only capture receipts, which the phone camera already queues.", "c03e57b", _ADR)
_DECISIONS = f'<ol>{_D1}{_D2}</ol>'
_DEC_LOADING = _busy("Loading decisions", '<div class="decision" aria-hidden="true"><span class="stack stack--sm">' + _sk("skeleton--w75") + _sk("skeleton--w50")
                     + '</span><span class="stack stack--sm">' + _sk() + _sk("skeleton--w75") + _sk("skeleton--w66") + "</span></div>")
_DEC_EMPTY = (f'<div class="empty empty--tight">{icon("git-commit")}<div><p class="empty__title">No decisions yet</p>'
              '<p class="empty__text">When a skill would ask you something, the agent answers it and records the answer here with its reasoning. None so far.</p></div></div>')


def _qlink(attrs=""):
    return f'<a class="quiet-link mono" href="#states"{attrs}>{icon("git-commit", "icon--xs")} a41c9e2</a>'


_TL_MATRIX = matrix(["Default", "Hover", "Focus"], [("Commit link", [_qlink(), _qlink(' data-state="hover"'), _qlink(' data-state="focus"')])])

SPECS["timeline"] = {
    "lead": "Timelines tell what happened in order: the test-first steps of an increment from red to merge, and the log of decisions the agent made in your place, each with its reason and commit.",
    "readme_variants": "step timeline (increment), decision log",
    "readme_states": "succeeded, failed, skipped, running, blocked, merged, pending; link hover and focus; loading; empty",
    "pills": ["<code>&lt;ol&gt;</code> with <code>&lt;time&gt;</code>"],
    "overview": f"""<p>Use a timeline when order in time is the point and each entry is a step or an event with a short explanation. Use a {page('components/stepper')} for a fixed sequence of stages people navigate between, and a {page('components/list')} (event stream) for high-volume live events.</p>
{ul(["<b>Step timeline</b> (<code>.timeline</code>): a vertical rule with a status icon per step, the step, its detail and the time. On the increment page: tests committed, red recorded, green, video, pull request, squash-merge.",
     "<b>Decision log</b> (<code>.decision</code>): when and in which stage, the question a skill would have asked, the answer (after an arrow), why, and the commit that records it."])}""",
    "anatomy": (FULL + _tl(_TL[:2]) + END, [(1, 22), (14, 22), (14, 44), (92, 22)],
                [("Rule and icon", "A hairline on the left; each step's status icon sits on it, masked by the canvas colour."),
                 ("Step", "<code>.timeline__t</code>, body-sm default ink, with the status word visually hidden."),
                 ("Detail", "<code>.timeline__d</code>, muted: counts, reasons, what happens next."),
                 ("Time", "<code>&lt;time class=\"timeline__time\"&gt;</code> in code type, right column; empty for steps not reached.")]),
    "variants": f"""<h3>Step timeline</h3>
{ex(_TIMELINE, "Increment 7, Reconcile a card statement: PR #28 waiting on checks.", cls=STACK)}
<h3>Decision log</h3>
{ex(_DECISIONS, "Newest first. The Stack decision also links its ADR.", cls=STACK)}""",
    "sizes": NA("One size: body-sm steps and md (16px) questions and answers. The decision log's question size is fixed at --font-size-md after the 15px drift fix."),
    "states": f"""<p>Entries change by status as the increment moves; links in the decision log have pointer and focus states.</p>
{ex(_TL_STATES, "Every status a step takes: Succeeded, Failed (red recorded is expected), Skipped (tests green first), Running, Blocked, Merged, Pending.", cls=STACK)}
{_TL_MATRIX}
<h3>Loading and empty</h3>
{ex(_DEC_LOADING, "Decision skeletons in the two-column layout.", cls=STACK)}
{ex(_DEC_EMPTY, "No decisions recorded yet: says what will appear and when.", cls=STACK)}
{themes(FULL + _tl(_TL[:3]) + END)}""",
    "responsive": ul(["Step timeline: the same layout at every width; the detail wraps under the step and the time stays in the right column.",
                      "Decision log: stacked below md (when and stage on one line above the question); from md (48rem) a two-column grid with an 8.5rem when column, the date above the stage.",
                      "Decision text wraps; it never truncates (the reasoning is the content)."]),
    "theming": """<p>The rule is <code>--color-border-default</code>; icons take their status icon tokens; the icon's mask is <code>--color-bg-canvas</code>, so a timeline placed on a card must repaint the mask with the card's surface. The decision answer's arrow uses <code>--color-success-fg</code>; questions are default ink, reasons muted.</p>
<pre><code>.card .timeline__icon { background: var(--color-bg-surface); }</code></pre>""",
    "a11y": {
        "pattern": "<p>An <code>&lt;ol&gt;</code>: order matters. Each step's status is in text (visually hidden after the step) and its time is a <code>&lt;time datetime&gt;</code>. Decisions are list items whose question and answer are paragraphs. No ARIA widget; see the <a href=\"https://www.w3.org/WAI/ARIA/apg/practices/structural-roles/\">APG structural roles</a> (list). The arrow before an answer is decoration and must not be read (CSS alt text: <code>content: \"→ \" / \"\"</code>).</p>",
        "keys": [(kbd("Tab"), "Reaches commit and ADR links in the decision log; the step timeline has none."), (kbd("Enter"), "Opens the commit on GitHub.")],
        "focus": "<p>The shared ring on decision links.</p>",
        "labelling": "<p>Each step reads as “Red recorded (Failed), 14:03, 4 failing, 0 passing”. Commit links read their SHA; when several commits appear, prefix with hidden text (<i>Commit a41c9e2</i>).</p>",
        "pairs": [("Step on page", "--color-fg-default", "--color-bg-canvas", 4.5), ("Detail on page", "--color-fg-muted", "--color-bg-canvas", 4.5),
                  ("Time on page", "--color-fg-subtle", "--color-bg-canvas", 4.5), ("Success icon", "--color-success-icon", "--color-bg-canvas", 3),
                  ("Danger icon", "--color-danger-icon", "--color-bg-canvas", 3), ("Answer arrow", "--color-success-fg", "--color-bg-canvas", 4.5),
                  ("Focus ring", "--color-focus-ring", "--color-bg-canvas", 3)],
        "motion": "<p>The Running step's loader spins and stops under reduced motion. New steps appear without animation.</p>",
        "touch": "<p>Decision links are caption-size text with a 12px icon; the line is at least 24px tall and links are 16px apart.</p>",
    },
    "content": ul(["Steps are outcomes in the past tense or the current activity: <i>Failing tests committed</i>, <i>Green after 3 iterations</i>, <i>Implementing · iteration 3 of 10</i>.",
                   "Details give counts and the next condition: <i>4 failing, 0 passing</i>; <i>Automatic when checks pass</i>.",
                   "Times are 24-hour local (<i>14:37</i>); the current step says <i>now</i>; unreached steps have no time.",
                   "Decisions: the question as the skill would have asked it, the answer as a short sentence, the reason as one or two sentences.",
                   "Decision dates are day, month and time (<i>9 Nov, 14:21</i>); the stage is its name (<i>Increments</i>)."]),
    "dodont": [
        (FULL + _tl(_TL[1:2]) + END, "The status word is in the text (hidden) and the icon is decorative.",
         FULL + '<ol class="timeline"><li class="timeline__item"><span class="timeline__icon">' + status_icon("Failed", "icon--sm") + '</span><span class="timeline__t">Red recorded</span><span class="timeline__time">14:03</span><span class="timeline__d">4 failing, 0 passing</span></li></ol>' + END,
         "Icon only: a screen reader hears “Red recorded” and never learns it failed (as intended)."),
        (FULL + f"<ol>{_D1}</ol>" + END, "The decision log in an ordered list, newest first, with the commit.",
         FULL + '<div class="decision"><div class="decision__when"><span class="text-muted">9 Nov, 14:21</span></div><div><p class="decision__q">Which time zone decides whether a card transaction falls on a statement date?</p><p class="decision__a">The account’s time zone.</p></div></div>' + END,
         "No reason and no commit: the decision cannot be checked or reversed."),
    ],
    "tokens": [("Rule", "--color-border-default"), ("Icon mask", "--color-bg-canvas"), ("Icon layer", "--z-raised"), ("Step", "--text-body-sm / --color-fg-default"),
               ("Detail", "--color-fg-muted"), ("Time", "--text-code / --color-fg-subtle"), ("Step padding", "--space-2-5 / --space-6"),
               ("Question and answer", "--font-size-md / --line-height-snug"), ("Answer arrow", "--color-success-fg"), ("Reason", "--text-body-sm / --line-height-relaxed"),
               ("Decision padding / column gap", "--space-6 / --space-8"), ("Link row gap", "--space-4")],
    "code": {"snippet": """<ol class="timeline">
  <li class="timeline__item">
    <span class="timeline__icon"><svg class="icon icon--sm s-icon--fail" aria-hidden="true">…</svg></span>
    <span class="timeline__t">Red recorded<span class="visually-hidden"> (Failed)</span></span>
    <time class="timeline__time tabular" datetime="2026-11-09T14:03">14:03</time>
    <span class="timeline__d">4 failing, 0 passing</span>
  </li>
</ol>
<ol><li class="decision">
  <div class="decision__when"><span class="text-muted">9 Nov, 14:21</span><span class="text-subtle">Increments</span></div>
  <div><p class="decision__q">Which time zone decides …?</p><p class="decision__a">The account's time zone …</p>
    <p class="decision__why">Statements are issued …</p>
    <div class="decision__links"><a class="quiet-link mono" href="…/commit/a41c9e2">… a41c9e2</a></div></div>
</li></ol>""",
             "classes": [("<code>.timeline</code> <code>.timeline__item</code>", "Step timeline and step."),
                         ("<code>.timeline__icon</code> <code>.timeline__t</code> <code>.timeline__d</code> <code>.timeline__time</code>", "Icon on the rule, step, detail, time."),
                         ("<code>.decision</code>", "Decision entry; two columns from md."),
                         ("<code>.decision__when</code> <code>.decision__q</code> <code>.decision__a</code> <code>.decision__why</code> <code>.decision__links</code>", "When and stage, question, answer, reason, links.")]},
    "sources": {"mocks": [("pages/increment/default", "step timeline"), ("pages/increment/blocked", "blocked step"), ("pages/increment/green-first", "skipped red"),
                          ("pages/increment/merged", "merged"), ("pages/decisions/default", "decision log"), ("pages/decisions/loading", "skeletons"), ("pages/decisions/empty", "empty")],
                "drift": "15px decision text snapped to <code>--font-size-md</code>; step times become <code>&lt;time&gt;</code>; the answer arrow is generated content that screen readers announced (CSS alt text proposed)."},
}
