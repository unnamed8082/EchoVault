"""
认证 API 路由（JWT）
"""

import re
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field
from jose import JWTError, jwt
import bcrypt

from config import settings

router = APIRouter(tags=["auth"])

SECRET_KEY = settings.SECRET_KEY
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

DB_PATH = str(settings.DATA_DIR / "users.db")


class _PwdContext:
    def hash(self, password: str) -> str:
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    def verify(self, password: str, hashed: str) -> bool:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


pwd_context = _PwdContext()

bearer_scheme = HTTPBearer(auto_error=False)


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def _init_db():
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                email TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        columns = [row[1] for row in conn.execute("PRAGMA table_info(users)").fetchall()]
        if "phone" not in columns:
            conn.execute("ALTER TABLE users ADD COLUMN phone TEXT")


_init_db()


class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)


class UserLogin(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not credentials:
        raise credentials_exception
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    with get_db() as conn:
        row = conn.execute("SELECT username FROM users WHERE username = ?", (username,)).fetchone()
    if not row:
        raise credentials_exception
    return {"username": username}


@router.post("/register", response_model=TokenResponse, summary="用户注册")
async def register(user: UserRegister):
    with get_db() as conn:
        existing = conn.execute("SELECT username FROM users WHERE username = ?", (user.username,)).fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="Username already registered")
        conn.execute(
            "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
            (user.username, user.email, pwd_context.hash(user.password)),
        )
    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return TokenResponse(access_token=access_token)


@router.post("/login", response_model=TokenResponse, summary="用户登录")
async def login(user: UserLogin):
    with get_db() as conn:
        row = conn.execute(
            "SELECT password_hash FROM users WHERE username = ?", (user.username,)
        ).fetchone()
    if not row or not pwd_context.verify(user.password, row[0]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return TokenResponse(access_token=access_token)


class BindPhoneRequest(BaseModel):
    username: str
    phone: str


PHONE_PATTERN = re.compile(r"^1[3-9]\d{9}$")


@router.post("/bindPhone", summary="绑定手机号")
async def bind_phone(req: BindPhoneRequest, current_user: dict = Depends(get_current_user)):
    if current_user["username"] != req.username:
        raise HTTPException(status_code=403, detail="无权操作其他用户")
    if not PHONE_PATTERN.match(req.phone):
        raise HTTPException(status_code=400, detail="手机号格式不正确")
    with get_db() as conn:
        row = conn.execute("SELECT username FROM users WHERE username = ?", (req.username,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="用户不存在")
        conn.execute("UPDATE users SET phone = ? WHERE username = ?", (req.phone, req.username))
    return {"success": True, "message": "手机号绑定成功"}


@router.get("/profile", summary="获取用户资料")
async def get_profile(token: str = Query(...), current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        row = conn.execute(
            "SELECT username, email, phone, created_at FROM users WHERE username = ?",
            (current_user["username"],),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="用户不存在")
    return {
        "username": row[0],
        "email": row[1],
        "phone": row[2],
        "created_at": row[3],
    }
