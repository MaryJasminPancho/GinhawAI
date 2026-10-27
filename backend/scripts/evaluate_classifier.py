"""Measures a trained slot classifier on hand-written test sentences it never saw in training.
Run from the backend folder:  python scripts/evaluate_classifier.py employment_status
"""
import csv
import sys
from collections import Counter
from pathlib import Path

# make "app" importable when running this file directly (same folder layout as test_classifier.py)
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.ai.slot_classifier import classify

slot = sys.argv[1] if len(sys.argv) > 1 else "employment_status"
path = Path(__file__).resolve().parent / "test_sets" / f"{slot}.csv"

rows = list(csv.DictReader(open(path, encoding="utf-8")))   # columns: text,label
results = []
for r in rows:
    pred, conf = classify(r["text"], slot)
    results.append((r["text"], r["label"], pred, conf))

# --- per-sentence view (shows the confidence % for every answer) ---
print(f"\nModel: {slot}   |   test sentences: {len(results)}\n")
for text, true, pred, conf in results:
    mark = "OK " if pred == true else "XX "
    print(f"{mark} {conf*100:5.1f}%  predicted={pred:<15} expected={true:<15} | {text}")

# --- overall accuracy ---
correct = sum(1 for _, t, p, _ in results if t == p)
print(f"\nOVERALL ACCURACY: {correct}/{len(results)} = {correct/len(results)*100:.1f}%")

# --- accuracy if we only trust answers at/above the chat's 0.5 confidence cutoff ---
sure = [x for x in results if x[3] >= 0.5]
if sure:
    ok = sum(1 for _, t, p, _ in sure if t == p)
    print(f"Answers the chat would accept (confidence >= 50%): {len(sure)}/{len(results)}, "
          f"of which correct: {ok}/{len(sure)} = {ok/len(sure)*100:.1f}%")

# --- per-label precision / recall / F1 ---
print(f"\n{'label':<16}{'precision':>10}{'recall':>9}{'f1':>7}{'support':>9}")
labels = sorted({t for _, t, _, _ in results} | {p for _, _, p, _ in results})
f1s = []
for lab in labels:
    tp = sum(1 for _, t, p, _ in results if t == lab and p == lab)
    fp = sum(1 for _, t, p, _ in results if t != lab and p == lab)
    fn = sum(1 for _, t, p, _ in results if t == lab and p != lab)
    prec = tp / (tp + fp) if tp + fp else 0
    rec = tp / (tp + fn) if tp + fn else 0
    f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0
    sup = Counter(t for _, t, _, _ in results)[lab]
    if sup:
        f1s.append(f1)
    print(f"{lab:<16}{prec:>10.2f}{rec:>9.2f}{f1:>7.2f}{sup:>9}")
print(f"\nMACRO F1: {sum(f1s)/len(f1s):.2f}")