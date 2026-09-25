import asyncio
import os
import bcrypt
import asyncpg
from dotenv import load_dotenv

load_dotenv()

async def create_admin(username: str, plain_password: str, role_name: str):
    conn = await asyncpg.connect(os.getenv("DATABASE_URL"))
    try:
        role_id = await conn.fetchval(
            "SELECT role_id FROM roles WHERE role_name = $1;", role_name
        )
        if role_id is None:
            print(f"Role '{role_name}' not found.")
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

if __name__ == "__main__":
    # ---- EDIT THESE THREE VALUES EACH TIME YOU WANT A NEW TEST ACCOUNT ----
    asyncio.run(create_admin("admin", "ginhawai", "Social Worker"))