import asyncio
import os
import bcrypt
import asyncpg
from dotenv import load_dotenv

load_dotenv()

async def reset_password(username: str, new_password: str):
    conn = await asyncpg.connect(os.getenv("DATABASE_URL"))
    try:
        password_hash = bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        result = await conn.execute(
            # Treated as a temporary password: the user must set their own on next sign-in
            # (and existing sessions are signed out).
            "UPDATE admin_users SET password_hash = $1, must_change_password = TRUE, tokens_valid_after = NOW() WHERE username = $2;",
            password_hash, username,
        )
        if result == "UPDATE 0":
            print(f"No user found with username '{username}'.")
        else:
            print(f"Password updated for '{username}'.")
    finally:
        await conn.close()

if __name__ == "__main__":
    # ---- EDIT THESE TWO VALUES ----
    asyncio.run(reset_password(
        username="admin",
        new_password="password123!",
    ))