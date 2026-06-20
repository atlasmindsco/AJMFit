#!/usr/bin/env python3
"""
build_review.py — One scrollable page to review the whole drip lineup before it
goes live. Renders every queued drip (in send order, with its Thursday + theme)
using the brand styles, so you can read, spot weak ones, and flag edits.

Usage: python tools/build_review.py   ->   newsletter-content/review.html
"""
from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import kit_schedule_drip as ksd          # noqa: E402
from markdown_email import md_to_html    # noqa: E402

QUEUE = ROOT / "newsletter-content" / "queue.json"
OUT = ROOT / "newsletter-content" / "review.html"
NAVY, BLUE, ORANGE, OFF, SLATE = "#1B2D50", "#1A7BFF", "#F76B16", "#F4F6F9", "#64748B"


def fmt_date(iso: str | None) -> str:
    if not iso:
        return "unscheduled"
    return datetime.fromisoformat(iso).strftime("%a %b %-d, %Y") if hasattr(
        datetime, "fromisoformat") else iso


def main():
    from datetime import datetime as dt
    q = json.loads(QUEUE.read_text(encoding="utf-8"))
    cards = []
    for i, it in enumerate(q["items"], 1):
        subject, body = ksd.parse_drip(ROOT / it["file"])
        when = dt.fromisoformat(it["send_at"]).strftime("%a %b %d, %Y") if it["send_at"] else f"Week {i}"
        cards.append(f"""
      <article class="card">
        <div class="meta"><span class="wk">#{i:02d}</span>
          <span class="theme">{it['theme']}</span>
          <span class="date">{when}</span></div>
        <h2>{subject}</h2>
        <div class="body">{md_to_html(body)}</div>
      </article>""")

    html = f"""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Brains &amp; Gains — Lineup Review</title>
<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@600;700&display=swap" rel="stylesheet">
<style>
  body{{margin:0;background:{OFF};font-family:'Barlow',Arial,sans-serif;color:{NAVY};}}
  header{{background:{NAVY};color:#fff;padding:26px 20px;text-align:center;}}
  header img{{max-width:420px;width:90%;border-radius:10px;}}
  header h1{{font-family:'Barlow Condensed',sans-serif;text-transform:uppercase;letter-spacing:2px;margin:14px 0 4px;}}
  header p{{color:#9fb3d1;margin:0;font-size:14px;}}
  .wrap{{max-width:680px;margin:0 auto;padding:24px 16px 60px;}}
  .card{{background:#fff;border-radius:14px;padding:26px 30px;margin:18px 0;box-shadow:0 8px 24px rgba(27,45,80,.08);border-top:4px solid {ORANGE};}}
  .meta{{display:flex;gap:10px;align-items:center;font-size:12px;margin-bottom:8px;font-family:'Barlow Condensed',sans-serif;text-transform:uppercase;letter-spacing:1px;}}
  .wk{{color:{SLATE};font-weight:700;}}
  .theme{{background:{BLUE};color:#fff;padding:2px 10px;border-radius:20px;font-weight:600;}}
  .date{{color:{SLATE};margin-left:auto;}}
  .card h2{{font-family:'Barlow Condensed',sans-serif;color:{NAVY};font-size:26px;margin:4px 0 14px;letter-spacing:-.01em;}}
  .body{{font-size:16px;line-height:1.7;}}
  .body p{{margin:0 0 14px;}} .body ul{{margin:0 0 14px;padding-left:20px;}} .body li{{margin:0 0 8px;}}
  .body strong{{color:{NAVY};}}
</style></head><body>
<header>
  <img src="https://ajmfit.com/BandGnewsletter.png" alt="AJMfit Newsletter">
  <h1>Brains &amp; Gains — Lineup Review</h1>
  <p>{len(q['items'])} issues · review before scheduling/deploy · each editable in Kit before it sends</p>
</header>
<div class="wrap">{''.join(cards)}</div>
</body></html>"""
    OUT.write_text(html, encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)} ({len(q['items'])} issues)")


if __name__ == "__main__":
    main()
