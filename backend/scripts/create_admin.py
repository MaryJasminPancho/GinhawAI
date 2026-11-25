"""Create a staff account from the command line.

Run from the backend folder:
    python scripts/create_admin.py <username> "<role name>"
    e.g. python scripts/create_admin.py jdelacruz "Social Worker"

The password is typed at a hidden prompt; it is never stored in this file.
"""
import argparse
import asyncio
import getpass
import os
import sys

import asyncpg
import bcrypt
from dotenv import load_dotenv

load_dotenv()

MIN_LENGTH = 8


async def create_admin(username: str, plain_password: str, role_name: str):
    conn = await asyncpg.connect(os.getenv("DATABASE_URL"))
    try:
        role_id = await conn.fetchval(
            "SELECT role_id FROM roles WHERE role_name = $1;", role_name
        )
        if role_id is None:
            roles = [r["role_name"] for r in await conn.fetch("SELECT role_name FROM roles ORDER BY role_name;")]
            print(f"Role '{role_name}' not found. Choose one of: {', '.join(roles)}")
            return

        password_hash = bcrypt.hashpw(
            plain_password.encode("utf-8"), bcrypt.gensalt()
        ).decode("utf-8")

        await conn.execute(
            "INSERT INTO admin_users (username, password_hash, role_id) VALUES ($1, $2, $3);",
            username, password_hash, role_id,
        )
        print(f"Admin user '{username}' created.")
    finally:
        await conn.close()


def ask_password() -> str:
    password = getpass.getpass("Password: ")
    if len(password) < MIN_LENGTH:
        sys.exit(f"Password must be at least {MIN_LENGTH} characters.")
    if getpass.getpass("Type it again: ") != password:
        sys.exit("The passwords don't match.")
    return password


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create a staff account.")
    parser.add_argument("username")
    parser.add_argument("role", help='Role name, e.g. "Social Worker"')
    args = parser.parse_args()
    asyncio.run(create_admin(args.username, ask_password(), args.role))
