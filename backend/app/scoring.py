"""Vulnerability scoring + explainable eligibility evaluation.

PLACEHOLDER SCORING: the XGBoost classifier described in the manuscript isn't
trained yet, so `score_vulnerability` uses transparent, documented points based
on PSA poverty indicators. It returns the same shape the model will
(score 0–100, tier, top contributing factors), so swapping in the model later
only changes this one function.

Eligibility is evaluated directly against the rules stored in
eligibility_criteria — the same rows LGU staff edit in the admin console.
"""

from datetime import date

# PSA 2023 poverty statistics (approximate monthly, per person).
FOOD_THRESHOLD_MONTHLY = 1950
POVERTY_THRESHOLD_MONTHLY = 2790

TIERS = ("high", "moderate", "low")

# ---------------------------------------------------------------------------
# Friendly labels for attributes (used in explanations and the admin rule form)
# ---------------------------------------------------------------------------
ATTRIBUTE_LABELS = {
    "monthly_income": "Monthly household income (₱)",
    "household_size": "People in the household",
    "per_capita_income": "Monthly income per person (₱)",
    "age": "Age of the applicant",
    "employment_status": "Employment status",
    "housing_type": "Housing situation",
    "barangay_code": "Barangay",
    "has_children_0_18": "Has children 0–18 or a pregnant member",
    "has_member_age_0_18_or_pregnant": "Has children 0–18 or a pregnant member",
    "children_0_18": "Has children 0–18",
    "has_pwd": "Has a household member with disability (PWD)",
    "is_pwd": "Has a household member with disability (PWD)",
    "is_solo_parent": "Solo parent",
    "crisis_type": "Current crisis",
    "has_crisis": "Currently facing a crisis",
    "is_unemployed": "Currently without work",
    "is_indigent_or_vulnerable": "Low-income or vulnerable household",
    "belongs_to_priority_worker_group": "Belongs to a priority worker group",
    # Can't be known from the chat — verified at the office:
    "listed_in_targeting_system": "Listed in the DSWD Listahanan / targeting system",
    "not_government_employee_or_elected_official": "Not a government employee or elected official",
    "not_receiving_other_dswd_program": "Not receiving a similar DSWD program",
    "has_supporting_documents_for_assistance_type": "Has supporting documents for the type of help needed",
    "physically_fit_for_assigned_task": "Physically fit for the assigned work",
}

# Attributes the evaluator can compute from the chat answers (shown in the admin rule form).
COMPUTED_ATTRIBUTES = [
    "monthly_income", "household_size", "per_capita_income", "age", "employment_status", "housing_type",
    "barangay_code", "has_children_0_18", "has_pwd", "is_solo_parent", "crisis_type", "has_crisis",
    "is_unemployed", "is_indigent_or_vulnerable", "belongs_to_priority_worker_group",
]

EMPLOYMENT_VALUES = ["employed", "self_employed", "informal", "seasonal", "underemployed", "unemployed", "displaced"]
HOUSING_VALUES = ["owned", "rented", "with_relatives", "informal_settler"]
CRISIS_VALUES = ["none", "medical", "death", "fire", "calamity", "job_loss"]

VALUE_LABELS = {
    "employed": "regular job", "self_employed": "self-employed / small business", "informal": "informal / daily wage",
    "seasonal": "seasonal work", "underemployed": "not enough work", "unemployed": "no work", "displaced": "recently lost job",
    "owned": "own house", "rented": "renting", "with_relatives": "living with relatives", "informal_settler": "informal settler",
    "none": "none", "medical": "medical emergency", "death": "death in the family", "fire": "fire", "calamity": "flood / typhoon / calamity",
    "job_loss": "sudden loss of income",
}


def derive_profile(entities: dict) -> dict:
    """Turn raw chat answers into every attribute a rule can reference."""
    income = _num(entities.get("monthly_income"))
    size = max(int(_num(entities.get("household_size")) or 1), 1)
    per_capita = income / size if income is not None else None
    employment = entities.get("employment_status")
    crisis = entities.get("crisis_type")
    has_pwd = entities.get("has_pwd")
    solo = entities.get("is_solo_parent")
    kids = entities.get("has_children_0_18")

    p = {
        "monthly_income": income,
        "household_size": size if entities.get("household_size") is not None else None,
        "per_capita_income": round(per_capita, 2) if per_capita is not None else None,
        "age": _num(entities.get("age")),
        "employment_status": employment,
        "housing_type": entities.get("housing_type"),
        "barangay_code": entities.get("barangay_code"),
        "has_children_0_18": kids,
        "has_member_age_0_18_or_pregnant": kids,
        "children_0_18": (1 if kids else 0) if kids is not None else None,
        "has_pwd": has_pwd,
        "is_pwd": has_pwd,
        "is_solo_parent": solo,
        "crisis_type": crisis,
        "has_crisis": (crisis not in (None, "none")) if crisis is not None else None,
        "is_unemployed": (employment in ("unemployed", "displaced")) if employment else None,
    }
    if per_capita is not None:
        p["is_indigent_or_vulnerable"] = bool(
            per_capita <= POVERTY_THRESHOLD_MONTHLY * 1.5 or has_pwd or solo or p["has_crisis"]
        )
    if employment:
        p["belongs_to_priority_worker_group"] = bool(
            employment in ("displaced", "underemployed", "seasonal", "unemployed", "informal") or has_pwd or solo
        )
    return {k: v for k, v in p.items() if v is not None}


# ---------------------------------------------------------------------------
# Vulnerability score (placeholder for the XGBoost model)
# ---------------------------------------------------------------------------
FACTOR_TEXT = {
    "income": {
        "en": "Household income per person is {v} a month, {rel} the poverty line (₱{line:,}).",
        "fil": "Ang kita kada tao ay {v} kada buwan, {rel} sa poverty line (₱{line:,}).",
        "ceb": "Ang kita matag tawo kay {v} kada bulan, {rel} sa poverty line (₱{line:,}).",
    },
    "employment": {
        "en": "Main earner's work situation: {v}.",
        "fil": "Kalagayan ng trabaho: {v}.",
        "ceb": "Kahimtang sa trabaho: {v}.",
    },
    "housing": {"en": "Housing: {v}.", "fil": "Tirahan: {v}.", "ceb": "Puy-anan: {v}."},
    "crisis": {"en": "Currently facing a crisis: {v}.", "fil": "May kinakaharap na krisis: {v}.", "ceb": "Adunay krisis karon: {v}."},
    "pwd": {"en": "A household member has a disability.", "fil": "May miyembrong may kapansanan.", "ceb": "Adunay miyembro nga may kakulangan."},
    "solo": {"en": "Solo parent household.", "fil": "Solo parent ang nag-aalaga.", "ceb": "Solo parent ang nag-atiman."},
    "children": {"en": "There are children or a pregnant member to support.", "fil": "May mga anak o buntis na sinusuportahan.", "ceb": "Adunay mga bata o mabdos nga gisuportahan."},
    "size": {"en": "Large household of {v} people.", "fil": "Malaking pamilya na may {v} katao.", "ceb": "Dako nga pamilya nga adunay {v} ka tawo."},
}

REL = {
    "en": {"below": "below", "near": "just above", "above": "above"},
    "fil": {"below": "mas mababa", "near": "bahagyang mas mataas", "above": "mas mataas"},
    "ceb": {"below": "ubos", "near": "gamay ra nga taas", "above": "taas"},
}

TIER_MESSAGE = {
    "high": {
        "en": "Your household may need support right away. Programs that can help quickly are listed first.",
        "fil": "Maaaring kailangan agad ng tulong ng inyong pamilya. Nauuna sa listahan ang mga programang makakatulong agad.",
        "ceb": "Mahimong kinahanglan dayon sa inyong pamilya ang tabang. Nag-una sa lista ang mga programa nga makatabang dayon.",
    },
    "moderate": {
        "en": "Your household may qualify for some support programs.",
        "fil": "Maaaring kwalipikado ang inyong pamilya sa ilang programa ng tulong.",
        "ceb": "Mahimong kwalipikado ang inyong pamilya sa pipila ka programa sa tabang.",
    },
    "low": {
        "en": "Your household's need looks lower right now, but you can still check the programs below.",
        "fil": "Mukhang mas mababa ang pangangailangan ngayon, pero maaari pa ring tingnan ang mga programa sa ibaba.",
        "ceb": "Morag ubos ang panginahanglan karon, apan mahimo gihapon nimong tan-awon ang mga programa sa ubos.",
    },
}


def score_vulnerability(profile: dict, lang: str = "en") -> dict:
    lang = lang if lang in ("en", "fil", "ceb") else "en"
    factors: list[tuple[int, str]] = []

    per_capita = profile.get("per_capita_income")
    if per_capita is not None:
        if per_capita <= FOOD_THRESHOLD_MONTHLY:
            pts, rel = 40, "below"
        elif per_capita <= POVERTY_THRESHOLD_MONTHLY:
            pts, rel = 30, "below"
        elif per_capita <= POVERTY_THRESHOLD_MONTHLY * 1.5:
            pts, rel = 15, "near"
        else:
            pts, rel = 0, "above"
        factors.append((pts, FACTOR_TEXT["income"][lang].format(v=f"₱{per_capita:,.0f}", rel=REL[lang][rel], line=POVERTY_THRESHOLD_MONTHLY)))

    emp = profile.get("employment_status")
    emp_pts = {"unemployed": 15, "displaced": 15, "underemployed": 10, "informal": 10, "seasonal": 10, "self_employed": 5}.get(emp or "", 0)
    if emp:
        factors.append((emp_pts, FACTOR_TEXT["employment"][lang].format(v=VALUE_LABELS.get(emp, emp))))

    housing = profile.get("housing_type")
    h_pts = {"informal_settler": 12, "rented": 6, "with_relatives": 4}.get(housing or "", 0)
    if housing:
        factors.append((h_pts, FACTOR_TEXT["housing"][lang].format(v=VALUE_LABELS.get(housing, housing))))

    if profile.get("has_crisis"):
        factors.append((15, FACTOR_TEXT["crisis"][lang].format(v=VALUE_LABELS.get(profile["crisis_type"], profile["crisis_type"]))))
    if profile.get("has_pwd"):
        factors.append((6, FACTOR_TEXT["pwd"][lang]))
    if profile.get("is_solo_parent"):
        factors.append((6, FACTOR_TEXT["solo"][lang]))
    if profile.get("has_children_0_18"):
        factors.append((4, FACTOR_TEXT["children"][lang]))
    if (profile.get("household_size") or 0) >= 6:
        factors.append((4, FACTOR_TEXT["size"][lang].format(v=profile["household_size"])))

    score = min(100, sum(p for p, _ in factors))
    tier = "high" if score >= 60 else "moderate" if score >= 35 else "low"
    top = [text for pts, text in sorted(factors, key=lambda f: -f[0]) if pts > 0][:3]
    if not top and factors:
        top = [factors[0][1]]
    return {
        "score": score,
        "tier": tier,
        "message": TIER_MESSAGE[tier][lang],
        "top_factors": top,
        "engine": "rule-based placeholder (XGBoost pending)",
    }


# ---------------------------------------------------------------------------
# Eligibility rules
# ---------------------------------------------------------------------------
def _num(v):
    if v is None or isinstance(v, bool):
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _as_bool(s: str):
    s = str(s).strip().lower()
    if s in ("true", "yes", "1", "oo"):
        return True
    if s in ("false", "no", "0", "hindi", "dili"):
        return False
    return None


def _split_list(threshold: str) -> list[str]:
    t = threshold.strip().lower()
    parts = t.split(",") if "," in t else t.split("_or_") if "_or_" in t else [t]
    return [p.strip() for p in parts if p.strip()]


def compare(actual, operator: str, threshold: str) -> bool:
    op = operator.strip()
    if op == "=":
        op = "=="
    if isinstance(actual, bool):
        expected = _as_bool(threshold)
        if op == "in":
            return str(actual).lower() in _split_list(threshold)
        if op == "!=":
            return actual != expected
        return actual == expected
    if isinstance(actual, (int, float)):
        if op == "in":
            return any(_num(x) == actual for x in _split_list(threshold))
        t = _num(threshold)
        if t is None:
            return False
        return {"<=": actual <= t, ">=": actual >= t, "<": actual < t, ">": actual > t, "==": actual == t, "!=": actual != t}.get(op, False)
    a = str(actual).strip().lower()
    options = _split_list(threshold)
    if op in ("in", "=="):
        return a in options
    if op == "!=":
        return a not in options
    return False


def _fmt(attr: str, v) -> str:
    if isinstance(v, bool):
        return "yes" if v else "no"
    if attr in ("monthly_income", "per_capita_income") and isinstance(v, (int, float)):
        return f"₱{v:,.0f}"
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return VALUE_LABELS.get(str(v), str(v))


def _fmt_requirement(attr: str, op: str, threshold: str) -> str:
    op = "=" if op in ("=", "==") else op
    if op == "in" or "_or_" in threshold or "," in threshold:
        opts = ", ".join(VALUE_LABELS.get(o, o) for o in _split_list(threshold))
        return f"one of: {opts}"
    b = _as_bool(threshold)
    if b is not None and op == "=":
        return "yes" if b else "no"
    if attr in ("monthly_income", "per_capita_income") and _num(threshold) is not None:
        return f"{op} ₱{_num(threshold):,.0f}"
    return f"{op} {VALUE_LABELS.get(threshold, threshold)}"


def evaluate_program(program: dict, criteria: list[dict], profile: dict) -> dict:
    results = []
    total = passed = unknown = 0.0
    for c in criteria:
        w = float(c["weight"] or 0)
        total += w
        attr = c["attribute"]
        label = ATTRIBUTE_LABELS.get(attr, attr.replace("_", " ").capitalize())
        requirement = _fmt_requirement(attr, c["operator"], c["threshold_value"])
        if attr not in profile:
            unknown += w
            results.append({"attribute": attr, "label": label, "status": "unknown", "actual": None, "requirement": requirement,
                            "explanation": "We couldn't check this from the chat — the office will verify it."})
            continue
        ok = compare(profile[attr], c["operator"], c["threshold_value"])
        actual = _fmt(attr, profile[attr])
        if ok:
            passed += w
            results.append({"attribute": attr, "label": label, "status": "pass", "actual": actual, "requirement": requirement,
                            "explanation": f"Yours: {actual} (needs {requirement})."})
        else:
            results.append({"attribute": attr, "label": label, "status": "fail", "actual": actual, "requirement": requirement,
                            "explanation": f"Yours: {actual}, but this program needs {requirement}."})

    if not criteria:
        status, likelihood = "partial", 50
    else:
        likelihood = round(((passed + 0.5 * unknown) / total) * 100) if total > 0 else 50
        if any(r["status"] == "fail" for r in results):
            status = "not_qualified"
        elif any(r["status"] == "unknown" for r in results):
            status = "partial"
        else:
            status = "qualified"
    return {
        "program_id": str(program["program_id"]),
        "program_name": program["program_name"],
        "agency": program["agency"],
        "scope": program["scope"],
        "status": status,
        "likelihood": likelihood,
        "criteria": results,
    }


STATUS_ORDER = {"qualified": 0, "partial": 1, "not_qualified": 2}


def rank_programs(evaluations: list[dict]) -> list[dict]:
    return sorted(evaluations, key=lambda e: (STATUS_ORDER[e["status"]], -e["likelihood"]))


def today_iso() -> str:
    return date.today().isoformat()
