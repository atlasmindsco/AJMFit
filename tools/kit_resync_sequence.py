#!/usr/bin/env python3
"""
kit_resync_sequence.py — Re-render every email already in the sequence from
source and PATCH it in Kit. Run after changing email_template.py so live
sequence emails (welcome + 51 drips) pick up the new design.

Usage:
  python tools/kit_resync_sequence.py --limit 1   # test on the welcome only
  python tools/kit_resync_sequence.py             # resync welcome + all drips
"""
from __future__ import annotations

import argparse
import json
import re
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
SEQ = 2800010
WELCOME_EMAIL_ID = 9983940
WELCOME_MD = ROOT / "newsletter-content" / "welcome-email.md"


def key() -> str:
    for l in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
        if l.startswith("KIT_API_KEY="):
            return l.split("=", 1)[1].strip()
    sys.exit("no KIT_API_KEY")


def patch(email_id: int, content: str, k: str) -> int:
    req = urllib.request.Request(
        f"https://api.kit.com/v4/sequences/{SEQ}/emails/{email_id}",
        data=json.dumps({"content": content}).encode("utf-8"), method="PATCH",
        headers={"Content-Type": "application/json", "X-Kit-Api-Key": k})
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            return r.status
    except urllib.error.HTTPError as e:
        sys.exit(f"ERROR {e.code} on email {email_id}: {e.read().decode()}")


def render_welcome() -> str:
    text = WELCOME_MD.read_text(encoding="utf-8")
    parts = re.split(r"^\s*---\s*$", text, flags=re.M)
    meta, body = parts[1], parts[2]
    preview = re.search(r"\*\*Preview text:\*\*\s*(.+)", meta).group(1).strip()
    return email_template.render(md_to_html(body.strip()), preheader=preview)


def render_drip(item) -> str:
    subject, body = ksd.parse_drip(ROOT / item["file"])
    return email_template.render(md_to_html(body), preheader=first_sentence(body))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int)
    args = ap.parse_args()
    k = key()
    q = json.loads(QUEUE.read_text(encoding="utf-8"))

    jobs = [("welcome", WELCOME_EMAIL_ID, render_welcome())]
    for it in q["items"]:
        if it.get("seq_email_id"):
            jobs.append((it["subject"], it["seq_email_id"], None, it))
    if args.limit:
        jobs = jobs[: args.limit]

    for job in jobs:
        label, email_id = job[0], job[1]
        content = job[2] if job[2] is not None else render_drip(job[3])
        code = patch(email_id, content, k)
        print(f"  patched [{email_id}] {label[:46]} -> HTTP {code}")
    print(f"Done. Resynced {len(jobs)} emails.")


if __name__ == "__main__":
    main()
