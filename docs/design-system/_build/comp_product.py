"""Component specs: product-specific data display (log viewer, pipeline strip, project header, preview, logo)."""
from html import escape

from common import (NA, btn, ex, icon, kbd, mark, matrix, mk, status, table, themes, ul, page, wordmark)

SPECS = {}

STAGE_NAMES = mk.STAGE_NAMES  # 11 stages, numbered 0 to 10
LOG = mk.LOG


# ============================================================== log viewer
def _line(t, lvl, txt, state=""):
    ds = f' data-state="{state}"' if state else ""
    return (f'<div class="log__line"{ds}><span class="log__t">{t}</span><span class="log__lvl log__lvl--{lvl}">{lvl}</span>'
            f'<span class="log__text">{escape(txt)}</span></div>')


def _log(lines, live=True, jump=0, height="auto", label="Run log, stage 10 Increments", box_state="", jump_state=""):
    out = "".join(_line(*l) for l in lines)
    cursor = '<span class="log__cursor" aria-hidden="true"></span>' if live else ""
    js = f' data-state="{jump_state}"' if jump_state else ""
    jump_html = (f'<button class="log__jump" type="button"{js}>{icon("arrow-down", "icon--xs")} {jump} new lines — Jump to latest</button>'
                 if jump else "")
    bs = f' data-state="{box_state}"' if box_state else ""
    return (f'<div class="log" style="width: 100%;"><div class="log__box" role="log" aria-label="{label}" tabindex="0" style="height: {height};"{bs}>'
            f"{out}{cursor}</div>{jump_html}</div>")


_BLOCKED = [("14:06:13", "tool", "validate-requirements docs/specs/"), ("14:06:14", "error", "L2-014 has no Given/When/Then acceptance criterion"),
            ("14:06:14", "error", "Validation failed: 1 requirement without criteria"), ("14:06:14", "warn", "Stage 5 Failed after 3 retries · direction Blocked")]
_CANCELLED = [("17:01:36", "info", "Cancel requested by quinntynebrown"), ("17:01:40", "info", "Run stopped at step 3 of 4"),
              ("17:01:41", "tool", "gh pr edit 9 --add-label hewn:cancelled")]
_BUDGET = [("13:51:12", "warn", "Spend at 80% of budget ($200.00 of $250.00)"), ("13:52:40", "warn", "Spend reached 100% ($250.00). Pausing after this model call."),
           ("13:52:41", "info", "Checkpoint committed: 4c1e0b2 · direction Paused")]
_LEVELS = [("info", "14:27:30", "Backend: 412 passed, 0 failed", "Progress the agent reports: steps, counts, decisions, checkpoints."),
           ("tool", "14:27:31", "npx playwright test e2e/reconcile-card-statement.spec.ts", "A command or MCP call the agent ran, verbatim. Accent, so commands stand out from narration."),
           ("warn", "14:20:41", "Iteration 2 · 1 of 4 failing: matches-across-midnight", "Something went wrong that the agent is handling: failing tests, 80% budget."),
           ("error", "14:06:14", "L2-014 has no Given/When/Then acceptance criterion", "A failure that ended a step or a stage. Usually followed by a Blocked or Failed line.")]


def _cell_line(state=""):
    return (f'<div style="min-width: 20rem; padding-block: var(--space-1); background: var(--color-bg-log); font: var(--text-log);">'
            f'{_line("14:21:03", "info", "Decision recorded: compare posting dates in the account time zone", state)}</div>')


_LOG_WAIT = (f'<div class="empty empty--tight" style="width: 100%;">{icon("circle-dashed")}<div><h4 class="empty__title">Waiting for a worker</h4>'
             '<p class="empty__text">The direction is queued. Stage 0 starts as soon as a worker leases it, usually within 2 seconds. Nothing to do here.</p></div></div>')
_LOG_LOADING = ('<div aria-busy="true" aria-live="polite" style="width: 100%;"><p class="visually-hidden">Loading the run log</p>'
                '<span class="skeleton skeleton--log" style="height: 8rem;" aria-hidden="true"></span></div>')
_LEVEL_TABLE = table(["Level", "Example", "Use for"],
                     [[f'<span class="log__lvl log__lvl--{l}" style="font: var(--text-log);">{l}</span>', f'<code>{escape(e)}</code>', u] for l, _t, e, u in _LEVELS])
_LEVEL_LINES = [(t, l, e) for l, t, e, _u in _LEVELS]
_FOLLOW = btn("Follow log", "", "sm", attrs='aria-pressed="true"')

SPECS["log-viewer"] = {
    "lead": "The log viewer streams what an agent is doing, line by line, so an Owner can watch a stage run and see exactly why it failed.",
    "readme_variants": "live (cursor), finished, failed with error lines; levels info, tool, warn, error",
    "readme_states": "streaming, scrolled up (jump pill), finished, waiting, loading, line hover, box focus",
    "pills": ['<code>role="log"</code>'],
    "overview": f"""<p>Use the log viewer for the worker's output on the {page('components/stepper', 'pipeline')} screen: one line per event, newest at the bottom, following new lines while the reader is at the bottom and holding still when they scroll up. It is the only place raw agent output appears. For a human summary of a run use the {page('components/timeline')}; for a short command to copy use the {page('components/code-block')}.</p>
{ul(["<b>Live</b>: a run is streaming; a pulsing cursor sits under the last line and the box follows new lines.",
     "<b>Finished</b>: the run ended (Paused, Cancelled, Complete or Failed); no cursor, the last line says how it ended.",
     "<b>Scrolled up</b>: the reader left the bottom; new lines still arrive but the view stays put and the <i>n new lines — Jump to latest</i> pill appears (L2-033)."])}""",
    "anatomy": (_log(LOG[9:12], True, 12, "auto"),
                [(9, 14), (26, 14), (60, 14), (5, 74), (72, 64)],
                [("Timestamp", "<code>.log__t</code>: <code>HH:MM:SS</code> in the worker's clock, tabular figures, <code>--color-fg-subtle</code>."),
                 ("Level", "<code>.log__lvl</code>: the word <i>info</i>, <i>tool</i>, <i>warn</i> or <i>error</i>, coloured by level; the word carries the meaning."),
                 ("Text", "<code>.log__text</code>: verbatim output, wraps anywhere so long paths never scroll sideways."),
                 ("Cursor", "<code>.log__cursor</code>: pulsing accent block while the run is live; <code>aria-hidden</code>."),
                 ("Jump pill", "<code>.log__jump</code>: appears when scrolled up with new lines below; a real button.")]),
    "variants": f"""<p>The variant follows the run, not a setting.</p>
<h3>Live</h3>
{ex(_log(LOG[:6], True), "Streaming: the box follows new lines; the cursor shows the run is alive.", cls="ds-example__canvas--stack")}
<h3>Finished</h3>
{ex(_log(_CANCELLED, False, label="Run log, stage 10 Increments, cancelled"), "Cancelled run: no cursor; the last line says how it ended (Harbor CRM).", cls="ds-example__canvas--stack")}
<h3>Failed, with error lines</h3>
{ex(_log(_BLOCKED, False, label="Run log, stage 5 Requirements, failed"), "Blocked stage: error lines name the requirement that failed validation (Parcel Post).", cls="ds-example__canvas--stack")}
<h3>Levels</h3>
{_LEVEL_TABLE}""",
    "sizes": NA("The log has one density: 12px mono (--text-log) on a loose line height. Only its height changes, by breakpoint; see Responsive."),
    "states": f"""<p>A single line has default and hover; the box takes focus so keyboard users can scroll it; the jump pill is a button with the button states. Pointer and focus states are forced with <code>data-state</code>.</p>
{matrix(["Default", "Hover", "Focus", "Active"], [
    ("Log line", [_cell_line(), _cell_line("hover"), "<span class='text-caption'>Lines are not focusable</span>", "<span class='text-caption'>—</span>"]),
    ("Jump pill", [f'<div class="log" style="height: var(--control-height-md); width: 16rem;"><button class="log__jump" type="button">{icon("arrow-down", "icon--xs")} 12 new lines</button></div>',
                   f'<div class="log" style="height: var(--control-height-md); width: 16rem;"><button class="log__jump" type="button" data-state="hover">{icon("arrow-down", "icon--xs")} 12 new lines</button></div>',
                   f'<div class="log" style="height: var(--control-height-md); width: 16rem;"><button class="log__jump" type="button" data-state="focus">{icon("arrow-down", "icon--xs")} 12 new lines</button></div>',
                   f'<div class="log" style="height: var(--control-height-md); width: 16rem;"><button class="log__jump" type="button" data-state="active">{icon("arrow-down", "icon--xs")} 12 new lines</button></div>'])])}
<h3>Box focused</h3>
{ex(_log(LOG[:3], True, box_state="focus"), 'Tab lands on the box (<code>tabindex="0"</code>) so arrow keys and Page Up / Page Down scroll it; the shared focus ring draws round it.', cls="ds-example__canvas--stack")}
<h3>Scrolled up, new lines waiting</h3>
{ex(_log(LOG[:9], True, 12, "12rem"), "The reader scrolled up: the view holds still and the pill counts what arrived below (pages/project-pipeline/log-scrolled).", cls="ds-example__canvas--stack")}
<h3>Waiting and loading</h3>
{ex(_LOG_WAIT, "Queued direction, no worker yet: an empty state stands in for the box (pages/project-pipeline/empty).", cls="ds-example__canvas--stack")}
{ex(_LOG_LOADING, "Loading: one log-height skeleton inside a busy region; the box appears with its first lines.", cls="ds-example__canvas--stack")}
{themes(_log(_LEVEL_LINES, True, 6, "auto"), stack=True)}
{ul(["<b>Follow</b>: while the box is scrolled to the bottom, each new line scrolls it down. Scrolling up by any means (wheel, keys, dragging) stops following; reaching the bottom again, or pressing the pill, resumes it.",
     "<b>Jump pill</b> counts new lines since following stopped and updates in place; it disappears on the bottom.",
     "<b>Finished</b> removes the cursor and keeps the scroll position; the box never clears on its own."])}""",
    "responsive": ul([
        "Base (360px): timestamp column 4.5rem, level column 3rem (<code>--space-12</code>), text takes the rest and wraps anywhere (<code>overflow-wrap: anywhere</code>), so a long <code>git</code> command or path never scrolls sideways.",
        "From sm (36rem) the timestamp column widens to 5rem.",
        "The box is 26rem tall below lg and 28.75rem from lg (<code>--layout-breakpoint-lg</code>), where it sits beside the stage list in <code>.split--pipeline</code>.",
        "The jump pill is centred 16px above the bottom edge at every width and never wraps; at 360px its label is <i>12 new lines — Jump to latest</i>, which fits."]),
    "theming": f"""<p>The box reads <code>--color-bg-log</code> (the canvas tone in light, <code>--palette-slate-950</code> in dark) so it reads as a sunken console in both themes. Levels read status text tokens, not palette colours, so each keeps 4.5:1 on the log background in both themes. Hovered lines use <code>--color-bg-surface</code>; the dark <code>--color-fg-subtle</code> was lightened to keep timestamps legible there (see drift).</p>
<pre><code>/* A taller log on a dedicated full-screen view */
.log--full .log__box {{ height: calc(100dvh - var(--layout-topbar-height) - var(--space-16)); }}</code></pre>""",
    "a11y": {
        "pattern": '<p>The box is <code>role="log"</code> (implicitly <code>aria-live="polite"</code>, additions only) with an <code>aria-label</code> naming the stage. There is no APG pattern for logs; see the <a href="https://www.w3.org/TR/wai-aria-1.2/#log">WAI-ARIA <code>log</code> role</a>. Lines are batched (at most one DOM update per animation frame) so screen readers are not flooded; an Owner who wants silence turns <i>Follow log</i> off (' + _FOLLOW + "), which also stops live announcements.</p>",
        "keys": [(kbd("Tab"), 'Moves focus to the log box (it is a scrollable region with <code>tabindex="0"</code>), then to the jump pill when it is shown.'),
                 (kbd("↑") + " / " + kbd("↓"), "Scrolls the box by a line. Scrolling up stops following."),
                 (kbd("Page Up") + " / " + kbd("Page Down"), "Scrolls by a box height."),
                 (kbd("Home") + " / " + kbd("End"), "Jumps to the first or last line; End resumes following."),
                 (kbd("Enter") + ", " + kbd("Space"), "On the jump pill: scrolls to the latest line, resumes following and moves focus back to the box.")],
        "focus": "<p>The box shows the shared focus ring when focused. Pressing the jump pill removes it from the page, so focus moves to the box rather than being lost. New lines never move focus.</p>",
        "labelling": "<p>Name the box after what it logs: <i>Run log, stage 10 Increments</i>. Each line's level is a visible word, so meaning never depends on colour (1.4.1). The cursor is <code>aria-hidden</code>.</p>",
        "pairs": [("Log text", "--color-fg-default", "--color-bg-log", 4.5), ("Timestamp and info level", "--color-fg-subtle", "--color-bg-log", 4.5),
                  ("tool level", "--color-fg-accent", "--color-bg-log", 4.5), ("warn level", "--color-warning-fg", "--color-bg-log", 4.5),
                  ("error level", "--color-danger-strong", "--color-bg-log", 4.5), ("Timestamp on hovered line", "--color-fg-subtle", "--color-bg-surface", 4.5),
                  ("Jump pill label", "--color-fg-on-accent", "--color-accent", 4.5), ("Focus ring on canvas", "--color-focus-ring", "--color-bg-canvas", 3)],
        "motion": "<p>The cursor pulses on <code>--duration-pulse</code>; following scrolls instantly (never smooth-scrolls, which would lag a fast stream). Under reduced motion <code>--duration-pulse</code> is 0s, so the cursor is a still block and still marks the live run.</p>",
        "touch": "<p>The box scrolls with the finger; the jump pill is 32px tall (<code>--control-height-sm</code>) and full-pill wide, comfortably above the 24px minimum, and floats clear of the last line.</p>",
    },
    "content": ul(["Lines are verbatim agent output; the UI never rewrites them. What the UI adds (the pill, the waiting state) follows the content rules.",
                   "Timestamps are 24-hour <code>HH:MM:SS</code> in the worker's time zone, tabular.",
                   "Pill label: <i>{n} new lines — Jump to latest</i>; singular <i>1 new line</i>.",
                   "Waiting copy says what happens next and that nothing is needed: <i>Stage 0 starts as soon as a worker leases it, usually within 2 seconds. Nothing to do here.</i>",
                   "The final line of a finished run says how it ended: <i>Step finished · checkpoint a8d2e41 · direction Paused</i>."]),
    "dodont": [
        (_log(_BUDGET[:2], False, label="Run log, budget"), "Say the level as a word; colour only reinforces it.",
         ('<div class="log" style="width: 100%;"><div class="log__box" role="log" aria-label="Run log, colour only" tabindex="0" style="height: auto;">'
          '<div class="log__line" style="grid-template-columns: 4.5rem minmax(0, 1fr);"><span class="log__t">13:51:12</span><span class="log__text" style="color: var(--color-warning-fg);">Spend at 80% of budget ($200.00 of $250.00)</span></div></div></div>'),
         "A level shown only by text colour fails 1.4.1 and is lost in forced colours."),
        (_log(LOG[:4], True, 12, "8rem"), "When the reader scrolls up, hold the view and offer the jump pill.",
         _log(LOG[6:10], True, 0, "8rem"), "Snapping back to the bottom on every new line while someone is reading line 4 (the behaviour L2-033 forbids)."),
        (_log(LOG[1:2], False, label="Run log, wrapped"), "Long commands wrap inside the text column.",
         ('<div class="log" style="width: 100%;"><div class="log__box" role="log" aria-label="Run log, truncated" tabindex="0" style="height: auto;">'
          f'<div class="log__line"><span class="log__t">14:02:11</span><span class="log__lvl log__lvl--tool">tool</span><span class="log__text truncate">{escape(LOG[1][2])} and more</span></div></div></div>'),
         "Truncating or <code>white-space: nowrap</code> hides the part of a command that explains the failure."),
    ],
    "tokens": [("Box background", "--color-bg-log"), ("Line type", "--text-log"), ("Text", "--color-fg-default"),
               ("Timestamp, info level", "--color-fg-subtle"), ("tool / warn / error level", "--color-fg-accent / --color-warning-fg / --color-danger-strong"),
               ("Hovered line", "--color-bg-surface"), ("Cursor, jump pill", "--color-accent / --color-accent-hover"), ("Jump pill label", "--color-fg-on-accent"),
               ("Jump pill shadow", "--shadow-3"), ("Jump pill height / radius", "--control-height-sm / --radius-full"),
               ("Line padding / column gap", "--space-4 / --space-2"), ("Cursor pulse", "--duration-pulse / --ease-standard")],
    "code": {"snippet": """<div class="log">
  <div class="log__box" role="log" aria-label="Run log, stage 10 Increments" tabindex="0">
    <div class="log__line">
      <span class="log__t">14:27:30</span><span class="log__lvl log__lvl--info">info</span>
      <span class="log__text">Backend: 412 passed, 0 failed</span>
    </div>
    …
    <span class="log__cursor" aria-hidden="true"></span>
  </div>
  <button class="log__jump" type="button">
    <svg class="icon icon--xs" viewBox="0 0 24 24" aria-hidden="true">…</svg> 12 new lines — Jump to latest
  </button>
</div>""",
             "classes": [("<code>.log</code>", "Positioning wrapper for the box and the jump pill."),
                         ('<code>.log__box</code> + <code>role="log"</code> <code>tabindex="0"</code>', "The scrolling, focusable, polite live region; 26rem tall, 28.75rem from lg."),
                         ("<code>.log__line</code>", "Three-column grid: time, level, text."),
                         ("<code>.log__t</code> <code>.log__lvl</code> <code>.log__text</code>", "Timestamp, level word, verbatim text."),
                         ("<code>.log__lvl--tool</code> <code>--warn</code> <code>--error</code>", "Level colour; info has no modifier."),
                         ("<code>.log__cursor</code>", "Live cursor; omit when the run has finished."),
                         ("<code>.log__jump</code>", "Jump to latest; render only when scrolled up with new lines below."),
                         ('<code>data-state="hover|focus|active"</code>', "Documentation only: forces a state in static pages.")]},
    "sources": {"mocks": [("pages/project-pipeline/default", "live log, stage 10"), ("pages/project-pipeline/log-scrolled", "jump pill"),
                          ("pages/project-pipeline/blocked", "error lines"), ("pages/project-pipeline/budget-reached", "warn lines, finished"),
                          ("pages/project-pipeline/cancelled", "finished run"), ("pages/project-pipeline/empty", "waiting for a worker"),
                          ("pages/project-pipeline/loading", "skeleton")],
                "drift": "the cursor's raw 1.2s loop is now <code>--duration-pulse</code> and stops under reduced motion; dark <code>--color-fg-subtle</code> was lightened so timestamps keep 4.5:1 on hovered lines; the 11px level type is now 12px (<code>--text-log</code>); the box's <code>aria-label</code> now names the stage instead of every log being <i>Run log</i>."},
}


# ============================================================== pipeline strip
_SEG = {"o": " pstrip__seg--ok", "r": " pstrip__seg--run", "f": " pstrip__seg--fail", "p": " pstrip__seg--paused", "s": " pstrip__seg--skip", ".": ""}


def _pstrip(segs, label, width="100%"):
    inner = "".join(f'<span class="pstrip__seg{_SEG[c]}"></span>' for c in segs)
    return f'<div class="pstrip" role="img" aria-label="{escape(label, quote=True)}" style="width: {width};">{inner}</div>'


_RUNS = [
    ("Ledgerline, running", "oooooooooor", "Pipeline: Bootstrap to Estimates succeeded, stage 10 Increments running", "Stage 10 · Increments", "Running"),
    ("Tidewater, running", "ooor.......", "Pipeline: Bootstrap to Designs succeeded, stage 3 Design system running, 7 pending", "Stage 3 · Design system", "Running"),
    ("Parcel Post, blocked", "ooooof.....", "Pipeline: Bootstrap to Stack succeeded, stage 5 Requirements failed, 5 pending", "Stage 5 · Requirements", "Blocked"),
    ("Kiln Booking, paused", "oooooooooop", "Pipeline: Bootstrap to Estimates succeeded, stage 10 Increments paused", "Stage 10 · Increments", "Paused"),
    ("Northwind Ops, feature direction", "sosssosoooo", "Pipeline: 5 stages skipped for a feature direction, Idea, Requirements and Detailed designs to Increments succeeded", "Complete", "Complete"),
    ("Field Notes, complete", "ooooooooooo", "Pipeline: all 11 stages succeeded", "Complete", "Complete"),
]



_PS_ROWS = [(n, [_pstrip(s, l, "14rem"), f'<span class="text-caption">{escape(l)}</span>', status(st, sm=True)]) for n, s, l, _stg, st in _RUNS]
_PS_RUN = (f'<div class="run" style="width: 100%; padding: 0;"><div class="run__head"><span class="run__name">Ledgerline</span>'
           f'<span class="run__stage">{icon("loader", "icon--sm icon--spin")}Stage 10 · Increments</span>'
           '<span class="run__money">62% · $184.20 <span class="text-subtle">of $400.00</span></span></div>'
           f'{_pstrip(_RUNS[0][1], _RUNS[0][2])}</div>')
_PS_STOPPED = (f'<div class="run" style="width: 100%; padding: 0;"><div class="run__head"><span class="run__name">Tidewater</span>'
               f'<span class="run__stage" style="color: var(--color-warning-fg);">{icon("pause-circle", "icon--sm")}Paused at checkpoint · stage 3</span></div>'
               f'{_pstrip("ooop.......", "Pipeline: Bootstrap to Designs succeeded, stage 3 Design system paused, 7 pending")}</div>')
_PS_SEGS = table(["Segment", "Class", "Meaning"], [
    ['<div class="pstrip" style="width: 3rem;" aria-hidden="true"><span class="pstrip__seg pstrip__seg--ok"></span></div>', "<code>.pstrip__seg--ok</code>", "Stage succeeded."],
    ['<div class="pstrip" style="width: 3rem;" aria-hidden="true"><span class="pstrip__seg pstrip__seg--run"></span></div>', "<code>.pstrip__seg--run</code>", "Stage running now; pulses."],
    ['<div class="pstrip" style="width: 3rem;" aria-hidden="true"><span class="pstrip__seg pstrip__seg--fail"></span></div>', "<code>.pstrip__seg--fail</code>", "Stage failed after its retries; direction Blocked."],
    ['<div class="pstrip" style="width: 3rem;" aria-hidden="true"><span class="pstrip__seg pstrip__seg--paused"></span></div>', "<code>.pstrip__seg--paused</code>", "Paused at a checkpoint (by an Owner, a budget stop, or Stop all workers)."],
    ['<div class="pstrip" style="width: 3rem;" aria-hidden="true"><span class="pstrip__seg pstrip__seg--skip"></span></div>', "<code>.pstrip__seg--skip</code>", "Skipped by design (feature directions skip Bootstrap, Designs, Design system, Stack and Scaffold)."],
    ['<div class="pstrip" style="width: 3rem;" aria-hidden="true"><span class="pstrip__seg"></span></div>', "no modifier", "Pending: not reached yet."]])

SPECS["pipeline-strip"] = {
    "lead": "The pipeline strip compresses a direction's eleven stages into one bar, so the dashboard shows how far each live run has got at a glance.",
    "readme_variants": "segments ok, run, fail, paused, skip, pending",
    "readme_states": "running, blocked, paused, feature direction, complete (not interactive)",
    "pills": ['<code>role="img"</code>'],
    "overview": f"""<p>Use the strip where many directions are summarised in little space: the dashboard's <i>Live work</i> tile. Each of the 11 segments is one stage, Bootstrap (0) to Increments (10), in order. It is a glance aid: the stage number and name always appear in text beside it, and the full, interactive view is the {page('components/stepper', 'stage list')} on the pipeline screen.</p>
<p>Do not use it inside the pipeline screen itself (the stage list already shows every stage), or for progress within a stage; that is a {page('components/progress-bar')}.</p>""",
    "anatomy": (_pstrip(_RUNS[2][1], _RUNS[2][2], "18rem"),
                [(31, 22), (50, 22), (64, 22), (77, 50)],
                [("Done segment", "<code>.pstrip__seg--ok</code>: one per succeeded stage."),
                 ("Current segment", "The stage now running (<code>--run</code>), failed (<code>--fail</code>) or paused (<code>--paused</code>)."),
                 ("Pending segment", "No modifier: the track colour."),
                 ("Track", "<code>.pstrip</code>: a flex row with a 2px gap; 6px tall; segments share the width equally.")]),
    "variants": f"""<p>A strip has no variants of its own; each segment takes one of six looks.</p>
{_PS_SEGS}
<h3>In context</h3>
{ex(_PS_RUN, "Dashboard Live work row: name, stage in words with a spinning loader, money, then the strip.", cls="ds-example__canvas--stack")}
{ex(_PS_STOPPED, "Stop all workers: the current segment turns paused and the stage text says so.", cls="ds-example__canvas--stack")}""",
    "sizes": NA("One size: 6px tall (--space-1-5), full width of its container; segments divide the width equally."),
    "states": f"""<p>The strip is not interactive: it has no hover, focus, active or disabled state, and is never a link on its own (the run's name is the link). Its states are the states of the direction, shown in the current segment and repeated in its accessible name.</p>
{matrix(["Strip", "Accessible name", "Status beside it"], _PS_ROWS)}
{themes(_pstrip(_RUNS[2][1], _RUNS[2][2]) + _pstrip(_RUNS[4][1], _RUNS[4][2]) + _pstrip(_RUNS[3][1], _RUNS[3][2]), stack=True)}""",
    "responsive": ul([
        "The strip is fluid at every breakpoint: 11 equal segments with fixed 2px gaps. At 360px inside a tile each segment is about 26px wide; it never wraps or scrolls.",
        "Below sm the dashboard tile stacks name, stage and money above the strip; from lg the tile spans 8 of 12 columns and the strip widens with it.",
        "Below 16rem of width the segments get too thin to read; do not place the strip in narrower containers (use the stage text alone)."]),
    "theming": "<p>Segments read status fill tokens (<code>--color-success-solid</code>, <code>--color-info-solid</code>, <code>--color-danger-icon</code>, <code>--color-warning-solid</code>) and the pending track reads <code>--color-border-default</code>, so they re-tone with the theme and keep 3:1 against the tile surface in both. The skipped segment is an outline in <code>--color-border-strong</code>, so it reads as <i>not part of this run</i> rather than <i>not reached</i>.</p>",
    "a11y": {
        "pattern": '<p>One <code>role="img"</code> element with an <code>aria-label</code> that summarises the run; the segments are presentational spans. No APG pattern applies; see <a href="https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html">1.1.1 Non-text content</a>. The adjacent stage text (<i>Stage 10 · Increments</i>) is the primary information, so the strip is never the only carrier (1.4.1).</p>',
        "keys": [("None", "The strip is not focusable. Tab moves to the run's name link beside it.")],
        "focus": "<p>The strip never takes focus.</p>",
        "labelling": "<p>Group runs of the same status instead of reading 11 stage names: <i>Pipeline: Bootstrap to Estimates succeeded, stage 10 Increments running</i>. Name the current stage and its status every time; give counts for pending or skipped stages.</p>",
        "pairs": [("Succeeded segment", "--color-success-solid", "--color-bg-surface", 3), ("Running segment", "--color-info-solid", "--color-bg-surface", 3),
                  ("Failed segment", "--color-danger-icon", "--color-bg-surface", 3), ("Paused segment", "--color-warning-solid", "--color-bg-surface", 3),
                  ("Skipped outline", "--color-border-strong", "--color-bg-surface", 3), ("Stage text beside it", "--color-fg-accent", "--color-bg-surface", 4.5)],
        "motion": "<p>The running segment pulses on <code>--duration-pulse</code>. Under reduced motion it holds still at full opacity; the stage text and the spinner's static icon still say it is running.</p>",
        "touch": "<p>Not a target. The tappable run name sits above it with its own 44px row height on phones.</p>",
    },
    "content": ul(["Always pair the strip with the stage in words: <i>Stage 3 · Design system</i>, <i>Paused at checkpoint · stage 3</i>.",
                   "Stage names come from the pipeline, in sentence case: Bootstrap, Idea, Designs, Design system, Stack, Requirements, Scaffold, Detailed designs, User journeys, Estimates, Increments.",
                   "In the accessible name, number the current stage (<i>stage 10 Increments</i>) and use the same status words as the status badge: succeeded, running, failed, paused, skipped, pending."]),
    "dodont": [
        (_PS_RUN, "Pair the strip with the stage in words and a status icon.",
         _pstrip(_RUNS[0][1], _RUNS[0][2]), "A bare strip says nothing to anyone who cannot tell blue from green, and nothing in forced colours."),
        (_pstrip(_RUNS[4][1], _RUNS[4][2]), "Skipped stages are outlined, so a finished feature direction does not look unfinished.",
         _pstrip(".o...o.oooo", "Pipeline with skipped stages drawn as pending"), "Skipped stages drawn as pending make Northwind Ops look stuck at 55%."),
    ],
    "tokens": [("Succeeded", "--color-success-solid"), ("Running", "--color-info-solid"), ("Failed", "--color-danger-icon"), ("Paused", "--color-warning-solid"),
               ("Pending track", "--color-border-default"), ("Skipped outline", "--color-border-strong"),
               ("Height / gap", "--space-1-5 / --space-0-5"), ("Segment radius", "--radius-xs"), ("Outline width", "--border-width-hairline"),
               ("Pulse", "--duration-pulse / --ease-standard")],
    "code": {"snippet": """<div class="pstrip" role="img"
     aria-label="Pipeline: Bootstrap to Designs succeeded, stage 3 Design system running, 7 pending">
  <span class="pstrip__seg pstrip__seg--ok"></span>   <!-- 0 Bootstrap -->
  <span class="pstrip__seg pstrip__seg--ok"></span>   <!-- 1 Idea -->
  <span class="pstrip__seg pstrip__seg--ok"></span>   <!-- 2 Designs -->
  <span class="pstrip__seg pstrip__seg--run"></span>  <!-- 3 Design system -->
  <span class="pstrip__seg"></span>                   <!-- 4 to 10 pending -->
  …
</div>""",
             "classes": [('<code>.pstrip</code> + <code>role="img"</code> <code>aria-label</code>', "The strip; the label summarises every segment."),
                         ("<code>.pstrip__seg</code>", "One stage; with no modifier it is pending."),
                         ("<code>--ok</code> <code>--run</code> <code>--fail</code> <code>--paused</code> <code>--skip</code>", "Segment status.")]},
    "sources": {"mocks": [("pages/dashboard/default", "Live work tile"), ("pages/dashboard/stopped", "paused current segment"),
                          ("pages/dashboard/viewer", "same strip for Viewers"), ("pages/dashboard/reconnecting", "strip while reconnecting")],
                "drift": "the 3px gap is now <code>--space-0-5</code>; the running segment moved from <code>--color-accent</code> to <code>--color-info-solid</code>; the succeeded segment lost its 0.85 opacity (it fell below 3:1); the skipped outline moved from <code>--color-border-default</code> to <code>--color-border-strong</code>; the mocks' <code>pstrip__seg--pend</code> had no rule and is now simply the unmodified segment; the 11-name <code>aria-label</code> is grouped by status."},
}


# ============================================================== project header
_TABS = [("pipeline", "Pipeline"), ("backlog", "Backlog"), ("designs", "Designs"), ("design-system", "Design system"),
         ("decisions", "Decisions"), ("artifacts", "Artifacts"), ("trace", "Traceability")]


def _phead(st="Running", role="owner", spend=184.20, budget=400.0, pct=62, name="Ledgerline", repo="hewn-builds/ledgerline",
           kind="Product direction · started 7 Nov", skills=True, tab="pipeline"):
    owner = role == "owner"
    used = min(100, spend / budget * 100)
    meter_cls = "meter meter--warn" if used >= 80 else "meter"
    controls = ""
    if owner and st not in ("Cancelled", "Complete", "Idle"):
        primary = (btn("Retry stage", "", "sm", "rotate-ccw") if st == "Blocked" else
                   btn("Resume", "", "sm", "play") if st == "Paused" else btn("Pause", "", "sm", "pause"))
        controls = f'<div class="cluster">{primary}{btn("Cancel", "ghost", "sm", "square")}</div>'
    skills_link = (f'<a class="btn btn--link" href="#states">{icon("refresh", "icon--xs")} Skills update available (4 commits)</a>'
                   if owner and skills else "")
    tabs = "".join(f'<a class="tab" href="#overview"{" aria-current=" + chr(34) + "page" + chr(34) if k == tab else ""}>{lbl}</a>' for k, lbl in _TABS)
    money_s = f"${spend:,.2f}"
    budget_s = f"${budget:,.2f}"
    return f"""<header class="phead" style="width: 100%; min-width: 0;">
  <div class="phead__top">
    <nav aria-label="Breadcrumb"><ol class="breadcrumb"><li><a href="#overview">Projects</a></li><li aria-hidden="true">{icon("chevron-right")}</li><li aria-current="page">{name}</li></ol></nav>
    <div class="phead__row">
      <div class="truncate">
        <div class="cluster cluster--lg"><p style="font: var(--text-h1); letter-spacing: var(--letter-spacing-tight);">{name}</p>{status(st)}</div>
        <div class="phead__meta"><span>{kind}</span><a class="phead__repo" href="https://github.com/{repo}">{icon("github", "icon--xs")} {repo}</a>{skills_link}</div>
      </div>
      <div class="phead__stats">
        <div class="phead__spend">
          <div class="phead__label"><span>Spend</span><span class="tabular"><strong>{money_s}</strong> of {budget_s}</span></div>
          <div class="{meter_cls} mt-2" role="meter" aria-label="Spend" aria-valuenow="{spend:.2f}" aria-valuemin="0" aria-valuemax="{budget:.2f}" aria-valuetext="{money_s} of {budget_s}"><span class="meter__bar" style="--value: {used:.0f}%"></span></div>
        </div>
        <div class="text-xs"><div class="text-muted">Complete</div><div class="tabular text-sm mt-1">{pct}%</div></div>
        {controls}
      </div>
    </div>
  </div>
  <nav class="phead__tabs" aria-label="Project sections"><div class="tabs tabs--flush">{tabs}</div></nav>
</header>"""


def _tab(label, state="", current=False):
    ds = f' data-state="{state}"' if state else ""
    cur = ' aria-current="page"' if current else ""
    return f'<div class="tabs tabs--flush"><a class="tab" href="#states"{ds}{cur}>{label}</a></div>'


def _repo(state=""):
    ds = f' data-state="{state}"' if state else ""
    style = ' style="color: var(--color-fg-default); text-decoration: underline;"' if state == "hover" else ""
    return f'<span class="phead__meta" style="margin: 0;"><a class="phead__repo" href="#states"{ds}{style}>{icon("github", "icon--xs")} hewn-builds/ledgerline</a></span>'


_PH_KILN = _phead("Paused", spend=250.0, budget=250.0, pct=81, name="Kiln Booking", repo="hewn-builds/kiln-booking", kind="Product direction · started 5 Nov")
_PH_PARCEL = _phead("Blocked", spend=58.10, budget=300.0, pct=24, name="Parcel Post", repo="hewn-builds/parcel-post", kind="Product direction · started 6 Nov")
_PH_FIELD = _phead("Complete", spend=341.90, budget=400.0, pct=100, name="Field Notes", repo="hewn-builds/field-notes", kind="Product direction · finished 8 Nov", skills=False)
_PH_VIEWER = _phead(role="viewer")
_PH_SPEND_BAD = ('<div class="phead__spend"><div class="phead__label"><span>Spend</span><span class="tabular"><strong>46%</strong></span></div>'
                 '<div class="meter mt-2" role="meter" aria-label="Spend" aria-valuenow="46" aria-valuemin="0" aria-valuemax="100"><span class="meter__bar" style="--value: 46%"></span></div></div>')
_PH_SPEND_GOOD = ('<div class="phead__spend"><div class="phead__label"><span>Spend</span><span class="tabular"><strong>$184.20</strong> of $400.00</span></div>'
                  '<div class="meter mt-2" role="meter" aria-label="Spend" aria-valuenow="184.20" aria-valuemin="0" aria-valuemax="400.00" aria-valuetext="$184.20 of $400.00"><span class="meter__bar" style="--value: 46%"></span></div></div>')
_PH_CTRL_BAD = (f'<div class="cluster"><button class="btn btn--sm" type="button" disabled>{icon("pause", "icon--sm")}Pause</button>'
                f'<button class="btn btn--ghost btn--sm" type="button" disabled>{icon("square", "icon--sm")}Cancel</button></div>')

SPECS["project-header"] = {
    "lead": "The project header sits on every project screen: which project this is, where its code lives, how it is doing, what it has spent, and the tabs between its views.",
    "readme_variants": "running (Pause, Cancel), paused (Resume), blocked (Retry stage), finished (no controls), viewer (read-only); spend meter warns at 80%",
    "readme_states": "tab default, hover, focus, current; repo link hover, focus; budget warning",
    "overview": f"""<p>Every screen under a project (Pipeline, Backlog, Designs, Design system, Decisions, Artifacts, Traceability) starts with this header. It replaces the generic {page('components/page-header')} there. It combines a {page('components/breadcrumb')}, the project name as the page's <code>h1</code> with its {page('components/badge', 'status')}, the repository, a spend meter ({page('components/progress-bar')}), percent complete, the direction controls for Owners, and navigation {page('components/tabs')}.</p>
<p>The controls change with the status, so the header is where an Owner pauses, resumes, retries or cancels the direction from any project view.</p>""",
    "anatomy": (_phead(),
                [(5, 24), (5, 41), (46, 41), (5, 58), (89, 35), (88, 65), (5, 81)],
                [("Breadcrumb", 'Back to Projects; the current crumb is <code>aria-current="page"</code>.'),
                 ("Name", "The page <code>h1</code> in <code>--text-h1</code>."),
                 ("Status", "Icon + word, the same status badge as everywhere else."),
                 ("Meta line", "Direction kind and start date, the repository link, and for Owners the skills update link."),
                 ("Spend meter", '<code>role="meter"</code>, money as text above it; turns warning at 80%.'),
                 ("Controls", "Owner only: Pause or Resume or Retry stage, plus Cancel."),
                 ("Tabs", "Navigation links to the project's views; the current one has <code>aria-current=\"page\"</code>.")]),
    "variants": f"""<p>The status decides the controls; the role decides whether there are any.</p>
<h3>Paused at budget</h3>
{ex(_PH_KILN, "Kiln Booking hit its $250.00 budget: Resume replaces Pause and the meter turns warning.", cls="ds-example__canvas--stack")}
<h3>Blocked</h3>
{ex(_PH_PARCEL, "Parcel Post: Retry stage replaces Pause.", cls="ds-example__canvas--stack")}
<h3>Finished</h3>
{ex(_PH_FIELD, "Field Notes is Complete: no controls and no skills link; tabs stay.", cls="ds-example__canvas--stack")}
<h3>Viewer</h3>
{ex(_PH_VIEWER, "ama-osei (Viewer) sees the same header without controls or the skills link; nothing is shown disabled.", cls="ds-example__canvas--stack")}""",
    "sizes": NA("One size. Spacing changes with the breakpoint, not with a size option; see Responsive."),
    "states": f"""<p>The header's interactive parts are the breadcrumb link, the repository link, the skills link, the control buttons (see {page('components/button')}) and the tabs. Pointer and focus states are forced with <code>data-state</code>.</p>
{matrix(["Default", "Hover", "Focus", "Current"], [
    ("Tab", [_tab("Backlog"), _tab("Backlog", "hover"), _tab("Backlog", "focus"), _tab("Pipeline", current=True)]),
    ("Repository link", [_repo(), _repo("hover"), _repo("focus"), "<span class='text-caption'>—</span>"]),
    ("Skills link", [f'<a class="btn btn--link" href="#states">{icon("refresh", "icon--xs")} Skills update available (4 commits)</a>',
                     f'<a class="btn btn--link" href="#states" data-state="hover">{icon("refresh", "icon--xs")} Skills update available (4 commits)</a>',
                     f'<a class="btn btn--link" href="#states" data-state="focus">{icon("refresh", "icon--xs")} Skills update available (4 commits)</a>',
                     "<span class='text-caption'>—</span>"])])}
<h3>Budget warning</h3>
{ex(_PH_SPEND_GOOD + '<div class="phead__spend"><div class="phead__label"><span>Spend</span><span class="tabular"><strong>$200.00</strong> of $250.00</span></div><div class="meter meter--warn mt-2" role="meter" aria-label="Spend" aria-valuenow="200.00" aria-valuemin="0" aria-valuemax="250.00" aria-valuetext="$200.00 of $250.00, 80%"><span class="meter__bar" style="--value: 80%"></span></div></div>',
    "Below 80% the meter is accent; at 80% and above it is warning (the direction pauses itself at 100%).")}
{themes(_phead(), stack=True)}""",
    "responsive": ul([
        "Base (360px): padding 20px top, 16px sides; name and status wrap as a cluster; the meta line wraps; the stats (spend, complete, controls) stack under the title block; tabs scroll horizontally inside <code>.phead__tabs</code> with the scrollbar hidden and a 44px touch height.",
        "From lg (62rem): padding grows to 24px top and 32px sides to line up with the page content; tabs drop to 40px (<code>--control-height-md</code>).",
        "From xl (75rem): the title block and the stats sit on one row (<code>.phead__row</code> becomes a row), stats aligned to the bottom right.",
        "The name truncates with an ellipsis rather than wrapping under the status; the spend block keeps a minimum width of 11rem so money never wraps."]),
    "theming": "<p>The header is a <code>--color-bg-surface</code> band with a hairline <code>--color-border-default</code> bottom edge, so it reads as part of the chrome in both themes. The meter follows the progress bar's tokens; tabs follow the tab tokens. No header-specific colour tokens exist; override the tab and meter component tokens instead.</p>",
    "a11y": {
        "pattern": '<p>A <code>&lt;header&gt;</code> inside <code>&lt;main&gt;</code> (not the banner landmark) holding a <a href="https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/">breadcrumb</a> <code>nav</code>, the page <code>h1</code>, a <a href="https://www.w3.org/WAI/ARIA/apg/patterns/meter/">meter</a>, buttons, and a second <code>nav</code> labelled <i>Project sections</i>. The tabs navigate to other pages, so they are links with <code>aria-current="page"</code>, not the ARIA tabs pattern.</p>',
        "keys": [(kbd("Tab"), "Breadcrumb link, repository link, skills link, controls, then each section link in order."),
                 (kbd("Enter"), "Follows a link; on a control button it acts (Pause, Resume, Retry stage, Cancel opens its dialog)."),
                 (kbd("Space"), "Activates the focused button.")],
        "focus": "<p>Every link and button shows the shared focus ring. The tab strip scrolls the focused tab into view on phones. After Pause or Resume the button swaps label in place and keeps focus.</p>",
        "labelling": "<p>The project name is the page's only <code>h1</code>. The two navs have distinct labels (<i>Breadcrumb</i>, <i>Project sections</i>). The meter carries <code>aria-valuetext=\"$184.20 of $400.00\"</code>, so it is read as money rather than <i>184.2</i>. The status is icon plus word.</p>",
        "pairs": [("Name and current tab", "--color-fg-default", "--color-bg-surface", 4.5), ("Meta line, tabs", "--color-fg-muted", "--color-bg-surface", 4.5),
                  ("Running status", "--color-fg-accent", "--color-bg-surface", 4.5), ("Paused status", "--color-warning-fg", "--color-bg-surface", 4.5),
                  ("Spend fill vs track", "--color-accent", "--color-border-default", 3), ("Warning fill vs track", "--color-warning-solid", "--color-border-default", 3),
                  ("Current tab underline", "--color-accent", "--color-bg-surface", 3), ("Focus ring", "--color-focus-ring", "--color-bg-surface", 3)],
        "motion": "<p>Only the tab underline transitions (<code>--duration-base</code>) and the Running status icon spins (<code>--duration-spin</code>); both stop under reduced motion.</p>",
        "touch": "<p>Tabs are 44px tall below lg; control buttons are small (32px) with 8px between them; the repository link has an inline target in a line of text (exempt under 2.5.8).</p>",
    },
    "content": ul(["Kind and date: <i>Product direction · started 7 Nov</i> or <i>Feature direction · started 8 Nov</i>; <i>finished 8 Nov</i> once Complete.",
                   "Repository as <code>owner/repo</code> in mono, linking to GitHub.",
                   "Money is always amount and budget: <strong>$184.20</strong> of $400.00, two decimals, tabular.",
                   "Tabs are nouns in sentence case: Pipeline, Backlog, Designs, Design system, Decisions, Artifacts, Traceability.",
                   "Controls are verbs: <i>Pause</i>, <i>Resume</i>, <i>Retry stage</i>, <i>Cancel</i>."]),
    "dodont": [
        (_PH_SPEND_GOOD, "Show money spent of budget, and give the meter the same words as <code>aria-valuetext</code>.",
         _PH_SPEND_BAD, "A bare percentage hides what has been spent and is read as <i>46</i>."),
        ('<p class="text-caption">Viewer</p>' + f'<div class="cluster">{status("Running")}</div>', "Hide controls a Viewer cannot use (pages/project-pipeline/viewer).",
         _PH_CTRL_BAD, "Disabled Pause and Cancel buttons tell a Viewer nothing and add two dead tab stops."),
    ],
    "tokens": [("Band", "--color-bg-surface / --color-border-default"), ("Name", "--text-h1 / --letter-spacing-tight"), ("Meta line", "--text-body-sm / --color-fg-muted"),
               ("Repository", "--text-code"), ("Spend label", "--text-caption"), ("Spend fill / warning fill", "--color-accent / --color-warning-solid"),
               ("Padding base / lg", "--space-5 / --space-8"), ("Tab height base / lg", "--target-comfortable / --control-height-md"),
               ("Row gap", "--space-4")],
    "code": {"snippet": """<header class="phead">
  <div class="phead__top">
    <nav aria-label="Breadcrumb"><ol class="breadcrumb">…<li aria-current="page">Ledgerline</li></ol></nav>
    <div class="phead__row">
      <div class="truncate">
        <div class="cluster cluster--lg"><h1>Ledgerline</h1><span class="status status--run">…Running</span></div>
        <div class="phead__meta"><span>Product direction · started 7 Nov</span>
          <a class="phead__repo" href="https://github.com/hewn-builds/ledgerline">… hewn-builds/ledgerline</a></div>
      </div>
      <div class="phead__stats">
        <div class="phead__spend">
          <div class="phead__label"><span>Spend</span><span class="tabular"><strong>$184.20</strong> of $400.00</span></div>
          <div class="meter mt-2" role="meter" aria-label="Spend" aria-valuemin="0" aria-valuemax="400"
               aria-valuenow="184.20" aria-valuetext="$184.20 of $400.00"><span class="meter__bar" style="--value: 46%"></span></div>
        </div>
        <div class="cluster"><button class="btn btn--sm" type="button">…Pause</button> …</div>
      </div>
    </div>
  </div>
  <nav class="phead__tabs" aria-label="Project sections"><div class="tabs tabs--flush">
    <a class="tab" href="/projects/ledgerline" aria-current="page">Pipeline</a> …
  </div></nav>
</header>""",
             "classes": [("<code>.phead</code>", "The band."), ("<code>.phead__top</code>", "Padded area above the tabs."),
                         ("<code>.phead__row</code>", "Title block and stats; a column below xl, a row from xl."),
                         ("<code>.phead__meta</code> <code>.phead__repo</code>", "Meta line and repository link."),
                         ("<code>.phead__stats</code> <code>.phead__spend</code> <code>.phead__label</code>", "Spend, complete and controls."),
                         ("<code>.phead__tabs</code>", "Horizontally scrolling tab nav.")]},
    "sources": {"mocks": [("pages/project-pipeline/default", "Running, owner"), ("pages/project-pipeline/viewer", "Viewer, no controls"),
                          ("pages/project-pipeline/budget-reached", "Paused, warning meter"), ("pages/project-pipeline/blocked", "Retry stage"),
                          ("pages/project-pipeline/complete", "no controls"), ("pages/backlog/default", "Backlog tab current")],
                "drift": "the spend meter gains <code>aria-valuetext</code> (the mocks announce <i>184.2</i>); padding snapped to the 4px scale; the mocks' <code>p.h1-like</code> with an inline <code>font</code> exists only for screens with another <code>h1</code> and is not part of the component."},
}


# ============================================================== preview
_VROWS = [("Nov 30", "Harbour Coffee", "-$14.25", "Receipt #2214", True), ("Nov 30", "Translink", "-$3.15", "Receipt #2215", True),
          ("Dec 1", "AWS EMEA", "-$212.48", "Statement line 18", True), ("Dec 1", "Staples 0412", "-$58.90", "Suggest: Receipt #2219", False)]
_VTRS = "".join(f'<div class="video__tr{"" if ok else " video__tr--focus"}"><span>{d}</span><span class="truncate">{m}</span><span class="tabular">{a}</span>'
                f'<span class="truncate {"video__ok" if ok else "video__sug"}">{r}</span></div>' for d, m, a, r, ok in _VROWS)


def _vbtn(ic, label, state="", pressed=None):
    ds = f' data-state="{state}"' if state else ""
    pr = f' aria-pressed="{pressed}"' if pressed is not None else ""
    return f'<button class="video__btn" type="button" aria-label="{label}"{pr}{ds}>{icon(ic)}</button>'


def _video(caption=True):
    cap = '<div class="video__caption"><span>A transaction posted at 11:58 pm still matches the November statement.</span></div>' if caption else ""
    return f"""<div class="video" style="width: 100%;">
  <div class="video__frame" aria-hidden="true"><div class="video__side"><span></span><span></span><span></span><span></span></div>
    <div class="video__content"><div class="video__h">Visa ···4410 · November statement</div><div class="video__s">38 of 41 lines matched · 3 to review</div><div class="video__table">{_VTRS}</div></div></div>
  {cap}
  <div class="video__controls">{_vbtn("play", "Play")}<span class="tabular">1:22 / 2:14</span>
    <div class="video__track" role="slider" aria-label="Seek" aria-valuemin="0" aria-valuemax="134" aria-valuenow="82" aria-valuetext="1 minute 22 of 2 minutes 14" tabindex="0"><span></span></div>
    {_vbtn("captions", "Captions", pressed="true" if caption else "false")}
    <button class="video__btn sm-only" type="button" aria-label="Full screen">{icon("maximize")}</button></div>
</div>"""


_ROWS6 = "".join(f'<div class="mini-app__row{" mini-app__row--focus" if i == 3 else ""}"><span class="mini-app__cell"></span><span class="mini-app__cell"></span>'
                 f'<span class="mini-app__cell"></span><span class="mini-app__cell {"mini-app__cell--accent" if i == 3 else "mini-app__cell--ok"}"></span></div>' for i in range(6))


def _preview(width="62rem", dark=False, label="Exported mock: Reconcile statement, Review state, 992 px, light"):
    cls = "preview__frame" + (" preview__frame--dark preview__frame--narrow" if dark else "")
    return (f'<div class="preview" style="width: 100%; margin-top: 0;"><div class="{cls}" style="--w: {width}" role="img" aria-label="{label}">'
            '<div class="mini-app"><div class="mini-app__side"><div class="mini-app__bar mini-app__bar--title"></div><div class="mini-app__bar"></div>'
            '<div class="mini-app__bar mini-app__bar--accent"></div><div class="mini-app__bar"></div></div>'
            f'<div class="mini-app__main"><div class="mini-app__bar mini-app__bar--title"></div><div class="mini-app__bar" style="width: 35%"></div>{_ROWS6}</div></div></div></div>')


def _state_link(label, state="", current=False, mp=True):
    ds = f' data-state="{state}"' if state else ""
    cur = ' aria-current="true"' if current else ""
    mp_html = (f'<a class="state-mp" href="https://www.magicpatterns.com/os/c9upyFcFm8ZTUr3n843kZW" aria-label="Open Reconcile statement · {label} in Magic Patterns" title="Open in Magic Patterns">{icon("external", "icon--xs")}</a>'
               if mp else "")
    return (f'<div class="state-item"><a class="state-link" href="#states"{ds}{cur}><span class="state-thumb" aria-hidden="true"><span></span><span></span><span></span></span>{label}</a>{mp_html}</div>')


_STATE_LIST = ('<div style="width: 100%; max-width: 16rem;"><p class="text-sm" style="font-weight: var(--font-weight-medium);">Reconcile statement</p><ul class="state-list">'
               + "".join(f"<li>{_state_link(s, current=(s == 'Review'))}</li>" for s in ["Default", "Review", "Loading", "Error"]) + "</ul></div>")
_PLACEHOLDER = (f'<div class="video video--placeholder" style="width: 100%;">{icon("video", "icon--xl")}'
                '<p class="max-measure">The walkthrough records once every test is green. Implementing, iteration 3 of 10.</p></div>')
_VFAILED = (f'<div class="video video--placeholder" style="width: 100%;">{icon("alert-triangle", "icon--xl s-icon--warn")}'
            '<p style="color: var(--color-fg-default); font-weight: var(--font-weight-medium);">Video failed: browser crashed during capture</p>'
            '<p class="max-measure">The capture failed, was retried once and failed again. The pull request went ahead with this noted under Notes.</p></div>')
_VFAILED_BAD = (f'<div class="video video--placeholder" style="width: 100%;">{icon("alert-triangle", "icon--xl s-icon--warn")}<p>Video unavailable</p></div>')
_PREVIEW_BAD = ('<div class="preview" style="width: 100%; margin-top: 0;"><div class="preview__frame" style="--w: 62rem; background: var(--color-bg-surface);" role="img" aria-label="Preview drawn with Mission Control surface tokens">'
                '<div class="mini-app" style="color: var(--color-fg-default);"><div class="mini-app__side" style="background: var(--color-bg-surface-raised); border-color: var(--color-border-default);">'
                '<div class="mini-app__bar" style="background: var(--color-fg-default);"></div></div><div class="mini-app__main"><div class="mini-app__bar" style="background: var(--color-fg-default); width: 45%;"></div></div></div></div></div>')

SPECS["preview"] = {
    "lead": "Previews show the product Hewn is building: the captioned walkthrough video of each increment, and the exported mocks and design-system pages in a sandboxed frame.",
    "readme_variants": "increment video, video placeholder (waiting, failed), design preview frame (light, dark narrow), state list",
    "readme_states": "video controls default, hover, focus, pressed; state link default, hover, focus, current; loading; failed",
    "pills": ["Fixed <code>--color-preview-*</code> tokens"],
    "overview": f"""<p>Previews are pictures of someone else's product inside Mission Control. They use their own fixed <code>--color-preview-*</code> tokens on purpose: the built app has its own theme, so switching Mission Control to dark must not repaint the product being previewed. Only the frame around it follows the Mission Control theme.</p>
{ul(["<b>Increment video</b> (<code>.video</code>): the captioned 1080p walkthrough recorded once every acceptance test is green, with play, seek, captions and full screen (pages/increment/default).",
     "<b>Video placeholder</b> (<code>.video--placeholder</code>): the same 16:9 box, saying why there is no video yet or why capture failed.",
     "<b>Design preview</b> (<code>.preview</code> + <code>.preview__frame</code>): a sandboxed, separate-origin frame showing an exported mock or design-system page at a chosen width and theme (pages/designs/default).",
     "<b>State list</b> (<code>.state-list</code>): the screens and states that pick what the design preview shows."])}
<p>The mocks draw the product with <code>.mini-app</code> blocks; in the product the frame is an <code>&lt;iframe sandbox=\"allow-scripts\"&gt;</code> on mocks.hewn.dev with no <code>allow-same-origin</code>, so a mock cannot read Mission Control's cookies or storage (L2-011).</p>""",
    "anatomy": (_video(),
                [(10, 12), (50, 76), (6, 92), (26, 92), (55, 92), (84, 92)],
                [("Frame", "<code>.video__frame</code>: the recorded product, in fixed preview tokens; <code>aria-hidden</code> because the real element is <code>&lt;video&gt;</code>."),
                 ("Caption", "<code>.video__caption</code>: burned-in style captions on <code>--color-bg-scrim</code>, from the WebVTT track."),
                 ("Play", "<code>.video__btn</code>: play or pause, labelled by its action."),
                 ("Time", "Elapsed / total, tabular mono."),
                 ("Seek", "<code>.video__track</code>: a slider with a spoken time value."),
                 ("Captions, full screen", "Captions is a toggle (<code>aria-pressed</code>); full screen appears from sm.")]),
    "variants": f"""<h3>Increment video</h3>
{ex(_video(), "Ledgerline increment 7, Reconcile a card statement: the walkthrough that ships with the pull request.", cls="ds-example__canvas--stack")}
<h3>Placeholders</h3>
{ex(_PLACEHOLDER, "Still implementing: say when the video will exist (pages/increment/implementing).", cls="ds-example__canvas--stack")}
{ex(_VFAILED, "Capture failed: say what failed, what was retried and what happened instead (pages/increment/video-failed).", cls="ds-example__canvas--stack")}
<h3>Design preview</h3>
{ex(_preview(), "Exported mock at L (992 px), light: the frame is the product's own canvas, not Mission Control's surface.", cls="ds-example__canvas--stack")}
{ex(_preview("23.4375rem", True, "Exported mock: Reconcile statement, Review state, 375 px, dark"), "At XS (375 px), dark: <code>.preview__frame--dark</code> and <code>--narrow</code> (9:16, at most 40rem tall) use the <code>--color-preview-dark-*</code> set.", cls="ds-example__canvas--stack")}
<h3>State list</h3>
{ex(_STATE_LIST, 'Each state is a link to the preview with a thumbnail; the current one has <code>aria-current="true"</code>; the external icon opens it in Magic Patterns.')}""",
    "sizes": f"""<p>The design preview's width is set with <code>--w</code> on <code>.preview__frame</code> to one of the five preview widths, picked with a segmented control; the frame never exceeds its container (<code>min(100%, var(--w))</code>) and <code>.preview</code> scrolls sideways if the chosen width is wider than the screen.</p>
{table(["Width", "<code>--w</code>", "Frame"], [["XS · 375 px", "<code>23.4375rem</code>", "9:16 with <code>--narrow</code>"], ["S · 576 px", "<code>36rem</code>", "4:3"], ["M · 768 px", "<code>48rem</code>", "4:3"], ["L · 992 px", "<code>62rem</code>", "4:3 (default)"], ["XL · 1200 px", "<code>75rem</code>", "4:3"]])}
<p>The video is always 16:9 at the width of its column.</p>""",
    "states": f"""<p>Video controls and state links are the interactive parts. Pointer and focus states are forced with <code>data-state</code>; the video's own states (playing, paused, captions on) come from real attributes.</p>
{matrix(["Default", "Hover", "Focus", "Pressed / current"], [
    ("Video button", [f'<div class="video__controls" style="position: static;">{_vbtn("play", "Play")}</div>',
                      f'<div class="video__controls" style="position: static;">{_vbtn("play", "Play", "hover")}</div>',
                      f'<div class="video__controls" style="position: static;">{_vbtn("play", "Play", "focus")}</div>',
                      f'<div class="video__controls" style="position: static;">{_vbtn("captions", "Captions", pressed="true")}</div>']),
    ("State link", [_state_link("Loading", mp=False), _state_link("Loading", "hover", mp=False), _state_link("Loading", "focus", mp=False), _state_link("Review", current=True, mp=False)])])}
<h3>Loading and failed</h3>
{ex('<div aria-busy="true" aria-live="polite" style="width: 100%;"><p class="visually-hidden">Loading increment 7</p><span class="skeleton skeleton--video" aria-hidden="true"></span></div>', "Loading: a 16:9 skeleton holds the space so nothing moves when the video arrives (pages/increment/loading).", cls="ds-example__canvas--stack")}
{ex(_VFAILED, "Failed: the placeholder with a warning icon and what happened next.", cls="ds-example__canvas--stack")}
{themes(_video(False) + _preview(), stack=True)}
<p>In both themes the recorded product stays the same: only the frame ring, the scrim and the page around it change.</p>""",
    "responsive": ul([
        "Base (360px): the video fills the column at 16:9; the recorded product's sidebar is hidden; full screen is hidden (phones go full screen by rotating); caption type scales between 12px and 16px with <code>clamp()</code>.",
        "From sm (36rem): the recorded sidebar and the full screen button appear.",
        "From lg (62rem): on the increment page the video takes the main column of <code>.split--aside</code> and the pull request sits in the rail; the design preview sits beside the state list in <code>.split--nav</code>.",
        "State list: below lg it wraps horizontally as a row of 44px links (<code>--target-comfortable</code>); from lg it is a vertical list of 32px links.",
        "Design preview: the frame is <code>min(100%, --w)</code>; wider choices scroll inside <code>.preview</code>, never the page."]),
    "theming": """<p>Previews are deliberately <b>not</b> themed by Mission Control. The <code>--color-preview-*</code> tokens hold the same values in light and dark, because they depict the built product, and <code>--color-preview-dark-*</code> exist for when the person previews the product's own dark theme. The scrim tokens (<code>--color-bg-scrim</code>, <code>--color-fg-on-scrim</code>) are fixed too, because captions sit over video that can be any colour.</p>
<pre><code>/* Preview a product whose accent is green: override the preview set, not the Mission Control tokens */
.preview--harbor { --color-preview-accent: var(--palette-green-700); --color-preview-mark-accent: var(--palette-green-400); }</code></pre>""",
    "a11y": {
        "pattern": '<p>In the product the video is a native <code>&lt;video&gt;</code> with a WebVTT <code>&lt;track kind="captions" default&gt;</code>; the custom controls are buttons and an <a href="https://www.w3.org/WAI/ARIA/apg/patterns/slider/">APG slider</a> for seek. The design preview is an <code>&lt;iframe&gt;</code> with a <code>title</code> (<i>Exported mock: Reconcile statement, Review state, 992 px, light</i>); the mocks stand it in with <code>role="img"</code> and the same text as <code>aria-label</code>. The state list is a list of links with <code>aria-current="true"</code>.</p>',
        "keys": [(kbd("Tab"), "Play, seek, captions, full screen, then the state list links in order."),
                 (kbd("Enter") + ", " + kbd("Space"), "Play or pause; toggle captions; enter full screen; follow a state link."),
                 (kbd("←") + " / " + kbd("→"), "On seek: back or forward 5 seconds."),
                 (kbd("Page Up") + " / " + kbd("Page Down"), "On seek: back or forward 10% of the video."),
                 (kbd("Home") + " / " + kbd("End"), "On seek: start or end."),
                 (kbd("Esc"), "Leaves full screen.")],
        "focus": "<p>Video buttons and the seek track show the shared focus ring; on the dark scrim the ring is still <code>--color-focus-ring</code> with its offset, so it stays visible. Following a state link moves focus to the preview heading so the new state is announced.</p>",
        "labelling": "<p>The play button's label is its next action (<i>Play</i> / <i>Pause</i>); captions is a toggle with a fixed label (<i>Captions</i>) and <code>aria-pressed</code>; seek speaks <code>aria-valuetext=\"1 minute 22 of 2 minutes 14\"</code>. The video has a visible caption line under it: <i>Captioned walkthrough · 1080p · 2:14</i>. External state icons say <i>Open Reconcile statement · Review in Magic Patterns</i>.</p>",
        "pairs": [("Captions and controls", "--color-fg-on-scrim", "--color-bg-scrim", 4.5), ("Preview text", "--color-preview-ink", "--color-preview-canvas", 4.5),
                  ("Preview secondary text", "--color-preview-ink-muted", "--color-preview-surface", 4.5), ("Suggested match on highlight", "--color-preview-accent", "--color-preview-highlight", 4.5),
                  ("Matched receipt", "--color-preview-ok", "--color-preview-surface", 4.5), ("Dark preview text", "--color-preview-dark-ink", "--color-preview-dark-canvas", 4.5),
                  ("Current state link", "--color-fg-default", "--color-accent-subtle", 4.5), ("Placeholder text", "--color-fg-muted", "--color-bg-surface", 4.5)],
        "motion": "<p>The video never autoplays and has no motion until the person presses Play. Placeholders and frames are static. Respect reduced motion in the product: do not start a preview's own animations when <code>prefers-reduced-motion</code> is set.</p>",
        "touch": "<p>Video buttons are 32px circles with 12px between them on the control bar; the seek track is 4px tall with a 32px tall hit area (the whole bar row). State links are 44px below lg.</p>",
    },
    "content": ul(["Every video has captions; the caption track is written by the agent from the walkthrough script.",
                   "The line under the video says what it is: <i>Captioned walkthrough · 1080p · 2:14</i>, and where it lives: <code>docs/videos/reconcile-card-statement/</code>.",
                   "Placeholders say when the video will exist or why it does not: <i>The walkthrough records once every test is green. Implementing, iteration 3 of 10.</i>",
                   "Failure placeholders name the failure, the retry and the consequence: <i>Video failed: browser crashed during capture … The pull request went ahead with this noted under Notes.</i>",
                   "Frame titles: <i>Exported mock: {screen}, {state} state, {width} px, {theme}</i>."]),
    "dodont": [
        (_preview(), "Draw the previewed product in fixed <code>--color-preview-*</code> tokens.",
         _PREVIEW_BAD, "Mission Control surface tokens inside the frame repaint the customer's product when someone switches Mission Control to dark."),
        (_VFAILED, "Say what failed and what happened instead.",
         _VFAILED_BAD, "<i>Video unavailable</i> leaves the reader guessing whether to wait, retry or review the PR without it."),
    ],
    "tokens": [("Preview canvas / surface", "--color-preview-canvas / --color-preview-surface"), ("Preview ink / muted ink", "--color-preview-ink / --color-preview-ink-muted"),
               ("Preview lines / blocks", "--color-preview-line / --color-preview-block"), ("Preview accent / highlight", "--color-preview-accent / --color-preview-highlight"),
               ("Preview marks", "--color-preview-mark-ok / --color-preview-mark-accent"), ("Dark preview canvas / ink", "--color-preview-dark-canvas / --color-preview-dark-ink"),
               ("Scrim / scrim hover / track", "--color-bg-scrim / --color-bg-scrim-hover / --color-bg-scrim-track"), ("On scrim", "--color-fg-on-scrim"),
               ("Frame ring", "--color-border-default"), ("Preview well", "--color-bg-surface-sunken"), ("Frame shadow", "--shadow-2"),
               ("Video radius / frame radius", "--radius-md / --radius-sm"), ("State link height base / lg", "--target-comfortable / --control-height-sm")],
    "code": {"snippet": """<figure class="video">
  <video src="/videos/reconcile-card-statement.mp4" preload="metadata">
    <track kind="captions" src="/videos/reconcile-card-statement.vtt" srclang="en" label="English" default>
  </video>
  <div class="video__controls">
    <button class="video__btn" type="button" aria-label="Play">…</button><span class="tabular">1:22 / 2:14</span>
    <div class="video__track" role="slider" tabindex="0" aria-label="Seek" aria-valuemin="0" aria-valuemax="134"
         aria-valuenow="82" aria-valuetext="1 minute 22 of 2 minutes 14"><span></span></div>
    <button class="video__btn" type="button" aria-label="Captions" aria-pressed="true">…</button>
  </div>
</figure>

<div class="preview">
  <iframe class="preview__frame" style="--w: 62rem" sandbox="allow-scripts"
          src="https://mocks.hewn.dev/ledgerline/reconcile-statement/review.html"
          title="Exported mock: Reconcile statement, Review state, 992 px, light"></iframe>
</div>""",
             "classes": [("<code>.video</code>", "16:9 box with ring and radius."), ("<code>.video__frame</code> …", "Static drawing of a recording (mocks and docs only)."),
                         ("<code>.video__caption</code>", "Caption line on the scrim."), ("<code>.video__controls</code> <code>.video__btn</code> <code>.video__track</code>", "Control bar, buttons, seek."),
                         ("<code>.video--placeholder</code>", "No video yet or capture failed: icon and message, centred."),
                         ("<code>.preview</code> <code>.preview__frame</code>", "Sunken well and the frame; set <code>--w</code> for the width."),
                         ("<code>.preview__frame--dark</code> <code>--narrow</code>", "Dark product theme; 9:16 phone frame."),
                         ("<code>.state-list</code> <code>.state-item</code> <code>.state-link</code> <code>.state-thumb</code> <code>.state-mp</code>", "State picker with thumbnails and the Magic Patterns link.")]},
    "sources": {"mocks": [("pages/increment/default", "video"), ("pages/increment/implementing", "placeholder"), ("pages/increment/video-failed", "failed capture"),
                          ("pages/increment/loading", "video skeleton"), ("pages/designs/default", "design preview, state list"), ("pages/designs/xs-dark", "narrow, dark frame"),
                          ("pages/design-system/default", "design-system page preview")],
                "drift": 'raw <code>rgb(0 0 0 / 0.8)</code> and white overlays became the fixed <code>--color-preview-*</code> and <code>--color-bg-scrim*</code> tokens; the video-failed title and the right-aligned amounts are styled inline in the mocks; the width and theme pickers are links with <code>role="radio"</code> (logged under Button group).'},
}


# ============================================================== logo
_W_SM = wordmark("sm", "#overview", "Hewn, go to dashboard")
_W_MD = wordmark("", "#overview", "Hewn, go to dashboard")
_W_LG = wordmark("lg")
_MARK = f'<span class="wordmark wordmark--lg" role="img" aria-label="Hewn">{mark()}</span>'


def _wm_state(state):
    w = wordmark("", "#states", "Hewn, go to dashboard")
    return w.replace('class="wordmark"', f'class="wordmark" data-state="{state}"', 1) if state else w


_LOGO_SIZES = table(["Size", "Class", "Mark height", "Where"], [
    [wordmark("sm"), "<code>.wordmark--sm</code>", "18px (<code>--font-size-lg</code>)", "Top bar on phones and tablets."],
    [wordmark(""), "<code>.wordmark</code>", "20px (<code>--font-size-xl</code>)", "Sidebar brand row."],
    [wordmark("lg"), "<code>.wordmark--lg</code>", "24px (<code>--font-size-2xl</code>)", "Sign-in page."]])

SPECS["logo"] = {
    "lead": "The Hewn mark is an H whose right pillar has had its corner hewn off; the chip that came away is the only colour in it. The wordmark pairs it with the lower-case name.",
    "readme_variants": "wordmark, mark only; sizes sm, md, lg; link or static",
    "readme_states": "default, hover (no change), focus",
    "pills": ["Inline SVG"],
    "overview": f"""<p>Use the wordmark once per screen as the product's signature: in the {page('components/sidebar-nav', 'sidebar')} brand row and the mobile {page('components/top-bar')}, where it links to the dashboard, and on sign-in, where it is static. Use the mark alone only where the name is already present or space is square (favicons, avatars for the Hewn system user in the audit log).</p>
<p>The mark is drawn from two brand tokens: <code>--color-brand-body</code> for the H and <code>--color-brand-chip</code> for the hewn-off corner. Nothing else about it changes.</p>""",
    "anatomy": (f'<span class="wordmark" role="img" aria-label="Hewn" style="font-size: var(--font-size-5xl);">{mark()}<span class="wordmark__text" aria-hidden="true">hewn</span></span>',
                [(29, 50), (42, 28), (71, 58), (50, 96)],
                [("Body", "Left pillar, crossbar and the right pillar, <code>.mark__body</code>, filled with <code>--color-brand-body</code>."),
                 ("Chip", "The hewn-off corner, <code>.mark__chip</code>, filled with <code>--color-brand-chip</code>."),
                 ("Name", "<code>.wordmark__text</code>: lower-case <i>hewn</i>, bold, 1.08em, tracked in by <code>--letter-spacing-wordmark</code>; <code>aria-hidden</code>."),
                 ("Clear space", "The mark sits 0.34em from the name; keep at least half the mark's height clear on every side.")]),
    "variants": f"""<h3>Wordmark and mark</h3>
{ex(_W_LG + _MARK, 'Wordmark (static, sign-in) and the mark alone, both with <code>role="img"</code> and the name <i>Hewn</i>.')}
<h3>As a link</h3>
{ex(_W_MD, 'In the sidebar and top bar the wordmark is a link to the dashboard: <code>aria-label="Hewn, go to dashboard"</code>.')}""",
    "sizes": f"""<p>The logo scales with <code>font-size</code>; the mark is 1em square and the name 1.08em. Use the three sizes below; never go below the small size.</p>
{_LOGO_SIZES}""",
    "states": f"""<p>The wordmark link keeps its colour on hover (it is a signature, not a text link) and takes the shared focus ring.</p>
{matrix(["Default", "Hover", "Focus"], [("Wordmark link", [_wm_state(""), _wm_state("hover"), _wm_state("focus")]), ("Static wordmark", [wordmark(""), "<span class='text-caption'>Not interactive</span>", "<span class='text-caption'>Not focusable</span>"])])}
{themes(_W_MD + _MARK)}""",
    "responsive": ul([
        "Below lg (62rem) the sidebar is hidden and the small wordmark sits centred in the 56px top bar.",
        "From lg the medium wordmark sits in the sidebar brand row (64px tall, 20px side padding).",
        "Sign-in uses the large wordmark at every width, top left of the form column.",
        "The logo never scales fluidly with the viewport; it switches size only with the component that holds it."]),
    "theming": "<p>Light: body <code>--palette-slate-900</code>, chip <code>--palette-blue-600</code>. Dark: body <code>--palette-stone-200</code>, chip <code>--palette-blue-400</code>. Both come from <code>--color-brand-body</code> and <code>--color-brand-chip</code>, so the mark inverts with the theme and the chip stays the accent blue. Do not recolour the mark for a single surface; if it must sit on an inverse surface, override both brand tokens on that container.</p>",
    "a11y": {
        "pattern": '<p>Inline SVG, <code>aria-hidden</code>, inside a wrapper that carries the name: <code>&lt;a aria-label="Hewn, go to dashboard"&gt;</code> when it links, <code>&lt;span role="img" aria-label="Hewn"&gt;</code> when it does not. The visible <i>hewn</i> text is <code>aria-hidden</code> so the name is not read twice. See <a href="https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html">1.1.1 Non-text content</a>.</p>',
        "keys": [(kbd("Tab"), "Focuses the wordmark link (first in the sidebar, second in the top bar after the menu button)."),
                 (kbd("Enter"), "Goes to the dashboard.")],
        "focus": "<p>Shared focus ring round the whole wordmark with the 2px offset.</p>",
        "labelling": "<p>Linked: <i>Hewn, go to dashboard</i>. Static: <i>Hewn</i>. Never add a separate visible <i>Hewn</i> next to it.</p>",
        "pairs": [("Mark body and name on sidebar", "--color-brand-body", "--color-bg-surface", 4.5), ("Chip on sidebar", "--color-brand-chip", "--color-bg-surface", 3),
                  ("Focus ring", "--color-focus-ring", "--color-bg-surface", 3)],
        "motion": "<p>None. The mark never animates.</p>",
        "touch": "<p>In the top bar the wordmark link is the full 56px bar height and about 80px wide.</p>",
    },
    "content": ul(["The product name is <i>Hewn</i> in running text and accessible names; the lower-case <i>hewn</i> appears only inside the wordmark.",
                   "The dashboard screen is <i>Mission Control</i>; do not put that name in the logo.",
                   "Version lines go near the logo as caption text, not inside it: <i>Hewn 0.9.2 · MIT</i>."]),
    "dodont": [
        (_W_MD, "Use the mark exactly as drawn, in the brand tokens.",
         '<span class="wordmark" role="img" aria-label="Hewn, recoloured" style="--color-brand-body: var(--color-fg-accent); --color-brand-chip: var(--color-danger-icon);">' + mark() + '<span class="wordmark__text" aria-hidden="true">hewn</span></span>',
         "Recolouring the body or chip (even with other tokens) makes it a different mark."),
        (_W_LG, "Use the wordmark on the canvas or a surface.",
         '<span style="display: inline-block; padding: var(--space-3); background: var(--color-accent); border-radius: var(--radius-md);">' + wordmark("lg") + "</span>",
         "On the accent fill the chip disappears and the body falls below 3:1."),
        (_W_SM, "Let the SVG and the bold name do the work.",
         '<span style="font: var(--text-h2);">Hewn</span>', "Typing the name in body type is not the logo."),
    ],
    "tokens": [("Body and name", "--color-brand-body"), ("Chip", "--color-brand-chip"), ("Size sm / md / lg", "--font-size-lg / --font-size-xl / --font-size-2xl"),
               ("Name weight", "--font-weight-bold"), ("Name tracking", "--letter-spacing-wordmark")],
    "code": {"snippet": """<a class="wordmark" href="/" aria-label="Hewn, go to dashboard">
  <svg viewBox="0 0 32 32" aria-hidden="true">
    <rect class="mark__body" x="0" y="0" width="10" height="32"/>
    <rect class="mark__body" x="10" y="13" width="12" height="6"/>
    <polygon class="mark__body" points="22,10 32,0 32,32 22,32"/>
    <polygon class="mark__chip" points="22,0 29,0 22,7"/>
  </svg>
  <span class="wordmark__text" aria-hidden="true">hewn</span>
</a>""",
             "classes": [("<code>.wordmark</code>", 'Mark + name, medium size; on <code>&lt;a&gt;</code> with <code>aria-label</code> or <code>&lt;span role="img"&gt;</code>.'),
                         ("<code>.wordmark--sm</code> <code>.wordmark--lg</code>", "Small (top bar) and large (sign-in)."),
                         ("<code>.wordmark__text</code>", "The lower-case name; <code>aria-hidden</code>."),
                         ("<code>.mark__body</code> <code>.mark__chip</code>", "SVG parts filled from the brand tokens.")]},
    "sources": {"mocks": [("pages/sign-in/default", "large, static"), ("pages/dashboard/default", "sidebar and top bar, linked"),
                          ("dialogs/mobile-nav/default", "wordmark in the drawer")],
                "drift": "none for the logo itself; the brand colours are now their own tokens (<code>--color-brand-body</code>, <code>--color-brand-chip</code>) instead of reading the slate and blue palette directly."},
}
