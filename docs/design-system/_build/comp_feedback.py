"""Component specs: Feedback (toast, alert, inline message, progress bar, spinner, skeleton, empty state, error page)."""
from common import (NA, btn, ex, icon, kbd, matrix, page, table, themes, ul)

SPECS = {}


# ============================================================== toast
def _toast(tone, ic, title, text, actions="", progress=None, close_state=""):
    acts = f'<div class="toast__actions">{actions}</div>' if actions else ""
    prog = f'<span class="toast__progress" style="--value: {progress}%;" aria-hidden="true"></span>' if progress is not None else ""
    cs = f' data-state="{close_state}"' if close_state else ""
    return (f'<div class="toast toast--{tone}">{icon(ic)}<div class="toast__body"><div class="toast__title">{title}</div>'
            f'<div class="toast__text">{text}</div>{acts}</div>'
            f'<button class="toast__close" type="button" aria-label="Dismiss: {title}"{cs}>{icon("x", "icon--sm")}</button>{prog}</div>')


def _region(content, alert=False):
    role = 'role="alert"' if alert else 'role="status" aria-live="polite"'
    return f'<div class="toast-region toast-region--static" {role} style="width: 100%; max-width: var(--layout-toast-width);">{content}</div>'


_T_INFO = _toast("info", "info", "Tidewater started stage 3", "Design system · extracting tokens from 46 mocks", progress=62)
_T_OK = _toast("ok", "git-merge", "Ledgerline #27 merged", "Split a transaction · 62% complete", progress=62)
_T_WARN = _toast("warn", "alert-triangle", "Kiln Booking at 80% of budget", "$200.00 of $250.00. It pauses at $250.00.", progress=30)
_T_DANGER = _toast("danger", "x-circle", "Parcel Post is blocked", "Requirements failed after 3 retries.")
_T_ACTS = '<a class="toast__action" href="#states">Open log</a><button class="toast__action" type="button">Retry stage</button>'
_T_ACTION = _toast("danger", "x-circle", "Parcel Post is blocked", "Requirements failed after 3 retries. Other projects keep running.", _T_ACTS)
_T_STACK = (_toast("ok", "git-merge", "Ledgerline #27 merged", "Split a transaction · 62% complete")
            + _toast("info", "info", "Tidewater started stage 3", "Design system · extracting tokens from 46 mocks")
            + _toast("warn", "alert-triangle", "Kiln Booking at 80% of budget", "$200.00 of $250.00. It pauses at $250.00.")
            + '<p class="text-caption" style="text-align: right;">+2 more in the event stream</p>')
_T_TIMING = table(["Tone", "Use for", "Stays", "Region"], [
    ["Info", "A stage started, a worker connected.", "5 s, with the time-left line", '<code>role="status"</code>'],
    ["Success", "A PR merged, a direction completed.", "5 s, with the time-left line", '<code>role="status"</code>'],
    ["Warning", "Budget at 80%, a retry scheduled.", "10 s", '<code>role="status"</code>'],
    ["Danger", "A direction blocked, a worker went offline mid-run.", "Until dismissed", '<code>role="alert"</code>']])


def _close(state):
    return (f'<div class="toast" style="padding: var(--space-2); box-shadow: none;"><button class="toast__close" type="button" aria-label="Dismiss notification"'
            f'{(" data-state=" + chr(34) + state + chr(34)) if state else ""}>{icon("x", "icon--sm")}</button></div>')


def _action(state):
    ds = f' data-state="{state}"' if state else ""
    return f'<button class="toast__action" type="button"{ds}>Retry stage</button>'


_T_LEAVING = _T_OK.replace('class="toast toast--ok"', 'class="toast toast--ok toast--leaving"', 1)

SPECS["toast"] = {
    "lead": "Toasts tell an Owner that something happened elsewhere (a PR merged, a stage started, a direction blocked) without taking them away from what they are doing.",
    "readme_variants": "info, success, warning, danger; with actions; with time-left line; stacked",
    "readme_states": "entering, shown, paused on hover/focus, leaving; close and action hover, focus, active",
    "pills": ['<code>role="status"</code> / <code>role="alert"</code> regions'],
    "overview": f"""<p>Use a toast for news from the live event stream about something the person is not looking at. Toasts are brief, never block, and never hold the only copy of information: every event is also in the dashboard's event stream and the project's own pages.</p>
{ul(["Use an " + page("components/alert", "alert strip") + " for a condition that lasts (connection lost, all workers stopped), because a toast would leave while the condition stays.",
     "Use an " + page("components/alert", "inline callout") + " for the result of something the person did on this page (Defaults saved, Stage failed).",
     "Use a " + page("components/dialog") + " when the person must decide before continuing."])}
{_T_TIMING}""",
    "anatomy": (_region(_toast("danger", "x-circle", "Parcel Post is blocked", "Requirements failed after 3 retries. Other projects keep running.", _T_ACTS), alert=True),
                [(17, 31), (53, 31), (72, 47), (55, 68), (84, 32)],
                [("Icon", "Tone icon, 16px, <code>aria-hidden</code>; the title carries the meaning."),
                 ("Title", "<code>.toast__title</code>: what happened, with the project name."),
                 ("Text", "<code>.toast__text</code>: the detail or the consequence, one line."),
                 ("Actions (optional)", "<code>.toast__action</code>: up to two text actions; links when they navigate."),
                 ("Close", '<code>.toast__close</code>: 28px button, <code>aria-label="Dismiss: …"</code>.')]),
    "variants": f"""<p>Four tones. The tone changes the icon colour (and the ring for danger), never the surface, so a stack stays calm.</p>
{ex(_region(_T_INFO + _T_OK + _T_WARN), "Info, success and warning share the polite region. The thin line at the bottom shows the time left; it is <code>aria-hidden</code>.")}
{ex(_region(_T_DANGER, alert=True), 'Danger goes in its own <code>role="alert"</code> region, has no time-left line and stays until dismissed.')}
<h3>With actions</h3>
{ex(_region(_T_ACTION, alert=True), "Up to two actions: <i>Open log</i> navigates (a link), <i>Retry stage</i> acts (a button).")}
<h3>Stacked</h3>
{ex(_region(_T_STACK), "Newest on top, at most three visible; the rest are counted and live in the event stream.")}""",
    "sizes": NA("One size: the region is 24rem wide (--layout-toast-width) from sm and full width below; toasts grow in height with their text."),
    "states": f"""<p>The close button and actions have the usual states, forced here with <code>data-state</code>. The toast itself enters, waits, pauses while hovered or focused, and leaves.</p>
{matrix(["Default", "Hover", "Focus", "Active"], [
    ("Close", [_close(""), _close("hover"), _close("focus"), _close("active")]),
    ("Action", [_action(""), _action("hover"), _action("focus"), _action("active")])])}
<h3>Lifecycle</h3>
{ex(_region(_T_OK), "Shown: rises in over <code>--duration-slow</code> with <code>--ease-enter</code>; the time-left line shrinks from 100% to 0.")}
{ex(_region(_T_LEAVING), "Leaving (<code>.toast--leaving</code>): fades and drops over <code>--duration-base</code> with <code>--ease-exit</code>, then is removed.")}
{ul(["<b>Paused</b>: while the pointer is over a toast or focus is inside it, its timer stops (2.2.1); it restarts with the full remaining time when both leave.",
     "<b>Dismissed</b>: the close button or <kbd>Esc</kbd> inside the toast removes it at once; the event stays in the event stream.",
     "<b>Overflow</b>: a fourth toast removes the oldest visible one into the <i>+n more in the event stream</i> count."])}
{themes(_region(_T_OK + _T_DANGER), stack=True)}""",
    "responsive": ul([
        "Base (360px): the region is fixed 16px from the left, right and bottom (plus <code>env(safe-area-inset-bottom)</code>), so toasts are full width on phones.",
        "From sm (36rem): the region is 24rem wide at the bottom right; the left edge is free.",
        "Toast text wraps; actions stay on one row and wrap only if the screen is narrower than 320px.",
        "The region sits above sheets and drawers (<code>--z-toast</code>) but below tooltips; on phones it moves up above a bottom sheet's sticky footer."]),
    "theming": f"""<p>Toasts are <code>--color-bg-surface-raised</code> with <code>--shadow-3</code> and a hairline ring, so they float in both themes; dark elevation comes from the lighter raised surface more than the shadow. Tone modifiers set two component tokens, <code>--toast-ring</code> and <code>--toast-icon</code>.</p>
<pre><code>/* A quieter warning toast for a dense monitoring wall */
.wall .toast--warn {{ --toast-icon: var(--color-fg-muted); }}</code></pre>""",
    "a11y": {
        "pattern": '<p>Two persistent live regions exist from page load (a live region added at the same time as its content is not announced): <code>&lt;div class="toast-region" role="status" aria-live="polite"&gt;</code> for info, success and warning, and a separate <code>role="alert"</code> region for danger. Toasts themselves carry no role. This follows the <a href="https://www.w3.org/WAI/ARIA/apg/patterns/alert/">APG alert pattern</a> and <a href="https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html">4.1.3 Status messages</a>.</p>',
        "keys": [(kbd("Tab"), "Reaches toast actions and close buttons in DOM order; the regions sit at the end of <code>&lt;body&gt;</code>, so they never interrupt the page's tab order."),
                 (kbd("Enter") + ", " + kbd("Space"), "Activates the focused action or close button."),
                 (kbd("Esc"), "With focus inside a toast: dismisses it and moves focus to the next toast, or back to <code>#main</code> if it was the last.")],
        "focus": "<p>A toast never takes focus when it appears. Hovering or focusing it pauses its timer. Dismissing moves focus to the next toast or to <code>#main</code>, never to <code>&lt;body&gt;</code>.</p>",
        "labelling": "<p>The title and text are the announcement, so they must make sense alone: <i>Parcel Post is blocked. Requirements failed after 3 retries.</i> Close buttons name the toast: <i>Dismiss: Parcel Post is blocked</i>. Icons are <code>aria-hidden</code>.</p>",
        "pairs": [("Title", "--color-fg-default", "--color-bg-surface-raised", 4.5), ("Text", "--color-fg-muted", "--color-bg-surface-raised", 4.5),
                  ("Action", "--color-fg-accent", "--color-bg-surface-raised", 4.5), ("Close icon", "--color-fg-subtle", "--color-bg-surface-raised", 4.5),
                  ("Info icon", "--color-info-icon", "--color-bg-surface-raised", 3), ("Success icon", "--color-success-icon", "--color-bg-surface-raised", 3),
                  ("Warning icon", "--color-warning-icon", "--color-bg-surface-raised", 3), ("Danger icon", "--color-danger-icon", "--color-bg-surface-raised", 3),
                  ("Focus ring", "--color-focus-ring", "--color-bg-surface-raised", 3)],
        "motion": "<p>Enter: rise and fade over <code>--duration-slow</code>; leave: fade and drop over <code>--duration-base</code>. Under reduced motion both durations are effectively zero, so toasts appear and disappear in place; the time-left line still shrinks because it conveys time, not decoration.</p>",
        "touch": "<p>The close button is 28px (<code>--control-height-xs</code>) and actions are 24px tall text targets with 12px between them; on phones a toast can also be swiped sideways to dismiss.</p>",
    },
    "content": ul(["Title: what happened, project first, past tense or a state: <i>Ledgerline #27 merged</i>, <i>Parcel Post is blocked</i>, <i>Kiln Booking at 80% of budget</i>.",
                   "Text: the detail or consequence, with numbers: <i>$200.00 of $250.00. It pauses at $250.00.</i>",
                   "Reassure when something failed: <i>Other projects keep running.</i>",
                   "Actions are verbs and at most two: <i>Open log</i>, <i>Retry stage</i>. No <i>OK</i>; the close button covers that.",
                   "No exclamation marks, no <i>Success!</i>."]),
    "dodont": [
        (_region(_T_DANGER, alert=True), "A blocked direction stays until dismissed and goes in the alert region.",
         _region(_toast("danger", "x-circle", "Parcel Post is blocked", "Requirements failed after 3 retries.", progress=40)), "A danger toast with a time-left line disappears before anyone has read it (2.2.1)."),
        (_region(_T_OK), "Name the project and the event.",
         _region(_toast("ok", "check-circle", "Success", "The operation completed.")), "<i>Success</i> says nothing when three directions are running."),
        (_region(_T_WARN), "Use a toast for a moment: budget crossed 80%.",
         _region(_toast("warn", "octagon-x", "All workers stopped", "Nothing new will be leased.")), "A lasting condition belongs in a strip (notifications/system-banner/warning); this toast would vanish while workers stay stopped."),
    ],
    "tokens": [("Surface", "--color-bg-surface-raised"), ("Shadow", "--shadow-3"), ("Ring / danger ring", "--color-border-default / --color-danger-border"),
               ("Icon info / success / warning / danger", "--color-info-icon / --color-success-icon / --color-warning-icon / --color-danger-icon"),
               ("Title / text", "--color-fg-default / --color-fg-muted"), ("Action", "--color-fg-accent"), ("Close icon / hover", "--color-fg-subtle / --color-bg-subtle-hover"),
               ("Time-left line", "--color-accent"), ("Radius", "--radius-lg"), ("Region width", "--layout-toast-width"), ("Layer", "--z-toast"),
               ("Enter", "--duration-slow / --ease-enter"), ("Leave", "--duration-base / --ease-exit")],
    "code": {"snippet": """<!-- Both regions exist, empty, from page load -->
<div class="toast-region" role="status" aria-live="polite">
  <div class="toast toast--ok">
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">…</svg>
    <div class="toast__body"><div class="toast__title">Ledgerline #27 merged</div>
      <div class="toast__text">Split a transaction · 62% complete</div></div>
    <button class="toast__close" type="button" aria-label="Dismiss: Ledgerline #27 merged">…</button>
    <span class="toast__progress" style="--value: 62%" aria-hidden="true"></span>
  </div>
</div>
<div class="toast-region" role="alert"></div>""",
             "classes": [("<code>.toast-region</code>", "Fixed live region; full width below sm, 24rem bottom right from sm."),
                         ("<code>.toast-region--static</code>", "Documentation only: places a region in the flow."),
                         ("<code>.toast</code> + <code>--info</code> <code>--ok</code> <code>--warn</code> <code>--danger</code>", "Toast and tone."),
                         ("<code>.toast__body</code> <code>.toast__title</code> <code>.toast__text</code>", "Text block."),
                         ("<code>.toast__actions</code> <code>.toast__action</code>", "Up to two text actions."),
                         ("<code>.toast__close</code>", "Dismiss button; needs an <code>aria-label</code>."),
                         ("<code>.toast__progress</code> + <code>--value</code>", "Time-left line; <code>aria-hidden</code>; omit for danger."),
                         ("<code>.toast--leaving</code>", "Exit transition before removal.")]},
    "sources": {"mocks": [("notifications/live-toast/info", "info, 5 s"), ("notifications/live-toast/success", "success, 5 s"),
                          ("notifications/live-toast/warning", "warning, 10 s"), ("notifications/live-toast/danger", "danger, persistent"),
                          ("notifications/live-toast/with-action", "actions"), ("notifications/live-toast/stacked", "stack of three")],
                "drift": "a <code>role=\"alert\"</code> toast sat inside the <code>role=\"status\"</code> region and was announced twice; error toasts now go in a separate alert region. The 40rem breakpoint for the region is now <code>--layout-breakpoint-sm</code>; close buttons are named after their toast instead of a bare <i>Dismiss</i>; the stacked note's inline <code>text-align</code> is documentation only."},
}


# ============================================================== alert (callout + strip)
def _callout(tone, ic, title, body, actions="", role="status", close=False):
    mod = f" callout--{tone}" if tone else ""
    t = f'<p class="callout__title">{title}</p>' if title else ""
    bstyle = "" if title else ' style="margin-top: 0;"'
    acts = f'<div class="callout__actions">{actions}</div>' if actions else ""
    cl = (f'<button class="btn btn--icon btn--ghost btn--sm callout__close" type="button" aria-label="Dismiss">{icon("x", "icon--sm")}</button>'
          if close else "")
    r = f' role="{role}"' if role else ""
    return (f'<div class="callout{mod}"{r} style="width: 100%;">{icon(ic, "icon--lg")}<div class="callout__body-wrap">{t}'
            f'<p class="callout__body"{bstyle}>{body}</p>{acts}</div>{cl}</div>')


def _strip(tone, ic, text, action="", role="status", spin=False):
    mod = f" strip--{tone}" if tone else ""
    cls = "icon--sm icon--spin" if spin else "icon--sm"
    return f'<div class="strip{mod}" role="{role}" style="width: 100%;">{icon(ic, cls)}<span class="strip__text">{text}</span>{action}</div>'


_C_INFO = _callout("info", "info", "1 direction queued", "Feature direction “Export a reconciled period as PDF”, submitted by quinntynebrown at 14:12, starts when this direction is Complete or Cancelled.")
_C_OK = _callout("ok", "check-circle", "Defaults saved", "New directions start with a $350.00 budget and a 3-day descope threshold. Directions already running keep theirs.")
_C_WARN = _callout("warn", "pause-circle", "Paused by quinntynebrown at 14:29", "The step in progress finished and was checkpointed. Nothing new starts until Resume.")
_C_DANGER = _callout("danger", "alert-triangle", "Stage failed after 3 retries", "Validation failed: L2-014 has no Given/When/Then the brief can support. Retried after 30 s, 2 min and 10 min. Other projects keep running.",
                     btn("Retry stage", "", "sm", "rotate-ccw"), role="alert")
_C_NEUTRAL = _callout("", "clock", "", "Your session ended after 8 hours. Work kept running while you were away; sign in to catch up.")
_C_SUMMARY = ('<div class="callout callout--danger form-summary" role="alert" tabindex="-1" style="width: 100%;">' + icon("alert-triangle", "icon--lg")
              + '<div class="callout__body-wrap"><p class="callout__title">2 things to fix</p><ul><li><a href="#variants">Default budget is out of range</a></li>'
              '<li><a href="#variants">Descope threshold must be 1 to 20 days</a></li></ul></div></div>')
_S_INFO = _strip("info", "refresh", "Greenlit has 4 new skill commits. Each project updates when you choose.", '<a class="btn btn--sm" href="#variants">Review</a>')
_S_OK = _strip("ok", "check-circle", "Reconnected. Caught up 14 missed events, #48,200 to #48,213.")
_S_WARN = _strip("warn", "refresh", "Reconnecting… next attempt in 10 s. Missed events will catch up from #48,213.", spin=True)
_S_DANGER = _strip("danger", "wifi-off", "Connection lost. Retrying every 30 s; agents keep working and nothing is lost.", btn("Retry now", "", "sm", "refresh"), role="alert")
_S_SYS = _strip("danger", "shield-alert", "GitHub App credentials are invalid. Pull requests can’t be opened or merged until an Owner reconnects the app in Settings.",
                '<a class="btn btn--sm" href="#variants">Open settings</a>', role="alert")
_S_NEUTRAL = _strip("", "octagon-x", "All workers stopped. Nothing new will be leased until you start them again.")
_A_TONES = table(["Tone", "Callout", "Strip", "Role"], [
    ["Neutral", "Session expired, direction cancelled.", "Workers stopped (in the shell).", "<code>status</code>"],
    ["Info", "Direction queued, read-only for Viewers.", "Connecting, skills update available.", "<code>status</code>"],
    ["Success", "Defaults saved, direction complete, signed out.", "Reconnected, workers started.", "<code>status</code>"],
    ["Warning", "Paused, budget reached, rate limited.", "Reconnecting, all workers stopped.", "<code>status</code>"],
    ["Danger", "Stage failed, form errors, access denied.", "Connection lost, GitHub App credentials invalid.", "<code>alert</code> when it appears in response to something; <code>status</code> for a state present on load"]])


def _cbtn(state):
    ds = f' data-state="{state}"' if state else ""
    return f'<button class="btn btn--icon btn--ghost btn--sm" type="button" aria-label="Dismiss"{ds}>{icon("x", "icon--sm")}</button>'


def _sbtn(state):
    ds = f' data-state="{state}"' if state else ""
    return f'<button class="btn btn--sm" type="button"{ds}>{icon("refresh", "icon--sm")}Retry now</button>'


SPECS["alert"] = {
    "lead": "Alerts tell people about a condition that matters on this page or across the app: inline callouts sit in the content, strips run full width under the top bar.",
    "readme_variants": "callout neutral, info, success, warning, danger (title, body, actions, dismiss, error summary); strip neutral, info, success, warning, danger (with action)",
    "readme_states": "present on load, appearing in response, dismissed; action and dismiss hover, focus, active",
    "pills": ["Callout", "Strip"],
    "overview": f"""<p>Two forms, one job: telling someone about a condition that lasts until something changes.</p>
{ul(["<b>Callout</b> (<code>.callout</code>): inside the content, next to what it is about. The pipeline's <i>Stage failed after 3 retries</i>, the settings <i>Defaults saved</i>, the form error summary, the sign-in <i>This account doesn’t have access</i>.",
     "<b>Strip</b> (<code>.strip</code>): a full-width band under the top bar for conditions that affect the whole app: connection state, all workers stopped, GitHub App credentials invalid, a skills update. Strips stay until the condition ends."])}
<p>Use a {page('components/toast')} for passing news, an {page('components/inline-message')} for one field, and an {page('components/empty-state')} when the error replaces the content.</p>
{_A_TONES}""",
    "anatomy": (_callout("danger", "alert-triangle", "Stage failed after 3 retries", "Validation failed: L2-014 has no Given/When/Then the brief can support. Other projects keep running.", btn("Retry stage", "", "sm", "rotate-ccw"), role="alert", close=True),
                [(3, 30), (43, 30), (80, 50), (34, 68), (97, 49)],
                [("Icon", "Tone icon at 20px, <code>aria-hidden</code>."),
                 ("Title", "<code>.callout__title</code>: what is true now, in one line."),
                 ("Body", "<code>.callout__body</code>: why, what is safe, what happens next."),
                 ("Actions (optional)", "<code>.callout__actions</code>: small buttons or a compact form (raise budget)."),
                 ("Dismiss (optional)", "<code>.callout__close</code>: only for callouts that report a finished action.")]),
    "variants": f"""<h3>Callout tones</h3>
{ex(_C_NEUTRAL + _C_INFO + _C_OK + _C_WARN + _C_DANGER, "Neutral (no modifier), info, success, warning and danger. Title and body text use the tone's foreground; neutral uses muted text on the raised surface.", cls="ds-example__canvas--stack")}
<h3>Error summary</h3>
{ex(_C_SUMMARY, 'A danger callout listing each error as a link to its field; it receives focus after a failed submit (<code>tabindex="-1"</code>).', cls="ds-example__canvas--stack")}
<h3>Strips</h3>
{ex(_S_NEUTRAL + _S_INFO + _S_OK + _S_WARN + _S_DANGER + _S_SYS, "Neutral, info with an action, success, warning with a spinning icon, danger with Retry now, and the system danger strip.", cls="ds-example__canvas--stack")}""",
    "sizes": NA("Callouts and strips have one size each; they take the width of their container and grow with their text."),
    "states": f"""<p>The alert itself is not interactive; its buttons are. Pointer and focus states are forced with <code>data-state</code>.</p>
{matrix(["Default", "Hover", "Focus", "Active"], [
    ("Callout dismiss", [_cbtn(""), _cbtn("hover"), _cbtn("focus"), _cbtn("active")]),
    ("Strip action", [_sbtn(""), _sbtn("hover"), _sbtn("focus"), _sbtn("active")])])}
{ul(['<b>Present on load</b>: a state the page was rendered in (Paused, Blocked, Read-only). <code>role="status"</code> or no role; it is read in reading order.',
     '<b>Appears in response</b>: after a submit, a retry or a connection change. <code>role="alert"</code> for danger, <code>role="status"</code> otherwise, on an element that exists before its content is inserted.',
     "<b>Resolved</b>: strips are removed when the condition ends (<i>Reconnected…</i> shows for 4 s first); callouts reporting a finished action may be dismissed."])}
{themes(_C_WARN + _C_DANGER + _S_DANGER, stack=True)}""",
    "responsive": ul([
        "Callouts take the full width of their column at every breakpoint; actions wrap under the body.",
        "Strips span the whole content area under the top bar; their side padding is <code>--layout-margin</code> (16px below lg, 32px from lg) so the text lines up with the page.",
        "Below sm a strip's action wraps onto its own line, left-aligned under the text; from sm it sits at the end of the row (<code>margin-left: auto</code>).",
        "Strips stack in priority order when several apply: connection, then workers stopped, then system."]),
    "theming": f"""<p>Callouts read five component tokens that each tone overrides: <code>--callout-bg</code>, <code>--callout-fg</code>, <code>--callout-ring</code>, <code>--callout-icon</code>, <code>--callout-title</code>. Strips read the same status tokens directly. In dark the status backgrounds become deep tints and the foregrounds lighten, keeping 4.5:1.</p>
<pre><code>/* A callout on a raised dialog surface keeps its tone but drops the ring */
.dialog .callout {{ --callout-ring: transparent; }}</code></pre>""",
    "a11y": {
        "pattern": '<p>Callouts and strips use <code>role="status"</code> (polite) or, for danger that appears in response to something, <code>role="alert"</code>, following the <a href="https://www.w3.org/WAI/ARIA/apg/patterns/alert/">APG alert pattern</a>. Alerts never take focus, with one exception: the form error summary receives focus after a failed submit (<code>tabindex="-1"</code>), per the forms pattern.</p>',
        "keys": [(kbd("Tab"), "Reaches the alert's links and buttons in reading order."),
                 (kbd("Enter") + ", " + kbd("Space"), "Activates an action; in the error summary Enter on a link moves focus to that field.")],
        "focus": "<p>Alerts do not move focus when they appear (except the error summary). Dismissing a callout moves focus to the next focusable element after it.</p>",
        "labelling": "<p>The title and body are the announcement; write them to stand alone. Icons are <code>aria-hidden</code>; the tone is never carried by colour alone because the title says it (<i>Stage failed</i>, <i>Paused</i>).</p>",
        "pairs": [("Info text", "--color-info-fg", "--color-info-bg", 4.5), ("Success text", "--color-success-fg", "--color-success-bg", 4.5),
                  ("Warning text", "--color-warning-fg", "--color-warning-bg", 4.5), ("Danger text", "--color-danger-fg", "--color-danger-bg", 4.5),
                  ("Danger title", "--color-danger-strong", "--color-danger-bg", 4.5), ("Neutral text", "--color-fg-muted", "--color-bg-surface-raised", 4.5),
                  ("Info icon", "--color-info-icon", "--color-info-bg", 3), ("Warning icon", "--color-warning-icon", "--color-warning-bg", 3),
                  ("Danger icon", "--color-danger-icon", "--color-danger-bg", 3), ("Success icon", "--color-success-icon", "--color-success-bg", 3)],
        "motion": "<p>Alerts appear in place without animation. The reconnecting strip's icon spins on <code>--duration-spin</code> and stops under reduced motion; the word <i>Reconnecting…</i> still carries the state.</p>",
        "touch": "<p>Actions are small buttons (32px) with 8px gaps; the dismiss button is 32px. Strip actions sit clear of the strip text on phones.</p>",
    },
    "content": ul(["Title states what is true now: <i>Paused · Budget reached</i>, <i>Stage failed after 3 retries</i>, <i>Defaults saved</i>.",
                   "Body answers: why, what is safe, what next. <i>Retried after 30 s, 2 min and 10 min. Other projects keep running.</i>",
                   "Strips are one sentence plus the next attempt or the fix: <i>Connection lost. Retrying every 30 s; agents keep working and nothing is lost.</i>",
                   "Name who did it and when: <i>Paused by quinntynebrown at 14:29</i>.",
                   "Error summary title counts: <i>2 things to fix</i>; each item names the field and the problem."]),
    "dodont": [
        (_C_DANGER, "Say what failed, what was retried, and that other work is safe.",
         _callout("danger", "alert-triangle", "Error", "Something went wrong.", role="alert"), "<i>Error. Something went wrong.</i> gives an Owner nothing to act on."),
        (_S_DANGER, "A lasting, app-wide condition goes in a strip under the top bar.",
         _callout("danger", "wifi-off", "Connection lost", "Retrying every 30 s.", role="alert"), "A connection callout inside one tile implies only that tile is affected."),
        (_C_WARN, 'A state the page loads in uses <code>role="status"</code> (pages/project-pipeline/paused).',
         _callout("warn", "pause-circle", "Paused by quinntynebrown at 14:29", "Nothing new starts until Resume.", role="alert"), '<code>role="alert"</code> on a callout rendered with the page interrupts the screen reader on every visit.'),
    ],
    "tokens": [("Callout neutral background / ring", "--color-bg-surface-raised / --color-border-default"), ("Neutral text / title / icon", "--color-fg-muted / --color-fg-default / --color-fg-subtle"),
               ("Info background / text / ring / icon", "--color-info-bg / --color-info-fg / --color-info-border / --color-info-icon"),
               ("Success background / text / ring / icon", "--color-success-bg / --color-success-fg / --color-success-border / --color-success-icon"),
               ("Warning background / text / ring / icon", "--color-warning-bg / --color-warning-fg / --color-warning-border / --color-warning-icon"),
               ("Danger background / text / title / icon", "--color-danger-bg / --color-danger-fg / --color-danger-strong / --color-danger-icon"),
               ("Callout padding / gap / radius", "--space-4 / --space-3 / --radius-md"), ("Strip padding", "--space-2 / --layout-margin"),
               ("Text", "--text-body-sm / --line-height-relaxed")],
    "code": {"snippet": """<div class="callout callout--danger" role="alert">
  <svg class="icon icon--lg" viewBox="0 0 24 24" aria-hidden="true">…</svg>
  <div class="callout__body-wrap">
    <p class="callout__title">Stage failed after 3 retries</p>
    <p class="callout__body">Validation failed: L2-014 has no Given/When/Then … Other projects keep running.</p>
    <div class="callout__actions"><button class="btn btn--sm" type="button">…Retry stage</button></div>
  </div>
</div>

<div class="strip strip--danger" role="alert">
  <svg class="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true">…</svg>
  <span class="strip__text">Connection lost. Retrying every 30 s; agents keep working and nothing is lost.</span>
  <button class="btn btn--sm" type="button">…Retry now</button>
</div>""",
             "classes": [("<code>.callout</code> + <code>--info</code> <code>--ok</code> <code>--warn</code> <code>--danger</code>", "Inline callout; no modifier is neutral."),
                         ("<code>.callout__body-wrap</code> <code>.callout__title</code> <code>.callout__body</code>", "Text block, title, body."),
                         ("<code>.callout__actions</code> <code>.callout__close</code>", "Action row; optional dismiss."),
                         ("<code>.form-summary</code>", "Error summary list styling inside a danger callout."),
                         ("<code>.strip</code> + <code>--info</code> <code>--ok</code> <code>--warn</code> <code>--danger</code>", "Full-width banner; no modifier is neutral."),
                         ("<code>.strip__text</code>", "The sentence; the trailing button aligns to the end.")]},
    "sources": {"mocks": [("pages/project-pipeline/blocked", "danger callout with action"), ("pages/project-pipeline/paused", "warning callout"),
                          ("pages/settings/success", "success callout"), ("pages/settings/invalid", "error summary"), ("pages/sign-in/expired", "neutral callout"),
                          ("notifications/connection-banner/danger", "danger strip"), ("notifications/connection-banner/warning", "reconnecting strip"),
                          ("notifications/system-banner/info", "info strip with action"), ("notifications/system-banner/danger", "system danger strip")],
                "drift": "callout contents were wrapped in an unclassed <code>&lt;div&gt;</code>, which could not shrink; they now use <code>.callout__body-wrap</code>. Bodies without a title reset their margin inline (<code>style=\"margin-top:0\"</code> on sign-in/expired); strips' 3px gap snapped to <code>--space-1</code>."},
}


# ============================================================== inline message
def _imfield(n, label, value, kind="hint", state="", msg=None):
    fid = f"im-{n}"
    hint = msg or "1–100 characters, unique among your projects"
    if kind == "error":
        msg_html = (f'<span class="field__error" id="{fid}-err">{icon("alert-circle", "icon--sm")}Name is already used by another project. Pick a different name.</span>'
                    f'<span class="field__hint" id="{fid}-hint">{hint}</span>')
        attrs = f' aria-invalid="true" aria-describedby="{fid}-err {fid}-hint"'
    elif kind == "success":
        msg_html = f'<span class="field__success" id="{fid}-ok">{icon("check-circle", "icon--sm")}{msg}</span>'
        attrs = f' aria-describedby="{fid}-ok"'
    else:
        msg_html = f'<span class="field__hint" id="{fid}-hint">{hint}</span>'
        attrs = f' aria-describedby="{fid}-hint"'
    if state in ("hover", "focus"):
        attrs += f' data-state="{state}"'
    if state == "disabled":
        attrs += " disabled"
    return (f'<div class="field" style="width: 100%; min-width: 12rem;"><label class="field__label" for="{fid}">{label}</label>'
            f'<div class="field__control"><input class="input" id="{fid}" value="{value}" autocomplete="off"{attrs}></div>{msg_html}</div>')


_IM_COUNTER = ('<div class="field" style="width: 100%;"><label class="field__label" for="im-c1">Idea</label><div class="field__control">'
               '<textarea class="textarea" id="im-c1" rows="3" aria-describedby="im-c1-count">Add a CSV export to the shift report so supervisors can open it in Excel.</textarea></div>'
               '<span class="field__counter" id="im-c1-count">73 of 20,000 characters</span></div>')
_IM_REPO = ('<div class="field" style="width: 100%;"><label class="field__label" for="im-r1">Existing repository <span class="optional">(optional)</span></label><div class="field__control">'
            '<input class="input" id="im-r1" value="https://github.com/northwind/handover" aria-invalid="true" aria-describedby="im-r1-err"></div>'
            f'<span class="field__error" id="im-r1-err">{icon("alert-circle", "icon--sm")}Hewn’s GitHub App can’t write to northwind/handover. Install the app on that repository, or leave this empty to create one.</span></div>')
_IM_BUDGET = ('<div class="field" style="width: 100%;"><label class="field__label" for="im-b1">Budget</label><div class="field__control"><div class="prefix prefix--money">'
              '<span class="prefix__sym" aria-hidden="true">$</span><input class="input" id="im-b1" inputmode="decimal" value="400.00" aria-describedby="im-b1-hint"></div></div>'
              '<span class="field__hint" id="im-b1-hint">Pauses at 100%, warns at 80%. Project default is $300.</span></div>')
_IM_MESSAGES = ('<div class="stack stack--sm" style="width: 100%;"><span class="field__hint">1–100 characters, unique among your projects</span>'
                f'<span class="field__error">{icon("alert-circle", "icon--sm")}The idea must be 10 to 20,000 characters. This one has 8.</span>'
                f'<span class="field__success">{icon("check-circle", "icon--sm")}Hewn’s GitHub App can write to northwind/ops-portal.</span>'
                '<span class="field__counter">312 of 20,000 characters</span></div>')
_IM_BAD_ERR = ('<div class="field" style="width: 100%;"><label class="field__label" for="im-x1">Idea</label><div class="field__control">'
               '<input class="input" id="im-x1" value="Expenses" aria-invalid="true" aria-describedby="im-x1-err"></div>'
               f'<span class="field__error" id="im-x1-err">{icon("alert-circle", "icon--sm")}Invalid input.</span></div>')
_IM_GOOD_ERR = ('<div class="field" style="width: 100%;"><label class="field__label" for="im-x2">Idea</label><div class="field__control">'
                '<input class="input" id="im-x2" value="Expenses" aria-invalid="true" aria-describedby="im-x2-err"></div>'
                f'<span class="field__error" id="im-x2-err">{icon("alert-circle", "icon--sm")}The idea must be 10 to 20,000 characters. This one has 8.</span></div>')
_IM_BAD_COLOUR = ('<div class="field" style="width: 100%;"><label class="field__label" for="im-x3">Name</label><div class="field__control">'
                  '<input class="input" id="im-x3" value="Field Notes" style="box-shadow: inset 0 0 0 var(--border-width-thick) var(--color-danger-icon);"></div></div>')

SPECS["inline-message"] = {
    "lead": "Inline messages sit directly under one control: the hint that says what to enter, the error that says what to fix, and the confirmation that a check passed.",
    "readme_variants": "hint, error, success, counter; hint and error together",
    "readme_states": "hint (default, focus, disabled), invalid, valid",
    "overview": f"""<p>Every {page('components/form-field')} can show one or more inline messages below its control. They are part of the field, linked to the control with <code>aria-describedby</code>, and say something about this field only. Messages about the whole form go in an error summary {page('components/alert', 'callout')}; messages about something that happened go in a {page('components/toast')}.</p>
{ul(["<b>Hint</b> (<code>.field__hint</code>): format, limits or a default, shown before any input: <i>Pauses at 100%, warns at 80%. Project default is $300.</i>",
     "<b>Error</b> (<code>.field__error</code>): what is wrong and how to fix it, with an icon, after the field is left or the form submitted.",
     "<b>Success</b> (<code>.field__success</code>): a server-side check passed (repository access), shown only where a check is not obvious.",
     "<b>Counter</b> (<code>.field__counter</code>): characters used against a limit, right-aligned, tabular."])}""",
    "anatomy": (_imfield(0, "Name", "Field Notes", "error"),
                [(14, 26), (97, 45), (76, 63), (49, 75)],
                [("Label", "<code>.field__label</code>; the control's name."),
                 ("Control", 'Invalid: <code>aria-invalid="true"</code> draws the 2px danger ring.'),
                 ("Error", "<code>.field__error</code>: 14px danger text with a 14px alert icon; first in <code>aria-describedby</code>."),
                 ("Hint", "<code>.field__hint</code>: 12px subtle text; stays visible under the error so the rule is not lost.")]),
    "variants": f"""{ex(_IM_MESSAGES, "Hint, error, success and counter, without their controls.", cls="ds-example__canvas--stack")}
<h3>In fields</h3>
{ex(_IM_BUDGET, "Hint: the rule and the default, before input.", cls="ds-example__canvas--stack")}
{ex(_IM_REPO, "Error from a server check: names the repository and gives two ways out (pages/new-direction/repo-no-access).", cls="ds-example__canvas--stack")}
{ex(_IM_COUNTER, "Counter: characters used of the limit, linked to the textarea.", cls="ds-example__canvas--stack")}""",
    "sizes": NA("One size: hints and counters use --text-caption (12px), errors and success messages --text-body-sm (14px) so the important ones read first."),
    "states": f"""<p>Messages follow the field's state. Pointer and focus states are forced with <code>data-state</code>.</p>
{matrix(["Default", "Focus", "Invalid", "Valid", "Disabled"], [
    ("Name field", [_imfield(1, "Name", "Ledgerline"), _imfield(2, "Name", "Ledgerline", state="focus"), _imfield(3, "Name", "Field Notes", "error"),
                    _imfield(4, "Repository", "northwind/ops-portal", "success", msg="Hewn’s GitHub App can write to northwind/ops-portal."),
                    _imfield(5, "Name", "Ledgerline", state="disabled")])])}
{ul(["<b>When errors appear</b>: on leaving a field that has a value, or on submit for every field. Never while typing the first time.",
     "<b>When they clear</b>: as soon as the value becomes valid, on input (the person is fixing it, so live feedback helps).",
     "<b>Success</b> only follows a check the person cannot see (repository write access); never mark ordinary fields valid."])}
{themes(_IM_MESSAGES, stack=True)}""",
    "responsive": ul([
        "Messages wrap under the control at every width; they never sit beside it, so they cannot be cut off at 360px.",
        "In two-column form grids (from sm) each column keeps its own messages; a long error does not push the neighbouring field.",
        "The counter is right-aligned under the control at every width."]),
    "theming": "<p>Hint and counter read <code>--color-fg-subtle</code>; error <code>--color-danger-strong</code>; success <code>--color-success-fg</code>. All three keep 4.5:1 on surface and canvas in both themes. The invalid ring is <code>--field-invalid</code> (<code>--color-danger-icon</code>), a component token a form can override.</p>",
    "a11y": {
        "pattern": "<p>No widget role: the messages are plain text referenced by the control's <code>aria-describedby</code> (error first, then hint), with <code>aria-invalid=\"true\"</code> on the control while it is in error. See <a href=\"https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html\">3.3.1 Error identification</a> and <a href=\"https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion.html\">3.3.3 Error suggestion</a>. A success message from an asynchronous check is inserted into a container with <code>role=\"status\"</code>.</p>",
        "keys": [(kbd("Tab"), "Messages are not focusable; they are read when the control receives focus.")],
        "focus": "<p>An inline error never moves focus. After a failed submit, focus goes to the error summary, whose links move focus to each field.</p>",
        "labelling": "<p>Errors are read as the control's description after its name and value: <i>Name, Field Notes, invalid entry, Name is already used by another project. Pick a different name. 1–100 characters, unique among your projects.</i> Icons are <code>aria-hidden</code>.</p>",
        "pairs": [("Hint and counter on surface", "--color-fg-subtle", "--color-bg-surface", 4.5), ("Hint on canvas", "--color-fg-subtle", "--color-bg-canvas", 4.5),
                  ("Error on surface", "--color-danger-strong", "--color-bg-surface", 4.5), ("Error on canvas", "--color-danger-strong", "--color-bg-canvas", 4.5),
                  ("Success on surface", "--color-success-fg", "--color-bg-surface", 4.5), ("Invalid ring", "--color-danger-icon", "--color-bg-surface", 3)],
        "motion": "<p>None. Messages appear and disappear in place, without shifting other fields more than their own height.</p>",
        "touch": "<p>Not targets. Keep a 6px gap (<code>--space-1-5</code>) between control and message so a tap on the message is not taken for the control.</p>",
    },
    "content": ul(["Errors say what is wrong and how to fix it, with the numbers: <i>The idea must be 10 to 20,000 characters. This one has 8.</i>",
                   "Give the exact format: <i>Use a https://github.com/{owner}/{repo} URL.</i>",
                   "When the fix is elsewhere, say where: <i>Install the app on that repository, or leave this empty to create one.</i>",
                   "Hints state rules and defaults, not instructions to type: <i>Default: .NET backend, Angular frontend</i>.",
                   "Counters: <i>312 of 20,000 characters</i>; no <i>remaining</i>."]),
    "dodont": [
        (_IM_GOOD_ERR, "Say what is wrong and give the numbers.",
         _IM_BAD_ERR, "<i>Invalid input.</i> leaves the person guessing what the rule is."),
        (_imfield(9, "Name", "Field Notes", "error"), "Error text with an icon, plus <code>aria-invalid</code> and <code>aria-describedby</code>; the hint stays.",
         _IM_BAD_COLOUR, "A red ring alone fails 1.4.1 and says nothing to a screen reader. pages/new-direction/invalid also drops the hint when the error shows."),
    ],
    "tokens": [("Hint, counter", "--color-fg-subtle / --text-caption"), ("Error", "--color-danger-strong / --text-body-sm"), ("Success", "--color-success-fg / --text-body-sm"),
               ("Invalid ring", "--color-danger-icon / --border-width-thick"), ("Gap below control", "--space-1-5"), ("Icon", "--size-icon-sm")],
    "code": {"snippet": """<div class="field">
  <label class="field__label" for="name">Name</label>
  <div class="field__control">
    <input class="input" id="name" value="Field Notes" aria-invalid="true" aria-describedby="name-err name-hint">
  </div>
  <span class="field__error" id="name-err">
    <svg class="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true">…</svg>Name is already used by another project. Pick a different name.
  </span>
  <span class="field__hint" id="name-hint">1–100 characters, unique among your projects</span>
</div>""",
             "classes": [("<code>.field__hint</code>", "Rule, limit or default."), ("<code>.field__error</code>", "Error text with a leading icon."),
                         ("<code>.field__success</code>", "Passed check with a leading icon."), ("<code>.field__counter</code>", "Characters used of the limit."),
                         ('<code>aria-invalid="true"</code>', "On the control while in error: danger ring."),
                         ("<code>aria-describedby</code>", "On the control: error id first, then hint id.")]},
    "sources": {"mocks": [("pages/new-direction/invalid", "three field errors"), ("pages/new-direction/repo-no-access", "server-check error"),
                          ("pages/new-direction/default", "hints and character counts"), ("pages/settings/invalid", "settings errors")],
                "drift": "pages/new-direction/invalid replaces the hint with the error, so the rule disappears exactly when it is needed; the hint now stays under the error and both ids are in <code>aria-describedby</code>. pages/new-direction/feature renders the Product hint without linking it to the select. The character count is shown as a hint in the mocks; it is <code>.field__counter</code> here."},
}


# ============================================================== progress bar
def _meter(value, role="progressbar", label="Ledgerline complete", mod="", text=None, maxv=100, now=None, width="100%"):
    cls = "meter" + (f" {mod}" if mod else "")
    vt = f' aria-valuetext="{text}"' if text else ""
    nv = now if now is not None else value
    return (f'<div class="{cls}" role="{role}" aria-label="{label}" aria-valuemin="0" aria-valuemax="{maxv}" aria-valuenow="{nv}"{vt} style="width: {width};">'
            f'<span class="meter__bar" style="--value: {value}%"></span></div>')


def _indet(label="Importing the CSV statement", width="100%"):
    return f'<div class="meter meter--indeterminate" role="progressbar" aria-label="{label}" style="width: {width};"><span class="meter__bar"></span></div>'


def _labelled(label, strong, rest, meter):
    return (f'<div style="width: 100%;"><div class="progress__label"><span>{label}</span><span><strong>{strong}</strong>{rest}</span></div>{meter}</div>')


_PB_SPEND = _labelled("Spend", "$184.20", " of $400.00", _meter(46, "meter", "Spend", text="$184.20 of $400.00", maxv="400.00", now="184.20"))
_PB_SPEND_WARN = _labelled("Kiln Booking spend", "$250.00", " of $250.00", _meter(100, "meter", "Kiln Booking spend", "meter--warn", "$250.00 of $250.00, budget reached", "250.00", "250.00"))
_PB_DONE = _labelled("Field Notes", "100%", " complete", _meter(100, label="Field Notes complete", mod="meter--ok"))
_PB_INLINE = (f'<span class="pct">{_meter(62, label="Ledgerline complete", mod="meter--muted meter--inline", width="3.5rem")}62%</span>'
              f'<span class="pct">{_meter(18, label="Tidewater complete", mod="meter--muted meter--inline", width="3.5rem")}18%</span>'
              f'<span class="pct">{_meter(81, label="Kiln Booking complete", mod="meter--muted meter--inline", width="3.5rem")}81%</span>')
_PB_INDET = _labelled("Importing the CSV statement", "", "", _indet())


def _pcell(v, role, mod=""):
    if role == "meter":
        spend = v * 4
        lab = "Spend"
        txt = f"${spend:,.2f} of $400.00"
        return _meter(v, "meter", lab, mod, txt, "400.00", f"{spend:.2f}", "10rem")
    return _meter(v, label="Ledgerline complete", mod=mod, width="10rem")


SPECS["progress-bar"] = {
    "lead": "Progress bars show how far something has got (a project, an upload) and meters show how much of a limit is used (spend against budget). Both are the same thin bar.",
    "readme_variants": "progress (accent, ok on complete), meter (accent, warning at 80%), muted inline, large, indeterminate",
    "readme_states": "0%, partial, 80% warning, 100%, indeterminate (not interactive)",
    "pills": ['<code>role="progressbar"</code> / <code>role="meter"</code>'],
    "overview": f"""<p>One component, two roles, chosen by what the number means:</p>
{ul(['<b>Progress</b> (<code>role="progressbar"</code>): completion of a task that ends: a project’s percent complete, an import, a capture. Goes green (<code>.meter--ok</code>) at 100%.',
     '<b>Meter</b> (<code>role="meter"</code>): a quantity within a known range that is not a task: spend against budget, worker capacity. Turns warning at 80% because the direction pauses itself at 100%.',
     "<b>Indeterminate</b> (<code>.meter--indeterminate</code>): a task whose length is unknown and that takes long enough to need more than a " + page("components/spinner") + "."])}
<p>Use the {page('components/pipeline-strip')} for stage-by-stage progress and a {page('components/stat')} when the number itself is the point.</p>""",
    "anatomy": (_PB_SPEND, [(12, 45), (73, 45), (25, 80), (75, 80)],
                [("Label", "<code>.progress__label</code>: what is measured, left."),
                 ("Value", "Right, tabular: <strong>amount</strong> of limit, or percent."),
                 ("Fill", "<code>.meter__bar</code>, width from <code>--value</code>."),
                 ("Track", "<code>.meter</code>: 4px, fully rounded, <code>--color-border-default</code>.")]),
    "variants": f"""{ex(_PB_SPEND + _PB_SPEND_WARN, "Meters: spend in accent, warning from 80%; <code>aria-valuetext</code> speaks the money.", cls="ds-example__canvas--stack")}
{ex(_PB_DONE, "Progress at 100%: success fill.", cls="ds-example__canvas--stack")}
{ex(_PB_INLINE, "Muted inline progress in table rows (<code>.meter--muted .meter--inline</code>, 3.5rem) with the percent beside it.")}
{ex(_PB_INDET, "Indeterminate: no <code>aria-valuenow</code>; a 40% segment sweeps the track.", cls="ds-example__canvas--stack")}""",
    "sizes": f"""{ex(_labelled("Default · 4px", "62%", "", _meter(62, label="Default size example")) + _labelled("Large · 8px", "62%", "", _meter(62, label="Large size example", mod="meter--lg")), "Default 4px (<code>--space-1</code>) everywhere; large 8px (<code>--space-2</code>) for a single headline figure such as a budget dialog.", cls="ds-example__canvas--stack")}
<p>Inline (<code>.meter--inline</code>) fixes the width at 3.5rem for table and row cells; otherwise the bar takes the width of its container.</p>""",
    "states": f"""<p>Not interactive: no hover, focus or disabled states. Its states are its values and its thresholds.</p>
{matrix(["0%", "46%", "80%", "100%"], [
    ("Progress", [_pcell(0, "p"), _pcell(46, "p"), _pcell(80, "p"), _pcell(100, "p", "meter--ok")]),
    ("Meter (spend)", [_pcell(0, "meter"), _pcell(46, "meter"), _pcell(80, "meter", "meter--warn"), _pcell(100, "meter", "meter--warn")]),
    ("Indeterminate", [_indet("Indeterminate example", "10rem"), "<span class='text-caption'>—</span>", "<span class='text-caption'>—</span>", "<span class='text-caption'>—</span>"])])}
{ul(["<b>Warning</b> (<code>.meter--warn</code>) applies to meters from 80% of the limit; the value text says it: <i>$200.00 of $250.00</i>.",
     "<b>Danger</b> (<code>.meter--danger</code>) is for a failed task frozen at the point it failed (an import that stopped at 40%), alongside an error message.",
     "<b>Updating</b>: the fill width changes without animation; announce milestones (not every percent) through the surrounding live region."])}
{themes(_PB_SPEND + _PB_SPEND_WARN + _PB_DONE, stack=True)}""",
    "responsive": ul([
        "The bar is fluid at every breakpoint; label and value sit on one line above it and wrap only if the label is long.",
        "In row lists the inline bar and its percent show from lg; below lg the percent stays and the bar hides with its column.",
        "In the project header the spend block keeps a minimum width of 11rem so money never wraps."]),
    "theming": f"""<p>The fill reads <code>--meter-fill</code>, which each modifier sets (<code>--color-accent</code>, <code>--color-fg-muted</code>, <code>--color-success-solid</code>, <code>--color-warning-solid</code>, <code>--color-danger-icon</code>). Every fill keeps 3:1 against the track in both themes.</p>
<pre><code>/* Worker capacity uses the info fill */
.capacity .meter {{ --meter-fill: var(--color-info-solid); }}</code></pre>""",
    "a11y": {
        "pattern": '<p><code>role="progressbar"</code> for completion and <a href="https://www.w3.org/WAI/ARIA/apg/patterns/meter/">APG meter</a> (<code>role="meter"</code>) for a value in a range, each with <code>aria-label</code>, <code>aria-valuemin</code>, <code>aria-valuemax</code> and <code>aria-valuenow</code>; add <code>aria-valuetext</code> whenever the number is not a plain percent (<i>$184.20 of $400.00</i>). Indeterminate progress omits <code>aria-valuenow</code>; the region that is loading also gets <code>aria-busy="true"</code>. See the <a href="https://www.w3.org/TR/wai-aria-1.2/#progressbar">WAI-ARIA progressbar role</a>.</p>',
        "keys": [("None", "Not focusable. The value is read in reading order or from the row it belongs to.")],
        "focus": "<p>Never takes focus.</p>",
        "labelling": "<p>Name it after what it measures: <i>Spend</i>, <i>Ledgerline complete</i>, <i>Importing the CSV statement</i>. The visible value text and <code>aria-valuetext</code> say the same thing.</p>",
        "pairs": [("Accent fill vs track", "--color-accent", "--color-border-default", 3), ("Success fill vs track", "--color-success-solid", "--color-border-default", 3),
                  ("Warning fill vs track", "--color-warning-solid", "--color-border-default", 3), ("Danger fill vs track", "--color-danger-icon", "--color-border-default", 3),
                  ("Muted fill vs track", "--color-fg-muted", "--color-border-default", 3), ("Label", "--color-fg-muted", "--color-bg-surface", 4.5),
                  ("Value", "--color-fg-default", "--color-bg-surface", 4.5)],
        "motion": "<p>The indeterminate sweep runs on <code>--duration-pulse</code>; under reduced motion it stops as a still 40% segment, and the label still says the task is under way. Determinate fills change width instantly.</p>",
        "touch": "<p>Not a target.</p>",
    },
    "content": ul(["Label what is measured, value on the right: <i>Spend</i> · <strong>$184.20</strong> of $400.00.",
                   "Money with two decimals; percent with no decimals: <i>62%</i>.",
                   "At a threshold, the value text says what happens: <i>It pauses at $250.00.</i>",
                   "Indeterminate labels use the progressive verb: <i>Importing the CSV statement</i>."]),
    "dodont": [
        (_PB_SPEND, "Spend is a meter with the money as text and as <code>aria-valuetext</code>.",
         _labelled("Spend", "46%", "", _meter(46, label="Spend")), "A spend bar labelled <i>46%</i> as a progressbar implies the budget is a task to finish."),
        (_PB_INLINE, 'Project completion is progress: <code>role="progressbar"</code>.',
         '<span class="pct"><span class="meter meter--muted meter--inline" role="meter" aria-label="Ledgerline complete" aria-valuenow="62" aria-valuemin="0" aria-valuemax="100"><span class="meter__bar" style="--value: 62%"></span></span>62%</span>',
         'pages/projects/default marks completion as <code>role="meter"</code>, so it is announced as a gauge reading.'),
    ],
    "tokens": [("Track", "--color-border-default"), ("Fill accent / muted", "--color-accent / --color-fg-muted"), ("Fill success / warning / danger", "--color-success-solid / --color-warning-solid / --color-danger-icon"),
               ("Height default / large", "--space-1 / --space-2"), ("Radius", "--radius-full"), ("Label", "--text-caption / --color-fg-muted"),
               ("Indeterminate sweep", "--duration-pulse / --ease-standard")],
    "code": {"snippet": """<div class="progress__label"><span>Spend</span><span><strong>$184.20</strong> of $400.00</span></div>
<div class="meter" role="meter" aria-label="Spend" aria-valuemin="0" aria-valuemax="400"
     aria-valuenow="184.20" aria-valuetext="$184.20 of $400.00">
  <span class="meter__bar" style="--value: 46%"></span>
</div>

<div class="meter meter--muted meter--inline" role="progressbar" aria-label="Ledgerline complete"
     aria-valuemin="0" aria-valuemax="100" aria-valuenow="62"><span class="meter__bar" style="--value: 62%"></span></div>

<div class="meter meter--indeterminate" role="progressbar" aria-label="Importing the CSV statement"><span class="meter__bar"></span></div>""",
             "classes": [("<code>.meter</code> + <code>role</code>", "Track; <code>progressbar</code> for completion, <code>meter</code> for a value in a range."),
                         ("<code>.meter__bar</code> + <code>--value</code>", "Fill width as a percentage."),
                         ("<code>--muted</code> <code>--ok</code> <code>--warn</code> <code>--danger</code>", "Fill colour."),
                         ("<code>--lg</code> <code>--inline</code>", "8px tall; 3.5rem wide inline."),
                         ("<code>--indeterminate</code>", "Sweeping segment; omit <code>aria-valuenow</code>."),
                         ("<code>.progress__label</code> <code>.pct</code>", "Label row above; inline percent beside.")]},
    "sources": {"mocks": [("pages/projects/default", "inline completion"), ("pages/project-pipeline/default", "spend meter in the header"),
                          ("pages/project-pipeline/budget-reached", "warning at 100%"), ("pages/dashboard/default", "Kiln Booking spend in Needs attention")],
                "drift": 'light <code>--color-warning-solid</code> was 2.0:1 and is now <code>--palette-amber-600</code>; project completion bars are <code>role="meter"</code> in the mocks and are progress bars here; spend meters gain <code>aria-valuetext</code>; <code>.meter--indeterminate</code> is new (the mocks had none).'},
}


# ============================================================== spinner
def _spin(text, cls="", static=False, role="status"):
    st = ' style="animation: none;"' if static else ""
    r = f' role="{role}"' if role else ""
    return f'<span class="spinner"{r}><svg class="icon {cls}" viewBox="0 0 24 24" aria-hidden="true"{st}>{_LOADER}</svg>{text}</span>'


from common import ICONS  # noqa: E402
_LOADER = ICONS["loader"]
_SP_BUSY = f'<button class="btn btn--stone" type="button" aria-busy="true" aria-disabled="true">{icon("loader", "icon--lg")}Waiting for GitHub…</button>'
_SP_STRIP = _strip("warn", "refresh", "Reconnecting… next attempt in 10 s. Missed events will catch up from #48,213.", spin=True)
_SP_RUN = f'<span class="run__stage">{icon("loader", "icon--sm icon--spin")}Stage 10 · Increments</span>'

SPECS["spinner"] = {
    "lead": "A spinner says the app is working on something right here and does not know how long it will take. It always comes with words.",
    "readme_variants": "inline with label, in a busy button, in a strip, running status; icon sizes xs to lg",
    "readme_states": "spinning, reduced motion (static), finished",
    "overview": f"""<p>Use a spinner for a short, unmeasured wait tied to one place: a button that is submitting, a connection being re-established, a stage that is running. The loader icon turns; the words say what is happening.</p>
{ul(["Loading a page or a region: use a " + page("components/skeleton") + " shaped like the content, not a spinner in the middle of nothing.",
     "Measurable work: use a " + page("components/progress-bar") + ".",
     "A running stage or worker: the <i>Running</i> " + page("components/badge", "status") + " uses the same spinning loader with its word."])}""",
    "anatomy": (_spin("Loading increment 7…", role=""), [(34, 47), (64, 47)],
                [("Icon", "The loader icon in <code>--color-fg-accent</code>, turning on <code>--duration-spin</code>; <code>aria-hidden</code>."),
                 ("Label", "What is happening, progressive verb with an ellipsis, <code>--color-fg-muted</code>.")]),
    "variants": f"""{ex(_spin("Loading increment 7…"), 'Inline with a label (<code>.spinner</code>), in a <code>role="status"</code> container.')}
{ex(_SP_BUSY, "In a busy button: the leading icon becomes the loader and the label its progressive form (pages/sign-in/loading).")}
{ex(_SP_STRIP, "In a strip: the strip's icon spins while reconnecting.", cls="ds-example__canvas--stack")}
{ex(_SP_RUN, "Running stage on the dashboard: the loader is part of the status.")}""",
    "sizes": f"""{ex(_spin("12px", "icon--xs", role="") + _spin("14px", "icon--sm", role="") + _spin("16px", "", role="") + _spin("20px", "icon--lg", role=""), "Match the icon to the text beside it: xs with captions, sm in small buttons and strips, md (default) with body text, lg in large buttons.")}""",
    "states": f"""{matrix(["Spinning", "Reduced motion", "Finished"], [
    ("Inline", [_spin("Saving defaults…", role=""), _spin("Saving defaults…", static=True, role=""), f'<span class="field__success">{icon("check-circle", "icon--sm")}Defaults saved</span>']),
    ("Button", [f'<button class="btn btn--primary" type="button" aria-busy="true" aria-disabled="true">{icon("loader")}Saving…</button>',
                f'<button class="btn btn--primary" type="button" aria-busy="true" aria-disabled="true">{icon("loader").replace("aria-hidden", "style=" + chr(34) + "animation: none;" + chr(34) + " aria-hidden")}Saving…</button>',
                btn("Save changes", "primary")])])}
<p>Reduced motion sets <code>--duration-spin</code> to 0s, so the loader stands still; the label keeps saying it is working. When the work finishes the spinner is replaced by the result (a message, the loaded content, the button's normal label), never left turning.</p>
{themes(_spin("Loading increment 7…", role="") + _SP_BUSY)}""",
    "responsive": NA("A spinner is inline and sized with its text; it behaves the same at every breakpoint."),
    "theming": "<p>The icon reads <code>--color-fg-accent</code> and the label <code>--color-fg-muted</code>; inside a button or strip the icon inherits the text colour instead, so it matches the variant in both themes.</p>",
    "a11y": {
        "pattern": "<p>The icon is <code>aria-hidden</code>; the label is the information. Put the spinner's label in a <code>role=\"status\"</code> container that exists before the label is inserted, so <i>Loading increment 7…</i> is announced once (<a href=\"https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html\">4.1.3 Status messages</a>). In buttons, <code>aria-busy=\"true\"</code> and <code>aria-disabled=\"true\"</code> carry the state, as on the " + page("components/button") + " page.</p>",
        "keys": [("None", "Spinners are not focusable. A busy button keeps focus and ignores Enter and Space until it finishes.")],
        "focus": "<p>Never takes or moves focus. When a busy button finishes, focus stays on it (or moves with the dialog that closes).</p>",
        "labelling": "<p>Always a visible label; never an icon alone. Icon-only spots (a running status in a dense row) carry the word in the row: <i>Running</i>.</p>",
        "pairs": [("Spinner icon", "--color-fg-accent", "--color-bg-surface", 3), ("Spinner label", "--color-fg-muted", "--color-bg-surface", 4.5),
                  ("In a warning strip", "--color-warning-fg", "--color-warning-bg", 4.5), ("In a primary button", "--color-fg-on-accent", "--color-accent", 4.5)],
        "motion": "<p>One full turn per <code>--duration-spin</code> (2.4s), linear. It is a continuous loop, so under reduced motion it stops (0s); no flashing, never faster than once per second.</p>",
        "touch": "<p>Not a target.</p>",
    },
    "content": ul(["Progressive verb plus object and an ellipsis character: <i>Loading increment 7…</i>, <i>Waiting for GitHub…</i>, <i>Reconnecting…</i>.",
                   "If the wait has a known next step, say it: <i>Reconnecting… next attempt in 10 s.</i>",
                   "Never <i>Please wait</i> or <i>Loading…</i> with no object."]),
    "dodont": [
        (_spin("Loading increment 7…", role=""), "Say what is loading.",
         f'<span class="spinner">{icon("loader")}</span>', "A spinner with no words gives a screen reader nothing and a sighted user no idea how long."),
        ('<div class="stack stack--sm" style="width: 100%;" aria-hidden="true"><span class="skeleton skeleton--title"></span><span class="skeleton skeleton--w75"></span><span class="skeleton skeleton--w50"></span></div>',
         "Load a page region with a skeleton shaped like it (pages/projects/loading).",
         '<div style="display: grid; place-items: center; width: 100%; min-height: 6rem;">' + _spin("Loading…", role="") + "</div>", "A centred spinner in an empty region hides the layout and shifts everything when content arrives."),
    ],
    "tokens": [("Icon", "--color-fg-accent"), ("Label", "--color-fg-muted / --text-body-sm"), ("Turn", "--duration-spin / --ease-linear"),
               ("Icon sizes", "--size-icon-xs / --size-icon-sm / --size-icon-md / --size-icon-lg"), ("Gap", "--space-2")],
    "code": {"snippet": """<span class="spinner" role="status">
  <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">…loader…</svg>Loading increment 7…
</span>

<!-- Inside other components, the icon alone spins -->
<svg class="icon icon--sm icon--spin" viewBox="0 0 24 24" aria-hidden="true">…loader…</svg>""",
             "classes": [("<code>.spinner</code>", "Inline icon and label; the icon spins in accent."),
                         ("<code>.icon--spin</code>", "Spins any icon (strips, running status)."),
                         ('<code>.btn[aria-busy="true"]</code>', "Busy button: the leading icon spins.")]},
    "sources": {"mocks": [("pages/sign-in/loading", "busy button"), ("notifications/connection-banner/warning", "reconnecting strip"),
                          ("notifications/connection-banner/info", "connecting strip"), ("pages/dashboard/default", "running stage")],
                "drift": "the raw 1s spin and <code>linear</code> easing became <code>--duration-spin</code> / <code>--ease-linear</code>, and stop under reduced motion. pages/sign-in/loading sets <code>disabled</code> on its busy button (as the dialogs did), losing focus; busy buttons use <code>aria-disabled</code>. <code>.spinner</code> is new: the mocks only spun icons inside other components."},
}


# ============================================================== skeleton
def _sk(cls="skeleton--line", style=""):
    st = f' style="{style}"' if style else ""
    return f'<span class="skeleton {cls}"{st} aria-hidden="true"></span>'


def _loading(label, inner):
    return f'<div aria-busy="true" aria-live="polite" style="width: 100%;"><p class="visually-hidden">{label}</p>{inner}</div>'


_SK_ROWS = "".join(f'<div class="cluster" style="flex-wrap: nowrap;">{_sk("skeleton--circle")}<div class="stack stack--sm" style="flex: 1;">{_sk("skeleton--w66")}{_sk("skeleton--w33 skeleton--sm")}</div>{_sk("skeleton--w25")}</div>' for _ in range(3))
_SK_LIST = _loading("Loading projects", f'<div class="stack">{_sk("skeleton--title")}{_sk("skeleton--w50")}{_SK_ROWS}</div>')
_SK_INC = _loading("Loading increment 7", f'<div class="stack">{_sk("skeleton--title")}{_sk("skeleton--w50")}{_sk("skeleton--video")}</div>')
_SK_FIELD = ('<div class="field" style="width: 100%;"><span class="field__label">Product</span><div class="field__control">'
             + _sk("skeleton--btn", "width: 100%; height: var(--control-height-md);") + '</div><span class="field__hint">Loading your products…</span></div>')
_SK_TABLE = table(["Class", "Shape", "Use for"], [
    [f'{_sk("skeleton--line", "width: 6rem;")}', "<code>.skeleton--line</code>", "A line of body text (12px tall, full width)."],
    [f'{_sk("skeleton--title", "width: 6rem;")}', "<code>.skeleton--title</code>", "A heading (24px, 12rem)."],
    [f'{_sk("skeleton--sm", "width: 6rem;")}', "<code>.skeleton--sm</code>", "Caption or metadata (8px)."],
    [f'{_sk("skeleton--w50", "width: 3rem;")}', "<code>.skeleton--w75</code> <code>--w66</code> <code>--w50</code> <code>--w33</code> <code>--w25</code>", "Ragged line widths so a paragraph looks like one."],
    [f'{_sk("skeleton--btn", "width: 6rem;")}', "<code>.skeleton--btn</code>", "A small button or a control (32px)."],
    [f'{_sk("skeleton--circle")}', "<code>.skeleton--circle</code>", "An avatar or status icon (28px)."],
    [f'{_sk("skeleton--block", "width: 6rem; min-height: 3rem;")}', "<code>.skeleton--block</code>", "A card, tile body or preview (fills, at least 6rem)."],
    [f'{_sk("skeleton--video", "width: 6rem;")}', "<code>.skeleton--video</code>", "The increment video (16:9)."],
    [f'{_sk("skeleton--log", "width: 6rem; height: 3rem;")}', "<code>.skeleton--log</code>", "The run log box (26rem tall, square corners)."]])

SPECS["skeleton"] = {
    "lead": "Skeletons hold the shape of content while it loads, so the page appears at once and nothing jumps when the data arrives.",
    "readme_variants": "line, title, sm, ragged widths, button, circle, block, video, log",
    "readme_states": "loading (shimmer), reduced motion (still), loaded, timed out",
    "overview": f"""<p>Use skeletons for the first load of a page or region whose layout is known: the projects list, the pipeline, the increment, the designs list. The shell (sidebar, top bar, page header) renders for real; only the data areas are skeletons.</p>
{ul(["Short waits on one control: a " + page("components/spinner") + ".",
     "Measurable work: a " + page("components/progress-bar") + ".",
     "Load failed: replace the skeleton with an " + page("components/empty-state", "error state") + " in the same place."])}""",
    "anatomy": (_SK_LIST, [(4, 14), (4, 30), (6, 52), (40, 52)],
                [("Busy region", '<code>aria-busy="true"</code> + <code>aria-live="polite"</code> wrapper with a visually hidden label (<i>Loading projects</i>).'),
                 ("Title bar", "<code>.skeleton--title</code> where the heading will be."),
                 ("Circle", "<code>.skeleton--circle</code> where the status icon or avatar will be."),
                 ("Lines", "Ragged <code>.skeleton--w*</code> lines; every skeleton is <code>aria-hidden</code>.")]),
    "variants": f"""{_SK_TABLE}
<h3>Composed</h3>
{ex(_SK_INC, "Increment page: title, subtitle and a 16:9 video block (pages/increment/loading).", cls="ds-example__canvas--stack")}
{ex(_SK_FIELD, "A single control loading inside a form, with a hint that says what (pages/new-direction/loading).", cls="ds-example__canvas--stack")}""",
    "sizes": NA("Skeleton sizes are the shapes in Variants; each matches the element it stands in for."),
    "states": f"""{matrix(["Loading", "Reduced motion", "Loaded"], [
    ("Row", [f'<div style="width: 12rem;" class="stack stack--sm">{_sk("skeleton--w66")}{_sk("skeleton--w33 skeleton--sm")}</div>',
             f'<div style="width: 12rem;" class="stack stack--sm">{_sk("skeleton--w66", "animation: none;")}{_sk("skeleton--w33 skeleton--sm", "animation: none;")}</div>',
             '<div style="width: 12rem;"><div class="text-sm">Ledgerline</div><div class="text-caption">Increment 7 of 12</div></div>'])])}
{ul(["<b>Loading</b>: a soft highlight sweeps left to right on <code>--duration-pulse</code>.",
     "<b>Reduced motion</b>: <code>--duration-pulse</code> is 0s, so the shapes hold still.",
     "<b>Loaded</b>: content replaces the skeleton in one swap; <code>aria-busy</code> is removed and the region's heading or first item is announced politely.",
     "<b>Timed out</b>: after 10 s with no data the skeleton is replaced by the error state (<i>Ledgerline’s stages didn’t load (timeout after 10 s)</i>)."])}
{themes(_SK_LIST, stack=True)}""",
    "responsive": ul([
        "Skeletons follow the layout they stand in for: the same grid, columns and stacking at every breakpoint as the loaded content (stacked rows below lg, table columns from lg).",
        "Ragged widths are percentages, so lines scale with the column.",
        "Never show more skeleton rows than fit the first screen: 3 rows in a phone list, 6 to 8 on desktop."]),
    "theming": "<p>The base is <code>--color-bg-subtle</code> and the sweep highlight <code>--color-bg-subtle-hover</code>, both one step off the surface in each theme, so skeletons read as placeholders without drawing the eye.</p>",
    "a11y": {
        "pattern": '<p>Every skeleton is <code>aria-hidden="true"</code>. The region that is loading carries <code>aria-busy="true"</code> and <code>aria-live="polite"</code> plus a visually hidden label, so a screen reader hears <i>Loading projects</i> once and then the content when <code>aria-busy</code> is removed. See <a href="https://www.w3.org/TR/wai-aria-1.2/#aria-busy"><code>aria-busy</code></a>.</p>',
        "keys": [("None", "Skeletons are not focusable; Tab skips the loading region until it has content.")],
        "focus": "<p>If focus was inside a region that reloads, keep it on the region's heading, not on a skeleton.</p>",
        "labelling": "<p>The hidden label names what is loading: <i>Loading increment 7</i>, <i>Loading the design system</i>.</p>",
        "pairs": [("Loading hint under a skeleton", "--color-fg-subtle", "--color-bg-surface", 4.5), ("Error icon after a timeout", "--color-danger-icon", "--color-bg-canvas", 3),
                  ("Error text after a timeout", "--color-fg-muted", "--color-bg-canvas", 4.5)],
        "motion": "<p>The shimmer is a slow, low-contrast loop on <code>--duration-pulse</code> (2s), well under the three-flashes threshold; under reduced motion it stops.</p>",
        "touch": "<p>Not a target.</p>",
    },
    "content": ul(["Skeletons have no text. The hidden label says <i>Loading {thing}</i>; a visible hint under a loading control says what is coming: <i>Loading your products…</i>.",
                   "Do not put real headings inside a skeleton region unless they are final (the page <code>h1</code> may be real and visually hidden: <i>Increment 7</i>)."]),
    "dodont": [
        (_SK_INC, "Match the shape of the page that is coming.",
         _loading("Loading", f'<div class="stack">{_sk()}{_sk()}{_sk()}{_sk()}</div>'), "Four identical full-width bars for a page with a title and a video tell nothing and still shift on load."),
        (_SK_LIST, "Wrap skeletons in a busy region with a hidden label.",
         f'<div class="stack" style="width: 100%;">{_sk("skeleton--title")}<span class="skeleton skeleton--w50"></span></div>', "Skeletons without <code>aria-hidden</code> or a busy region are silent to a screen reader, then everything arrives unannounced."),
    ],
    "tokens": [("Base", "--color-bg-subtle"), ("Sweep", "--color-bg-subtle-hover"), ("Line / sm / title height", "--space-3 / --space-2 / --space-6"),
               ("Button / circle", "--control-height-sm / --control-height-xs"), ("Radius line / block", "--radius-sm / --radius-md"),
               ("Sweep loop", "--duration-pulse / --ease-linear")],
    "code": {"snippet": """<div aria-busy="true" aria-live="polite">
  <p class="visually-hidden">Loading increment 7</p>
  <span class="skeleton skeleton--title" aria-hidden="true"></span>
  <span class="skeleton skeleton--w50" aria-hidden="true"></span>
  <span class="skeleton skeleton--video" aria-hidden="true"></span>
</div>""",
             "classes": [("<code>.skeleton</code>", "Base: a 12px line with the shimmer."),
                         ("<code>--line</code> <code>--title</code> <code>--sm</code> <code>--w75…--w25</code>", "Text shapes."),
                         ("<code>--btn</code> <code>--circle</code> <code>--block</code> <code>--video</code> <code>--log</code>", "Control and media shapes."),
                         ('<code>aria-busy="true"</code> on the region', "Marks the region loading; remove it when content lands.")]},
    "sources": {"mocks": [("pages/projects/loading", "row list"), ("pages/increment/loading", "video"), ("pages/project-pipeline/loading", "log"),
                          ("pages/designs/loading", "state list and preview"), ("pages/new-direction/loading", "single control")],
                "drift": 'the raw 1.4s shimmer is now <code>--duration-pulse</code> with <code>--ease-linear</code> and stops under reduced motion; skeleton widths set inline in the mocks (<code>style="width: 20rem"</code>, <code>height: 24rem</code>) map to the width modifiers and <code>--block</code>.'},
}


# ============================================================== empty state
def _empty(ic, title, text, action="", mod="", role=""):
    cls = "empty" + (f" {mod}" if mod else "")
    r = f' role="{role}"' if role else ""
    return f'<div class="{cls}"{r} style="width: 100%;">{icon(ic)}<div><h4 class="empty__title">{title}</h4><p class="empty__text">{text}</p></div>{action}</div>'


_E_FIRST = _empty("folder-open", "No projects yet", "Describe a product in plain language. Hewn takes it from brief to merged pull requests without stopping to ask.",
                  btn("New product", "primary", "", "plus"))
_E_VIEWER = _empty("folder-open", "No projects yet", "Nothing is being built yet. When an Owner gives Hewn a direction, the project appears here and you can watch it live.")
_E_NORES = _empty("search", "No entries match these filters", "Nobody stopped all workers from Ledgerline. Stop all is recorded against All projects.",
                  '<a class="btn" href="#variants">Clear filters</a>', "empty--tight")
_E_FORBID = _empty("lock", "You don’t have access", "The audit log records who did what and from where, so only Owners can read it. Ask an Owner if you need an entry.",
                   '<a class="btn" href="#variants">Back to dashboard</a>', "empty--forbidden")
_E_ERROR = _empty("alert-triangle", "Projects couldn’t load", "The Hewn API returned 503 Service Unavailable. Your directions are still running on their workers.",
                  f'<div class="cluster">{btn("Try again", "", "", "refresh")}<a class="btn btn--ghost" href="#variants">Go to dashboard</a></div>', "empty--error", "alert")
_E_TILE = ('<section class="tile" aria-label="Needs attention" style="width: 100%; max-width: 22rem;"><div class="tile__header"><h4 class="tile__title">Needs attention</h4><span class="tile__meta">0</span></div>'
           f'<div class="tile__body"><div class="empty empty--center empty--tight">{icon("check-circle")}<div><p class="empty__title">All clear</p><p class="empty__text">Blocked stages and budget stops show up here.</p></div></div></div></section>')
_E_TILE_ERR = ('<section class="tile" aria-label="Event stream" style="width: 100%; max-width: 22rem;"><div class="tile__header"><h4 class="tile__title">Event stream</h4><span class="tile__meta">Unavailable</span></div>'
               f'<div class="tile__body"><div class="empty empty--error empty--center empty--tight" role="alert">{icon("alert-triangle")}<div><p class="empty__title">Events didn’t load</p>'
               f'<p class="empty__text">The event store timed out. Other tiles are live.</p></div>{btn("Retry", "", "sm", "refresh")}</div></div></section>')
_E_WAIT = _empty("circle-dashed", "Waiting for a worker", "The direction is queued. Stage 0 starts as soon as a worker leases it, usually within 2 seconds. Nothing to do here.", mod="empty--tight")
_E_KINDS = table(["Kind", "Icon", "Formula", "Action"], [
    ["First run", "The object's icon, subtle", "What will be here and how it gets here.", "The one action that fills it, Owners only."],
    ["Not yet (pipeline)", "The object's icon, subtle", "Which stage produces it and that it has not run yet.", "<i>Open the pipeline</i>."],
    ["No results", "<code>search</code>", "That nothing matches, and why if known.", "<i>Clear filters</i> / <i>Show all</i>."],
    ["Forbidden", "<code>lock</code>, warning", "Who can see it and why; reveal nothing else.", "A way back."],
    ["Error", "<code>alert-triangle</code>, danger", "What failed, the code, and what still works.", "<i>Try again</i> plus a way back."]])


def _ebtn(state):
    ds = f' data-state="{state}"' if state else ""
    return f'<button class="btn" type="button"{ds}>Clear filters</button>'


SPECS["empty-state"] = {
    "lead": "Empty states fill the space where a list or view would be when there is nothing to show yet, nothing matches, the person may not see it, or it failed to load.",
    "readme_variants": "first run, viewer first run, not yet (pipeline), no results, forbidden, error; tight and centred (tiles)",
    "readme_states": "empty, no results, forbidden, error; action hover, focus, busy",
    "overview": f"""<p>Every list, table, tile and project view has an empty state. It replaces the content in place, keeps the page chrome, and always explains why it is empty and what happens next. One action at most, and only one the person can take.</p>
{_E_KINDS}
<p>A whole page that cannot be shown (unknown project, server error) is an {page('components/error-page')}; a failure next to content that did load is an {page('components/alert', 'alert')}.</p>""",
    "anatomy": (_E_FIRST, [(12, 32), (29, 43), (75, 52), (31, 67)],
                [("Icon", "28px (<code>--size-icon-xl</code>), <code>--color-fg-subtle</code>; danger for errors, warning for forbidden."),
                 ("Title", "<code>.empty__title</code>: a heading at the level the content would have had (<code>h2</code> on a page, <code>h3</code> or a <code>p</code> in a tile)."),
                 ("Text", "<code>.empty__text</code>: why it is empty and what happens next; at most 28rem wide."),
                 ("Action (optional)", "One button or link; error states may add a way back.")]),
    "variants": f"""<h3>First run</h3>
{ex(_E_FIRST, "Owner: one primary action (pages/projects/empty).", cls="ds-example__canvas--stack")}
{ex(_E_VIEWER, "Viewer: the same title, no action, and text that says who can start one (pages/projects/viewer-empty).", cls="ds-example__canvas--stack")}
<h3>No results, forbidden, error</h3>
{ex(_E_NORES, "No results: <code>.empty--tight</code> with the way out (pages/audit/no-results).", cls="ds-example__canvas--stack")}
{ex(_E_FORBID, "Forbidden: <code>.empty--forbidden</code> turns the lock warning (pages/audit/forbidden).", cls="ds-example__canvas--stack")}
{ex(_E_ERROR, 'Error: <code>.empty--error</code>, <code>role="alert"</code>, retry plus a way back (pages/projects/error).', cls="ds-example__canvas--stack")}
<h3>In tiles and panels</h3>
{ex(_E_TILE + _E_TILE_ERR, "Dashboard tiles: <code>.empty--center .empty--tight</code>; the title is a <code>p</code> under the tile heading.")}
{ex(_E_WAIT, "In a panel: waiting for a worker, nothing to do (pages/project-pipeline/empty).", cls="ds-example__canvas--stack")}""",
    "sizes": f"""<p>Two densities: default (64px block padding, <code>--text-h2</code> title) for a page's main content, and tight (<code>.empty--tight</code>: 40px padding, <code>--text-h3</code> title) for tiles, panels and filtered lists.</p>
{ex(_empty("inbox", "No backlog yet", "The backlog is produced by stage 9, Estimates.") + _empty("inbox", "No backlog yet", "The backlog is produced by stage 9, Estimates.", mod="empty--tight"), "Default and tight.", cls="ds-example__canvas--stack")}""",
    "states": f"""<p>The empty state is not interactive; its action has the button states. Pointer and focus states are forced with <code>data-state</code>.</p>
{matrix(["Default", "Hover", "Focus", "Busy"], [("Action", [_ebtn(""), _ebtn("hover"), _ebtn("focus"),
                                                          f'<button class="btn" type="button" aria-busy="true" aria-disabled="true">{icon("loader")}Trying again…</button>'])])}
{ul(["<b>Retry</b> in an error state turns busy (<i>Trying again…</i>) and either loads the content or re-renders the error with the new code.",
     'Error states use <code>role="alert"</code> when they replace content after a failed request; first-run, no-results and forbidden states have no role and are read in order.'])}
{themes(_E_NORES + _E_ERROR, stack=True)}""",
    "responsive": ul([
        "Base (360px): start-aligned in the content column, icon above text, action below; text wraps at 28rem or the column, whichever is narrower.",
        "Tile variant (<code>.empty--center</code>) centres everything at every width.",
        "Error states with two actions wrap the buttons onto two lines below sm.",
        "Padding stays the same at every breakpoint so a page's empty state sits where its first row would."]),
    "theming": "<p>Title <code>--color-fg-default</code>, text <code>--color-fg-muted</code>, icon <code>--color-fg-subtle</code> (danger icon for errors, warning icon for forbidden); a hairline <code>--color-border-default</code> top edge separates it from the page header. Nothing else changes between themes.</p>",
    "a11y": {
        "pattern": '<p>No widget role. The title is a real heading at the level the missing content would have had, so heading navigation still finds the section. Error states that replace content after a failed request use <code>role="alert"</code> (<a href="https://www.w3.org/WAI/ARIA/apg/patterns/alert/">APG alert</a>). Icons are <code>aria-hidden</code>.</p>',
        "keys": [(kbd("Tab"), "Reaches the action (and the way back in error states).")],
        "focus": "<p>After <i>Clear filters</i>, focus moves to the first result or the results heading; after a successful retry, to the content's heading.</p>",
        "labelling": "<p>The title says what is missing (<i>No projects yet</i>), so it works as a heading out of context. Buttons name the action, not <i>Click here</i>.</p>",
        "pairs": [("Title on canvas", "--color-fg-default", "--color-bg-canvas", 4.5), ("Text on canvas", "--color-fg-muted", "--color-bg-canvas", 4.5),
                  ("Text in a tile", "--color-fg-muted", "--color-bg-surface", 4.5), ("Icon", "--color-fg-subtle", "--color-bg-canvas", 3),
                  ("Error icon", "--color-danger-icon", "--color-bg-canvas", 3), ("Forbidden icon", "--color-warning-icon", "--color-bg-canvas", 3)],
        "motion": "<p>None. The empty state replaces the skeleton without a transition.</p>",
        "touch": "<p>Actions are medium buttons (40px); small (32px) inside tiles.</p>",
    },
    "content": ul(["Title: what is missing, plainly: <i>No projects yet</i>, <i>No entries match these filters</i>, <i>You don’t have access</i>, <i>Projects couldn’t load</i>.",
                   "Text: why, and what happens next. For pipeline outputs name the stage: <i>The backlog is produced by stage 9, Estimates.</i>",
                   "Errors give the code and reassure: <i>The Hewn API returned 503 Service Unavailable. Your directions are still running on their workers.</i>",
                   "Forbidden reveals nothing beyond who can see it: <i>only Owners can read it</i>.",
                   "If nothing needs doing, say so: <i>Nothing to do here.</i>"]),
    "dodont": [
        (_E_VIEWER, "A Viewer gets the explanation without an action they cannot take.",
         _empty("folder-open", "No projects yet", "Describe a product in plain language.", f'<button class="btn btn--primary" type="button" disabled>{icon("plus")}New product</button>'),
         "A disabled <i>New product</i> button invites a click that cannot work (L2-002 AC3)."),
        (_E_FORBID, "Use <code>.empty--forbidden</code> for no-access, with a way back.",
         '<div class="stack" style="align-items: flex-start; width: 100%;">' + icon("lock", "icon--xl text-subtle") + '<h3>You don’t have permission</h3><p class="text-sm text-muted">Viewers can watch every project but can’t give direction.</p></div>',
         "pages/new-direction/forbidden hand-builds the same thing from a stack and inline styles, without the warning tone or the hairline."),
        (_E_NORES, "No results says what was searched and offers the reset.",
         _empty("search", "No results", "Try again."), "<i>No results. Try again.</i> does not say which filters to change."),
    ],
    "tokens": [("Title default / tight", "--text-h2 / --text-h3"), ("Text", "--text-body-sm / --color-fg-muted"), ("Icon", "--size-icon-xl / --color-fg-subtle"),
               ("Error / forbidden icon", "--color-danger-icon / --color-warning-icon"), ("Top edge", "--color-border-default"),
               ("Padding default / tight", "--space-16 / --space-10"), ("Gap", "--space-4")],
    "code": {"snippet": """<div class="empty">
  <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">…</svg>
  <div><h2 class="empty__title">No projects yet</h2>
    <p class="empty__text">Describe a product in plain language. Hewn takes it from brief to merged pull requests without stopping to ask.</p></div>
  <a class="btn btn--primary" href="/new">…New product</a>
</div>

<div class="empty empty--error" role="alert">… <div class="cluster"><button class="btn" type="button">…Try again</button> …</div></div>""",
             "classes": [("<code>.empty</code>", "Start-aligned, 64px padding, hairline top."), ("<code>.empty__title</code> <code>.empty__text</code>", "Heading and explanation."),
                         ("<code>.empty--tight</code>", "40px padding, h3-size title."), ("<code>.empty--center</code>", "Centred, no top edge (tiles)."),
                         ("<code>.empty--error</code> <code>.empty--forbidden</code>", "Danger or warning icon.")]},
    "sources": {"mocks": [("pages/projects/empty", "first run, Owner"), ("pages/projects/viewer-empty", "first run, Viewer"), ("pages/audit/no-results", "no results"),
                          ("pages/audit/forbidden", "forbidden"), ("pages/projects/error", "error"), ("pages/dashboard/empty", "tile empty states"),
                          ("pages/dashboard/partial", "tile error"), ("pages/backlog/empty", "not yet (stage 9)"), ("pages/project-pipeline/empty", "waiting for a worker")],
                "drift": 'compact titles restyled inline (<code>style="font: var(--text-h3)"</code>) in 59 mocks are now <code>.empty--tight</code>. pages/audit/forbidden uses plain <code>.empty</code> with a subtle lock, and pages/new-direction/forbidden a hand-built stack; both should be <code>.empty--forbidden</code>.'},
}


# ============================================================== error page
def _errpage(code_line, title, text, actions, ref=""):
    r = f'<p class="errpage__ref">{ref}</p>' if ref else ""
    return (f'<div class="errpage" style="width: 100%; min-height: 0; padding-block: var(--space-10);"><div class="errpage__inner"><p class="errpage__code">{code_line}</p>'
            f'<h4 style="margin-top: var(--space-2); font: var(--text-h1); letter-spacing: var(--letter-spacing-tight);">{title}</h4><p>{text}</p>'
            f'<div class="cluster">{actions}</div>{r}</div></div>')


_EP_404 = _errpage("404", "That project isn’t here", "It may have been deleted, or it belongs to a Hewn you can’t see. Nothing about other projects is shown on purpose.",
                   '<a class="btn btn--primary" href="#variants">Go to projects</a><a class="btn btn--ghost" href="#variants">Dashboard</a>')
_EP_500 = _errpage("500 · ref 7c2e-91af", "Mission Control hit a problem",
                   "The page couldn’t be built. Your directions keep running on their workers; this only affects what you can see. Try again, or share the reference with whoever runs this Hewn.",
                   btn("Try again", "primary", "", "refresh") + '<a class="btn btn--ghost" href="#variants">Dashboard</a>')
_EP_403 = _errpage("403", "You don’t have permission", "Viewers can watch every project but can’t give direction. Ask an Owner to change your role.",
                   '<a class="btn" href="#variants">Back to projects</a>')
_EP_500_BUSY = _errpage("500 · ref 7c2e-91af", "Mission Control hit a problem", "The page couldn’t be built. Your directions keep running on their workers.",
                        f'<button class="btn btn--primary" type="button" aria-busy="true" aria-disabled="true">{icon("loader")}Trying again…</button><a class="btn btn--ghost" href="#states">Dashboard</a>')
_EP_SHELL = ('<div class="shell" style="min-height: 0; width: 100%; box-shadow: inset 0 0 0 var(--border-width-hairline) var(--color-border-default); border-radius: var(--radius-md); overflow: hidden;">'
             '<div class="shell__sidebar" style="display: block; width: 25%; min-height: 12rem;" aria-hidden="true"><div class="stack stack--sm" style="padding: var(--space-4);">'
             '<span class="skeleton skeleton--w66" style="animation: none;"></span><span class="skeleton skeleton--w50" style="animation: none;"></span><span class="skeleton skeleton--w75" style="animation: none;"></span></div></div>'
             f'<div class="shell__body">{_errpage("404", "That project isn’t here", "Nothing about other projects is shown on purpose.", chr(32))}</div></div>')

SPECS["error-page"] = {
    "lead": "Error pages replace a page that cannot be shown (a project that does not exist or cannot be seen, a server failure) while keeping the app shell so people can carry on.",
    "readme_variants": "404 not found, 500 server error (with reference), 403 forbidden",
    "readme_states": "default, retrying (busy)",
    "overview": f"""<p>Use an error page only when the whole page cannot render. The sidebar and top bar stay, so navigation still works; the error takes the main area. When part of a page fails, use an {page('components/empty-state', 'error state')} in that part; when an action fails, an {page('components/alert', 'alert')}.</p>
{ul(["<b>404</b>: the project or page does not exist, or belongs to a Hewn the person cannot see. The copy is the same in both cases, so it reveals nothing (L2-039).",
     "<b>500</b>: the server failed to build the page. Show a reference for support and reassure that directions keep running.",
     "<b>403</b>: the person is signed in but their role cannot use this page (a Viewer opening New direction)."])}
{ex(_EP_SHELL, "The error fills the main area; the shell around it is unchanged.", cls="ds-example__canvas--stack")}""",
    "anatomy": (_EP_500, [(8, 28), (8, 38), (8, 52), (8, 73)],
                [("Code", "<code>.errpage__code</code>: status code and, for 500, the reference, in mono, subtle."),
                 ("Title", "The page <code>h1</code>: what happened, in plain words."),
                 ("Text", "Why, what still works, what to do."),
                 ("Actions", "A primary way forward (<i>Try again</i>, <i>Go to projects</i>) and a ghost way back (<i>Dashboard</i>).")]),
    "variants": f"""{ex(_EP_404, "404 (pages/not-found/default).", cls="ds-example__canvas--stack")}
{ex(_EP_500, "500 with reference (pages/server-error/default).", cls="ds-example__canvas--stack")}
{ex(_EP_403, "403 for a role that cannot use the page (copy from pages/new-direction/forbidden).", cls="ds-example__canvas--stack")}""",
    "sizes": NA("One size: the inner column is at most 30rem and the page centres it in the main area."),
    "states": f"""<p>The page itself is static; its buttons have the button states. <i>Try again</i> turns busy while it reloads.</p>
{matrix(["Default", "Hover", "Focus", "Busy"], [("Try again", [btn("Try again", "primary", "", "refresh"), btn("Try again", "primary", "", "refresh", attrs='data-state="hover"'),
                                                             btn("Try again", "primary", "", "refresh", attrs='data-state="focus"'),
                                                             f'<button class="btn btn--primary" type="button" aria-busy="true" aria-disabled="true">{icon("loader")}Trying again…</button>'])])}
{ex(_EP_500_BUSY, "Retrying: the button keeps focus; on a second failure the page re-renders with a new reference.", cls="ds-example__canvas--stack")}
{themes(_EP_404, stack=True)}""",
    "responsive": ul([
        "Base (360px): the content is centred in the main area with 32px top and bottom and 16px side padding; buttons wrap onto two lines if needed.",
        "From lg the sidebar returns beside it; the error stays centred in the main area, at least 70% of the viewport tall so it does not sit at the top of an empty screen.",
        "The inner column never exceeds 30rem, so lines stay readable on wide screens."]),
    "theming": "<p>Error pages use only the canvas and text tokens: <code>--color-fg-default</code> title, <code>--color-fg-muted</code> text, <code>--color-fg-subtle</code> code and reference. No danger colour: a missing page is not an alarm, and the copy carries the meaning.</p>",
    "a11y": {
        "pattern": '<p>A normal page: <code>&lt;main&gt;</code> with one <code>h1</code>, and the HTTP status set for real (404, 500, 403) so assistive tech, crawlers and tests see it. The document <code>&lt;title&gt;</code> starts with the problem: <i>Not found — Hewn</i>. On client-side navigation to an error page, focus moves to the <code>h1</code>. See <a href="https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html">2.4.2 Page titled</a>.</p>',
        "keys": [(kbd("Tab"), "Skip link, shell navigation, then the error page's actions."),
                 (kbd("Enter"), "Follows the primary link or activates Try again.")],
        "focus": '<p>Focus lands on the <code>h1</code> (with <code>tabindex="-1"</code>) after a client-side route change; on a full page load it starts at the skip link as usual. Retrying keeps focus on the button.</p>',
        "labelling": "<p>The title says what happened (<i>That project isn’t here</i>), not the code alone. The reference is selectable text so it can be copied.</p>",
        "pairs": [("Title", "--color-fg-default", "--color-bg-canvas", 4.5), ("Text", "--color-fg-muted", "--color-bg-canvas", 4.5),
                  ("Code and reference", "--color-fg-subtle", "--color-bg-canvas", 4.5), ("Primary action", "--color-fg-on-accent", "--color-accent", 4.5),
                  ("Focus ring", "--color-focus-ring", "--color-bg-canvas", 3)],
        "motion": "<p>None, apart from the busy button's spinner, which stops under reduced motion.</p>",
        "touch": "<p>Medium buttons (40px) with 8px between them.</p>",
    },
    "content": ul(["Title: what happened, in the person's terms: <i>That project isn’t here</i>, <i>Mission Control hit a problem</i>, <i>You don’t have permission</i>.",
                   "Reassure about running work: <i>Your directions keep running on their workers; this only affects what you can see.</i>",
                   "404 copy is identical whether the project was deleted or belongs to someone else.",
                   "500 shows a short reference: <i>500 · ref 7c2e-91af</i>, and says who to give it to.",
                   "Actions: one way forward, one way back. No <i>Go home</i>; name the place: <i>Dashboard</i>."]),
    "dodont": [
        (_EP_404, "Reveal nothing about projects the person cannot see.",
         _errpage("404", "Harbor CRM was deleted", "quinntynebrown deleted it on 8 Nov.", '<a class="btn" href="#do-dont">Go to projects</a>'),
         "Saying a project was deleted, or by whom, confirms it existed to someone who may never have had access (L2-039)."),
        (_EP_500, "Give a reference and say what still works.",
         _errpage("500", "Internal Server Error", "An error occurred.", '<a class="btn" href="#do-dont">Reload</a>'), "A raw status phrase with no reference leaves support nothing to search and the Owner worried about their runs."),
    ],
    "tokens": [("Code, reference", "--text-code / --color-fg-subtle"), ("Title", "--text-h1"), ("Text", "--text-body-sm / --color-fg-muted"),
               ("Padding", "--space-8 / --space-4"), ("Title gap / text gap", "--space-2 / --space-3"), ("Actions gap", "--space-6")],
    "code": {"snippet": """<main id="main" class="shell__main">
  <div class="errpage"><div class="errpage__inner">
    <p class="errpage__code">500 · ref 7c2e-91af</p>
    <h1 tabindex="-1">Mission Control hit a problem</h1>
    <p>The page couldn’t be built. Your directions keep running on their workers; … share the reference with whoever runs this Hewn.</p>
    <div class="cluster">
      <button class="btn btn--primary" type="button">…Try again</button>
      <a class="btn btn--ghost" href="/">Dashboard</a>
    </div>
  </div></div>
</main>""",
             "classes": [("<code>.errpage</code>", "Centres the content in the main area, at least 70dvh tall."),
                         ("<code>.errpage__inner</code>", "30rem column."), ("<code>.errpage__code</code>", "Status code (and reference) line."),
                         ("<code>.errpage__ref</code>", "Optional separate reference line under the actions.")]},
    "sources": {"mocks": [("pages/not-found/default", "404"), ("pages/server-error/default", "500 with reference"), ("pages/new-direction/forbidden", "403 copy")],
                "drift": "none in the 404 and 500 pages; the 403 case (pages/new-direction/forbidden) is hand-built with inline styles and is documented here as an error page variant. <code>.errpage__inner</code> is 30rem, close to but not on <code>--layout-measure</code>."},
}
