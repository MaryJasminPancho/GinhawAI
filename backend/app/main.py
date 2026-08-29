import os
from contextlib import asynccontextmanager
from pathlib import Path
from dotenv import load_dotenv
import asyncpg
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from uuid import UUID

from datetime import datetime, timedelta, timezone
import bcrypt
import jwt
from pydantic import BaseModel
from fastapi import HTTPException


# Explicitly find and load the backend/.env file relative to this script
BASE_DIR = Path(__file__).resolve().parent.parent.parent
env_path = BASE_DIR / "backend" / ".env"

if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()  # Fallback to current working directory

SECRET_KEY = os.getenv("SECRET_KEY")
print("SECRET_KEY loaded:", repr(SECRET_KEY))

JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 60

class LoginRequest(BaseModel):
    username: str
    password: str

@asynccontextmanager
async def lifespan(app: FastAPI):
    database_url = os.getenv("DATABASE_URL")
    
    # Safety Check: Prevent defaulting to local OS username if env variable is missing
    if not database_url:
        raise ValueError(
            "DATABASE_URL is not set or could not be found in backend/.env! "
            "Please check your .env file."
        )
        
    # Create the raw asyncpg connection pool
    app.state.db_pool = await asyncpg.create_pool(dsn=database_url)
    yield
    # Clean up and close connection pool when FastAPI shuts down
    await app.state.db_pool.close()

app = FastAPI(
    title=os.getenv("PROJECT_NAME", "GinhawAI API"),
    version=os.getenv("VERSION", "1.0.0"),
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "GinhawAI backend is running"}

@app.get("/health/db")
async def health_db():
    async with app.state.db_pool.acquire() as conn:
        version = await conn.fetchval("SELECT version();")
    return {"database": "connected", "postgres_version": version}

@app.get("/api/programs")
async def list_programs():
    async with app.state.db_pool.acquire() as conn:
        rows = await conn.fetch("SELECT program_id, program_name, agency, scope, is_active FROM programs;")
    return [dict(row) for row in rows]

@app.get("/api/programs/{program_id}/eligibility")
async def get_eligibility(program_id: UUID):
    async with app.state.db_pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT criteria_id, attribute, operator, threshold_value, weight "
            "FROM eligibility_criteria WHERE program_id = $1;",
            program_id,
        )
    return [dict(row) for row in rows]

@app.get("/api/programs/{program_id}/documents")
async def get_documents(program_id: UUID):
    async with app.state.db_pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT doc_id, document_name, is_mandatory, notes "
            "FROM document_requirements WHERE program_id = $1;",
            program_id,
        )
    return [dict(row) for row in rows]

@app.post("/api/auth/login")
async def login(credentials: LoginRequest):
    async with app.state.db_pool.acquire() as conn:
        user = await conn.fetchrow(
            "SELECT au.user_id, au.password_hash, au.is_active, r.role_name "
            "FROM admin_users au JOIN roles r ON au.role_id = r.role_id "
            "WHERE au.username = $1;",
            credentials.username,
        )

    if user is None or not user["is_active"]:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    if not bcrypt.checkpw(credentials.password.encode("utf-8"), user["password_hash"].encode("utf-8")):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    payload = {
        "sub": str(user["user_id"]),
        "role": user["role_name"],
        "exp": datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES),
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)

    return {"access_token": token, "token_type": "bearer"}