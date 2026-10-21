import os
from pathlib import Path
from dotenv import load_dotenv

# 1. External secure path outside the repo (~/.config/gabay/.env)
EXTERNAL_ENV_PATH = Path.home() / "config_gabay" / ".env"

# 2. Fallback to local .env (useful for Docker or local dev if external isn't used)
LOCAL_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"

if EXTERNAL_ENV_PATH.exists():
    load_dotenv(dotenv_path=EXTERNAL_ENV_PATH)
else:
    load_dotenv(dotenv_path=LOCAL_ENV_PATH)

# Environment & Server Config
ENV = os.getenv("ENV", "development")
PORT = int(os.getenv("PORT", 8000))

# Comma-separated list of frontend origins allowed to call the API (CORS)
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
    if origin.strip()
]

# Core Persistence & Cache
DATABASE_URL = os.getenv("DATABASE_URL")
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_URL = os.getenv("REDIS_URL", f"redis://{REDIS_HOST}:{REDIS_PORT}/0")

# Security & Third-Party APIs
SECRET_KEY = os.getenv("SECRET_KEY") or os.getenv("JWT_SECRET_KEY")
SEMAPHORE_API_KEY = os.getenv("SEMAPHORE_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Constants
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))
SESSION_TTL_SECONDS = 1800