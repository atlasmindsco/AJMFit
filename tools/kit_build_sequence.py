#!/usr/bin/env python3
"""
kit_build_sequence.py — Turn the drip queue into an evergreen Kit SEQUENCE.

Appends every drip (in the queue's interleaved order) to the "Brains & Gains —
Welcome" sequence as a weekly Thursday email, so every NEW subscriber starts at
issue 1 and receives one per week — nothing wasted on an empty list. Run after
deleting the one-off broadcasts.

Each drip becomes a sequence email: delay 7 days from the previous, restricted to
Thursday, branded, published. Idempotent — items already added (seq_email_id set)
are skipped, so it's safe to re-run / resume.

Usage:
  python tools/kit_build_sequence.py --limit 1     # test with one
  python tools/kit_build_sequence.py               # append all pending
  python tools/kit_build_sequence.py --plan        # show what would be added
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import email_template  # noqa: E402
import kit_schedule_drip as ksd  # noqa: E402
from markdown_email import first_sentence, md_to_html  # noqa: E402

QUEUE = ROOT / "newsletter-content" / "queue.json"
SEQUENCE_ID = 2800010          # "Brains & Gains — Welcome" (welcome = email 0)
TEMPLATE_ID = 5305584          # "Text only"
DELAY_DAYS = 7                 # one issue per week
SEND_DAY = "thursday"


def load_key() -> str:
    for line in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
        if line.startswith("KIT_API_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("ERROR: KIT_API_KEY not in .env.local")


def post_email(item, key) -> dict:
    subject, body_md = ksd.parse_drip(ROOT / item["file"])
    preview = first_sentence(body_md)
    content = email_template.render(md_to_html(body_md), preheader=preview)
    payload = {
        "subject": subject,
        "content": content,
        "preview_text": preview,
        "email_template_id": TEMPLATE_ID,
        "delay_value": DELAY_DAYS,
        "delay_unit": "days",
        "send_days": [SEND_DAY],
        "published": True,
    }
    req = urllib.request.Request(
        f"https://api.kit.com/v4/sequences/{SEQUENCE_ID}/emails",
        data=json.dumps(payload).encode("utf-8"), method="POST",
        headers={"Content-Type": "application/json", "X-Kit-Api-Key": key})
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        sys.exit(f"ERROR {e.code} on '{item['subject']}': {e.read().decode()}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int)
    ap.add_argument("--plan", action="store_true")
    args = ap.parse_args()

    q = json.loads(QUEUE.read_text(encoding="utf-8"))
    pending = [it for it in q["items"] if not it.get("seq_email_id")]
    if args.limit:
        pending = pending[: args.limit]

    if args.plan:
        print(f"Would append {len(pending)} drips to sequence {SEQUENCE_ID} "
              f"(weekly Thursday):")
        for i, it in enumerate(pending, 1):
            print(f"  {i:02d}. [{it['theme']:22}] {it['subject']}")
        return

    key = load_key()
    for it in pending:
        res = post_email(it, key)
        em = res.get("email", res)
        it["seq_email_id"] = em.get("id")
        it["status"] = "in_sequence"
        QUEUE.write_text(json.dumps(q, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"  +seq #{it['num']:>2} '{it['subject']}' (email id {em.get('id')})")
    print(f"Done. {len(pending)} drips now in the sequence.")


if __name__ == "__main__":
    main()
