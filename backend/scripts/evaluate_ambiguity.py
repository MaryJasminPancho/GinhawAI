"""Module 22 test: do ambiguous Taglish/Bisaya words ("wala", "sakit", "kita", "amin"...) get the right meaning?

Runs every sentence in test_sets/ambiguity.csv through the same steps as the chat (without Gemini):
  1) rule parser  (chatflow.parse_for_slot)
  2) XLM-R classifier, only if the parser could not tell and the slot has a model (accepted at confidence >= 0.5)
A sentence that neither step can answer is handed to Gemini in the real chat, so it is counted as "deferred", not wrong.
Run from the backend folder:  python scripts/evaluate_ambiguity.py          (add --rules-only to skip the models)
"""
import csv
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import chatflow

RULES_ONLY = "--rules-only" in sys.argv
if not RULES_ONLY:
    from app.ai.slot_classifier import classify

# Same mapping as SLOT_MODELS in app/routers/sessions.py (copied so this script needs no database/.env). Keep in sync.
SLOT_MODELS = {
    "employment_status": "employment_status", "housing_type": "housing_type", "crisis_type": "crisis_type",
    "has_children_0_18": "yes_no", "has_pwd": "yes_no", "has_senior": "yes_no", "is_solo_parent": "yes_no",
}
MIN_CONF = 0.5

path = Path(__file__).resolve().parent / "test_sets" / "ambiguity.csv"
rows = list(csv.DictReader(open(path, encoding="utf-8")))


def answer(slot, text, lang):
    """Returns (value, source). value None = nobody could tell (the chat would ask Gemini)."""
    v = chatflow.parse_for_slot(slot, text, lang)
    if v is not None:
        return ("yes" if v is True else "no" if v is False else v), "rules"
    key = SLOT_MODELS.get(slot)
    if key and not RULES_ONLY:
        label, conf = classify(text, key)
        if label != "unclear" and conf >= MIN_CONF:
            return label, "model"
    return None, "deferred"


stats = defaultdict(lambda: [0, 0, 0])  # word -> [correct, wrong, deferred]
wrong, correct, deferred = [], 0, 0
for r in rows:
    got, src = answer(r["slot"], r["text"], r["lang"])
    exp = r["expected"]
    if got is None:
        # for an "unclear" sentence, staying silent is the right behaviour
        ok = exp == "unclear"
        if ok:
            correct += 1; stats[r["word"]][0] += 1
        else:
            deferred += 1; stats[r["word"]][2] += 1
    elif got == exp:
        correct += 1; stats[r["word"]][0] += 1
    else:
        wrong.append((r, got, src)); stats[r["word"]][1] += 1

n = len(rows)
print(f"\nSentences: {n}   mode: {'rules only' if RULES_ONLY else 'rules + models'}")
print(f"Correct (incl. correctly staying unsure): {correct}/{n} = {correct/n*100:.1f}%")
print(f"Deferred to Gemini (not wrong):           {deferred}/{n}")
print(f"WRONG answers (the real problem):         {len(wrong)}/{n} = {len(wrong)/n*100:.1f}%")

print("\n--- WRONG answers ---")
for r, got, src in wrong:
    print(f"XX [{src}] {r['slot']:<18} expected={r['expected']:<16} got={got:<16} | {r['text']}")

print(f"\n{'word':<12}{'correct':>8}{'wrong':>7}{'deferred':>10}")
for w, (c, x, d) in sorted(stats.items(), key=lambda kv: -kv[1][1]):
    print(f"{w:<12}{c:>8}{x:>7}{d:>10}")
