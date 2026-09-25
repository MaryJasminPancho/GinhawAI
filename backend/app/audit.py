"""Append-only audit trail (manuscript Table 12)."""

import json


def as_text(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    return json.dumps(value, default=str, ensure_ascii=False)


async def write_audit(conn, user_id: str, action_type: str, target_table: str, old_value=None, new_value=None):
    await conn.execute(
        "INSERT INTO audit_logs (user_id, action_type, target_table, old_value, new_value) VALUES ($1, $2, $3, $4, $5);",
        user_id, action_type, target_table, as_text(old_value), as_text(new_value),
    )
