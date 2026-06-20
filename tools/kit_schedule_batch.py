#!/usr/bin/env python3
"""
kit_schedule_batch.py — Queue + interleaver + batch scheduler for the drips.

Turns the drip backlog into a varied (non-sequential) lineup and schedules each
issue onto a successive Thursday in Kit as a branded broadcast.

Pieces
  1. Queue        newsletter-content/queue.json — the send list with theme tags,
                  status (pending|scheduled|sent), send_at and broadcast_id.
  2. Interleaver  orders the queue so no two consecutive issues share a theme
                  (so it reads like a varied newsletter, not a course in order).
                  Deterministic (seeded) — reproducible but feels random.
  3. Scheduler    walks pending items onto the next open Thursdays (06:00 ET),
                  creates branded broadcasts, writes ids back. Idempotent.

Usage
  python tools/kit_schedule_batch.py build              # (re)build queue.json from drips/
  python tools/kit_schedule_batch.py plan               # show the interleaved schedule (dry)
  python tools/kit_schedule_batch.py schedule --limit 6 # create the broadcasts in Kit

Broadcasts target the "Brains & Gains" tag so only newsletter subscribers receive
them. Re-running never double-books: items already scheduled/sent are skipped.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import email_template  # noqa: E402
import kit_schedule_drip as ksd  # noqa: E402
from markdown_email import first_sentence, md_to_html  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DRIPS_DIR = ROOT / "newsletter-content" / "drips"
QUEUE_PATH = ROOT / "newsletter-content" / "queue.json"
BG_TAG_ID = 20490383  # "Brains & Gains" tag — broadcast audience
THURSDAY_HOUR = 6

# Theme per drip slug-prefix. Drives the interleaver. Extend as the backlog grows
# (the generator will set themes for new drips). Maps the content-plan modules.
THEME_BY_NUM = {
    range(1, 7): "Principles",        # Module 1
    range(7, 12): "Acute Variables",  # Module 2
    range(12, 18): "Workout Anatomy", # Module 3
    range(18, 21): "Recovery",        # Module 4
    range(21, 25): "Flexibility",     # Module 5
    range(25, 28): "Fuel",            # Module 6
}


def theme_for(num: int) -> str:
    for r, name in THEME_BY_NUM.items():
        if num in r:
            return name
    return "General"


# ----------------------------------------------------------------- queue ---
def theme_from_file(path: Path, num: int) -> str:
    """Prefer an explicit 'Theme: X.' line (generated drips); else map by number."""
    import re
    head = path.read_text(encoding="utf-8")[:400]
    m = re.search(r"Theme:\s*([^.\n]+)", head)
    return m.group(1).strip() if m else theme_for(num)


def build_queue() -> dict:
    items = []
    for path in sorted(DRIPS_DIR.glob("*.md")):
        num = int(path.stem.split("-", 1)[0])
        subject, _ = ksd.parse_drip(path)
        items.append({
            "num": num,
            "slug": path.stem,
            "file": str(path.relative_to(ROOT)).replace("\\", "/"),
            "theme": theme_from_file(path, num),
            "subject": subject,
            "status": "pending",
            "send_at": None,
            "broadcast_id": None,
        })
    ordered = interleave(items)
    return {"thursday_hour": THURSDAY_HOUR, "tag_id": BG_TAG_ID, "items": ordered}


def interleave(items: list[dict], seed: int = 1988) -> list[dict]:
    """Order so consecutive items avoid sharing a theme. Deterministic shuffle
    within each theme (seeded), then round-robin across themes."""
    from collections import defaultdict, deque

    buckets: dict[str, list] = defaultdict(list)
    for it in items:
        buckets[it["theme"]].append(it)

    # Deterministic per-theme shuffle without Math.random: rotate by seed.
    for theme, lst in buckets.items():
        lst.sort(key=lambda x: (x["num"] * 2654435761 + seed) % 100003)

    queues = {t: deque(lst) for t, lst in buckets.items()}
    out: list[dict] = []
    last_theme = None
    while any(queues.values()):
        # pick the largest remaining bucket whose theme != last_theme
        cand = sorted((t for t, q in queues.items() if q),
                      key=lambda t: (-len(queues[t]), t))
        choice = next((t for t in cand if t != last_theme), cand[0])
        out.append(queues[choice].popleft())
        last_theme = choice
    return out


def load_queue() -> dict:
    if QUEUE_PATH.exists():
        return json.loads(QUEUE_PATH.read_text(encoding="utf-8"))
    return build_queue()


def save_queue(q: dict) -> None:
    QUEUE_PATH.write_text(json.dumps(q, indent=2, ensure_ascii=False), encoding="utf-8")


# ------------------------------------------------------------- schedule ---
def upcoming_thursdays(n: int, used: set[str]) -> list[str]:
    """Next n Thursday 06:00 ET ISO timestamps, skipping any already used."""
    out, dt = [], ksd.next_thursday_at(THURSDAY_HOUR, 0)
    from datetime import timedelta
    while len(out) < n:
        iso = dt.isoformat()
        if iso not in used:
            out.append(iso)
        dt += timedelta(days=7)
    return out


def broadcast_payload(item: dict, send_at: str) -> dict:
    path = ROOT / item["file"]
    subject, body_md = ksd.parse_drip(path)
    preview = first_sentence(body_md)
    content = email_template.render(md_to_html(body_md), preheader=preview)
    return {
        "subject": subject,
        "content": content,
        "preview_text": preview,
        "public": False,
        "send_at": send_at,
        "subscriber_filter": [{"all": [{"type": "tag", "ids": [BG_TAG_ID]}]}],
    }


def cmd_build(_):
    q = build_queue()
    save_queue(q)
    print(f"Built queue.json with {len(q['items'])} items.")
    cmd_plan(_)


def cmd_plan(_):
    q = load_queue()
    pending = [it for it in q["items"] if it["status"] == "pending"]
    used = {it["send_at"] for it in q["items"] if it["send_at"]}
    dates = upcoming_thursdays(len(pending), used)
    print(f"\n{'#':>2}  {'THEME':16}  {'THURSDAY':25}  SUBJECT")
    print("-" * 78)
    already = [it for it in q["items"] if it["status"] != "pending"]
    for it in already:
        print(f"{it['num']:>2}  {it['theme']:16}  {str(it['send_at']):25}  "
              f"[{it['status']}] {it['subject']}")
    for it, d in zip(pending, dates):
        print(f"{it['num']:>2}  {it['theme']:16}  {d:25}  {it['subject']}")


def cmd_schedule(args):
    q = load_queue()
    pending = [it for it in q["items"] if it["status"] == "pending"]
    if args.limit:
        pending = pending[: args.limit]
    used = {it["send_at"] for it in q["items"] if it["send_at"]}
    dates = upcoming_thursdays(len(pending), used)

    if args.dry_run:
        print("DRY RUN — would schedule:")
        for it, d in zip(pending, dates):
            print(f"  [{it['theme']:16}] {d}  {it['subject']}")
        return

    api_key = ksd.load_api_key()
    for it, send_at in zip(pending, dates):
        payload = broadcast_payload(it, send_at)
        result = ksd.post_broadcast(payload, api_key)
        bc = result.get("broadcast", result)
        it["status"] = "scheduled"
        it["send_at"] = send_at
        it["broadcast_id"] = bc.get("id")
        save_queue(q)  # persist after each so a failure doesn't lose progress
        print(f"scheduled #{it['num']} '{it['subject']}' -> {send_at} (id {bc.get('id')})")
    print("Done.")


def main():
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("build", help="(re)build queue.json from drips/")
    sub.add_parser("plan", help="show the interleaved schedule (no API calls)")
    s = sub.add_parser("schedule", help="create the broadcasts in Kit")
    s.add_argument("--limit", type=int, help="schedule at most N pending items")
    s.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    {"build": cmd_build, "plan": cmd_plan, "schedule": cmd_schedule}[args.cmd](args)


if __name__ == "__main__":
    main()
