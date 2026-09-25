"""Deterministic slot-filling for the conversational assessment (Fig. 16).

The AI layer (Gemini now, XLM-RoBERTa later) only EXTRACTS values from free
text. Which question to ask next, and whether the profile is complete, is
decided here — never by the model.

Each slot has a question in Filipino, Bisaya and English plus quick-reply
chips, so users with low digital literacy can answer with one tap. Chip taps
and simple answers ("oo", "wala", "5", "8k") are parsed here directly, which
also keeps the chat working if the AI call fails.
"""

import re

from app.scoring import CRISIS_VALUES, EMPLOYMENT_VALUES, HOUSING_VALUES

LANGS = ("fil", "ceb", "en")

# Order matters: this is the order questions are asked in.
SLOTS = [
    "barangay",
    "household_size",
    "monthly_income",
    "employment_status",
    "age",
    "housing_type",
    "has_children_0_18",
    "has_pwd",
    "is_solo_parent",
    "crisis_type",
]

BOOL_SLOTS = {"has_children_0_18", "has_pwd", "is_solo_parent"}
INT_SLOTS = {"household_size", "age"}
ENUMS = {"employment_status": EMPLOYMENT_VALUES, "housing_type": HOUSING_VALUES, "crisis_type": CRISIS_VALUES}

QUESTIONS = {
    "barangay": {
        "fil": "Saang barangay po kayo nakatira?",
        "ceb": "Asa nga barangay ka nagpuyo?",
        "en": "Which barangay do you live in?",
    },
    "household_size": {
        "fil": "Ilan po kayong nakatira sa bahay, kasama na kayo?",
        "ceb": "Pila mo kabuok ang nagpuyo sa balay, apil na ka?",
        "en": "How many people live in your household, including you?",
    },
    "monthly_income": {
        "fil": "Magkano po ang kabuuang kita ng pamilya kada buwan? (halimbawa: 8000)",
        "ceb": "Pila ang kinatibuk-ang kita sa pamilya kada bulan? (pananglitan: 8000)",
        "en": "About how much does your whole household earn per month, in pesos? (e.g. 8000)",
    },
    "employment_status": {
        "fil": "Ano po ang kalagayan ng trabaho ng pangunahing kumikita sa pamilya?",
        "ceb": "Unsa ang kahimtang sa trabaho sa nag-unang nagtrabaho sa pamilya?",
        "en": "What is the work situation of the main earner in your household?",
    },
    "age": {
        "fil": "Ilang taon na po kayo?",
        "ceb": "Pila na ang imong edad?",
        "en": "How old are you?",
    },
    "housing_type": {
        "fil": "Ano po ang inyong tirahan?",
        "ceb": "Unsa ang inyong puy-anan?",
        "en": "What is your housing situation?",
    },
    "has_children_0_18": {
        "fil": "May anak po ba kayong 0–18 taong gulang, o may buntis sa pamilya?",
        "ceb": "Aduna ba moy anak nga 0–18 anyos, o adunay mabdos sa pamilya?",
        "en": "Do you have children aged 0–18, or a pregnant member in the household?",
    },
    "has_pwd": {
        "fil": "May miyembro po ba ng pamilya na may kapansanan (PWD)?",
        "ceb": "Aduna bay miyembro sa pamilya nga may kakulangan (PWD)?",
        "en": "Does anyone in your household have a disability (PWD)?",
    },
    "is_solo_parent": {
        "fil": "Kayo po ba ay solo parent?",
        "ceb": "Solo parent ba ka?",
        "en": "Are you a solo parent?",
    },
    "crisis_type": {
        "fil": "May kinakaharap po ba kayong krisis ngayon?",
        "ceb": "Aduna ba moy giatubang nga krisis karon?",
        "en": "Are you facing a crisis right now?",
    },
}

YES_NO = {
    "fil": [("true", "Oo / Mayroon"), ("false", "Wala / Hindi")],
    "ceb": [("true", "Oo / Naa"), ("false", "Wala / Dili")],
    "en": [("true", "Yes"), ("false", "No")],
}

CHIPS = {
    "household_size": {l: [(str(n), str(n)) for n in (1, 2, 3, 4, 5, 6, 7, 8)] for l in LANGS},
    "employment_status": {
        "fil": [("employed", "May regular na trabaho"), ("self_employed", "May sariling negosyo"), ("informal", "Arawan / 'extra'"),
                ("seasonal", "Pana-panahon"), ("underemployed", "Kulang ang trabaho"), ("unemployed", "Walang trabaho"), ("displaced", "Kakatanggal lang sa trabaho")],
        "ceb": [("employed", "Naay regular nga trabaho"), ("self_employed", "Naay kaugalingong negosyo"), ("informal", "Adlaw-adlaw / 'extra'"),
                ("seasonal", "Seasonal"), ("underemployed", "Kulang ang trabaho"), ("unemployed", "Walay trabaho"), ("displaced", "Bag-o lang natangtang")],
        "en": [("employed", "Regular job"), ("self_employed", "Own small business"), ("informal", "Daily wage / odd jobs"),
               ("seasonal", "Seasonal work"), ("underemployed", "Not enough work"), ("unemployed", "No work"), ("displaced", "Recently lost job")],
    },
    "housing_type": {
        "fil": [("owned", "Sariling bahay"), ("rented", "Umuupa"), ("with_relatives", "Nakikitira sa kamag-anak"), ("informal_settler", "Informal settler")],
        "ceb": [("owned", "Kaugalingong balay"), ("rented", "Nag-abang"), ("with_relatives", "Nakipuyo sa paryente"), ("informal_settler", "Informal settler")],
        "en": [("owned", "Own house"), ("rented", "Renting"), ("with_relatives", "Living with relatives"), ("informal_settler", "Informal settler")],
    },
    "crisis_type": {
        "fil": [("none", "Wala"), ("medical", "Pagpapagamot / ospital"), ("death", "May namatay sa pamilya"), ("fire", "Nasunugan"),
                ("calamity", "Baha / bagyo"), ("job_loss", "Biglang nawalan ng kita")],
        "ceb": [("none", "Wala"), ("medical", "Pagpatambal / ospital"), ("death", "Naay namatay sa pamilya"), ("fire", "Nasunogan"),
                ("calamity", "Baha / bagyo"), ("job_loss", "Kalit nawad-an og kita")],
        "en": [("none", "None"), ("medical", "Medical / hospital"), ("death", "Death in the family"), ("fire", "Fire"),
               ("calamity", "Flood / typhoon"), ("job_loss", "Sudden loss of income")],
    },
    "has_children_0_18": YES_NO,
    "has_pwd": YES_NO,
    "is_solo_parent": YES_NO,
}

GREETING = {
    "fil": "Magandang araw! Ako si GinhawAI. Magtatanong ako ng ilang bagay para malaman kung aling mga programa ng tulong ang maaaring para sa inyo. Hindi namin itatago ang inyong mga sagot pagkatapos ng session.",
    "ceb": "Maayong adlaw! Ako si GinhawAI. Mangutana ko og pipila ka butang aron mahibal-an kung unsang mga programa sa tabang ang para nimo. Dili namo tipigan ang imong mga tubag human sa session.",
    "en": "Good day! I'm GinhawAI. I'll ask a few questions to find which assistance programs may fit your household. Your answers are not kept after this session.",
}

DONE = {
    "fil": "Salamat po! Kumpleto na ang impormasyon. Pakitingnan at kumpirmahin ang inyong mga sagot.",
    "ceb": "Salamat! Kompleto na ang impormasyon. Palihug tan-awa ug kumpirmaha ang imong mga tubag.",
    "en": "Thank you! That's everything I need. Please review and confirm your answers.",
}

RETRY = {
    "fil": "Pasensya na, hindi ko po naintindihan. ",
    "ceb": "Pasensya, wala nako masabti. ",
    "en": "Sorry, I didn't quite get that. ",
}

YES_WORDS = {"yes", "y", "yup", "yeah", "oo", "opo", "oho", "o", "meron", "mayroon", "may", "naa", "aw", "true", "sige", "ou"}
NO_WORDS = {"no", "n", "nope", "hindi", "wala", "dili", "none", "false", "wa", "ala", "di"}

ENUM_SYNONYMS = {
    "employment_status": {
        "unemployed": ["walang trabaho", "walay trabaho", "no work", "jobless", "wala trabaho", "unemployed"],
        "displaced": ["natanggal", "tinanggal", "natangtang", "laid off", "lost my job", "lost job", "displaced"],
        "informal": ["arawan", "daily", "extra", "sideline", "odd job", "construction", "tricycle", "habal", "labandera"],
        "seasonal": ["seasonal", "pana-panahon", "harvest"],
        "underemployed": ["kulang", "part-time", "part time", "underemployed"],
        "self_employed": ["negosyo", "tindahan", "sari-sari", "business", "vendor", "tinda"],
        "employed": ["regular", "empleyado", "employed", "office", "trabaho sa", "may trabaho", "naay trabaho"],
    },
    "housing_type": {
        "informal_settler": ["informal", "squatter", "iskwater", "walang titulo"],
        "rented": ["upa", "abang", "rent", "boarding", "bedspace"],
        "with_relatives": ["kamag-anak", "paryente", "relatives", "kapatid", "parents", "magulang", "ginikanan", "nakikitira", "nakipuyo"],
        "owned": ["sariling", "kaugalingon", "own", "amin", "amoa"],
    },
    "crisis_type": {
        "none": ["wala", "none", "no", "dili", "hindi", "okay", "ok"],
        "medical": ["ospital", "hospital", "sakit", "medical", "gamot", "tambal", "operasyon", "dialysis"],
        "death": ["namatay", "patay", "death", "died", "lamay", "burial", "funeral"],
        "fire": ["sunog", "sunugan", "nasunog", "fire"],
        "calamity": ["baha", "bagyo", "flood", "typhoon", "lindol", "earthquake", "calamity"],
        "job_loss": ["nawalan ng kita", "nawad-an", "lost income", "job loss"],
    },
}


def lang_of(lang: str | None) -> str:
    return lang if lang in LANGS else "en"


def quick_replies(slot: str | None, lang: str) -> list[dict]:
    if slot is None or slot not in CHIPS:
        return []
    return [{"value": v, "label": label} for v, label in CHIPS[slot][lang]]


def next_slot(entities: dict) -> str | None:
    for s in SLOTS:
        if entities.get(s) is None:
            return s
    return None


def question(slot: str, lang: str) -> str:
    return QUESTIONS[slot][lang]


def _parse_number(text: str):
    t = text.lower().replace(",", "").replace("₱", "").replace("php", "")
    m = re.search(r"(\d+(?:\.\d+)?)\s*(k|thousand|libo|mil)?", t)
    if not m:
        return None
    value = float(m.group(1))
    if m.group(2):
        value *= 1000
    return value


def _parse_bool(text: str):
    words = set(re.findall(r"[a-z']+", text.lower()))
    if words & NO_WORDS and not words & (YES_WORDS - {"may"}):
        return False
    if words & YES_WORDS:
        return True
    return None


def parse_for_slot(slot: str, text: str, lang: str):
    """Parse a direct answer to `slot`. Returns None when it can't tell."""
    raw = text.strip()
    low = raw.lower()
    if not low:
        return None

    # Exact chip value or chip label in any language.
    if slot in CHIPS:
        for l in LANGS:
            for value, label in CHIPS[slot][l]:
                if low == value.lower() or low == label.lower():
                    return coerce(slot, value)

    if slot in BOOL_SLOTS:
        return _parse_bool(low)
    if slot in INT_SLOTS or slot == "monthly_income":
        n = _parse_number(low)
        if n is None:
            return None
        return coerce(slot, n)
    if slot in ENUM_SYNONYMS:
        for value, words in ENUM_SYNONYMS[slot].items():
            if value == "none":
                continue  # checked last, as whole words only ("no" is inside "nasunog")
            if any(w in low for w in words):
                return value
        if slot == "crisis_type" and _parse_bool(low) is False:
            return "none"
        return None
    if slot == "barangay":
        name = re.sub(r"^(brgy\.?|barangay|bgy\.?|sa)\s+", "", raw, flags=re.I).strip(" .!")
        return name or None
    return None


def coerce(slot: str, value):
    """Validate a value from any source (chip, parser or AI) for a slot."""
    if value is None:
        return None
    try:
        if slot in BOOL_SLOTS:
            if isinstance(value, bool):
                return value
            return {"true": True, "false": False}.get(str(value).lower())
        if slot == "household_size":
            n = int(float(value))
            return n if 1 <= n <= 30 else None
        if slot == "age":
            n = int(float(value))
            return n if 10 <= n <= 120 else None
        if slot == "monthly_income":
            n = float(value)
            return n if 0 <= n <= 10_000_000 else None
        if slot in ENUMS:
            v = str(value).lower().strip()
            return v if v in ENUMS[slot] else None
        if slot == "barangay":
            v = str(value).strip()
            return v[:100] or None
    except (TypeError, ValueError):
        return None
    return value
