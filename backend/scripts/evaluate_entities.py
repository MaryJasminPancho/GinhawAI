"""Module 20 test: does the extractor pull the right income / household size / age out of free text?

Compares the NEW extractor (app/amounts.py, used by the chat) with the OLD rule ("first number wins") on
test_sets/entities.csv. Income is checked after conversion to PHP per month. expected "none" means the extractor must
stay silent (the chat then asks the model / Gemini); a wrong number is worse than no number.
Run from the backend folder:  python scripts/evaluate_entities.py
"""
import csv
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import chatflow
from app.amounts import parse_count, parse_monthly_income


def old_rule(slot, text):
    """The behaviour before module 20 was finished: first number in the text, k/libo/mil multiplier, no period."""
    t = text.lower().replace(",", "").replace("₱", "").replace("php", "")
    m = re.search(r"(\d+(?:\.\d+)?)\s*(k|thousand|libo|mil)?", t)
    if not m:
        return None
    v = float(m.group(1)) * (1000 if m.group(2) else 1)
    return int(v) if slot != "monthly_income" else v


def new_rule(slot, text):
    low = text.lower()
    return parse_monthly_income(low) if slot == "monthly_income" else parse_count(low, slot)


def same(got, expected):
    if expected == "none":
        return got is None
    return got is not None and abs(float(got) - float(expected)) < 0.5


rows = list(csv.DictReader(open(Path(__file__).resolve().parent / "test_sets" / "entities.csv", encoding="utf-8")))
res = {"old": [0, 0, 0], "new": [0, 0, 0]}  # correct, wrong, silent
bad = []
for r in rows:
    for name, fn in (("old", old_rule), ("new", new_rule)):
        got = fn(r["slot"], r["text"])
        if same(got, r["expected"]):
            res[name][0] += 1
        elif got is None:
            res[name][2] += 1
            if name == "new":
                bad.append(("silent", r, got))
        else:
            res[name][1] += 1
            if name == "new":
                bad.append(("WRONG", r, got))

n = len(rows)
print(f"\nSentences: {n}")
print(f"{'':<14}{'correct':>9}{'wrong':>8}{'silent':>8}")
for name in ("old", "new"):
    c, w, s = res[name]
    print(f"{name + ' rule':<14}{c:>6} ({c/n*100:4.1f}%){w:>6}{s:>8}")

print("\n--- new rule: not correct ---")
for kind, r, got in bad:
    print(f"{kind:<7} {r['slot']:<15} expected={r['expected']:<9} got={got!s:<10} | {r['text']}")

print("\nBy slot (new rule):")
for slot in ("monthly_income", "household_size", "age"):
    sub = [r for r in rows if r["slot"] == slot]
    ok = sum(1 for r in sub if same(new_rule(slot, r["text"]), r["expected"]))
    print(f"  {slot:<16}{ok}/{len(sub)} = {ok/len(sub)*100:.1f}%")

# also confirm the chat entry point (parse_for_slot) gives the same answers
mism = 0
for r in rows:
    if r["slot"] == "monthly_income":
        a, b = chatflow.parse_for_slot("monthly_income", r["text"], r["lang"]), new_rule("monthly_income", r["text"])
        if (a is None) != (b is None) or (a is not None and abs(a - b) > 0.5):
            mism += 1
print(f"\nchatflow.parse_for_slot agrees with the extractor on every income row: {'yes' if mism == 0 else f'NO ({mism} differ)'}")
