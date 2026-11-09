"""Shared helpers for the Hewn design-system documentation generator.

Every documentation page is one folder below docs/design-system/ (foundations/,
components/, patterns/), so relative links are fixed:
    ../components/<slug>.html     another page
    ../../mocks/<kind>/<screen>/<state>.html   a source mock

Content modules (comp_*.py, foundations.py, patterns.py) build HTML strings
with these helpers. Live product markup inside examples uses the classes in
assets/components.css only; documentation chrome uses ds-* classes from
assets/ds.css. Never write a raw colour; use tokens.
"""
from __future__ import annotations

import sys
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent          # docs/design-system
MOCKS = ROOT.parent / "mocks"
import importlib.util as _ilu  # noqa: E402
_spec = _ilu.spec_from_file_location("mocks_common", MOCKS / "_build" / "common.py")
mk = _ilu.module_from_spec(_spec)  # the mocks' own icons, mark, status words
_spec.loader.exec_module(mk)

PRODUCT = "Hewn"
DS = "Hewn design system"
EXTRACTED = "8 November 2026"

ICONS = mk.ICONS
STATUS = mk.STATUS


# ---------------------------------------------------------------- tiny builders
def icon(name: str, cls: str = "", label: str | None = None) -> str:
    """Inline SVG icon from the mocks' set (aria-hidden unless a label is given)."""
    return mk.icon(name, cls, label)


def mark(cls: str = "") -> str:
    return mk.mark(cls)


def wordmark(size: str = "", href: str | None = None, label: str = "Hewn") -> str:
    return mk.wordmark(size, href, label)


def status(word: str, label: str | None = None, sm: bool = False) -> str:
    """Status = icon + word. Words: Running, Succeeded, Merged, Complete, Failed, Blocked, Paused,
    Pending, Queued, Skipped, Idle, Cancelled, Deferred, Archived, Offline, In progress, Leased."""
    return mk.status(word, label, sm)


def status_icon(word: str, cls: str = "") -> str:
    return mk.status_icon(word, cls)


def btn(label: str, variant: str = "", size: str = "", ic: str | None = None, attrs: str = "", busy: bool = False,
        disabled: bool = False, icon_after: bool = False, href: str | None = None) -> str:
    """A .btn. variant: primary|ghost|danger|link|outline-accent|stone|'' ; size: sm|lg|''."""
    return mk.btn(label, variant, size, ic, href, attrs, busy, disabled, icon_after)


def icon_btn(ic: str, label: str, variant: str = "ghost", size: str = "", attrs: str = "") -> str:
    cls = "btn btn--icon" + (f" btn--{variant}" if variant else "") + (f" btn--{size}" if size else "")
    return f'<button class="{cls}" type="button" aria-label="{escape(label)}"{(" " + attrs) if attrs else ""}>{icon(ic, "icon--sm" if size == "sm" else "")}</button>'


def code(text: str) -> str:
    """Escaped inline <code>."""
    return f"<code>{escape(text)}</code>"


def ul(items, cls: str = "") -> str:
    c = f' class="{cls}"' if cls else ""
    return f"<ul{c}>" + "".join(f"<li>{i}</li>" for i in items) + "</ul>"


def mock(path: str, note: str = "") -> str:
    """Link to a source mock, e.g. mock('pages/dashboard/default', 'live run tile')."""
    href = f"../../mocks/{path}.html"
    if not (MOCKS / f"{path}.html").exists():
        raise FileNotFoundError(f"mock {path} does not exist")
    tail = f" ({note})" if note else ""
    return f'<a href="{href}">{escape(path)}</a>{tail}'


def page(slug_path: str, text: str | None = None) -> str:
    """Link to another documentation page: page('components/button') or page('foundations/color#roles')."""
    path, _, frag = slug_path.partition("#")
    label = text or path.split("/")[-1].replace("-", " ").capitalize()
    return f'<a href="../{path}.html{("#" + frag) if frag else ""}">{escape(label)}</a>'


# ---------------------------------------------------------------- documentation blocks
class NA:
    """Marks a component section as not applicable: NA('Tooltips have one size.')."""
    def __init__(self, reason: str):
        self.reason = reason


def section(sid: str, title: str, body) -> str:
    if isinstance(body, NA):
        return (f'<section class="ds-section" id="{sid}" data-na="{escape(body.reason, quote=True)}">'
                f'<h2><a href="#{sid}">{escape(title)}</a></h2><p class="ds-na">{escape(body.reason)}</p></section>\n')
    return f'<section class="ds-section" id="{sid}"><h2><a href="#{sid}">{escape(title)}</a></h2>\n{body}\n</section>\n'


def ex(canvas: str, caption: str = "", code_html: str | bool | None = True, cls: str = "") -> str:
    """A live example: canvas + caption + collapsible HTML (code_html=True shows the canvas source)."""
    src = canvas if code_html is True else (code_html or "")
    cap = f'<div class="ds-example__caption"><span>{caption}</span></div>' if caption else ""
    codeblk = f'<details class="ds-example__code"><summary>HTML</summary><pre><code>{escape(src.strip())}</code></pre></details>' if src else ""
    return f'<div class="ds-example"><div class="ds-example__canvas {cls}">{canvas}</div>{cap}{codeblk}</div>'


def matrix(cols: list[str], rows: list[tuple[str, list[str]]]) -> str:
    """State matrix. cols = column headings after the first ('Default', 'Hover', ...);
    rows = [(row label, [cell html, ...]), ...]."""
    head = '<th scope="col">Variant</th>' + "".join(f'<th scope="col">{escape(c)}</th>' for c in cols)
    body = "".join(f'<tr><th scope="row">{escape(r)}</th>' + "".join(f"<td>{c}</td>" for c in cells) + "</tr>" for r, cells in rows)
    return f'<div class="ds-matrix"><table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table></div>'


def themes(html: str, stack: bool = False) -> str:
    """The same markup in the light and dark theme, side by side."""
    cls = "ds-example__canvas ds-example__canvas--stack" if stack else "ds-example__canvas"
    return ('<h3>Both themes</h3><div class="ds-themes">'
            f'<div data-theme="light"><div class="{cls}" style="padding: 0;">{html}</div></div>'
            f'<div data-theme="dark"><div class="{cls}" style="padding: 0;">{html}</div></div></div>')


def swatch_cell(token: str, theme: str) -> str:
    return (f'<span class="ds-swatch-cell" data-theme="{theme}"><i data-token="{token}" data-swatch></i>'
            f'<span data-token="{token}"></span></span>')


def value_cell(token: str, theme: str | None = None) -> str:
    t = f' data-theme="{theme}"' if theme else ""
    return f'<span{t} data-token="{token}"></span>'


def token_table(rows: list[tuple[str, str]]) -> str:
    """rows = [(part, token)] ; colour tokens get light/dark swatches, others one value across both columns.
    A token string may hold several tokens separated by ' / ' (values shown for each)."""
    out = []
    for part, tok in rows:
        toks = [t.strip() for t in tok.split("/")]
        names = " / ".join(code(t) for t in toks)
        if all(t.startswith(("--color-", "--shadow-")) for t in toks) and toks[0].startswith("--color-"):
            light = " ".join(swatch_cell(t, "light") for t in toks)
            dark = " ".join(swatch_cell(t, "dark") for t in toks)
            out.append(f"<tr><td>{escape(part)}</td><td>{names}</td><td>{light}</td><td>{dark}</td></tr>")
        else:
            vals = " / ".join(value_cell(t) for t in toks)
            out.append(f'<tr><td>{escape(part)}</td><td>{names}</td><td colspan="2">{vals}</td></tr>')
    return ('<div class="ds-table-wrap"><table class="ds-table"><thead><tr><th scope="col">Part</th><th scope="col">Token</th>'
            '<th scope="col">Light</th><th scope="col">Dark</th></tr></thead><tbody>' + "".join(out) + "</tbody></table></div>")


def pairs(items: list[tuple[str, str, str, float]]) -> str:
    """Live contrast ratios in the current theme plus both fixed themes: [(label, fg token, bg token, min)]."""
    rows = []
    for label, fg, bg, mn in items:
        rows.append(f'<tr><td>{escape(label)}</td><td>{code(fg)} on {code(bg)}</td>'
                    f'<td><span class="ds-pair" data-theme="light"><span>Aa</span><span class="ds-pair__ratio" data-contrast="{fg}|{bg}" data-min="{mn}"></span></span></td>'
                    f'<td><span class="ds-pair" data-theme="dark"><span>Aa</span><span class="ds-pair__ratio" data-contrast="{fg}|{bg}" data-min="{mn}"></span></span></td>'
                    f"<td>{mn}:1</td></tr>")
    return ('<div class="ds-table-wrap"><table class="ds-table"><thead><tr><th scope="col">Pair</th><th scope="col">Tokens</th>'
            '<th scope="col">Light</th><th scope="col">Dark</th><th scope="col">Minimum</th></tr></thead><tbody>' + "".join(rows) + "</tbody></table></div>")


def keys(items: list[tuple[str, str]]) -> str:
    """Keyboard map: [('<kbd>Tab</kbd>', 'Moves focus ...')]."""
    body = "".join(f"<tr><td>{k}</td><td>{a}</td></tr>" for k, a in items)
    return f'<div class="ds-table-wrap"><table class="ds-table ds-keys"><thead><tr><th scope="col">Key</th><th scope="col">Action</th></tr></thead><tbody>{body}</tbody></table></div>'


def kbd(*names: str) -> str:
    return " + ".join(f"<kbd>{escape(n)}</kbd>" for n in names)


def dodont(items: list[tuple[str, str, str, str]]) -> str:
    """[(do canvas, do caption, don't canvas, don't caption)] ; captions are HTML."""
    out = []
    for do_c, do_t, dont_c, dont_t in items:
        out.append(f'<figure class="ds-do"><div class="ds-example__canvas">{do_c}</div><figcaption>{do_t}</figcaption></figure>')
        out.append(f'<figure class="ds-dont"><div class="ds-example__canvas">{dont_c}</div><figcaption>{dont_t}</figcaption></figure>')
    return '<div class="ds-dodont">' + "".join(out) + "</div>"


def class_table(items: list[tuple[str, str]]) -> str:
    body = "".join(f"<tr><td>{c}</td><td>{e}</td></tr>" for c, e in items)
    return f'<div class="ds-table-wrap"><table class="ds-table"><thead><tr><th scope="col">Class / attribute</th><th scope="col">Effect</th></tr></thead><tbody>{body}</tbody></table></div>'


def pre(src: str) -> str:
    return f"<pre><code>{escape(src.strip())}</code></pre>"


def anatomy(figure: str, callouts: list[tuple[int, int]], parts: list[tuple[str, str]]) -> str:
    """figure = live markup; callouts = [(left %, top %)] numbered 1..n; parts = [(name, description html)]."""
    dots = "".join(f'<span class="ds-callout" style="left: {l}%; top: {t}%;" aria-hidden="true">{i}</span>'
                   for i, (l, t) in enumerate(callouts, 1))
    lis = "".join(f"<li><div><b>{escape(n)}</b><small>{d}</small></div></li>" for n, d in parts)
    return (f'<div class="ds-anatomy"><figure class="ds-anatomy__figure">{figure}{dots}</figure>'
            f'<ol class="ds-anatomy__list">{lis}</ol></div>')


def table(head: list[str], rows: list[list[str]]) -> str:
    """A documentation table (ds-table). Cells are HTML."""
    h = "".join(f'<th scope="col">{escape(c)}</th>' for c in head)
    b = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows)
    return f'<div class="ds-table-wrap"><table class="ds-table"><thead><tr>{h}</tr></thead><tbody>{b}</tbody></table></div>'
