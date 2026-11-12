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

from app.amounts import parse_count, parse_monthly_income
from app.scoring import CRISIS_VALUES, EMPLOYMENT_VALUES, HOUSING_VALUES
from app.scoring import CRISIS_VALUES, EMPLOYMENT_VALUES, HELP_VALUES, HOUSING_VALUES

LANGS = ("fil", "ceb", "en")

# Order matters: this is the order questions are asked in. General questions first (where you
# live, who lives with you, you, work and money, home), then the specific situations, and the
# most sensitive one (a crisis) last (2nd consultation: "generic first, then specific").
SLOTS = [
    "barangay",
    "household_size",
    "age",
    "employment_status",
    "monthly_income",
    "housing_type",
    "has_children_0_18",
    "has_pregnant",
    "has_pwd",
    "has_senior",
    "is_solo_parent",
    "crisis_type",
    "help_needed",
]

BOOL_SLOTS = {"has_children_0_18", "has_pregnant", "has_pwd", "has_senior", "is_solo_parent"}
INT_SLOTS = {"household_size", "age"}
ENUMS = {"employment_status": EMPLOYMENT_VALUES, "housing_type": HOUSING_VALUES, "crisis_type": CRISIS_VALUES, "help_needed": HELP_VALUES}

# One idea per question, everyday words, and an example or "tap one below" where it helps.
QUESTIONS = {
    "barangay": {
        "fil": "Saang barangay sa Cebu City po kayo nakatira? (halimbawa: Lahug, Mabolo)",
        "ceb": "Asa nga barangay sa Cebu City ka nagpuyo? (pananglitan: Lahug, Mabolo)",
        "en": "Which barangay in Cebu City do you live in? (e.g. Lahug, Mabolo)",
    },
    "household_size": {
        "fil": "Ilan po kayong nakatira sa bahay, kasama na kayo? (halimbawa: 5)",
        "ceb": "Pila mo kabuok ang nagpuyo sa balay, apil na ka? (pananglitan: 5)",
        "en": "How many people live in your home, including you? (e.g. 5)",
    },
    "age": {
        "fil": "Ilang taon na po kayo?",
        "ceb": "Pila na ang imong edad?",
        "en": "How old are you?",
    },
    "employment_status": {
        "fil": "Ano po ang trabaho ng pinakamalaking kumikita sa inyong bahay? Pumili sa ibaba.",
        "ceb": "Unsa ang trabaho sa labing dako ang kita sa inyong balay? Pili sa ubos.",
        "en": "What kind of work does the person who earns the most in your home have? Tap one below.",
    },
    "monthly_income": {
        "fil": "Mga magkano po ang kinikita ng buong pamilya sa isang buwan? Pagsamahin ang kita ng lahat. (halimbawa: 8000)",
        "ceb": "Mga pila ang kita sa tibuok pamilya sa usa ka bulan? Isumada ang kita sa tanan. (pananglitan: 8000)",
        "en": "About how much does your whole household earn in a month? Add up everyone's pay. (e.g. 8000)",
    },
    "housing_type": {
        "fil": "Saan po kayo nakatira ngayon? Pumili sa ibaba.",
        "ceb": "Asa ka nagpuyo karon? Pili sa ubos.",
        "en": "Where do you live now? Tap one below.",
    },
    "has_children_0_18": {
        "fil": "May mga bata po bang 0 hanggang 18 taong gulang na nakatira sa inyo?",
        "ceb": "Aduna bay mga bata nga 0 hangtod 18 anyos nga nagpuyo uban ninyo?",
        "en": "Are there children aged 0 to 18 living with you?",
    },
    "has_pregnant": {
        "fil": "May buntis po ba ngayon sa inyong pamilya?",
        "ceb": "Aduna bay mabdos karon sa inyong pamilya?",
        "en": "Is anyone in your household pregnant right now?",
    },
    "has_pwd": {
        "fil": "May miyembro po ba ng pamilya na may kapansanan (PWD)?",
        "ceb": "Aduna bay miyembro sa pamilya nga may kakulangan (PWD)?",
        "en": "Does anyone in your household have a disability (PWD)?",
    },
    "has_senior": {
        "fil": "May miyembro po ba ng pamilya na 60 taong gulang pataas (senior citizen)?",
        "ceb": "Aduna bay miyembro sa pamilya nga 60 anyos pataas (senior citizen)?",
        "en": "Is anyone in your household 60 or older?",
    },
    "is_solo_parent": {
        "fil": "Kayo po ba ay mag-isang nagpapalaki ng anak (solo parent)?",
        "ceb": "Ikaw ba nag-inusarang nagpadako sa imong anak (solo parent)?",
        "en": "Are you raising your children on your own (solo parent)?",
    },
    "crisis_type": {
        "fil": "May pinagdadaanan po bang emergency ang pamilya ngayon? (halimbawa: gastos sa ospital, may namatay, sunog, baha) Pumili sa ibaba.",
        "ceb": "Aduna bay emerhensya nga giagian sa pamilya karon? (pananglitan: gasto sa ospital, naay namatay, sunog, baha) Pili sa ubos.",
        "en": "Is your family going through an emergency right now? (e.g. hospital bills, a death, fire, flood) Tap one below.",
    },
    # AICS asks for different papers for each kind of help, so this decides which ones to show.
    "help_needed": {
        "fil": "Para saan po ang tulong na kailangan ninyo ngayon? Pumili sa ibaba.",
        "ceb": "Para asa ang tabang nga imong gikinahanglan karon? Pili sa ubos.",
        "en": "What do you need help paying for right now? Tap one below.",
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
    "help_needed": {
        "fil": [("none", "Wala sa ngayon"), ("medical", "Gamot / ospital"), ("death", "Libing / burol"), ("transport", "Pamasahe / biyahe"),
                ("education", "Gastos sa eskwela"), ("food", "Pagkain"), ("assistive_device", "Wheelchair, hearing aid o iba pang gamit"), ("other_help", "Iba pa")],
        "ceb": [("none", "Wala karon"), ("medical", "Tambal / ospital"), ("death", "Lubong / haya"), ("transport", "Plete / biyahe"),
                ("education", "Gasto sa eskwelahan"), ("food", "Pagkaon"), ("assistive_device", "Wheelchair, hearing aid o uban pang gamit"), ("other_help", "Uban pa")],
        "en": [("none", "Nothing right now"), ("medical", "Medicine / hospital"), ("death", "Funeral / burial"), ("transport", "Fare / travel"),
               ("education", "School expenses"), ("food", "Food"), ("assistive_device", "Wheelchair, hearing aid or other device"), ("other_help", "Something else")],
    },
    "has_children_0_18": YES_NO,
    "has_pregnant": YES_NO,
    "has_pwd": YES_NO,
    "has_senior": YES_NO,
    "is_solo_parent": YES_NO,
}

# Signed-in citizen with saved answers (optional account).
WELCOME_BACK = {
    "fil": "Maligayang pagbabalik, {name}! Inilagay ko na ang inyong mga naka-save na sagot. Maaari ninyong baguhin ang alinman sa susunod na pahina.",
    "ceb": "Maayong pagbalik, {name}! Gibutang na nako ang imong mga na-save nga tubag. Mahimo nimo usbon bisan unsa niini sa sunod nga panid.",
    "en": "Welcome back, {name}! I've filled in your saved answers. You can change any of them on the next page.",
}
ALL_SAVED = {
    "fil": "Kumpleto na ang inyong mga sagot. Pindutin ang \"Tingnan ang mga sagot\" para suriin o baguhin ang mga ito.",
    "ceb": "Kompleto na ang imong mga tubag. Pindota ang \"Tan-awa ang mga tubag\" aron susihon o usbon kini.",
    "en": "All your answers are filled in. Tap \"Review your answers\" to check or change them.",
}
# Signed in, nothing saved yet: unlike the anonymous greeting, answers ARE kept (in their account).
SIGNED_IN = {
    "fil": "Kumusta, {name}! Ako si GinhawAI. Magtatanong ako ng ilang bagay para malaman kung aling mga programa ng tulong ang para sa inyo. Dahil naka-log in kayo, ise-save ang inyong mga sagot sa inyong account.",
    "ceb": "Kumusta, {name}! Ako si GinhawAI. Mangutana ko og pipila ka butang aron mahibal-an kung unsang mga programa sa tabang ang para nimo. Kay naka-log in ka, i-save ang imong mga tubag sa imong account.",
    "en": "Hi {name}! I'm GinhawAI. I'll ask a few questions to find which assistance programs may fit your household. Since you're logged in, your answers will be saved to your account.",
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

# The barangay answer didn't match any barangay in the database (GinhawAI covers Cebu City only).
BARANGAY_UNKNOWN = {
    "fil": "Pasensya na, hindi ko mahanap ang barangay na iyan sa Cebu City. Pakisulat po ang pangalan ng inyong barangay (hal. Lahug, Mabolo).",
    "ceb": "Pasensya, wala nako makit-an kana nga barangay sa Cebu City. Palihug isulat ang ngalan sa inyong barangay (pananglitan Lahug, Mabolo).",
    "en": "Sorry, I couldn't find that barangay in Cebu City. Please type the name of your barangay (e.g. Lahug, Mabolo).",
}
BARANGAY_SUGGEST = {"fil": " Ito po ba ang ibig ninyong sabihin?", "ceb": " Mao ba ni imong pasabot?", "en": " Did you mean one of these?"}

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
        "job_loss": ["nawalan ng kita", "nawad-an", "lost income", "job loss", "wala nang kita", "wala na kaming kita", "wala na koy kita", "wala nay kita", "walay kita", "walang kita", "no income"],
    },
    "help_needed": {
        "none": ["wala", "none", "no", "dili", "hindi", "nothing"],
        "medical": ["ospital", "hospital", "gamot", "tambal", "medicine", "medical", "operasyon", "dialysis", "checkup"],
        "death": ["libing", "lubong", "burol", "haya", "funeral", "burial", "patay", "namatay"],
        "transport": ["pamasahe", "plete", "fare", "transport", "biyahe", "ticket", "stranded"],
        "education": ["eskwela", "eskwelahan", "school", "tuition", "matrikula", "enrollment"],
        "food": ["pagkain", "pagkaon", "food", "bigas", "rice", "groceries"],
        "assistive_device": ["wheelchair", "hearing aid", "saklay", "crutches", "salamin", "eyeglasses", "device"],
        "other_help": ["iba pa", "uban pa", "something else", "ofw"],
    },
}


def lang_of(lang: str | None) -> str:
    return lang if lang in LANGS else "en"


def quick_replies(slot: str | None, lang: str) -> list[dict]:
    if slot is None or slot not in CHIPS:
        return []
    return [{"value": v, "label": label} for v, label in CHIPS[slot][lang]]


def auto_answer(entities: dict) -> None:
    """Fill in answers that follow from earlier ones, so the citizen isn't asked the obvious:
    an applicant aged 60+ means there is a senior in the household; someone under 60 who
    lives alone means there isn't."""
    if entities.get("has_senior") is not None or entities.get("age") is None:
        return
    if entities["age"] >= 60:
        entities["has_senior"] = True
    elif entities.get("household_size") == 1:
        entities["has_senior"] = False


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


# Words that mean the person is not giving an answer ("hindi ko alam" = "I don't know", not "no").
UNSURE_WORDS = {"alam", "sure", "sigurado", "kahibalo", "kabalo", "ewan", "ambot", "basin", "baka"}
# Negation words. A keyword next to one of these can mean the opposite ("wala koy sakit" = no illness).
NEGATORS = {"wala", "walay", "walang", "dili", "hindi", "di", "no", "not", "none", "wa"}


# Crisis words used by the negation rule in parse_for_slot (medicine words are left out on purpose:
# "walang gamot" = no medicine, which is a medical need, not "no crisis").
_CRISIS_WORD = re.compile(r"sakit|ospital|hospital|namatay|patay|sunog|sunugan|\bbaha\b|binaha|nabahaan|bagyo|flood|typhoon|lindol|sickness|illness|\bsick\b|death|\bdied\b")
_NEGATED_CRISIS = re.compile(r"\b(?:wala|walay|walang|dili|hindi|di|no|not|wa)\b\s+(?:[\w'-]+\s+)?[\w'-]*(?:" + _CRISIS_WORD.pattern + r")[\w'-]*")


def _parse_bool(text: str):
    words = set(re.findall(r"[a-z']+", text.lower()))
    # Ambiguity guard: unsure words, or a negation inside a longer sentence ("Wala akong asawa, ako ang nag-aalaga"
    # is a YES for solo parent), are not safe to decide by keyword -> return None so the XLM-R model / Gemini decides.
    if words & UNSURE_WORDS:
        return None
    if words & NO_WORDS and len(words) > 3:
        return None
    if words & NO_WORDS and not words & (YES_WORDS - {"may"}):
        return False
    if words & YES_WORDS:
        return True
    return None


def parse_for_slot(slot: str, text: str, lang: str, synonyms: dict | None = None):
    """Parse a direct answer to `slot`. Returns None when it can't tell.

    `synonyms` is the staff-managed word list (app.jargon); defaults to the built-in one."""
    synonyms = {**ENUM_SYNONYMS, **(synonyms or {})}
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
        # amounts.py understands number words ("labinlimang libo"), pay periods ("kada adlaw", "kinsenas") and
        # "walang kita". If it can't read the answer confidently it returns None and the model / Gemini decides
        # (the old "first number wins" rule is no longer used: it turned "500 kada adlaw" into a monthly 500).
        n = parse_monthly_income(low) if slot == "monthly_income" else parse_count(low, slot)
        if n is None:
            return None
        return coerce(slot, n)
    if slot in synonyms:
        # Longest (most specific) word first, so "nawalan ng kita" beats a shorter word inside it.
        pairs = sorted(((w.lower(), v) for v, ws in synonyms[slot].items() if v != "none" for w in ws), key=lambda p: -len(p[0]))
        low_words = set(re.findall(r"[a-z']+", low))
        has_negator = bool(low_words & NEGATORS)
        if slot == "crisis_type":
            # Negated crisis ("walang sakit", "walay namatay", "no sickness") means NO crisis. Only 0-1 words may sit between
            # the negation and the keyword, so "wala kaming pambayad sa ospital" (can't pay the hospital) is NOT caught.
            neg = _NEGATED_CRISIS.search(low)
            if neg:
                rest = low[:neg.start()] + " " + low[neg.end():]
                # another crisis word elsewhere ("walang sunog pero binaha kami") -> unsure, let the model decide
                return None if _CRISIS_WORD.search(rest) else "none"
        for word, value in pairs:  # "none" is checked last, as whole words only ("no" is inside "nasunog")
            if word and word in low:
                # "wala na kaming kita" next to a death/illness/fire word is the result of that event, not job loss itself
                if slot == "crisis_type" and value == "job_loss" and _CRISIS_WORD.search(low):
                    continue
                # Ambiguity guard: a negation next to a plain keyword ("wala koy sakit", "walang namatay") flips its
                # meaning, so don't decide by keyword. Phrases that carry their own negation ("walang trabaho") are fine.
                if has_negator and not set(re.findall(r"[a-z']+", word)) & NEGATORS:
                    return None
                return value
        if slot == "crisis_type" and any(re.search(rf"\b{re.escape(w.lower())}\b", low) for w in synonyms[slot].get("none", [])):
            # "wala" alone means none, but inside a longer sentence ("wala na koy kita") it can mean something else.
            return "none" if len(low_words) <= 3 else None
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
