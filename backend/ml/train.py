"""Train and evaluate the XGBoost vulnerability classifier.

A scikit-learn Pipeline (one-hot encoding of the categorical answers) feeding an
XGBClassifier for the three tiers. Hyper-parameters are chosen by stratified
k-fold cross-validation; the held-out test set gives the reported accuracy,
macro F1 and Cohen's Kappa. Explanations use XGBoost's built-in exact Tree SHAP
contributions (pred_contribs), the same values the live backend shows citizens.

    python -m ml.train

Writes ml/models/vulnerability_xgb.joblib (used by the backend) and
ml/reports/evaluation_report.md + metrics.json (for the manuscript).
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
import xgboost
from sklearn.compose import ColumnTransformer
from sklearn.metrics import accuracy_score, classification_report, cohen_kappa_score, confusion_matrix, f1_score, make_scorer
from sklearn.model_selection import GridSearchCV, StratifiedKFold, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from xgboost import XGBClassifier

from ml.features import BINARY, CATEGORICAL, COLUMNS, NUMERIC, TIERS, source_field

HERE = Path(__file__).parent
CONFIG = json.loads((HERE / "config.json").read_text(encoding="utf-8"))


def build_pipeline(seed: int) -> Pipeline:
    pre = ColumnTransformer(
        [
            ("num", "passthrough", NUMERIC + BINARY),
            ("cat", OneHotEncoder(categories=[CATEGORICAL[c] for c in CATEGORICAL], handle_unknown="ignore", sparse_output=False), list(CATEGORICAL)),
        ],
        verbose_feature_names_out=True,
    )
    model = XGBClassifier(objective="multi:softprob", num_class=3, eval_metric="mlogloss", tree_method="hist", random_state=seed, n_jobs=1)
    return Pipeline([("prep", pre), ("model", model)])


def field_contributions(pipe: Pipeline, X: pd.DataFrame) -> pd.DataFrame:
    """Exact Tree SHAP contributions toward the HIGH-risk class, summed back per answer field."""
    Xt = pipe.named_steps["prep"].transform(X)
    names = list(pipe.named_steps["prep"].get_feature_names_out())
    dm = xgboost.DMatrix(Xt, feature_names=names)
    contrib = pipe.named_steps["model"].get_booster().predict(dm, pred_contribs=True)  # (n, classes, features + bias)
    high = contrib[:, TIERS.index("high"), :-1]
    df = pd.DataFrame(high, columns=names)
    return df.T.groupby([source_field(n) for n in names]).sum().T


def rule_based_tiers(X: pd.DataFrame) -> list[str]:
    """The current rule-based scorer, for comparison in the report."""
    sys.path.insert(0, str(HERE.parent))
    from app.scoring import derive_profile, rule_based_score

    return [rule_based_score(derive_profile(r))["tier"] for r in X.to_dict("records")]


def md_table(header: list[str], rows: list[list]) -> str:
    out = ["| " + " | ".join(header) + " |", "|" + "---|" * len(header)]
    out += ["| " + " | ".join(str(c) for c in r) + " |" for r in rows]
    return "\n".join(out)


def main():
    seed, tcfg = CONFIG["random_seed"], CONFIG["training"]
    data_path = HERE / "data" / "synthetic_households.csv"
    if not data_path.exists():
        sys.exit("No dataset yet. Run: python -m ml.generate_dataset")
    df = pd.read_csv(data_path)
    X, y = df[COLUMNS], df["tier"].map(TIERS.index)

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=tcfg["test_size"], stratify=y, random_state=seed)

    kappa = make_scorer(cohen_kappa_score)
    search = GridSearchCV(
        build_pipeline(seed), tcfg["param_grid"], scoring={"kappa": kappa, "accuracy": "accuracy", "f1_macro": "f1_macro"},
        refit="kappa", cv=StratifiedKFold(tcfg["cv_folds"], shuffle=True, random_state=seed), n_jobs=-1,
    )
    search.fit(X_train, y_train)
    pipe = search.best_estimator_
    cv = search.cv_results_
    best = search.best_index_

    pred = pipe.predict(X_test)
    acc, kap, f1m = accuracy_score(y_test, pred), cohen_kappa_score(y_test, pred), f1_score(y_test, pred, average="macro")
    cm = confusion_matrix(y_test, pred, labels=[0, 1, 2])
    per_class = classification_report(y_test, pred, labels=[0, 1, 2], target_names=TIERS, output_dict=True)

    rb = [TIERS.index(t) for t in rule_based_tiers(X_test)]
    rb_acc, rb_kap = accuracy_score(y_test, rb), cohen_kappa_score(y_test, rb)

    contrib = field_contributions(pipe, X_test)
    importance = contrib.abs().mean().sort_values(ascending=False)

    meta = {
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "rows": len(df), "train_rows": len(X_train), "test_rows": len(X_test),
        "best_params": {k.replace("model__", ""): v for k, v in search.best_params_.items()},
        "cv": {m: {"mean": round(float(cv[f"mean_test_{m}"][best]), 4), "std": round(float(cv[f"std_test_{m}"][best]), 4)} for m in ("kappa", "accuracy", "f1_macro")},
        "test": {"accuracy": round(acc, 4), "cohen_kappa": round(kap, 4), "f1_macro": round(f1m, 4),
                 "per_class": {t: {k: round(per_class[t][k], 4) for k in ("precision", "recall", "f1-score", "support")} for t in TIERS},
                 "confusion_matrix": {"labels": TIERS, "rows_true_cols_predicted": cm.tolist()}},
        "rule_based_baseline_on_test": {"accuracy": round(rb_acc, 4), "cohen_kappa": round(rb_kap, 4)},
        "global_importance_mean_abs_contribution_to_high": {k: round(float(v), 4) for k, v in importance.items()},
        "kappa_target": tcfg["kappa_target"],
        "versions": {"python": sys.version.split()[0], "xgboost": xgboost.__version__, "scikit-learn": sklearn.__version__},
        "tier_shares": df["tier"].value_counts(normalize=True).reindex(TIERS).round(4).to_dict(),
        "config_seed": seed,
    }

    (HERE / "models").mkdir(exist_ok=True)
    joblib.dump({"pipeline": pipe, "tiers": TIERS, "columns": COLUMNS, "meta": meta}, HERE / "models" / "vulnerability_xgb.joblib")

    rep = HERE / "reports"
    rep.mkdir(exist_ok=True)
    (rep / "metrics.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

    # A few worked examples (one per tier) with their top factors, for the manuscript.
    examples = []
    proba = pipe.predict_proba(X_test)
    for tier_idx, tier in enumerate(TIERS):
        idx = int(np.where(pred == tier_idx)[0][0])
        row = X_test.iloc[idx]
        top = contrib.iloc[idx].sort_values(ascending=False)
        top = [f"{f} (+{v:.2f})" for f, v in top.items() if v > 0][:3]
        examples.append([tier, f"{int(row.household_size)} {'person' if int(row.household_size) == 1 else 'people'}, ₱{row.monthly_income:,.0f}/mo, {row.employment_status}, {row.housing_type}, crisis: {row.crisis_type}",
                         f"{proba[idx][tier_idx]:.0%}", "; ".join(top) or "—"])

    passed = "meets" if kap >= tcfg["kappa_target"] else "does NOT meet"
    report = f"""# GinhawAI vulnerability model: evaluation report

Generated {meta['trained_at']} by `python -m ml.train` (XGBoost {xgboost.__version__}, scikit-learn {sklearn.__version__}).

## Data
- {len(df):,} synthetic households from `ml/config.json` (seed {seed}); no real citizen data.
- Distributions follow public statistics (PSA poverty thresholds, FIES income brackets, CBMS-style indicators); values marked VERIFY in the config must be checked against those sources.
- Reference labels: CBMS-style deprivation points with tier cut-offs, plus {CONFIG['label_rubric']['label_noise']['rate']:.0%} label noise to mimic assessor disagreement. The weights stand in for social-worker judgement and are to be reviewed by the licensed social workers.
- The sample deliberately over-represents low-income households (the system's intended users): {(df['per_capita_income'] <= CONFIG['thresholds']['poverty_per_capita_monthly']).mean():.0%} are below the per-capita poverty threshold.
- Tier shares: {", ".join(f"{t} {v:.0%}" for t, v in meta['tier_shares'].items())}.
- Split: {len(X_train):,} training / {len(X_test):,} held-out test (stratified).

## Model
scikit-learn `Pipeline`: one-hot encoding of work situation, housing and crisis; numeric and yes/no answers passed through; `XGBClassifier` (3 classes, softprob).
Hyper-parameters chosen by {tcfg['cv_folds']}-fold stratified cross-validation on Cohen's Kappa: {meta['best_params']}.

## Results (held-out test set)
{md_table(["Metric", "XGBoost", f"{tcfg['cv_folds']}-fold CV (mean ± sd)"], [
    ["Accuracy", f"{acc:.1%}", f"{meta['cv']['accuracy']['mean']:.1%} ± {meta['cv']['accuracy']['std']:.1%}"],
    ["Cohen's Kappa", f"{kap:.3f}", f"{meta['cv']['kappa']['mean']:.3f} ± {meta['cv']['kappa']['std']:.3f}"],
    ["Macro F1", f"{f1m:.3f}", f"{meta['cv']['f1_macro']['mean']:.3f} ± {meta['cv']['f1_macro']['std']:.3f}"],
])}

Target from the manuscript: Kappa ≥ {tcfg['kappa_target']} → the model **{passed}** it on the synthetic test set.

**Important:** this measures agreement with the synthetic reference labels. The manuscript's validity test is the Blind Cross-Validation against 3–5 licensed social workers on 30–50 cases (admin console → Blind Validation); report that Kappa as the main result.

### Confusion matrix (rows = reference tier, columns = predicted)
{md_table(["", *[f"pred. {t}" for t in TIERS]], [[f"**{t}**", *cm[i].tolist()] for i, t in enumerate(TIERS)])}

### Per tier
{md_table(["Tier", "Precision", "Recall", "F1", "Cases"], [[t, f"{per_class[t]['precision']:.3f}", f"{per_class[t]['recall']:.3f}", f"{per_class[t]['f1-score']:.3f}", int(per_class[t]['support'])] for t in TIERS])}

### Compared with the previous rule-based score (same test set)
{md_table(["", "Accuracy", "Cohen's Kappa"], [["Rule-based placeholder", f"{rb_acc:.1%}", f"{rb_kap:.3f}"], ["XGBoost", f"{acc:.1%}", f"{kap:.3f}"]])}

## Explainability
Each citizen's top three factors come from XGBoost's built-in **exact Tree SHAP** contributions (`pred_contribs=True`) toward the high-risk class, summed per answer and turned into plain-language sentences in Filipino, Bisaya or English.

### What matters most overall (mean absolute contribution to the high-risk score)
{md_table(["Answer", "Mean absolute contribution"], [[k, f"{v:.3f}"] for k, v in importance.items()])}

### Worked examples (one per predicted tier)
{md_table(["Predicted", "Household", "Confidence", "Top factors (contribution)"], examples)}
"""
    (rep / "evaluation_report.md").write_text(report, encoding="utf-8")
    print(f"Best params: {meta['best_params']}")
    print(f"Test accuracy {acc:.1%} | Cohen's Kappa {kap:.3f} | macro F1 {f1m:.3f}  (rule-based: {rb_acc:.1%}, kappa {rb_kap:.3f})")
    print(f"Saved model to {HERE / 'models' / 'vulnerability_xgb.joblib'} and report to {rep / 'evaluation_report.md'}")


if __name__ == "__main__":
    main()
