"""Local words and slang the chat understands ("Edit Regional Bureaucratic Jargon
Sets" / "Cross-Reference Code-Switched Jargon").

Staff manage the list in the admin console (Local Terms). It lives in the
jargon_terms table and is cached here, so the chat doesn't hit the database on
every message; the admin endpoints call `load()` again after each change.
The built-in lists in chatflow.ENUM_SYNONYMS are only the starting set (copied
into the table once) and the fallback if the table isn't there yet.
"""

from app import chatflow

SLOTS = ("employment_status", "housing_type", "crisis_type")

_terms: dict[str, dict[str, list[str]]] = {}


def _defaults() -> dict[str, dict[str, list[str]]]:
    return {slot: {v: list(words) for v, words in chatflow.ENUM_SYNONYMS[slot].items()} for slot in SLOTS}


async def load(pool) -> None:
    """(Re)load the word list from the database."""
    global _terms
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch("SELECT slot, value, term FROM jargon_terms ORDER BY length(term) DESC, term;")
    except Exception:
        _terms = _defaults()  # schema_admin.sql not applied yet
        return
    if not rows:
        _terms = _defaults()
        return
    terms: dict[str, dict[str, list[str]]] = {slot: {v: [] for v in chatflow.ENUMS[slot]} for slot in SLOTS}
    for r in rows:
        if r["slot"] in terms and r["value"] in terms[r["slot"]]:
            terms[r["slot"]][r["value"]].append(r["term"])
    _terms = terms


def synonyms() -> dict[str, dict[str, list[str]]]:
    return _terms or _defaults()


def glossary_text(limit: int = 150) -> str:
    """Short glossary for the AI extractor, e.g. '"arawan" -> employment_status = informal'."""
    lines = []
    for slot, values in synonyms().items():
        for value, words in values.items():
            for w in words:
                lines.append(f'- "{w}" -> {slot} = {value}')
    return "\n".join(lines[:limit])
