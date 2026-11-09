"""Dialog and notification mocks, each shown over or on the page it opens from."""
from __future__ import annotations

import re

import pages as P
from common import btn, dialog, icon, page_link, sidebar, toast, toast_region

NOTE_RE = re.compile(r'<p class="mock-note".*?</p>', re.S)


def page_behind(fn, state="default"):
    body, _ = fn(state)
    return NOTE_RE.sub("", body)


def behind_inert(fn, state="default"):
    return f'<div inert aria-hidden="true">{page_behind(fn, state)}</div>'


def cancel_link(page, state="default", label="Cancel"):
    return f'<a class="btn btn--ghost" href="{page_link(page, state)}">{label}</a>'


def failed_callout(title, text):
    return (f'<div class="callout callout--danger" role="alert">{icon("alert-triangle", "icon--lg")}'
            f'<div><p class="callout__title">{title}</p><p class="callout__body">{text}</p></div></div>')


def busy_btn(label, variant="primary"):
    return btn(label, variant, busy=True, disabled=True)


# ---------------------------------------------------------------------------
# Dialogs: (opens_from page fn, page state, title, builder(state) -> (dialog_html, desc))
# ---------------------------------------------------------------------------
def stop_workers(state):
    busy = state == "busy"
    body = ""
    if state == "failed":
        body = failed_callout("1 worker didn’t confirm", "hewn-cloud-eus-01 didn’t acknowledge within 10 s. The others stopped. Leasing is off, so it can’t pick up new work; try again to stop it.")
    body += ('<ul class="mini-list mt-4"><li>' + icon("loader", "icon--xs s-icon--run") + '<span class="mono">quinn-mbp.local</span><span class="text-subtle">Ledgerline</span></li>'
             '<li>' + icon("loader", "icon--xs s-icon--run") + '<span class="mono">hewn-cloud-eus-01</span><span class="text-subtle">Tidewater</span></li>'
             '<li>' + icon("circle-dot", "icon--xs s-icon--idle") + '<span class="mono">hewn-cloud-eus-02</span><span class="text-subtle">Idle</span></li></ul>')
    primary = busy_btn("Stopping 3 workers…", "danger") if busy else btn("Try again" if state == "failed" else "Stop all workers", "danger", "", "octagon-x", href=page_link("dashboard", "stopped"))
    html = dialog("Stop all workers?", "All 3 online workers halt their active runs within 10 seconds and stop leasing. Ledgerline and Tidewater keep their last checkpoints and resume from them when you start workers again.",
                  body, cancel_link("dashboard") + primary, alert=True)
    return html, {"default": "Confirm stopping every worker; lists what is running.", "busy": "Stopping; waiting for each worker to checkpoint.",
                  "failed": "One worker didn’t confirm; retry."}[state]


def cancel_direction(state):
    body = ""
    if state == "failed":
        body = failed_callout("Cancel didn’t reach the worker", "quinn-mbp.local stopped answering. The lease expires in 60 s and the run won’t resume; try again to cancel now.")
    primary = busy_btn("Cancelling…", "danger") if state == "busy" else btn("Try again" if state == "failed" else "Cancel direction", "danger", "", "square", href=page_link("projects"))
    html = dialog("Cancel Ledgerline’s direction?", "The active run stops within 10 seconds and the direction can’t be resumed. Six merged increments stay merged; any open pull request is left open and labelled hewn:cancelled.",
                  body, cancel_link("project-pipeline", label="Keep running") + primary, alert=True)
    return html, {"default": "Confirm cancelling the active direction.", "busy": "Cancelling the run.", "failed": "The worker didn’t confirm."}[state]


def delete_project(state):
    typed = {"confirm": "Harbor CRM", "busy": "Harbor CRM", "invalid": "Harbor"}.get(state, "")
    err = "Type Harbor CRM exactly to delete it." if state == "invalid" else ""
    field = P._field("confirm-name", "Type <strong>Harbor CRM</strong> to confirm",
                     f'<input class="input" id="confirm-name" autocomplete="off" value="{typed}"'
                     f'{" aria-invalid=" + chr(34) + "true" + chr(34) + " aria-describedby=" + chr(34) + "confirm-name-err" + chr(34) if err else " aria-describedby=" + chr(34) + "confirm-name-hint" + chr(34)}{" readonly" if state == "busy" else ""}>',
                     "The GitHub repository is kept; only Hewn’s record is deleted.", err)
    body = (failed_callout("Harbor CRM wasn’t deleted", "The API returned 503. Nothing was removed; try again.") if state == "failed" else "") + f'<div class="dialog__body">{field}</div>'
    if state == "busy":
        primary = busy_btn("Deleting…", "danger")
    elif state in ("confirm", "failed"):
        primary = btn("Try again" if state == "failed" else "Delete project", "danger", "", "trash", href=page_link("projects"))
    else:
        primary = btn("Delete project", "danger", "", "trash", disabled=True)
    html = dialog("Delete Harbor CRM?", "Its directions, runs, decisions, events and spend history are deleted from Hewn. This can’t be undone.", body,
                  cancel_link("projects") + primary, alert=True)
    return html, {"default": "Type the name to enable Delete.", "confirm": "Name matches; Delete enabled.", "busy": "Deleting.",
                  "invalid": "Name doesn’t match.", "failed": "Delete failed; nothing removed."}[state]


def raise_budget(state):
    val = {"invalid": "200.00"}.get(state, "350.00")
    err = "New budget must be more than the $250.00 already spent." if state == "invalid" else ""
    field = P._field("new-budget", "New budget",
                     f'<div class="prefix prefix--money"><span class="prefix__sym" aria-hidden="true">$</span><input class="input" id="new-budget" inputmode="decimal" value="{val}"'
                     f'{" aria-invalid=" + chr(34) + "true" + chr(34) + " aria-describedby=" + chr(34) + "new-budget-err" + chr(34) if err else " aria-describedby=" + chr(34) + "new-budget-hint" + chr(34)}{" readonly" if state == "busy" else ""}></div>',
                     "Warns again at 80%. $250.00 spent so far.", err)
    body = (failed_callout("The budget wasn’t changed", "The API returned 409: another session changed this budget a moment ago. Reload it and try again.") if state == "failed" else "") + f'<div class="dialog__body">{field}</div>'
    primary = busy_btn("Saving…") if state == "busy" else btn("Raise and resume", "primary", "", "play", href=page_link("project-pipeline"))
    html = dialog("Raise Kiln Booking’s budget", "The direction resumes from checkpoint 4c1e0b2 as soon as the new budget is saved.", body,
                  cancel_link("project-pipeline", "budget-reached") + primary)
    return html, {"default": "Enter a new budget and resume.", "busy": "Saving the budget.", "invalid": "Below what is already spent.",
                  "failed": "Conflict: changed elsewhere."}[state]


TOKEN = "hwt_live_8Qm2vR7xKc4pZ1nLw9sTj3dYf6aB0eHg"


def worker_token(state):
    if state == "success":
        body = (f'<div class="callout callout--ok" role="status">{icon("check-circle", "icon--lg")}<div><p class="callout__title">Token created for hewn-cloud-eus-03</p>'
                '<p class="callout__body">Copy it now. Hewn stores only a hash and can’t show it again.</p></div></div>'
                f'<div class="dialog__body"><p class="field__label">Token</p><div class="codebox mt-2"><code class="mono">{TOKEN}</code>'
                f'<button class="btn btn--ghost btn--icon btn--sm" type="button" aria-label="Copy token">{icon("copy", "icon--sm")}</button></div>'
                '<p class="field__label mt-4">Start the worker</p><pre class="pre mt-2">docker run -d --name hewn-worker \\\n  -e HEWN_API_URL=https://hewn.quinntyne.dev \\\n'
                f'  -e HEWN_WORKER_TOKEN={TOKEN} \\\n  ghcr.io/quinntynebrown/hewn-worker:0.9.2</pre>'
                '<p class="text-caption mt-2">Outbound HTTPS only; the worker needs no inbound ports.</p></div>')
        html = dialog("New worker token", "Paste the command on the machine that will run the worker.", body, f'<a class="btn btn--primary" href="{page_link("workers")}">Done</a>', lg=True)
        return html, "Token shown once with the docker command."
    invalid = state == "invalid"
    name_err = "Worker name must be 3–40 lowercase letters, digits or hyphens." if invalid else ""
    ro = " readonly" if state == "busy" else ""
    name = P._field("worker-name", "Worker name",
                    f'<input class="input mono" id="worker-name" autocomplete="off" value="{"Cloud 03!" if invalid else "hewn-cloud-eus-03"}"'
                    f'{" aria-invalid=" + chr(34) + "true" + chr(34) + " aria-describedby=" + chr(34) + "worker-name-err" + chr(34) if invalid else " aria-describedby=" + chr(34) + "worker-name-hint" + chr(34)}{ro}>',
                    "Shown on the Workers page and in the audit log.", name_err)
    loc = ('<fieldset class="field" style="border:0; padding:0; margin:0"><legend class="field__label">Location</legend><div class="cluster mt-2">'
           f'<label class="choice"><input type="radio" name="loc"{" disabled" if ro else ""}><span>{icon("laptop", "icon--sm")}</span><span>Local<small>Your machine</small></span></label>'
           f'<label class="choice"><input type="radio" name="loc" checked{" disabled" if ro else ""}><span>{icon("cloud", "icon--sm")}</span><span>Cloud<small>A VM or container host</small></span></label></div></fieldset>')
    expiry = P._field("expiry", "Expires", f'<select class="select" id="expiry"{" disabled" if ro else ""}><option>In 90 days</option><option>In 30 days</option><option>In 1 year</option></select>')
    body = (failed_callout("The token wasn’t created", "The secret store didn’t answer (timeout). Nothing was saved; try again.") if state == "failed" else "")
    body += f'<div class="dialog__body stack" style="gap: var(--space-5)">{name}{loc}{expiry}</div>'
    primary = busy_btn("Creating token…") if state == "busy" else btn("Create token", "primary", "", "key", href="success.html")
    html = dialog("New worker token", "A token lets one worker register and lease runs. Revoke it any time from Workers.", body, cancel_link("workers") + primary)
    return html, {"default": "Name, location and expiry for a new token.", "busy": "Creating the token.", "invalid": "Invalid worker name.",
                  "failed": "Secret store timeout."}[state]


def revoke_worker(state):
    body = failed_callout("The token is still active", "The API returned 500. build-box-02 can still register; try again.") if state == "failed" else ""
    primary = busy_btn("Revoking…", "danger") if state == "busy" else btn("Try again" if state == "failed" else "Revoke token", "danger", "", "x-circle", href=page_link("workers"))
    html = dialog("Revoke build-box-02?", "Its token stops working immediately. If it is running a step, the lease is released and the run resumes on another worker from its last checkpoint.",
                  body, cancel_link("workers") + primary, alert=True)
    return html, {"default": "Confirm revoking a worker’s token.", "busy": "Revoking.", "failed": "Revoke failed; token still active."}[state]


def update_skills(state):
    commits = [("3e1a9f0", "writing-html-mocks: require a bottom sheet under 640 px"), ("b72c4d1", "estimating-designs: 3-day descope threshold by default"),
               ("90fe215", "implementing-incrementally: record red before green"), ("4d0b8aa", "grilling: answer for the user when running unattended")]
    lis = "".join(f'<li><span class="mono text-subtle">{sha}</span><span class="truncate">{m}</span></li>' for sha, m in commits)
    body = (failed_callout("Skills weren’t updated", "Greenlit couldn’t be fetched (GitHub returned 502). Ledgerline keeps running on the skills it has.") if state == "failed" else "")
    body += f'<div class="dialog__body"><p class="field__label">Greenlit · 4 commits since 91c0b4e</p><ul class="mini-list mt-2">{lis}</ul></div>'
    primary = busy_btn("Updating skills…") if state == "busy" else btn("Try again" if state == "failed" else "Update skills", "primary", "", "refresh", href=page_link("project-pipeline"))
    html = dialog("Update Ledgerline’s skills?", "Hewn opens a pull request that updates the skill files and .hewn/skills.lock, and merges it automatically when checks pass. The running increment finishes on the current skills.",
                  body, cancel_link("project-pipeline", label="Not now") + primary, lg=True)
    return html, {"default": "Review the 4 new Greenlit commits.", "busy": "Copying skills.", "failed": "Greenlit fetch failed."}[state]


def add_user(state):
    invalid = state == "invalid"
    err = "@nadia-k is already on the allow list." if invalid else ""
    ro = " readonly" if state == "busy" else ""
    login = P._field("login", "GitHub login",
                     f'<div class="prefix"><span class="prefix__sym" aria-hidden="true">@</span><input class="input" id="login" autocomplete="off" value="nadia-k"'
                     f'{" aria-invalid=" + chr(34) + "true" + chr(34) + " aria-describedby=" + chr(34) + "login-err" + chr(34) if invalid else " aria-describedby=" + chr(34) + "login-hint" + chr(34)}{ro}></div>',
                     "They sign in with this GitHub account.", err)
    role = ('<fieldset class="field" style="border:0; padding:0; margin:0"><legend class="field__label">Role</legend><div class="stack mt-2">'
            f'<label class="choice"><input type="radio" name="role" checked{" disabled" if ro else ""}><span>{icon("users", "icon--sm")}</span><span>Viewer<small>Watches every project</small></span></label>'
            f'<label class="choice"><input type="radio" name="role"{" disabled" if ro else ""}><span>{icon("key", "icon--sm")}</span><span>Owner<small>Gives direction, stops work, manages access</small></span></label></div></fieldset>')
    body = (failed_callout("@nadia-k wasn’t added", "GitHub couldn’t confirm the login exists (rate limited). Try again in a minute.") if state == "failed" else "")
    body += f'<div class="dialog__body stack" style="gap: var(--space-5)">{login}{role}</div>'
    primary = busy_btn("Adding…") if state == "busy" else btn("Add to allow list", "primary", "", "plus", href=page_link("settings"))
    html = dialog("Add a GitHub login", "They can sign in as soon as they’re added.", body, cancel_link("settings") + primary)
    return html, {"default": "Login and role.", "busy": "Adding.", "invalid": "Already on the list.", "failed": "GitHub check failed."}[state]


def mobile_nav(state):
    html = (f'<div class="backdrop"></div><div class="drawer" role="dialog" aria-modal="true" aria-label="Menu" data-dismiss-on-escape>'
            f'<a class="btn btn--ghost btn--icon btn--touch drawer__close" href="{page_link("dashboard")}" aria-label="Close menu">{icon("x", "icon--lg")}</a>'
            f'{sidebar("dashboard", drawer=True)}</div>')
    return html, "Navigation drawer below 1024 px; focus starts on Close."


DIALOGS = {
    "stop-workers": (P.dashboard, "default", stop_workers),
    "cancel-direction": (P.project_pipeline, "default", cancel_direction),
    "delete-project": (P.projects, "default", delete_project),
    "raise-budget": (P.project_pipeline, "budget-reached", raise_budget),
    "worker-token": (P.workers, "default", worker_token),
    "revoke-worker": (P.workers, "default", revoke_worker),
    "update-skills": (P.project_pipeline, "default", update_skills),
    "add-user": (P.settings, "default", add_user),
    "mobile-nav": (P.dashboard, "default", mobile_nav),
}


def render_dialog(sid, state):
    fn, pstate, builder = DIALOGS[sid]
    html, desc = builder(state)
    return behind_inert(fn, pstate) + html, desc


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------
TOASTS = {
    "info": ("info", "info", "Tidewater started stage 3", "Design system · extracting tokens from 46 mocks", ""),
    "success": ("ok", "git-merge", "Ledgerline #27 merged", "Split a transaction · 62% complete", ""),
    "warning": ("warn", "alert-triangle", "Kiln Booking at 80% of budget", "$200.00 of $250.00. It pauses at $250.00.", ""),
    "danger": ("danger", "x-circle", "Parcel Post is blocked", "Requirements failed after 3 retries.", ""),
}


def live_toast(state):
    if state == "stacked":
        inner = "".join(toast(*TOASTS[k][:4]) for k in ("success", "info", "warning")) + '<p class="text-caption" style="text-align:right">+2 more in the event stream</p>'
        desc = "Three toasts stacked, newest on top, older ones capped."
    elif state == "with-action":
        acts = f'<a class="toast__action" href="{page_link("project-pipeline", "blocked")}">Open log</a><button class="toast__action" type="button">Retry stage</button>'
        inner = toast("danger", "x-circle", "Parcel Post is blocked", "Requirements failed after 3 retries. Other projects keep running.", acts, alert=True)
        desc = "A blocked toast with actions; it stays until dismissed."
    else:
        tone, ic, t, x, _ = TOASTS[state]
        inner = toast(tone, ic, t, x, progress=state in ("info", "success"), alert=state == "danger")
        desc = {"info": "Stage started; dismisses after 5 s.", "success": "PR merged; dismisses after 5 s.",
                "warning": "Budget at 80%; stays 10 s.", "danger": "Direction blocked; stays until dismissed."}[state]
    body = page_behind(P.dashboard) + toast_region(inner)
    return body, desc


CONN = {
    "info": ("info", "loader", "icon--spin", "Connecting to Mission Control… live updates start in a moment.", ""),
    "success": ("ok", "check-circle", "", "Reconnected. Caught up 14 missed events, #48,200 to #48,213.", ""),
    "warning": ("warn", "refresh", "icon--spin", "Reconnecting… next attempt in 10 s. Missed events will catch up from #48,213.", ""),
    "danger": ("danger", "wifi-off", "", "Connection lost. Retrying every 30 s; agents keep working and nothing is lost.", "retry"),
}


def _with_strip(body, strip):
    return body.replace("</header>\n", "</header>\n" + strip, 1)


def connection_banner(state):
    tone, ic, cls, text, extra = CONN[state]
    role = "alert" if tone == "danger" else "status"
    act = btn("Retry now", "", "sm", "refresh") if extra else ""
    strip = f'<div class="strip strip--{tone}" role="{role}">{icon(ic, ("icon--sm " + cls).strip())}<span class="strip__text">{text}</span>{act}</div>'
    desc = {"info": "First connection after load.", "success": "Reconnected and caught up; fades after 4 s.",
            "warning": "Reconnecting with backoff.", "danger": "Gave up fast retries; manual retry offered."}[state]
    return _with_strip(page_behind(P.dashboard), strip), desc


SYS = {
    "info": ("info", "refresh", "Greenlit has 4 new skill commits. Each project updates when you choose.", ("Review", "update-skills")),
    "success": ("ok", "play", "Workers started. 3 of 4 are leasing again; Ledgerline and Tidewater resumed from their checkpoints.", None),
    "warning": ("warn", "octagon-x", "All workers stopped by quinntynebrown at 08:30. Nothing new will be leased until you start them again.", None),
    "danger": ("danger", "shield-alert", "GitHub App credentials are invalid. Pull requests can’t be opened or merged until an Owner reconnects the app in Settings.", ("Open settings", None)),
}


def system_banner(state):
    tone, ic, text, action = SYS[state]
    role = "alert" if tone == "danger" else "status"
    act = ""
    if action:
        href = f"../../dialogs/{action[1]}/default.html" if action[1] else page_link("settings")
        act = f'<a class="btn btn--sm" href="{href}">{action[0]}</a>'
    strip = f'<div class="strip strip--{tone}" role="{role}">{icon(ic, "icon--sm")}<span class="strip__text">{text}</span>{act}</div>'
    desc = {"info": "Skills update available.", "success": "Workers started again.", "warning": "Workers stopped; persists until started.",
            "danger": "GitHub App credentials invalid; persists until fixed."}[state]
    return _with_strip(page_behind(P.dashboard), strip), desc


NOTIFICATIONS = {"live-toast": live_toast, "connection-banner": connection_banner, "system-banner": system_banner}
