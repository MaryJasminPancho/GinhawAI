import asyncio
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from redis.exceptions import ConnectionError as RedisConnectionError, TimeoutError as RedisTimeoutError

from app.cache import create_redis_client
from app.database import create_db_pool
from app import jargon
from app.routers import admin_users, analytics, audit_logs, auth, catalog, citizens, feedback, health, jargon_terms, localization, partners, programs, sessions, system, validation
from app.settings import DEFAULTS, load_settings

# Shared list object: the CORS middleware reads it on every request, so the
# Security Policy screen can change allowed origins without a restart.
CORS_ORIGINS: list[str] = list(DEFAULTS["allowed_origins"])


async def warm_up_models():
    """Loads every fine-tuned model once at startup. The first load of a ~1 GB model takes
    many seconds; doing it here means the first citizen to answer a question is not the one
    who waits (that wait used to pass the frontend's 20 s limit)."""
    from app.ai.slot_classifier import load_model

    for key in sorted(set(sessions.SLOT_MODELS.values())):
        try:
            await asyncio.to_thread(load_model, key)  # to_thread: keeps the server responsive
            print(f"[warm-up] model loaded: {key}")
        except Exception as e:  # a missing model must not stop the backend; the chat falls back
            print(f"[warm-up] could not load {key}: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.db_pool = await create_db_pool()
    app.state.redis = create_redis_client()
    app.state.settings = await load_settings(app.state.db_pool)
    await jargon.load(app.state.db_pool)
    app.state.cors_origins = CORS_ORIGINS
    CORS_ORIGINS[:] = app.state.settings.get("allowed_origins") or DEFAULTS["allowed_origins"]
    app.state.warmup_task = asyncio.create_task(warm_up_models())  # background: the server starts at once
    yield
    await app.state.db_pool.close()
    await app.state.redis.aclose()


app = FastAPI(lifespan=lifespan)


@app.exception_handler(RedisConnectionError)
@app.exception_handler(RedisTimeoutError)
async def redis_unavailable(request: Request, exc: Exception):
    # Chat sessions live in Redis; without it the assessment can't start.
    print(f"Redis unavailable: {exc}")
    return JSONResponse({"detail": "The chat service is temporarily unavailable (session cache is offline). Please try again later."}, status_code=503)


# Public endpoints get a per-IP rate limit (Security Policy: requests per minute).
RATE_LIMITED = ("/api/sessions", "/api/feedback", "/api/catalog", "/api/auth/login", "/api/auth/forgot-password")


@app.middleware("http")
async def rate_limit(request: Request, call_next):
    if request.method != "OPTIONS" and request.url.path.startswith(RATE_LIMITED):
        try:
            limit = int(request.app.state.settings.get("rate_limit_per_minute", 60))
            ip = request.client.host if request.client else "unknown"
            key = f"ratelimit:{ip}:{int(time.time() // 60)}"
            count = await request.app.state.redis.incr(key)
            if count == 1:
                await request.app.state.redis.expire(key, 70)
            if count > limit:
                return JSONResponse({"detail": "Too many requests. Please wait a minute and try again."}, status_code=429)
        except Exception as e:  # never block traffic because the limiter failed
            print(f"Rate limiter error: {e}")
    return await call_next(request)


# Added last so it wraps everything (including 429 responses) with CORS headers.
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
app.include_router(jargon_terms.router)
app.include_router(catalog.router)
app.include_router(partners.router)
app.include_router(localization.router)
app.include_router(sessions.router)
app.include_router(citizens.router)
app.include_router(feedback.router)
app.include_router(audit_logs.router)
app.include_router(analytics.router)
app.include_router(validation.router)
app.include_router(system.router)