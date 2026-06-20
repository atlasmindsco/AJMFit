#!/usr/bin/env python3
"""
generate_drips.py — Draft Brains & Gains micro-issues from the topic backlog.

For each topic seed (from topic-plan.json) it grounds gpt-4o-mini in the FULL
ISSA source chunk and writes a faithful micro-drip into newsletter-content/drips/
in the standard template. Picks topics round-robin across themes so the backlog
that gets drafted is varied (not a single module in order).

Cost is tiny: ~1.5k input + ~350 output tokens per drip on gpt-4o-mini
(≈ $0.0005 each, so ~$0.05 for 100 drips).

Usage:
  python tools/generate_drips.py --count 6              # draft 6 varied drips
  python tools/generate_drips.py --count 6 --dry-run    # pick topics, no API calls
  python tools/generate_drips.py --theme "Nutrition & Fuel" --count 3
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLAN = ROOT / "newsletter-content" / "topic-plan.json"
DRIPS = ROOT / "newsletter-content" / "drips"
KB = ROOT / "lib" / "knowledge-base.json"
OPENAI_URL = "https://api.openai.com/v1/chat/completions"

SYSTEM = """You are Anthony J. Martin, an ISSA-certified personal trainer writing \
"Brains & Gains" — a weekly micro-newsletter that teaches ONE idea from the ISSA \
certification, readable in under 90 seconds.

Voice: warm but direct coach. Plain, confident, no hype, no filler words like \
"crucial", "essential", "important". American spelling. No emojis.

Write the issue from the SOURCE provided. Be faithful to it — do not invent facts \
or numbers. If the source is thin, teach the concept simply and accurately. Make it \
useful to a regular person who trains — translate jargon into what they should DO or \
understand, never just recite a textbook definition.

SUBJECT LINE: 4–7 words, punchy and specific, sparking curiosity or a benefit. \
NEVER start with "Understanding", "Introduction", "The role of", "A look at", "What \
is", or the concept's name in title case. Good examples of the house style: \
"The one rule that builds everything", "Why week one feels like nothing", \
"Train for the thing you actually want", "Use it or lose it".

BODY — plain markdown, NO headings (never use #), 150–220 words, exactly:
1. Open with a vivid sentence, then name and define the single concept (straight \
   from the source). Bold the concept name with **like this**.
2. 2–3 plain sentences on what it means for the reader's training.
3. A line that begins "**Do this week:**" with one concrete, doable action.
4. A one-line close — a stewardship nod or a teaser to next week.
One idea only. Do not include a title, heading, subject line, or signature in body.

Return ONLY JSON: {"subject": "<hook>", "body": "<markdown body, no headings>"}"""


def load_key() -> str:
    for line in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
        if line.startswith("OPENAI_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("ERROR: OPENAI_API_KEY not in .env.local")


def chunk_text(kb: list, source: str, index: int) -> str:
    for c in kb:
        if c["source"] == source and c["index"] == index:
            return c["content"]
    return ""


# Weak seeds: professions, pure jargon, or meta terms that make dull issues.
WEAK = re.compile(r"^(personal trainer|physical therapist|chiropractor|"
                  r"physician|dietitian|nurse|in|protection|tires|specific)$", re.I)


def pick_topics(plan: list, count: int, theme: str | None) -> list:
    pool = [t for t in plan if t["status"] == "idea"
            and not WEAK.match(t["term"])
            and (theme is None or t["theme"] == theme)]
    if theme:
        return pool[:count]
    # round-robin across themes for variety
    from collections import defaultdict, deque
    buckets = defaultdict(deque)
    for t in pool:
        buckets[t["theme"]].append(t)
    order, picked = sorted(buckets, key=lambda k: -len(buckets[k])), []
    while len(picked) < count and any(buckets.values()):
        for th in order:
            if buckets[th]:
                picked.append(buckets[th].popleft())
                if len(picked) == count:
                    break
    return picked


def draft(topic: dict, source_chunk: str, key: str) -> dict:
    user = (f"Concept: {topic['term']}\nTheme: {topic['theme']}\n"
            f"ISSA source ({topic['source']}):\n\"\"\"\n{source_chunk[:1600]}\n\"\"\"")
    body = json.dumps({
        "model": "gpt-4o-mini",
        "temperature": 0.7,
        "response_format": {"type": "json_object"},
        "messages": [{"role": "system", "content": SYSTEM},
                     {"role": "user", "content": user}],
    }).encode("utf-8")
    req = urllib.request.Request(
        OPENAI_URL, data=body, method="POST",
        headers={"Content-Type": "application/json",
                 "Authorization": f"Bearer {key}"})
    with urllib.request.urlopen(req, timeout=60) as r:
        out = json.loads(r.read().decode("utf-8"))
    return json.loads(out["choices"][0]["message"]["content"])


def next_num() -> int:
    nums = [int(p.stem.split("-", 1)[0]) for p in DRIPS.glob("*.md")
            if p.stem.split("-", 1)[0].isdigit()]
    return (max(nums) + 1) if nums else 1


def sanitize_body(body: str) -> str:
    lines = body.strip().splitlines()
    # drop any leading markdown headings or a stray subject line the model added
    while lines and re.match(r"^\s*(#{1,6}\s|\*\*Subject:|Subject:)", lines[0]):
        lines.pop(0)
    return "\n".join(lines).strip()


def write_drip(num: int, topic: dict, subject: str, body: str) -> Path:
    body = sanitize_body(body)
    subject = re.sub(r"\.$", "", subject.strip())
    path = DRIPS / f"{num:03d}-{topic['slug']}.md"
    text = (f"# Drip {num:03d} — {topic['term']}\n"
            f"Source: {topic['source']}, chunk {topic['chunk_index']}. "
            f"Theme: {topic['theme']}. Send: Thursday.\n\n"
            f"**Subject:** {subject.strip()}\n\n---\n\n{body.strip()}\n")
    path.write_text(text, encoding="utf-8")
    return path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=6)
    ap.add_argument("--theme", help="restrict to one theme")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    plan = json.loads(PLAN.read_text(encoding="utf-8"))
    topics = pick_topics(plan["topics"], args.count, args.theme)
    if not topics:
        sys.exit("No 'idea' topics match. Run generate_topic_plan.py first.")

    if args.dry_run:
        print(f"Would draft {len(topics)} drips:")
        for t in topics:
            print(f"  [{t['theme']:24}] {t['term']}")
        return

    key = load_key()
    kb = json.loads(KB.read_text(encoding="utf-8"))
    num = next_num()
    by_term = {t["term"]: t for t in plan["topics"]}
    for t in topics:
        src = chunk_text(kb, t["source"], t["chunk_index"])
        try:
            res = draft(t, src, key)
        except Exception as e:
            print(f"  SKIP {t['term']}: {e}")
            continue
        path = write_drip(num, t, res["subject"], res["body"])
        by_term[t["term"]]["status"] = "drafted"
        PLAN.write_text(json.dumps(plan, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"  drafted {path.name}  [{t['theme']}]  \"{res['subject']}\"")
        num += 1
    print("Done.")


if __name__ == "__main__":
    main()
