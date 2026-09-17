import os
from dotenv import load_dotenv

load_dotenv()  # the only place this runs now

DATABASE_URL = os.getenv("DATABASE_URL")
REDIS_HOST = os.getenv("REDIS_HOST")
REDIS_PORT = int(os.getenv("REDIS_PORT"))
SECRET_KEY = os.getenv("SECRET_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 60
SESSION_TTL_SECONDS = 1800