#!/usr/bin/env python3
"""
generate_topic_plan.py — Mine the ISSA knowledge base into a themed backlog of
micro-drip topic seeds. This is the automation backbone: "numerous newsletters
lined up", each seed carrying its source excerpt so the drafter stays faithful.

Extracts glossary-style "Term — definition" / "Term: definition" entries from
lib/knowledge-base.json, filters book-metadata noise, dedupes, assigns a theme
(for the interleaver), and writes newsletter-content/topic-plan.json.

Usage:
  python tools/generate_topic_plan.py            # build the plan
  python tools/generate_topic_plan.py --show 25  # also print a sample
"""
from __future__ import annotations

import argparse
import json
import re
from collections import OrderedDict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KB = ROOT / "lib" / "knowledge-base.json"
OUT = ROOT / "newsletter-content" / "topic-plan.json"

# Term [— : –] Definition.  Term = 1–5 capitalised words.
ENTRY = re.compile(
    r"(?<![A-Za-z])([A-Z][A-Za-z]+(?:[ \-/][A-Za-z]+){0,4})\s*[—–:\-]\s+"
    r"([A-Z][^\n]{25,220}?[.!?])(?:\s|$)"
)

# Drop these — book front-matter / metadata, not teachable concepts.
NOISE = re.compile(
    r"edition|comprehensive guide|official course|copyright|all rights|"
    r"isbn|chapter|figure|table of contents|references|appendix|@|http|"
    r"www\.|certified personal trainer manual|specialist course", re.I
)
# Citation / journal / exercise-row noise in the definition text.
CITATION = re.compile(
    r"journal|meta-analys|umbrella review|systematic review|doi|et al|"
    r'vol\.|pp\.|“|”|"|prime mover|begin lying|begin seated|measure in|'
    r"reps?\b.*sets?\b|—\s*$", re.I
)
STOP_TERMS = {"Note", "Example", "Tip", "Warning", "Source", "Key", "Goal",
              "Step", "Phase", "Page", "Figure", "Table", "ISSA", "Experiences",
              "Thigh measurement", "Sanitizing", "Cleaning"}

# Keyword -> theme. First match wins; order matters (specific first).
THEME_RULES = [
    ("Recovery & Adaptation", r"recover|sleep|overtrain|fatigue|rest|adapt|stress|gas\b"),
    ("Mobility & Correctives", r"mobil|stretch|fascia|posture|joint|rom\b|flexib|myofascial|corrective|muscle imbalance"),
    ("Anatomy & Movement", r"muscle|tendon|ligament|joint|spine|rotator|fiber|anatom|skeleton|nervous"),
    ("Nutrition & Fuel", r"protein|carb|fat\b|calorie|nutri|vitamin|mineral|hydrat|supplement|macro|micronutrient|diet"),
    ("Programming & Variables", r"set|rep|load|intensity|volume|tempo|periodiz|progress|overload|density|program"),
    ("Cardio & Energy", r"aerobic|anaerobic|cardio|heart rate|vo2|energy system|endurance|metabolic"),
    ("Assessment & Safety", r"assess|screen|risk|injury|contraindicat|safety|posture|evaluat"),
]


def theme_for(term: str, definition: str) -> str:
    text = f"{term} {definition}".lower()
    for name, pat in THEME_RULES:
        if re.search(pat, text):
            return name
    return "Training Foundations"


def slugify(term: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", term.lower()).strip("-")[:48]


def mine() -> list[dict]:
    data = json.loads(KB.read_text(encoding="utf-8"))
    seen: "OrderedDict[str, dict]" = OrderedDict()
    for chunk in data:
        content = chunk["content"]
        for m in ENTRY.finditer(content):
            term = re.sub(r"\s+", " ", m.group(1)).strip()
            definition = re.sub(r"\s+", " ", m.group(2)).strip()
            if term in STOP_TERMS or term.isupper():
                continue
            if NOISE.search(term) or NOISE.search(definition):
                continue
            if CITATION.search(definition):
                continue
            if len(definition.split()) < 6 or len(definition.split()) > 34:
                continue
            if sum(c.isdigit() for c in definition) > 8:  # data rows
                continue
            key = term.lower()
            if key in seen:
                continue
            seen[key] = {
                "term": term,
                "slug": slugify(term),
                "theme": theme_for(term, definition),
                "source": chunk["source"],
                "chunk_index": chunk["index"],
                "excerpt": definition,
                "status": "idea",   # idea -> drafted -> scheduled -> sent
            }
    return list(seen.values())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--show", type=int, default=0, help="print N sample topics")
    args = ap.parse_args()

    topics = mine()
    from collections import Counter
    by_theme = Counter(t["theme"] for t in topics)
    OUT.write_text(json.dumps({"topics": topics}, indent=2, ensure_ascii=False),
                   encoding="utf-8")

    print(f"Mined {len(topics)} unique topic seeds -> {OUT.relative_to(ROOT)}")
    print("\nBy theme:")
    for theme, n in by_theme.most_common():
        print(f"  {n:4d}  {theme}")
    if args.show:
        print(f"\nSample ({args.show}):")
        step = max(1, len(topics) // args.show)
        for t in topics[::step][: args.show]:
            print(f"  [{t['theme']:24}] {t['term']} — {t['excerpt'][:64]}")


if __name__ == "__main__":
    main()
