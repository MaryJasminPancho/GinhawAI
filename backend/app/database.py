import json
import asyncpg
from app.config import DATABASE_URL


async def _init_connection(conn):
    # Return JSONB columns as Python objects (and accept them on insert).
    await conn.set_type_codec("jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog")


async def create_db_pool():
    return await asyncpg.create_pool(DATABASE_URL, init=_init_connection)
