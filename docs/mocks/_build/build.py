#!/usr/bin/env python3
"""Generate docs/mocks/manifest.json and every mock file from the screen table below.

Run from anywhere:  python3 docs/mocks/_build/build.py
Then:               python3 .claude/skills/writing-html-mocks/scripts/check_mocks.py docs/mocks --write
"""
from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import overlays as O  # noqa: E402
import pages as P  # noqa: E402
from common import document  # noqa: E402

ROOT = HERE.parent
MP_PROTOTYPE = "https://www.magicpatterns.com/os/c9upyFcFm8ZTUr3n843kZW/nnp7cA6QUJvTQVHAsYuTNL"
# Screens that exist as frames in the Magic Patterns prototype "Mission Control" (README). Everything else is
# derived from those frames' components and is listed in README "Open questions" to go back into Magic Patterns.
MP_FRAMES = {"sign-in", "dashboard", "projects", "new-direction", "project-pipeline", "backlog", "increment", "designs",
             "decisions", "artifacts", "traceability", "workers", "audit"}


def mp(sid):
    if sid in MP_FRAMES:
        return {"magic_patterns_url": MP_PROTOTYPE}
    return {"magic_patterns_url": None, "magic_patterns_note": "Derived from the prototype's components; not yet a Magic Patterns frame."}
NA_EMPTY_ONE = "Shows a single record, never a collection."

PAGES = [
    ("sign-in", "Sign in", "/sign-in", P.sign_in, ["L2-038", "L2-046", "L2-047", "L2-048"],
     ["default", "loading", "error", "denied", "expired", "signed-out"], {"empty": "A sign-in form has no collection to be empty."}),
    ("dashboard", "Dashboard", "/", P.dashboard, ["L2-030", "L2-031", "L2-032", "L2-029", "L2-052", "L2-046"],
     ["default", "loading", "empty", "error", "partial", "edit", "reconnecting", "stopped", "viewer"], {}),
    ("projects", "Projects", "/projects", P.projects, ["L2-001", "L2-002", "L2-003", "L2-039"],
     ["default", "loading", "empty", "error", "filtered", "no-results", "archived", "viewer", "viewer-empty"], {}),
    ("new-direction", "New direction", "/projects/new", P.new_direction, ["L2-001", "L2-005", "L2-009", "L2-053", "L2-028", "L2-043"],
     ["default", "feature", "loading", "error", "invalid", "repo-no-access", "submitting", "rate-limited", "forbidden"], {"empty": "A form always starts with its defaults; there is no collection."}),
    ("project-pipeline", "Project pipeline", "/projects/:id", P.project_pipeline, ["L2-004", "L2-005", "L2-006", "L2-008", "L2-029", "L2-030", "L2-033", "L2-053"],
     ["default", "loading", "empty", "error", "blocked", "budget-reached", "paused", "cancelled", "complete", "past-stage", "feature-direction", "runs", "queued-direction", "log-scrolled", "viewer", "offline"], {}),
    ("backlog", "Backlog", "/projects/:id/backlog", P.backlog, ["L2-018", "L2-019", "L2-020"],
     ["default", "loading", "empty", "error", "blocked-increment"], {}),
    ("increment", "Increment", "/projects/:id/increments/:n", P.increment, ["L2-021", "L2-022", "L2-023", "L2-024", "L2-025"],
     ["default", "loading", "error", "implementing", "merged", "video-failed", "blocked", "green-first"], {"empty": NA_EMPTY_ONE}),
    ("designs", "Designs", "/projects/:id/designs", P.designs, ["L2-010", "L2-011"],
     ["default", "loading", "empty", "error", "xs-dark"], {}),
    ("design-system", "Design system", "/projects/:id/design-system", P.design_system, ["L2-012", "L2-011"],
     ["default", "loading", "empty", "error"], {}),
    ("decisions", "Decisions", "/projects/:id/decisions", P.decisions, ["L2-054", "L2-028"],
     ["default", "loading", "empty", "error", "filtered", "no-results"], {}),
    ("artifacts", "Artifacts", "/projects/:id/artifacts", P.artifacts, ["L2-034"],
     ["default", "loading", "empty", "error"], {}),
    ("traceability", "Traceability", "/projects/:id/traceability", P.traceability, ["L2-035", "L2-014"],
     ["default", "loading", "empty", "error", "no-test", "deferred", "no-results"], {}),
    ("workers", "Workers", "/workers", P.workers, ["L2-026", "L2-027", "L2-041", "L2-029"],
     ["default", "loading", "empty", "error", "viewer", "stopped"], {}),
    ("audit", "Audit", "/audit", P.audit, ["L2-044", "L2-039"],
     ["default", "loading", "empty", "error", "no-results", "forbidden"], {}),
    ("settings", "Settings", "/settings", P.settings, ["L2-038", "L2-040", "L2-048", "L2-053", "L2-019"],
     ["default", "loading", "error", "invalid", "submitting", "success", "viewer"], {"empty": "Settings always has values; there is no collection."}),
    ("not-found", "Not found", "/**", P.not_found, ["L2-039"], ["default"],
     {"loading": "Rendered only after a lookup has already failed.", "empty": "An error page has no collection.", "error": "This page is itself the error state."}),
    ("server-error", "Server error", "/error", P.server_error, ["L2-049"], ["default"],
     {"loading": "Rendered only after a request has already failed.", "empty": "An error page has no collection.", "error": "This page is itself the error state."}),
]

NO_INPUT = "A confirmation with no input; nothing can be invalid."
DIALOGS = [
    ("stop-workers", "Stop all workers", "dashboard", ["L2-029"], ["default", "busy", "failed"], {"invalid": NO_INPUT}),
    ("cancel-direction", "Cancel direction", "project-pipeline", ["L2-029"], ["default", "busy", "failed"], {"invalid": NO_INPUT}),
    ("delete-project", "Delete project", "projects", ["L2-003"], ["default", "confirm", "busy", "invalid", "failed"], {}),
    ("raise-budget", "Raise budget", "project-pipeline", ["L2-053"], ["default", "busy", "invalid", "failed"], {}),
    ("worker-token", "New worker token", "workers", ["L2-041", "L2-040"], ["default", "busy", "invalid", "success", "failed"], {}),
    ("revoke-worker", "Revoke worker", "workers", ["L2-041"], ["default", "busy", "failed"], {"invalid": NO_INPUT}),
    ("update-skills", "Update skills", "project-pipeline", ["L2-008"], ["default", "busy", "failed"], {"invalid": NO_INPUT}),
    ("add-user", "Add a GitHub login", "settings", ["L2-038", "L2-039"], ["default", "busy", "invalid", "failed"], {}),
    ("mobile-nav", "Navigation drawer", "dashboard", ["L2-046"], ["default"],
     {"busy": "Navigation is instant; nothing is submitted.", "invalid": "Navigation has no input."}),
]

NOTIFICATIONS = [
    ("live-toast", "Live event toast", "dashboard", ["L2-031", "L2-047"], ["info", "success", "warning", "danger", "stacked", "with-action"]),
    ("connection-banner", "Connection banner", "dashboard", ["L2-032"], ["info", "success", "warning", "danger"]),
    ("system-banner", "System banner", "dashboard", ["L2-008", "L2-029", "L2-036"], ["info", "success", "warning", "danger"]),
]


def write(kind_folder, sid, state, html):
    path = ROOT / kind_folder / sid / f"{state}.html"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(html, encoding="utf-8")


def main():
    for folder in ("pages", "dialogs", "notifications"):
        shutil.rmtree(ROOT / folder, ignore_errors=True)
    screens, files = [], 0
    for sid, title, route, fn, reqs, states, na in PAGES:
        for st in states:
            body, desc = fn(st)
            write("pages", sid, st, document("page", sid, st, title, desc, reqs, body, states))
            files += 1
        screens.append({"id": sid, "kind": "page", "title": title, "route": route, "requirements": reqs, "states": states, "not_applicable": na, **mp(sid)})
    for sid, title, opens, reqs, states, na in DIALOGS:
        for st in states:
            body, desc = O.render_dialog(sid, st)
            write("dialogs", sid, st, document("dialog", sid, st, title, desc, reqs, body, states))
            files += 1
        screens.append({"id": sid, "kind": "dialog", "title": title, "opens_from": opens, "requirements": reqs, "states": states, "not_applicable": na, **mp(sid)})
    for sid, title, opens, reqs, states in NOTIFICATIONS:
        for st in states:
            body, desc = O.NOTIFICATIONS[sid](st)
            write("notifications", sid, st, document("notification", sid, st, title, desc, reqs, body, states))
            files += 1
        screens.append({"id": sid, "kind": "notification", "title": title, "opens_from": opens, "requirements": reqs, "states": states, "not_applicable": {}, **mp(sid)})
    manifest = {"project": "Hewn Mission Control",
                "required_states": {"page": ["default", "loading", "empty", "error"], "dialog": ["default", "busy", "invalid"],
                                    "notification": ["info", "success", "warning", "danger"]},
                "screens": screens}
    (ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(screens)} screens, {files} files")


if __name__ == "__main__":
    main()
