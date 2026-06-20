#!/usr/bin/env python3
"""
markdown_email.py — Minimal Markdown -> HTML for the drip/welcome email format.

Handles exactly what the Brains & Gains templates use: paragraphs, bold, italics,
unordered lists, and inline links [text](url). Shared by kit_schedule_drip.py and
the welcome-sequence tooling so conversion is identical everywhere.
"""
from __future__ import annotations

import re


def _inline(s: str) -> str:
    s = s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    # links [text](url) — before italics so the parens/url aren't mangled
    s = re.sub(
        r"\[([^\]]+)\]\((https?://[^)\s]+)\)",
        r'<a href="\2" target="_blank">\1</a>',
        s,
    )
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)            # bold
    s = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"<em>\1</em>", s)  # italic
    return s


def md_to_html(md: str) -> str:
    """Paragraphs (blank-line separated), bold/italic/links, unordered lists."""
    blocks = re.split(r"\n\s*\n", md.strip())
    out: list[str] = []
    for block in blocks:
        lines = [ln.rstrip() for ln in block.splitlines() if ln.strip()]
        if not lines:
            continue
        if all(re.match(r"^[-*•]\s+", ln) for ln in lines):
            items = "".join(
                f"<li>{_inline(re.sub(r'^[-*•]\s+', '', ln))}</li>" for ln in lines
            )
            out.append(f"<ul>{items}</ul>")
        else:
            # In this content style each paragraph is a single line, so multiple
            # lines in a block are intentional breaks (e.g. a signature).
            out.append("<p>" + "<br>".join(_inline(ln) for ln in lines) + "</p>")
    return "\n".join(out)


def first_sentence(md: str, limit: int = 150) -> str:
    plain = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", md)   # drop link urls
    plain = re.sub(r"[*_`#>]", "", plain).strip()
    plain = re.sub(r"\s+", " ", plain.replace("\n", " "))
    m = re.match(r"(.+?[.!?])(\s|$)", plain)
    snippet = m.group(1) if m else plain
    return (snippet[: limit - 1] + "…") if len(snippet) > limit else snippet
