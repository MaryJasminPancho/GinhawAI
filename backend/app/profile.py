"""Validation for staff profiles: display names and profile pictures."""

import base64
import re

from fastapi import HTTPException

MAX_AVATAR_BYTES = 400 * 1024  # the browser sends ~20–80 KB after resizing; this is a safety cap

# Recognize the image by its first bytes, not by what the client claims.
_SIGNATURES = {
    "image/jpeg": (b"\xff\xd8\xff",),
    "image/png": (b"\x89PNG\r\n\x1a\n",),
    "image/webp": (b"RIFF",),  # followed by "WEBP" at offset 8, checked below
}


def clean_full_name(raw: str | None) -> str | None:
    """Collapse spaces; allow letters (ñ, é…), spaces and . - ' only. Empty -> None."""
    if raw is None:
        return None
    name = re.sub(r"\s+", " ", raw).strip()
    if not name:
        return None
    if len(name) < 2:
        raise HTTPException(status_code=422, detail="Please enter at least 2 letters for the name.")
    if not all(ch.isalpha() or ch in " .-'" for ch in name) or not any(ch.isalpha() for ch in name):
        raise HTTPException(status_code=422, detail="A name can only have letters, spaces, periods, hyphens and apostrophes.")
    return name


def decode_avatar(data_url: str) -> tuple[bytes, str]:
    m = re.fullmatch(r"data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)", data_url.strip())
    if not m:
        raise HTTPException(status_code=422, detail="Upload a JPG, PNG or WebP image.")
    try:
        data = base64.b64decode(m.group(2), validate=False)
    except ValueError:
        raise HTTPException(status_code=422, detail="That image couldn't be read.")
    if len(data) > MAX_AVATAR_BYTES:
        raise HTTPException(status_code=413, detail="That picture is too large. Please choose a smaller one.")
    for mime, sigs in _SIGNATURES.items():
        if any(data.startswith(s) for s in sigs) and (mime != "image/webp" or data[8:12] == b"WEBP"):
            return data, mime
    raise HTTPException(status_code=422, detail="That file isn't a JPG, PNG or WebP image.")
