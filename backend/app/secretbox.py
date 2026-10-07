"""Reversible encryption for secrets kept in the database: a requested password
while it waits for approval, and the phone SMS gateway's password.

The key is derived from the backend SECRET_KEY (plus a per-purpose label), so
the database alone is not enough to read them. Pending-password ciphertexts are
erased once the request is decided (see routers/auth.py and routers/admin_users.py).
"""

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.config import SECRET_KEY


def _fernet(purpose: str) -> Fernet:
    key = hashlib.sha256(f"ginhawai-{purpose}:{SECRET_KEY}".encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(key))


def encrypt(text: str, purpose: str = "password-requests") -> str:
    return _fernet(purpose).encrypt(text.encode("utf-8")).decode("ascii")


def decrypt(token: str, purpose: str = "password-requests") -> str | None:
    """None if the token can't be read (e.g. SECRET_KEY changed since it was stored)."""
    try:
        return _fernet(purpose).decrypt(token.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError):
        return None
