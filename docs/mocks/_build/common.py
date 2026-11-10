"""Shared building blocks for the Mission Control mocks.

The markup reproduces the Magic Patterns prototype (shared/components in
magicpatterns.com/os/c9upyFcFm8ZTUr3n843kZW) as static HTML on the shared
tokens.css + ui.css kit. Every page, dialog and notification is generated
from these helpers so the shell, header and copy stay identical across the set.
"""
from __future__ import annotations

from html import escape

R = "../../"  # every mock lives two folders below docs/mocks/
CUR = ' aria-current="page"'
FULL = 'style="width:100%"'

# ---------------------------------------------------------------------------
# Icons: lucide-style, 24-unit viewBox, 2px stroke, currentColor.
# ---------------------------------------------------------------------------
_SHIELD = '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>'
ICONS = {
    "loader": '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
    "check-circle": '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    "x-circle": '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>',
    "pause-circle": '<circle cx="12" cy="12" r="10"/><path d="M10 15V9M14 15V9"/>',
    "circle-dashed": '<path d="M10.1 2.18a9.93 9.93 0 0 1 3.8 0M17.6 3.71a9.95 9.95 0 0 1 2.69 2.7M21.82 10.1a9.93 9.93 0 0 1 0 3.8M20.29 17.6a9.95 9.95 0 0 1-2.7 2.69M13.9 21.82a9.94 9.94 0 0 1-3.8 0M6.4 20.29a9.95 9.95 0 0 1-2.69-2.7M2.18 13.9a9.93 9.93 0 0 1 0-3.8M3.71 6.4a9.95 9.95 0 0 1 2.7-2.69"/>',
    "circle-slash": '<circle cx="12" cy="12" r="10"/><path d="M9 15 15 9"/>',
    "circle-dot": '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="1"/>',
    "ban": '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
    "minus-circle": '<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/>',
    "archive": '<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>',
    "wifi-off": '<path d="M12 20h.01M8.5 16.43a5 5 0 0 1 7 0M2 8.82a15 15 0 0 1 4.17-2.65M10.66 5c4.01-.36 8.14.9 11.34 3.76M16.85 11.25a10 10 0 0 1 2.22 1.68M5 13a10 10 0 0 1 5.24-2.76M2 2l20 20"/>',
    "layout-grid": '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
    "folder-kanban": '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2ZM8 10v4M12 10v2M16 10v6"/>',
    "server": '<rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><path d="M6 6h.01M6 18h.01"/>',
    "scroll-text": '<path d="M15 12h-5M15 8h-5M19 17V5a2 2 0 0 0-2-2H4M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"/>',
    "settings": '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    "plus": '<path d="M5 12h14M12 5v14"/>',
    "menu": '<path d="M4 6h16M4 12h16M4 18h16"/>',
    "x": '<path d="M18 6 6 18M6 6l12 12"/>',
    "octagon-x": '<polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><path d="m15 9-6 6M9 9l6 6"/>',
    "play": '<polygon points="6 3 20 12 6 21 6 3"/>',
    "pause": '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
    "square": '<rect x="3" y="3" width="18" height="18" rx="2"/>',
    "refresh": '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5"/>',
    "github": '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4M9 18c-4.51 2-5-2-7-2"/>',
    "chevron-right": '<path d="m9 18 6-6-6-6"/>',
    "arrow-right": '<path d="M5 12h14M12 5l7 7-7 7"/>',
    "lock": '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    "trash": '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    "folder-open": '<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>',
    "git-merge": '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/>',
    "git-pr": '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7M6 9v12"/>',
    "git-branch": '<path d="M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9a9 9 0 0 1-9 9"/>',
    "git-commit": '<circle cx="12" cy="12" r="3"/><path d="M3 12h6M15 12h6"/>',
    "video": '<path d="m16 13 5.22 3.48a.5.5 0 0 0 .78-.42V7.94a.5.5 0 0 0-.76-.43L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
    "alert-triangle": '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3ZM12 9v4M12 17h.01"/>',
    "alert-circle": '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
    "info": '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    "external": '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    "sun": '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    "moon": '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    "monitor": '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    "shield-check": _SHIELD + '<path d="m9 12 2 2 4-4"/>',
    "shield-alert": _SHIELD + '<path d="M12 8v4M12 16h.01"/>',
    "clock": '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    "key": '<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5"/>',
    "copy": '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    "check": '<path d="M20 6 9 17l-5-5"/>',
    "laptop": '<path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/>',
    "cloud": '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
    "file-text": '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8"/>',
    "folder": '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    "search": '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    "file-code": '<path d="M10 12.5 8 15l2 2.5M14 12.5l2 2.5-2 2.5M14 2v4a2 2 0 0 0 2 2h4"/><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/>',
    "route": '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
    "layout-template": '<rect x="3" y="3" width="18" height="7" rx="1"/><rect x="3" y="14" width="9" height="7" rx="1"/><rect x="16" y="14" width="5" height="7" rx="1"/>',
    "rotate-ccw": '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    "arrow-up-right": '<path d="M7 7h10v10M7 17 17 7"/>',
    "arrow-down": '<path d="M12 5v14M19 12l-7 7-7-7"/>',
    "captions": '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15h4M15 15h2M7 11h2M13 11h4"/>',
    "maximize": '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
    "log-out": '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    "users": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    "resize": '<path d="M21 15 15 21M21 8l-13 13"/>',
    "compass": '<circle cx="12" cy="12" r="10"/><path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z"/>',
    "plug": '<path d="M12 22v-5M9 8V2M15 8V2M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>',
    "inbox": '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    "bell": '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    "wallet": '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
}


def icon(name: str, cls: str = "", label: str | None = None) -> str:
    klass = f"icon {cls}".strip()
    if label:
        return f'<svg class="{klass}" viewBox="0 0 24 24" role="img" aria-label="{escape(label)}">{ICONS[name]}</svg>'
    return f'<svg class="{klass}" viewBox="0 0 24 24" aria-hidden="true">{ICONS[name]}</svg>'


def mark(cls: str = "") -> str:
    """The Hewn mark: an H whose right pillar has had its corner hewn off."""
    return (
        f'<svg class="{cls}" viewBox="0 0 32 32" aria-hidden="true">'
        '<rect class="mark__body" x="0" y="0" width="10" height="32"/>'
        '<rect class="mark__body" x="10" y="13" width="12" height="6"/>'
        '<polygon class="mark__body" points="22,10 32,0 32,32 22,32"/>'
        '<polygon class="mark__chip" points="22,0 29,0 22,7"/></svg>'
    )


def wordmark(size: str = "", href: str | None = None, label: str = "Hewn") -> str:
    cls = f"wordmark {('wordmark--' + size) if size else ''}".strip()
    inner = f'{mark()}<span class="wordmark__text" aria-hidden="true">hewn</span>'
    if href:
        return f'<a class="{cls}" href="{href}" aria-label="{label}">{inner}</a>'
    return f'<span class="{cls}" role="img" aria-label="{label}">{inner}</span>'


# ---------------------------------------------------------------------------
# Status: icon + word, never colour alone (L2-030).
# ---------------------------------------------------------------------------
STATUS = {
    "Running": ("loader", "run", True), "In progress": ("loader", "run", True), "Leased": ("loader", "run", True),
    "Succeeded": ("check-circle", "ok", False), "Merged": ("check-circle", "ok", False), "Complete": ("check-circle", "ok", False),
    "Failed": ("x-circle", "fail", False), "Blocked": ("x-circle", "fail", False),
    "Paused": ("pause-circle", "warn", False),
    "Pending": ("circle-dashed", "muted", False), "Queued": ("circle-dashed", "muted", False),
    "Skipped": ("circle-slash", "muted", False), "Idle": ("circle-dot", "idle", False),
    "Cancelled": ("ban", "muted", False), "Deferred": ("minus-circle", "muted", False),
    "Archived": ("archive", "muted", False), "Offline": ("wifi-off", "fail", False),
}


def status_icon(st: str, cls: str = "") -> str:
    name, tone, spin = STATUS[st]
    return icon(name, f"s-icon--{tone} {'icon--spin' if spin else ''} {cls}".strip())


def status(st: str, label: str | None = None, sm: bool = False) -> str:
    name, tone, spin = STATUS[st]
    text = st if label is None else label
    sr = "" if text else f'<span class="visually-hidden">{st}</span>'
    return (f'<span class="status status--{tone}{" status--sm" if sm else ""}">'
            f'{icon(name, "icon--spin" if spin else "")}{escape(text)}{sr}</span>')


def money(n: float) -> str:
    return f"${n:,.2f}"


def btn(label: str, variant: str = "", size: str = "", ic: str | None = None, href: str | None = None,
        attrs: str = "", busy: bool = False, disabled: bool = False, icon_after: bool = False) -> str:
    cls = "btn" + (f" btn--{variant}" if variant else "") + (f" btn--{size}" if size else "")
    glyph = icon("loader" if busy else ic, "icon--sm" if size == "sm" else "") if (ic or busy) else ""
    inner = f"{escape(label)}{glyph}" if icon_after else f"{glyph}{escape(label)}"
    extra = (' aria-busy="true"' if busy else "") + (" " + attrs if attrs else "")
    if href and not disabled and not busy:
        return f'<a class="{cls}" href="{href}"{extra}>{inner}</a>'
    return f'<button class="{cls}" type="button"{extra}{" disabled" if disabled else ""}>{inner}</button>'


def page_link(screen: str, state: str = "default") -> str:
    return f"{R}pages/{screen}/{state}.html"


def dialog_link(screen: str, state: str = "default") -> str:
    return f"{R}dialogs/{screen}/{state}.html"


def note(text: str, pos: str = "top: 5rem; right: 1rem;") -> str:
    return f'<p class="mock-note" style="{pos}">{text}</p>'


# ---------------------------------------------------------------------------
# Cast and catalog, shared by every mock (see README.md).
# ---------------------------------------------------------------------------
STAGE_NAMES = ["Bootstrap", "Idea", "Designs", "Design system", "Stack", "Requirements", "Scaffold",
               "Detailed designs", "User journeys", "Estimates", "Increments"]

PROJECTS = [
    dict(id="ledgerline", name="Ledgerline", idea="Expense reconciliation for small accounting teams", repo="hewn-builds/ledgerline",
         status="Running", stage=10, percent=62, spend=184.20, budget=400, last="4s ago", note="Increment 7 of 12 · implementing, iteration 3",
         href=("project-pipeline", "default")),
    dict(id="tidewater", name="Tidewater", idea="Tide and swell planner for small-boat charters", repo="hewn-builds/tidewater",
         status="Running", stage=3, percent=18, spend=41.80, budget=300, last="11s ago", note="Extracting tokens from 46 mocks",
         href=("project-pipeline", "past-stage")),
    dict(id="parcel-post", name="Parcel Post", idea="Shared mailroom log for coworking spaces", repo="hewn-builds/parcel-post",
         status="Blocked", stage=5, percent=24, spend=58.10, budget=300, last="18m ago", note="Requirements failed after 3 retries",
         href=("project-pipeline", "blocked")),
    dict(id="kiln", name="Kiln Booking", idea="Studio time booking for shared ceramics kilns", repo="hewn-builds/kiln-booking",
         status="Paused", stage=10, percent=81, spend=250.00, budget=250, last="42m ago", note="Budget reached",
         href=("project-pipeline", "budget-reached")),
    dict(id="northwind", name="Northwind Ops", idea="Feature: CSV export for the shift report", repo="northwind/ops-portal",
         status="Idle", stage=10, percent=100, spend=612.45, budget=800, last="2h ago", note=None,
         href=("project-pipeline", "feature-direction")),
    dict(id="field-notes", name="Field Notes", idea="Offline survey capture for ecology field teams", repo="hewn-builds/field-notes",
         status="Complete", stage=10, percent=100, spend=341.90, budget=400, last="Yesterday", note=None,
         href=("project-pipeline", "complete")),
    dict(id="harbor", name="Harbor CRM", idea="Lightweight CRM for marina slip rentals", repo="hewn-builds/harbor-crm",
         status="Cancelled", stage=7, percent=38, spend=96.30, budget=300, last="3 days ago", note=None,
         href=("project-pipeline", "cancelled")),
]
ACTIVE = ("Running", "Paused", "Blocked")

STAGES = [
    (0, "Bootstrap", "Copy from Greenlit", ".hewn/skills.lock", "0:41"),
    (1, "Idea", "grilling", "docs/brief.md", "6:12"),
    (2, "Designs", "Magic Patterns MCP", "docs/mocks/", "48:30"),
    (3, "Design system", "extracting-design-systems", "docs/design-system/", "14:05"),
    (4, "Stack", ".NET + Angular", "docs/adr/0001-stack.md", "1:58"),
    (5, "Requirements", "engineering-requirements", "docs/specs/", "11:44"),
    (6, "Scaffold", "Stack template", "Solution + CI", "7:20"),
    (7, "Detailed designs", "writing-software-design-documents", "docs/detailed-designs/", "22:16"),
    (8, "User journeys", "Numbered journeys", "docs/journeys.md", "4:03"),
    (9, "Estimates", "estimating-designs", "docs/estimates/", "5:37"),
    (10, "Increments", "implementing-incrementally", "Test → Code → Video → PR", "3:12:48"),
]

LOG = [
    ("14:02:11", "info", "Increment 7 · Reconcile a card statement (journey 4, L2-018, L2-019)"),
    ("14:02:11", "tool", "git checkout -b feature/reconcile-card-statement origin/main"),
    ("14:02:44", "info", "Wrote e2e/reconcile-card-statement.spec.ts (4 tests, traces to L2-018, L2-019)"),
    ("14:03:02", "info", "Red recorded: 4 failing, 0 passing"),
    ("14:03:05", "tool", 'git commit -m "Add failing acceptance tests for card reconciliation"'),
    ("14:09:37", "info", "Iteration 1 · StatementMatcher, MatchSuggestion endpoint"),
    ("14:11:58", "warn", "Iteration 1 · 2 of 4 acceptance tests failing (amount tolerance)"),
    ("14:18:20", "info", "Iteration 2 · Tolerance window from project settings"),
    ("14:20:41", "warn", "Iteration 2 · 1 of 4 failing: matches-across-midnight"),
    ("14:21:03", "info", "Decision recorded: compare posting dates in the account time zone"),
    ("14:24:15", "info", "Iteration 3 · Normalise posting dates to account time zone"),
    ("14:26:52", "tool", "dotnet test backend/Ledgerline.sln --filter Category=Acceptance"),
    ("14:27:30", "info", "Backend: 412 passed, 0 failed"),
    ("14:27:31", "tool", "npx playwright test e2e/reconcile-card-statement.spec.ts"),
]

INCREMENTS = [
    (1, "Sign in with Microsoft", 1, "L2-001, L2-002", "Merged", 1.5, 14),
    (2, "Connect a bank feed", 2, "L2-006, L2-007", "Merged", 2.5, 17),
    (3, "Import a CSV statement", 2, "L2-008", "Merged", 2, 19),
    (4, "Review unmatched transactions", 3, "L2-011, L2-012", "Merged", 3, 22),
    (5, "Match a receipt by photo", 3, "L2-013, L2-014", "Merged", 2.5, 25),
    (6, "Split a transaction", 3, "L2-015", "Merged", 1, 27),
    (7, "Reconcile a card statement", 4, "L2-018, L2-019", "In progress", 2.5, None),
    (8, "Close a period", 4, "L2-020, L2-021", "Queued", 2, None),
    (9, "Lock a closed period", 4, "L2-022", "Queued", 1, None),
    (10, "Export to the general ledger", 5, "L2-024, L2-025", "Queued", 3, None),
    (11, "Invite a reviewer", 6, "L2-027", "Queued", 1.5, None),
    (12, "Audit trail per period", 6, "L2-029", "Queued", 2, None),
]
DEFERRED = [
    ("Multi-currency reconciliation", "L2-031, L2-032", 7, "Estimated 7 days; could not be split below 3. Single-currency covers every journey."),
    ("Slack digest of unmatched items", "L2-034", 1.5, "Listed as nice-to-have in the brief."),
    ("Receipt OCR confidence tuning", "L2-035", 2, "Off the main path of every journey."),
]

WORKERS = [
    ("wk-7f3a", "quinn-mbp.local", "Local", "0.9.2", "Leased", "Ledgerline", "3s ago", "2h 14m"),
    ("wk-c21e", "hewn-cloud-eus-01", "Cloud", "0.9.2", "Leased", "Tidewater", "6s ago", "38m"),
    ("wk-90bd", "hewn-cloud-eus-02", "Cloud", "0.9.2", "Idle", None, "8s ago", "5h 02m"),
    ("wk-4e18", "build-box-02", "Local", "0.9.1", "Offline", None, "4m ago", "—"),
]

DECISIONS = [
    ("9 Nov, 14:21", "Increments", "Which time zone decides whether a card transaction falls on a statement date?",
     "The account's time zone, set during bank-feed connection.",
     "Statements are issued in the account holder’s local day; UTC split 3 test transactions across two days.", "a41c9e2"),
    ("9 Nov, 11:08", "Increments", "Should a split transaction keep the original receipt on every part?", "Yes, linked, not copied.",
     "Journey 3 has reviewers open the receipt from any part; copying would double storage and break deletion.", "7be0d13"),
    ("8 Nov, 16:40", "Estimates", "Multi-currency reconciliation is 7 days. Split or defer?", "Defer.",
     "No journey needs a second currency, and no split came in under the 3-day threshold.", "19f4a8c"),
    ("8 Nov, 09:12", "Stack", "The direction mentions “works offline on site visits”. Add a PWA layer?",
     "No. Keep the default .NET + Angular stack; offline is out of scope in the brief.",
     "The brief’s users reconcile at a desk; site visits only capture receipts, which the phone camera already queues.", "c03e57b"),
    ("7 Nov, 17:55", "Idea", "Who approves a reconciled period: the preparer or a second person?", "A second person with the Reviewer role.",
     "The direction names “small accounting teams”; four-eyes review is standard practice the brief should assume.", "e8812fa"),
]

AUDIT = [
    ("9 Nov 2026, 14:31:07", "quinntynebrown", "Merge", "Ledgerline #27", "—"),
    ("9 Nov 2026, 13:02:44", "quinntynebrown", "Resume", "Tidewater", "24.114.38.91"),
    ("9 Nov 2026, 12:58:10", "quinntynebrown", "Pause", "Tidewater", "24.114.38.91"),
    ("9 Nov 2026, 10:15:22", "ama-osei", "Sign in", "—", "99.230.12.4"),
    ("9 Nov 2026, 09:40:03", "quinntynebrown", "Token created", "hewn-cloud-eus-02", "24.114.38.91"),
    ("8 Nov 2026, 18:22:51", "quinntynebrown", "Direction submitted", "Northwind Ops", "24.114.38.91"),
    ("8 Nov 2026, 17:01:36", "quinntynebrown", "Cancel", "Harbor CRM", "24.114.38.91"),
    ("8 Nov 2026, 16:44:19", "quinntynebrown", "Token revoked", "build-box-01", "24.114.38.91"),
    ("8 Nov 2026, 08:34:12", "quinntynebrown", "Start workers", "All projects", "24.114.38.91"),
    ("8 Nov 2026, 08:30:00", "quinntynebrown", "Stop all workers", "All projects", "24.114.38.91"),
]


# ---------------------------------------------------------------------------
# App shell (AppShell.tsx)
# ---------------------------------------------------------------------------
NAV = [
    ("dashboard", "Dashboard", "layout-grid", False),
    ("projects", "Projects", "folder-kanban", False),
    ("workers", "Workers", "server", False),
    ("audit", "Audit", "scroll-text", True),
    ("settings", "Settings", "settings", False),
]


def sidebar(active: str, role: str = "owner", conn: str = "live", stopped: bool = False, drawer: bool = False) -> str:
    owner = role == "owner"
    sfx = "d" if drawer else "s"
    nav = "".join(
        f'<a class="nav-link" href="{page_link(k)}"{CUR if k == active else ""}>{icon(ic, "icon--lg")}{label}</a>'
        for k, label, ic, owner_only in NAV if owner or not owner_only
    )
    projects = "".join(
        f'<li><a class="side-project" href="{page_link(*p["href"])}">{status_icon("Paused" if stopped else p["status"], "icon--sm")}'
        f'<span class="side-project__name">{p["name"]}</span><span class="visually-hidden">, {"Paused" if stopped else p["status"]},</span>'
        f'<span class="side-project__pct">{p["percent"]}%</span></a></li>'
        for p in PROJECTS if p["status"] in ACTIVE
    )
    if conn == "live":
        conn_html = '<span class="conn__state"><span class="dot"></span>Live</span>'
    elif conn == "reconnecting":
        conn_html = '<span class="conn__state"><span class="dot dot--warn pulse"></span>Reconnecting…</span>'
    else:
        conn_html = '<span class="conn__state"><span class="dot dot--danger"></span>Offline</span>'
    stop = ""
    if owner:
        stop = (btn("Start workers", "", "sm", "play", attrs='style="width:100%; margin-top: var(--space-3);"')
                if stopped else
                btn("Stop all workers", "danger", "sm", "octagon-x", href=dialog_link("stop-workers"),
                    attrs='style="width:100%; margin-top: var(--space-3);"'))
    cta = (f'<div class="sidebar__cta">{btn("New direction", "primary", "", "plus", href=page_link("new-direction"), attrs=FULL)}</div>'
           if owner else "")
    return f"""<div class="sidebar">
  <div class="sidebar__brand">{wordmark("", page_link("dashboard"), "Hewn, go to dashboard")}</div>
  {cta}
  <nav class="sidebar__nav" aria-label="{'Primary' if not drawer else 'Primary, menu'}">{nav}</nav>
  <p class="sidebar__section" id="active-directions-{'d' if drawer else 's'}">Active directions</p>
  <ul class="sidebar__projects" aria-labelledby="active-directions-{'d' if drawer else 's'}">{projects}</ul>
  <div class="sidebar__foot">
    <div class="conn">{conn_html}<span class="tabular text-subtle">{"0" if stopped else "3"} of 4 workers</span></div>
    {stop}
    <div class="user"><span class="avatar" aria-hidden="true">QB</span><div class="truncate"><div class="user__name truncate">{"quinntynebrown" if owner else "ama-osei"}</div><div class="user__role">{"Owner" if owner else "Viewer"}</div></div><a class="btn btn--ghost btn--icon btn--sm" href="{page_link("sign-in", "signed-out")}" aria-label="Sign out" title="Sign out" style="margin-left: auto">{icon("log-out", "icon--sm")}</a></div>
  </div>
</div>"""


def topbar(conn: str = "live") -> str:
    dot = {"live": ("dot", "Live"), "reconnecting": ("dot dot--warn", "Reconnecting"), "offline": ("dot dot--danger", "Offline")}[conn]
    return f"""<header class="topbar">
  <a class="btn btn--ghost btn--icon btn--touch" href="{dialog_link('mobile-nav')}" aria-label="Open menu">{icon("menu", "icon--lg")}</a>
  {wordmark("sm", page_link("dashboard"), "Hewn, go to dashboard")}
  <span class="topbar__slot" role="img" aria-label="Connection: {dot[1]}"><span class="{dot[0]}"></span></span>
</header>"""


def strips(conn: str = "live", stopped: bool = False, extra: str = "") -> str:
    out = ""
    if conn == "reconnecting":
        out += (f'<div class="strip strip--warn" role="status">{icon("refresh", "icon--sm icon--spin")}'
                '<span class="strip__text">Reconnecting… next attempt in 10 s. Missed events will catch up from #48,213.</span></div>')
    if conn == "offline":
        out += (f'<div class="strip strip--danger" role="alert">{icon("wifi-off", "icon--sm")}'
                '<span class="strip__text">Connection lost. Retrying every 30 s; agents keep working and nothing is lost.</span>'
                f'{btn("Retry now", "", "sm", "refresh")}</div>')
    if stopped:
        out += (f'<div class="strip strip--danger" role="status">{icon("octagon-x", "icon--sm")}'
                '<span class="strip__text">All workers stopped. Nothing new will be leased until you start them again.</span></div>')
    return out + extra


def shell(active: str, main: str, role: str = "owner", conn: str = "live", stopped: bool = False,
          extra_strip: str = "", inert: bool = False) -> str:
    wrap_open = '<div inert aria-hidden="true">' if inert else ""
    wrap_close = "</div>" if inert else ""
    return f"""{wrap_open}<div class="shell">
<aside class="shell__sidebar" aria-label="Sidebar">{sidebar(active, role, conn, stopped)}</aside>
<div class="shell__body">
{topbar(conn)}
{strips(conn, stopped, extra_strip)}
<main id="main" class="shell__main">
{main}
</main>
</div>
</div>{wrap_close}"""


def page_header(title: str, desc: str = "", actions: str = "") -> str:
    d = f'<p class="page-header__desc">{desc}</p>' if desc else ""
    a = f'<div class="cluster">{actions}</div>' if actions else ""
    return f'<div class="page-header"><div class="truncate"><h1>{title}</h1>{d}</div>{a}</div>'


# ---------------------------------------------------------------------------
# Project header (ProjectHeader.tsx)
# ---------------------------------------------------------------------------
TABS = [("pipeline", "Pipeline", "project-pipeline"), ("backlog", "Backlog", "backlog"), ("designs", "Designs", "designs"),
        ("design-system", "Design system", "design-system"), ("decisions", "Decisions", "decisions"), ("artifacts", "Artifacts", "artifacts"), ("trace", "Traceability", "traceability")]


def project_header(tab: str, role: str = "owner", st: str = "Running", spend: float = 184.20, budget: float = 400,
                   percent: int = 62, name: str = "Ledgerline", repo: str = "hewn-builds/ledgerline",
                   kind: str = "Product direction · started 7 Nov", skills: bool = True, h1: bool = True) -> str:
    owner = role == "owner"
    pct = min(100, spend / budget * 100)
    meter_cls = "meter meter--warn" if pct >= 80 else "meter"
    controls = ""
    if owner and st not in ("Cancelled", "Complete", "Idle"):
        primary = (btn("Retry stage", "", "sm", "rotate-ccw") if st == "Blocked" else
                   btn("Resume", "", "sm", "play") if st == "Paused" else btn("Pause", "", "sm", "pause"))
        controls = f'<div class="cluster">{primary}{btn("Cancel", "ghost", "sm", "square", href=dialog_link("cancel-direction"))}</div>'
    skills_link = (f'<a class="btn btn--link" href="{dialog_link("update-skills")}">{icon("refresh", "icon--xs")} Skills update available (4 commits)</a>'
                   if owner and skills else "")
    tabs = "".join(
        f'<a class="tab" href="{page_link(page)}"{CUR if key == tab else ""}>{label}</a>'
        for key, label, page in TABS
    )
    heading = f"<h1>{name}</h1>" if h1 else f'<p class="h1-like" style="font: var(--text-h1); letter-spacing: var(--letter-spacing-tight);">{name}</p>'
    return f"""<header class="phead">
  <div class="phead__top">
    <nav aria-label="Breadcrumb"><ol class="breadcrumb"><li><a href="{page_link('projects')}">Projects</a></li><li aria-hidden="true">{icon("chevron-right")}</li><li aria-current="page">{name}</li></ol></nav>
    <div class="phead__row">
      <div class="truncate">
        <div class="cluster cluster--lg">{heading}{status(st)}</div>
        <div class="phead__meta"><span>{kind}</span><a class="phead__repo" href="https://github.com/{repo}">{icon("github", "icon--xs")} {repo}</a>{skills_link}</div>
      </div>
      <div class="phead__stats">
        <div class="phead__spend">
          <div class="phead__label"><span>Spend</span><span class="tabular"><strong>{money(spend)}</strong> of {money(budget)}</span></div>
          <div class="{meter_cls} mt-2" role="meter" aria-label="Spend" aria-valuenow="{spend:.2f}" aria-valuemin="0" aria-valuemax="{budget:.2f}"><span class="meter__bar" style="--value: {pct:.0f}%"></span></div>
        </div>
        <div class="text-xs"><div class="text-muted">Complete</div><div class="tabular text-sm mt-1">{percent}%</div></div>
        {controls}
      </div>
    </div>
  </div>
  <nav class="phead__tabs" aria-label="Project sections"><div class="tabs tabs--flush">{tabs}</div></nav>
</header>"""


# ---------------------------------------------------------------------------
# Document wrapper and mock bar
# ---------------------------------------------------------------------------
def mock_bar(screen_title: str, states: list[str], current: str) -> str:
    links = "".join(
        f'<li><a href="{s}.html"{CUR if s == current else ""}>{s}</a></li>' for s in states
    )
    return f"""<nav class="mock-bar" aria-label="Mock navigation">
  <a class="mock-bar__home" href="{R}index.html" aria-label="All mocks">⌂</a>
  <span class="mock-bar__screen">{escape(screen_title)}</span>
  <ul class="mock-bar__states">{links}</ul>
  <button type="button" data-theme-toggle aria-pressed="false">☾ Dark</button>
  <button type="button" data-chrome-toggle aria-label="Hide mock chrome">×</button>
</nav>"""


def document(kind: str, sid: str, state: str, screen_title: str, desc: str, reqs: list[str], body: str,
             states: list[str]) -> str:
    req_meta = f'\n<meta name="mock:requirements" content="{" ".join(reqs)}">' if reqs else ""
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{escape(screen_title)} · {state} — Hewn Mission Control mocks</title>
<meta name="mock:kind" content="{kind}">
<meta name="mock:screen" content="{sid}">
<meta name="mock:state" content="{state}">{req_meta}
<meta name="description" content="{escape(desc)}">
<link rel="stylesheet" href="{R}../design-system/tokens/tokens.css">
<link rel="stylesheet" href="{R}../design-system/assets/components.css">
<link rel="stylesheet" href="{R}assets/mock.css">
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
{body}
{mock_bar(screen_title, states, state)}
<script src="{R}assets/mock.js"></script>
</body>
</html>
"""


# ---------------------------------------------------------------------------
# Overlays
# ---------------------------------------------------------------------------
def dialog(title: str, text: str, body: str, footer: str, alert: bool = False, lg: bool = False, desc_id: str = "dlg-desc") -> str:
    role = "alertdialog" if alert else "dialog"
    return f"""<div class="backdrop"></div>
<div class="dialog" role="{role}" aria-modal="true" aria-labelledby="dlg-title" aria-describedby="{desc_id}" data-dismiss-on-escape>
  <div class="dialog__panel{' dialog__panel--lg' if lg else ''}">
    <h2 class="dialog__title" id="dlg-title">{title}</h2>
    <p class="dialog__text" id="dlg-desc">{text}</p>
    {body}
    <div class="dialog__footer">{footer}</div>
  </div>
</div>"""


def toast(tone: str, ic: str, title: str, text: str, actions: str = "", progress: bool = False, alert: bool = False) -> str:
    role = ' role="alert"' if alert else ""
    acts = f'<div class="toast__actions">{actions}</div>' if actions else ""
    prog = '<span class="toast__progress" aria-hidden="true"></span>' if progress else ""
    return (f'<div class="toast toast--{tone}"{role}>{icon(ic)}<div class="toast__body"><div class="toast__title">{title}</div>'
            f'<div class="toast__text">{text}</div>{acts}</div>'
            f'<button class="toast__close" type="button" aria-label="Dismiss">{icon("x", "icon--sm")}</button>{prog}</div>')


def toast_region(content: str) -> str:
    return f'<div class="toast-region" role="status" aria-live="polite">{content}</div>'
