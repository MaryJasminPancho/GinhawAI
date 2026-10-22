"""The household features the vulnerability model uses.

Shared by training (ml/train.py) and the live backend (app/ml_scoring.py), so the
model always sees exactly the same columns in the same form. They are the answers
the chat collects plus income per person and the hazard exposure (flood, landslide,
storm surge) of the household's barangay.
"""

NUMERIC = ["household_size", "monthly_income", "per_capita_income", "age"]
# Hazard exposure of the household's barangay, 0 = none … 3 = high; missing (NaN) when
# the barangay isn't listed or wasn't assessed (XGBoost handles missing values natively).
HAZARDS = ["flood_level", "landslide_level", "storm_surge_level"]
HAZARD_LEVELS = {"none": 0, "low": 1, "moderate": 2, "high": 3}
BINARY = ["has_children_0_18", "has_pwd", "is_solo_parent"]
CATEGORICAL = {
    "employment_status": ["employed", "self_employed", "informal", "seasonal", "underemployed", "unemployed", "displaced"],
    "housing_type": ["owned", "rented", "with_relatives", "informal_settler"],
    "crisis_type": ["none", "medical", "death", "fire", "calamity", "job_loss"],
}
COLUMNS = NUMERIC + HAZARDS + BINARY + list(CATEGORICAL)

TIERS = ["low", "moderate", "high"]  # class 0, 1, 2


def row_from_answers(a: dict) -> dict:
    """One model input row from the chat answers (or a synthetic household)."""
    size = max(int(a.get("household_size") or 1), 1)
    income = float(a.get("monthly_income") or 0)
    return {
        "household_size": size,
        "monthly_income": income,
        "per_capita_income": income / size,
        "age": float(a.get("age") or 0),
        "has_children_0_18": int(bool(a.get("has_children_0_18"))),
        "has_pwd": int(bool(a.get("has_pwd"))),
        "is_solo_parent": int(bool(a.get("is_solo_parent"))),
        "employment_status": a.get("employment_status") or "employed",
        "housing_type": a.get("housing_type") or "owned",
        "crisis_type": a.get("crisis_type") or "none",
        **{h: _level(a.get(h)) for h in HAZARDS},
    }


def _level(v) -> float:
    if isinstance(v, (int, float)) and v == v:  # already numeric (and not NaN)
        return float(v)
    return float(HAZARD_LEVELS[v]) if v in HAZARD_LEVELS else float("nan")


def source_field(transformed_name: str) -> str:
    """Map a pipeline output column (e.g. 'cat__crisis_type_fire') back to the answer it came from."""
    name = transformed_name.split("__", 1)[-1]
    for field in CATEGORICAL:
        if name.startswith(field + "_"):
            return field
    return name
