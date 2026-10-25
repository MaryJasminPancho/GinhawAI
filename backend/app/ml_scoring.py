"""Live XGBoost vulnerability scoring (Socioeconomic Vulnerability Scoring Engine).

Loads the model trained by `python -m ml.train` (backend/ml/models/
vulnerability_xgb.joblib) once. For each household it returns the tier, a 0–100
score and each answer's exact Tree SHAP contribution toward the high-risk tier
(XGBoost's built-in pred_contribs), which scoring.py turns into the citizen's
"top three factors". If the model file or the ML libraries are missing, `model()`
returns None and the rule-based scorer is used instead.
"""

from pathlib import Path

MODEL_PATH = Path(__file__).resolve().parent.parent / "ml" / "models" / "vulnerability_xgb.joblib"

_bundle = None
_loaded = False
_problem = "trained model not found"  # why the rule-based score is in use, for System Health


def model():
    """The trained model bundle, or None if it isn't available."""
    global _bundle, _loaded, _problem
    if not _loaded:
        _loaded = True
        try:
            import joblib  # noqa: F401  (part of the ML extras in requirements.txt)
            import xgboost  # noqa: F401

            _bundle = joblib.load(MODEL_PATH) if MODEL_PATH.exists() else None
        except ImportError as e:
            _problem = f"ML libraries not installed ({e.name}); run pip install -r requirements.txt"
            print(f"Vulnerability model not loaded ({_problem}); using the rule-based score.")
            _bundle = None
        except Exception as e:  # an incompatible or damaged model file: fall back to the rules
            _problem = f"model file could not be loaded ({type(e).__name__})"
            print(f"Vulnerability model not loaded ({type(e).__name__}: {e}); using the rule-based score.")
            _bundle = None
    return _bundle


def describe() -> str:
    b = model()
    if b is None:
        return f"Rule-based score ({_problem})"
    m = b["meta"]
    return f"XGBoost classifier, trained {m['trained_at'][:10]} (test accuracy {m['test']['accuracy']:.0%}, Cohen's Kappa {m['test']['cohen_kappa']:.2f})"


def predict(answers: dict) -> dict | None:
    """Tier, score and per-answer contributions for one household, or None without a model."""
    b = model()
    if b is None:
        return None
    import pandas as pd
    import xgboost

    from ml.features import TIERS, row_from_answers, source_field

    pipe = b["pipeline"]
    X = pd.DataFrame([row_from_answers(answers)], columns=b["columns"])
    proba = pipe.predict_proba(X)[0]
    tier = TIERS[int(proba.argmax())]
    Xt = pipe.named_steps["prep"].transform(X)
    names = list(pipe.named_steps["prep"].get_feature_names_out())
    contrib = pipe.named_steps["model"].get_booster().predict(xgboost.DMatrix(Xt, feature_names=names), pred_contribs=True)
    per_field: dict[str, float] = {}
    for name, value in zip(names, contrib[0, TIERS.index("high"), :-1]):
        field = source_field(name)
        per_field[field] = per_field.get(field, 0.0) + float(value)
    return {
        "tier": tier,
        # Expected urgency: certain high = 100, certain moderate = 50, certain low = 0.
        "score": round(100 * (proba[TIERS.index("high")] + 0.5 * proba[TIERS.index("moderate")])),
        "probabilities": {t: round(float(p), 4) for t, p in zip(TIERS, proba)},
        "contributions": per_field,
    }
