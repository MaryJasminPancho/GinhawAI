"""Mark ONE existing System Administrator as the Super Administrator.

Run on the server only (the website can never do this):
    cd backend && .venv/bin/python scripts/make_super_admin.py m.jasmin

The Super Administrator can't be deleted, deactivated or reset by anyone else, changes its
own password instantly, and is the only account that may create System Administrators.
Running it again with another username MOVES the flag (there is only ever one).
"""
import asyncio
import os
import sys

import asyncpg
from dotenv import load_dotenv

load_dotenv()


async def make_super_admin(username: str):
    conn = await asyncpg.connect(os.getenv("DATABASE_URL"))
    try:
        user = await conn.fetchrow(
            "SELECT au.user_id, au.username, r.role_name FROM admin_users au "
            "JOIN roles r ON r.role_id = au.role_id WHERE lower(au.username) = lower($1);",
            username,
        )
        if user is None:
            print(f"No user found with username '{username}'.")
            return
        if user["role_name"] != "System Administrator":
            print(f"'{user['username']}' is a {user['role_name']}. Only a System Administrator can be the Super Administrator.")
            return
        async with conn.transaction():
            # Clear first, then set, so the "only one" unique index is never violated.
            await conn.execute("UPDATE admin_users SET is_super_admin = FALSE WHERE is_super_admin;")
            await conn.execute("UPDATE admin_users SET is_super_admin = TRUE, is_active = TRUE WHERE user_id = $1;", user["user_id"])
        print(f"'{user['username']}' is now the Super Administrator.")
    finally:
        await conn.close()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python scripts/make_super_admin.py <username>")
        sys.exit(1)
    asyncio.run(make_super_admin(sys.argv[1]))
