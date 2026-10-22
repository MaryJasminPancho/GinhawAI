"""Generate the synthetic household dataset and its reference labels.

Distributions and label weights come from ml/config.json (each value notes its
public source). No real citizen data is used: this is the privacy-preserving
"Distributional Fidelity" approach described in the manuscript.

    python -m ml.generate_dataset
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd

from ml.features import COLUMNS, HAZARD_LEVELS, HAZARDS, TIERS, row_from_answers

HERE = Path(__file__).parent
CONFIG = json.loads((HERE / "config.json").read_text(encoding="utf-8"))


def _pick(rng, spec: dict, n: int):
    w = np.array(spec["weights"], dtype=float)
    return rng.choice(spec["values"], size=n, p=w / w.sum())


def generate(n: int, seed: int, cfg: dict = CONFIG) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    p = cfg["probabilities"]
    size = _pick(rng, cfg["household_size"], n).astype(int)
    employment = _pick(rng, cfg["employment_status"], n)
    inc = cfg["monthly_income"]
    medians = np.array([inc["median_by_employment"][e] for e in employment], dtype=float)
    # Bigger households tend to have a bit more earning capacity.
    medians *= 1 + 0.06 * (size - 4).clip(-3, 4)
    income = np.exp(np.log(medians) + rng.normal(0, inc["sigma"], n)).clip(inc["minimum"], inc["maximum"])
    income = (income / 100).round() * 100  # people answer in round numbers
    kids = (size >= 2) & (rng.random(n) < p["has_children_if_household_2_plus"])
    rows = []
    for i in range(n):
        rows.append(row_from_answers({
            "household_size": size[i],
            "monthly_income": income[i],
            "age": int(rng.integers(cfg["age"]["minimum"], cfg["age"]["maximum"] + 1)),
            "has_children_0_18": bool(kids[i]),
            "has_pwd": bool(rng.random() < p["has_pwd"]),
            "is_solo_parent": bool(kids[i] and rng.random() < p["is_solo_parent_if_children"]),
            "employment_status": employment[i],
            "housing_type": None,  # filled below
            "crisis_type": None,
        }))
    df = pd.DataFrame(rows, columns=COLUMNS)
    # Place each household in a real Cebu City barangay (its actual hazard levels);
    # a few get no barangay at all, like a citizen typing one that isn't listed.
    haz = pd.read_csv(HERE / "barangay_hazards.csv", dtype=str).fillna("")
    pick = rng.integers(0, len(haz), n)
    unlisted = rng.random(n) < cfg["barangay_hazards"]["unlisted_barangay_share"]
    for h in HAZARDS:
        levels = haz[h].map(lambda v: HAZARD_LEVELS.get(v, np.nan)).to_numpy(dtype=float)[pick]
        levels[unlisted] = np.nan
        df[h] = levels
    df["housing_type"] = _pick(rng, cfg["housing_type"], n)
    df["crisis_type"] = _pick(rng, cfg["crisis_type"], n)
    # A sudden loss of income is far more likely when the earner just lost their job.
    job_loss = (df["employment_status"] == "displaced") & (rng.random(n) < 0.5)
    df.loc[job_loss, "crisis_type"] = "job_loss"
    df["deprivation_points"] = df.apply(lambda r: rubric_points(r, cfg), axis=1)
    df["tier"] = [label_for(pts, cfg) for pts in df["deprivation_points"]]
    df["tier"] = add_label_noise(df["tier"].to_numpy(), rng, cfg["label_rubric"]["label_noise"]["rate"])
    return df


def rubric_points(r, cfg: dict = CONFIG) -> float:
    """CBMS-style deprivation points for one household (the reference judgement the model learns)."""
    lr, t = cfg["label_rubric"], cfg["thresholds"]
    pts = 0.0
    pc = r["per_capita_income"]
    income_deprived = pc <= t["poverty_per_capita_monthly"]
    if pc <= t["food_per_capita_monthly"]:
        pts += lr["income"]["below_food_threshold"]
    elif pc <= t["poverty_per_capita_monthly"]:
        pts += lr["income"]["below_poverty_threshold"]
    elif pc <= 1.5 * t["poverty_per_capita_monthly"]:
        pts += lr["income"]["below_1_5x_poverty_threshold"]
    pts += lr["employment"].get(r["employment_status"], 0.0)
    pts += lr["housing"].get(r["housing_type"], 0.0)
    if r["crisis_type"] != "none":
        pts += lr["crisis"].get(r["crisis_type"], 0.0)
        if income_deprived:
            pts += lr["crisis_while_income_deprived_bonus"]
    pts += lr["has_pwd"] * r["has_pwd"] + lr["is_solo_parent"] * r["is_solo_parent"]
    if r["has_children_0_18"] and r["household_size"] >= 5:
        pts += lr["children_in_household_of_5_plus"]
    if r["age"] >= 60:
        pts += lr["senior_applicant_60_plus"]
    if r["household_size"] >= 7:
        pts += lr["household_7_plus"]
    # Hazard exposure: worst of flood / landslide / storm surge, scaled by how exposed the housing is.
    known = [r[h] for h in HAZARDS if r[h] == r[h]]  # skip NaN (unlisted barangay)
    if known:
        worst = {v: k for k, v in HAZARD_LEVELS.items()}[int(max(known))]
        pts += lr["hazard"]["points_by_worst_level"][worst] * lr["hazard"]["housing_multiplier"].get(r["housing_type"], 1.0)
    return round(pts, 2)


def label_for(points: float, cfg: dict = CONFIG) -> str:
    cut = cfg["label_rubric"]["tier_cutoffs"]
    return "high" if points >= cut["high_at_least"] else "moderate" if points >= cut["moderate_at_least"] else "low"


def add_label_noise(tiers: np.ndarray, rng, rate: float) -> np.ndarray:
    out = tiers.copy()
    for i in np.where(rng.random(len(out)) < rate)[0]:
        k = TIERS.index(out[i])
        # low or high can only move to moderate; moderate moves up or down
        out[i] = TIERS[1] if k != 1 else TIERS[1 + rng.choice([-1, 1])]
    return out


def main():
    df = generate(CONFIG["rows"], CONFIG["random_seed"])
    out = HERE / "data" / "synthetic_households.csv"
    out.parent.mkdir(exist_ok=True)
    df.to_csv(out, index=False)
    print(f"Wrote {len(df):,} synthetic households to {out}")
    print("Tier shares:", (df["tier"].value_counts(normalize=True).reindex(TIERS).round(3)).to_dict())


if __name__ == "__main__":
    main()
