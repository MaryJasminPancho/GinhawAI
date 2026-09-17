from fastapi import APIRouter, Request

router = APIRouter()

@router.get("/")
async def read_root():
    return {"status": "GinhawAI backend is running"}

@router.get("/health/db")
async def health_db(request: Request):
    async with request.app.state.db_pool.acquire() as conn:
        version = await conn.fetchval("SELECT version();")
    return {"database": "connected", "postgres_version": version}

@router.get("/health/redis")
async def health_redis(request: Request):
    await request.app.state.redis.set("healthcheck", "ok", ex=10)
    value = await request.app.state.redis.get("healthcheck")
    return {"redis": "connected", "value": value}