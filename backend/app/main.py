from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.database import create_db_pool
from app.cache import create_redis_client
from app.routers import health, auth, admin_users, programs, localization, sessions

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.db_pool = await create_db_pool()
    app.state.redis = create_redis_client()
    yield
    await app.state.db_pool.close()
    await app.state.redis.aclose()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(admin_users.router)
app.include_router(programs.router)
app.include_router(localization.router)
app.include_router(sessions.router)