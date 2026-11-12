"""Pulls income, household size and age out of a citizen's free-text answer (module 20: isolate extracted entities).

Understands digits ("15k", "8,500", "₱500"), number words in Filipino, Bisaya, Spanish-style and English
("labinlimang libo", "kinse mil", "dalawampu't lima", "five thousand"), and pay periods ("kada adlaw", "kinsenas",
"per week"), which are converted to PHP per month. Pure rules: no AI call, instant, and testable.
Anything it cannot read confidently returns None, and the chat then falls back to the model / Gemini.
"""
import re

# ---------- number words (hyphens are removed before lookup, so "labing-isa" == "labingisa") ----------
_UNITS = {
    # English
    "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15, "sixteen": 16, "seventeen": 17, "eighteen": 18,
    "nineteen": 19, "twenty": 20, "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90,
    # Filipino
    "isa": 1, "dalawa": 2, "tatlo": 3, "apat": 4, "lima": 5, "anim": 6, "pito": 7, "walo": 8, "siyam": 9, "sampu": 10,
    "labingisa": 11, "labindalawa": 12, "labintatlo": 13, "labingapat": 14, "labinlima": 15, "labinganim": 16,
    "labimpito": 17, "labingwalo": 18, "labinsiyam": 19,
    "dalawampu": 20, "tatlumpu": 30, "apatnapu": 40, "limampu": 50, "animnapu": 60, "pitumpu": 70, "walumpu": 80, "siyamnapu": 90,
    # Bisaya ("napulog usa" = 10 + 1, so "napulog" simply adds 10)
    "usa": 1, "duha": 2, "tulo": 3, "upat": 4, "unom": 6, "napulo": 10, "napulog": 10,
    # Spanish-style (very common for money and age in Cebu)
    "uno": 1, "dos": 2, "tres": 3, "kuwatro": 4, "kwatro": 4, "singko": 5, "sais": 6, "siyete": 7, "otso": 8, "nuwebe": 9,
    "nwebe": 9, "diyes": 10, "onse": 11, "dose": 12, "trese": 13, "katorse": 14, "kinse": 15, "disisais": 16,
    "disisiyete": 17, "disiotso": 18, "disinuwebe": 19, "beinte": 20, "bente": 20, "baynte": 20, "trenta": 30,
    "kwarenta": 40, "singkwenta": 50, "sesenta": 60, "setenta": 70, "otsenta": 80, "nobenta": 90,
}
_THOUSAND = {"libo", "mil", "thousand", "kalibo"}
_HUNDRED = {"gatos", "gatus", "daan", "hundred", "siyento", "sien", "cien"}
_JOINERS = {"at", "ug", "and", "y", "na", "ka", "mga", "around", "about", "approximately", "ang", "ay"}


def _norm(tok: str) -> str:
    """'dalawampu't' -> 'dalawampu', 'limang' -> 'lima', 'labing-isa' -> 'labingisa'."""
    t = tok.replace("-", "").replace("’", "'")
    if t.endswith("'t") or t.endswith("'y"):  # "dalawampu't", "singkwenta'y"
        t = t[:-2]
    known = _UNITS.keys() | _THOUSAND | _HUNDRED
    if t not in known and t.endswith("ng") and t[:-2] in known:
        t = t[:-2]
    if t not in known and t.endswith("ng") and t[:-3] in known:  # "daang" -> "daan"
        t = t[:-3]
    return t


def _words_to_number(text: str):
    """First number written in words, e.g. 'labinlimang libo' -> 15000, 'three thousand five hundred' -> 3500."""
    tokens = [_norm(t) for t in re.findall(r"[a-z]+(?:['’-][a-z]+)*", text.lower())]
    total = current = 0
    found = False
    for t in tokens:
        if t in _UNITS:
            current += _UNITS[t]
            found = True
        elif t in _THOUSAND:
            total += (current or 1) * 1000
            current = 0
            found = True
        elif t in _HUNDRED:
            current = (current or 1) * 100
            found = True
        elif t in _JOINERS:
            continue
        elif found:  # the number phrase ended
            break
    return (total + current) if found else None


# ---------- digit amounts: 15k, 8,500, 12.5k, 15 libo, 2 ka libo ----------
_AMT = re.compile(r"(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(?:(?:ka\s+)?(k|thousand|libo|mil|million|m))?(?![a-z])", re.I)


def _digit_amounts(low: str):
    out = []
    for m in _AMT.finditer(low):
        value = float(m.group(1).replace(",", ""))
        suffix = (m.group(2) or "").lower()
        if suffix in ("k", "thousand", "libo", "mil"):
            value *= 1000
        elif suffix in ("million", "m"):
            value *= 1_000_000
        out.append((m.start(), m.end(), value))
    return out


# ---------- pay periods -> multiplier to PHP per month ----------
# Order matters: the first pattern that matches wins. Daily pay assumes 26 working days a month.
_PERIODS = [
    ("yearly", re.compile(r"kada\s+taon|kada\s+tuig|matag\s+tuig|per\s+year|a\s+year|yearly|annual|taunan|sa\s+isang\s+taon")),
    ("biweekly", re.compile(r"every\s+(?:two|2)\s+weeks|kada\s+(?:dalawang|2)\s+linggo|matag\s+duha\s+ka\s+semana|bi-?weekly")),
    ("semimonthly", re.compile(r"kinsenas|katapusan|twice\s+a\s+month|semi-?monthly|every\s+15|kada\s+15|matag\s+15")),
    ("weekly", re.compile(r"kada\s+(?:linggo|semana|simana)|bawat\s+linggo|matag\s+(?:semana|simana|linggo)|per\s+week|a\s+week|weekly|lingguhan|sa\s+isang\s+linggo|sa\s+usa\s+ka\s+semana|every\s+week|each\s+week")),
    ("daily", re.compile(r"kada\s+(?:araw|adlaw)|bawat\s+araw|matag\s+adlaw|per\s+day|a\s+day|daily|arawan|isang\s+araw|usa\s+ka\s+adlaw|adlaw-adlaw|araw-araw|every\s+day|each\s+day|/\s*day")),
    ("monthly", re.compile(r"kada\s+(?:buwan|bulan)|bawat\s+buwan|matag\s+bulan|per\s+month|a\s+month|monthly|buwanan|bulanan|sa\s+isang\s+buwan|sa\s+usa\s+ka\s+bulan|every\s+month")),
]
_TO_MONTHLY = {"yearly": 1 / 12, "biweekly": 26 / 12, "semimonthly": 2, "weekly": 52 / 12, "daily": 26, "monthly": 1}


def _period_in(text: str):
    for name, rx in _PERIODS:
        if rx.search(text):
            return name
    return None


_ZERO_INCOME = re.compile(r"\b(?:wala|walay|walang|wa)\b.{0,20}\b(?:kita|income|sweldo|sahod|suweldo|kinikita|kwarta|pera)\b|\bno\s+income\b|\bzero\b")
_RANGE_GAP = re.compile(r"^\s*(?:-|–|to|hanggang|hangtod|hangtud|o|or)\s*$")
_ADD_GAP = re.compile(r"\+|,|\b(?:and|at|ug|plus|tapos|saka)\b")


def parse_monthly_income(text: str):
    """Household income in PHP per month, or None when it can't be read confidently."""
    low = text.lower().replace("₱", " ").replace("php", " ").replace("pesos", " ").replace("peso", " ")
    amts = _digit_amounts(low)
    if not amts:
        n = _words_to_number(low)  # "labinlimang libo kada buwan"
        if n is None:
            short = low.strip(" .!")
            if _ZERO_INCOME.search(low) or short in ("wala", "walay", "wala po", "none", "zero", "0"):
                return 0.0
            return None
        amts = [(0, len(low), float(n))]

    # period for each amount: look right after it first, then right before it
    periods = []
    for i, (s, e, _) in enumerate(amts):
        nxt = amts[i + 1][0] if i + 1 < len(amts) else len(low)
        prev = amts[i - 1][1] if i > 0 else 0
        periods.append(_period_in(low[e:nxt]) or _period_in(low[prev:s]))
    if len(amts) == 1 and periods[0] is None:  # number written in words: the period can be anywhere in the sentence
        periods[0] = _period_in(low)
    distinct = {p for p in periods if p}
    if len(distinct) == 1:  # one period named anywhere applies to every amount ("400 ako ug 300 asawa ko per day")
        periods = [next(iter(distinct))] * len(amts)
    values = [v * _TO_MONTHLY[p or "monthly"] for (_, _, v), p in zip(amts, periods)]

    if len(values) == 1:
        return round(values[0], 2)
    gaps = [low[amts[i][1]:amts[i + 1][0]] for i in range(len(amts) - 1)]
    if all(_RANGE_GAP.match(g) for g in gaps):  # "10k to 12k", "8000-10000" -> middle of the range
        return round(sum(values) / len(values), 2)
    if all(_ADD_GAP.search(g) for g in gaps):  # "8000 ako ug 5000 asawa ko" -> add everyone's pay
        return round(sum(values), 2)
    return None  # several amounts we can't combine safely: let the model / Gemini decide


# ---------- household size and age ----------
_ALONE = re.compile(r"\bako\s+(?:lang|ra|rang|lamang)\b|\bmag-?isa\b|\bmag-?inusara\b|\bjust\s+me\b|\balone\b|\bako\s+(?:ra|lang)\s+(?:ang|nag)")


def parse_count(text: str, slot: str):
    """Whole number for household_size or age (digits first, then number words), or None."""
    low = text.lower()
    m = re.search(r"\d+", low)
    if m:
        return int(m.group())
    if slot == "household_size" and _ALONE.search(low):
        return 1
    n = _words_to_number(low)
    return int(n) if n is not None and n < 1000 else None
