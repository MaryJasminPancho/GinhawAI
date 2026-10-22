# Socioeconomic Vulnerability Scoring Engine (XGBoost)

The model that gives each household its **Low / Moderate / High** tier, its 0–100 score
and its **top three contributing factors** on the citizen's score screen.

| File | What it is |
|---|---|
| `config.json` | All settings: distributions for the synthetic households (each with its public source), the labeling weights, training options. Values marked **VERIFY** must be checked against the cited source. |
| `features.py` | The answers the model uses (shared by training and the live backend). |
| `generate_dataset.py` | Builds the synthetic dataset → `data/synthetic_households.csv` (not committed; regenerate any time). |
| `train.py` | Trains and evaluates → `models/vulnerability_xgb.joblib` (used by the backend) and `reports/`. |
| `reports/evaluation_report.md` | Accuracy, Cohen's Kappa, confusion matrix, comparison with the old rule-based score, what matters most, worked examples. For the manuscript. |
| `reports/metrics.json` | The same numbers, machine-readable. |

## Retrain (after changing `config.json`)
From the `backend` folder, with the backend's Python environment:

```bash
python -m ml.generate_dataset
python -m ml.train
```

Then restart the backend. Training takes a few minutes on a laptop; no GPU needed.

## How it works
1. **Data (privacy-first, no real citizens):** synthetic households drawn from PSA poverty thresholds,
   FIES income brackets and CBMS-style indicators ("Distributional Fidelity").
2. **Labels:** CBMS-style deprivation points (income, work, housing, crisis, PWD, solo parent, children,
   senior applicant) with tier cut-offs, plus a little label noise to mimic assessor disagreement.
   **These weights stand in for social-worker judgement. Have the licensed social workers review
   `label_rubric` in `config.json`, adjust it, and retrain.**
3. **Model:** scikit-learn `Pipeline` (one-hot encoding) → `XGBClassifier` (3 classes).
   Hyper-parameters chosen by stratified 5-fold cross-validation on Cohen's Kappa.
4. **Explanations:** XGBoost's built-in **exact Tree SHAP** contributions (`pred_contribs=True`) toward
   the high-risk tier. Income per person, total income and household size are added together as one
   "income" factor (SHAP values are additive), then the top three are shown as plain sentences in
   Filipino, Bisaya or English.
5. **Fallback:** if the model file or the ML libraries are missing, the backend uses the transparent
   rule-based score in `app/scoring.py` (`rule_based_score`) and System Health shows it.

## Validity (manuscript)
The report's Kappa measures agreement with the synthetic reference labels. The manuscript's main
validity test is the **Blind Cross-Validation**: 3–5 licensed social workers rate 30–50 synthetic cases
in the admin console (**Blind Validation**), and the system's tiers are compared with theirs
(target: Cohen's Kappa ≥ 0.60).
