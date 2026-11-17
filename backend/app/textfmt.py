"""Small text helpers for what citizens read."""

import re

# Words that end with a period but don't end a sentence (addresses, titles, initials).
_ABBREV = {"st", "ave", "gen", "no", "dr", "sr", "sto", "sta", "brgy", "bgy", "mr", "mrs", "ms", "hon", "cor", "ext", "blvd", "rd", "loc", "vs", "etc", "e.g", "i.e"}
# Only after a period: a question stays on the same line as its answer ("Wala pa kay ID? Libre ang National ID.").
_BOUNDARY = re.compile(r"(?<=[.!])\s+(?=[A-ZÑ\"“(₱0-9])")


def one_per_line(text: str | None) -> str | None:
    """Put each sentence on its own line (mentor: "next line" makes it neat and easy to read).
    Lines already broken stay as they are. Doesn't break after abbreviations or initials
    ("Gen. Maxilom", "M.J. Cuenco", "St. Peter")."""
    if not text:
        return text
    out = []
    for line in text.split("\n"):
        pieces, start = [], 0
        for m in _BOUNDARY.finditer(line):
            before = line[start:m.start()]
            last = re.search(r"([A-Za-z.]+)[.!]$", before)
            word = last.group(1).lower().rstrip(".") if last else ""
            # An initial ("M.J.", "J.") or a known abbreviation: not the end of a sentence.
            if word in _ABBREV or re.fullmatch(r"([a-z]\.)*[a-z]", word):
                continue
            pieces.append(before)
            start = m.end()
        pieces.append(line[start:])
        out.append("\n".join(p.strip() for p in pieces if p.strip()))
    return "\n".join(out)
