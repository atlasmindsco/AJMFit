#!/usr/bin/env python3
"""
kit_schedule_drip.py — Draft or schedule a Brains & Gains drip as a Kit broadcast.

Reads a drip Markdown file (newsletter-content/drips/NNN-slug.md), converts the
body to HTML, and creates a Kit v4 broadcast. By default it SCHEDULES the send for
the next upcoming Thursday at 06:00 America/New_York (matching the content plan).

Zero-click: this hits Kit's REST API directly (POST /v4/broadcasts with send_at),
which the Kit MCP can't do — the MCP only saves drafts.

Usage:
  python tools/kit_schedule_drip.py <drip-file> [options]

Options:
  --date YYYY-MM-DD   Override the send date (still 06:00 ET unless --time given).
  --time HH:MM        Override the send time (24h, America/New_York). Default 06:00.
  --draft             Save as a draft (send_at=null); ignore date/time.
  --tag ID            Target only subscribers with this tag id (repeatable).
  --segment ID        Target only this segment id (repeatable).
  --preview "text"    Override preview text (default: first sentence of the body).
  --dry-run           Print the computed payload and send_at; do NOT call the API.

Examples:
  python tools/kit_schedule_drip.py newsletter-content/drips/001-progressive-overload.md --dry-run
  python tools/kit_schedule_drip.py newsletter-content/drips/001-progressive-overload.md
  python tools/kit_schedule_drip.py newsletter-content/drips/003-specificity.md --date 2026-07-02
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))
import email_template  # noqa: E402
from markdown_email import first_sentence, md_to_html  # noqa: E402

API_URL = "https://api.kit.com/v4/broadcasts"
TZ = ZoneInfo("America/New_York")
PROJECT_ROOT = Path(__file__).resolve().parents[1]


# ---------------------------------------------------------------- env / key ---
def load_api_key() -> str:
    key = os.environ.get("KIT_API_KEY")
    if key:
        return key.strip()
    # Fall back to .env.local (KEY=VALUE lines), the project's secret store.
    env_path = PROJECT_ROOT / ".env.local"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            if k.strip() == "KIT_API_KEY":
                return v.strip().strip('"').strip("'")
    sys.exit("ERROR: KIT_API_KEY not found in environment or .env.local")


# ------------------------------------------------------------ drip parsing ---
def parse_drip(path: Path) -> tuple[str, str]:
    """Return (subject, body_markdown) from a drip file."""
    text = path.read_text(encoding="utf-8")

    m = re.search(r"^\*\*Subject:\*\*\s*(.+?)\s*$", text, re.MULTILINE)
    if not m:
        sys.exit(f"ERROR: no '**Subject:**' line found in {path.name}")
    subject = m.group(1).strip()

    # Body is everything after the first horizontal rule (--- on its own line).
    parts = re.split(r"^\s*---\s*$", text, maxsplit=1, flags=re.MULTILINE)
    body = parts[1].strip() if len(parts) == 2 else text[m.end():].strip()
    if not body:
        sys.exit(f"ERROR: empty body in {path.name}")
    return subject, body


# ------------------------------------------------------------- scheduling ---
def next_thursday_at(hour: int, minute: int, now: datetime | None = None) -> datetime:
    now = now or datetime.now(TZ)
    days_ahead = (3 - now.weekday()) % 7  # Thursday == 3
    candidate = (now + timedelta(days=days_ahead)).replace(
        hour=hour, minute=minute, second=0, microsecond=0
    )
    if candidate <= now:  # it's Thursday but already past the send time
        candidate += timedelta(days=7)
    return candidate


def compute_send_at(args) -> str | None:
    if args.draft:
        return None
    hour, minute = 6, 0
    if args.time:
        hour, minute = (int(x) for x in args.time.split(":", 1))
    if args.date:
        y, mo, d = (int(x) for x in args.date.split("-"))
        dt = datetime(y, mo, d, hour, minute, tzinfo=TZ)
    else:
        dt = next_thursday_at(hour, minute)
    return dt.isoformat()


# ------------------------------------------------------------------- main ---
def build_payload(subject, body_md, args) -> dict:
    preview = args.preview or first_sentence(body_md)
    inner = md_to_html(body_md)
    content = inner if args.raw else email_template.render(inner, preheader=preview)
    payload = {
        "subject": subject,
        "content": content,
        "preview_text": preview,
        "public": False,
        "send_at": compute_send_at(args),
    }
    group: dict[str, list] = {}
    if args.tag:
        group.setdefault("all", []).append({"type": "tag", "ids": args.tag})
    if args.segment:
        group.setdefault("all", []).append({"type": "segment", "ids": args.segment})
    if group:
        payload["subscriber_filter"] = [group]  # omitted => all subscribers
    return payload


def post_broadcast(payload: dict, api_key: str) -> dict:
    req = urllib.request.Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={"Content-Type": "application/json", "X-Kit-Api-Key": api_key},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        sys.exit(f"ERROR: Kit API {e.code} {e.reason}\n{body}")
    except urllib.error.URLError as e:
        sys.exit(f"ERROR: could not reach Kit API: {e.reason}")


def main() -> None:
    p = argparse.ArgumentParser(description="Draft/schedule a drip as a Kit broadcast.")
    p.add_argument("drip", help="Path to the drip .md file")
    p.add_argument("--date", help="Send date YYYY-MM-DD (default: next Thursday)")
    p.add_argument("--time", help="Send time HH:MM ET (default: 06:00)")
    p.add_argument("--draft", action="store_true", help="Save as draft (no send_at)")
    p.add_argument("--tag", type=int, action="append", help="Target tag id (repeatable)")
    p.add_argument("--segment", type=int, action="append", help="Target segment id")
    p.add_argument("--preview", help="Override preview text")
    p.add_argument("--raw", action="store_true",
                   help="Send raw body HTML without the branded template wrapper")
    p.add_argument("--dry-run", action="store_true", help="Print payload, don't send")
    args = p.parse_args()

    drip_path = Path(args.drip)
    if not drip_path.is_absolute():
        drip_path = (Path.cwd() / drip_path).resolve()
    if not drip_path.exists():
        sys.exit(f"ERROR: drip file not found: {drip_path}")

    subject, body_md = parse_drip(drip_path)
    payload = build_payload(subject, body_md, args)

    when = payload["send_at"]
    when_label = "DRAFT (no send time)" if when is None else f"scheduled {when}"
    print(f"Drip:    {drip_path.name}")
    print(f"Subject: {subject}")
    print(f"Preview: {payload['preview_text']}")
    print(f"Send:    {when_label}")
    print(f"Target:  {'all subscribers' if 'subscriber_filter' not in payload else payload['subscriber_filter']}")

    if args.dry_run:
        print("\n--- DRY RUN: payload (not sent) ---")
        print(json.dumps(payload, indent=2, ensure_ascii=False))
        return

    result = post_broadcast(payload, load_api_key())
    bc = result.get("broadcast", result)
    print(f"\nOK — broadcast id {bc.get('id')} created ({when_label}).")


if __name__ == "__main__":
    main()
