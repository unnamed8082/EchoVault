"""
认证 API 路由
使用 SQLAlchemy async + UserRepository
"""

import sys
from pathlib import Path

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
from jose import jwt
from datetime import datetime, timedelta
import bcrypt

sys.path.insert(0, str(Path(__file__).parent.parent))

from config import settings
from database import get_session
from repositories.user_repository import UserRepository
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=["auth"])


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str = Field(..., description="邮箱地址")
    password: str = Field(..., min_length=6, max_length=100)


class LoginRequest(BaseModel):
    username: str
    password: str


class BindPhoneRequest(BaseModel):
    username: str
    phone_number: str


def create_token(username: str) -> str:
    payload = {
        "sub": username,
        "exp": datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


@router.post("/register",
    summary="用户注册",
    description="""
    ## 功能说明

    创建新用户账号，注册成功后自动登录并返回 JWT Token。

    ## 请求示例

    ```
    POST /api/auth/register
    {
        "username": "zhangsan",
        "email": "zhangsan@example.com",
        "password": "mypassword123"
    }
    ```

    ## 参数说明

    | 参数 | 类型 | 必填 | 说明 |
    |------|------|------|------|
    | username | string | 是 | 用户名，3-50字符 |
    | email | string | 是 | 邮箱地址 |
    | password | string | 是 | 密码，6-100字符 |

    ## 响应示例

    ```json
    {
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "username": "zhangsan",
        "message": "注册成功"
    }
    ```

    ## 错误码

    | 状态码 | 说明 |
    |--------|------|
    | 200 | 注册成功 |
    | 400 | 用户名已存在或邮箱已注册 |
    | 422 | 参数验证失败 |
    """
)
async def register(req: RegisterRequest, session: AsyncSession = Depends(get_session)):
    repo = UserRepository(session)
    existing = await repo.get_user_by_username(req.username)
    if existing:
        raise HTTPException(status_code=400, detail="用户名已存在")

    hashed = hash_password(req.password)
    await repo.create_user(req.username, req.email, hashed)
    await session.commit()

    token = create_token(req.username)
    return {"token": token, "username": req.username, "message": "注册成功"}


@router.post("/login",
    summary="用户登录",
    description="""
    ## 功能说明

    使用用户名和密码登录，返回 JWT Token。

    ## 请求示例

    ```
    POST /api/auth/login
    {
        "username": "zhangsan",
        "password": "mypassword123"
    }
    ```

    ## 参数说明

    | 参数 | 类型 | 必填 | 说明 |
    |------|------|------|------|
    | username | string | 是 | 用户名 |
    | password | string | 是 | 密码 |

    ## 响应示例

    ```json
    {
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "username": "zhangsan",
        "message": "登录成功"
    }
    ```

    ## 错误码

    | 状态码 | 说明 |
    |--------|------|
    | 200 | 登录成功 |
    | 401 | 用户名或密码错误 |
    | 422 | 参数验证失败 |
    """
)
async def login(req: LoginRequest, session: AsyncSession = Depends(get_session)):
    repo = UserRepository(session)
    user = await repo.get_user_by_username(req.username)
    if not user:
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    if not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    token = create_token(req.username)
    return {"token": token, "username": req.username, "message": "登录成功"}


@router.post("/bindPhone",
    summary="绑定手机号",
    description="""
    ## 功能说明

    绑定用户手机号码，用于隐私数据擦除时的身份验证。

    ## 请求示例

    ```
    POST /api/auth/bindPhone
    {
        "username": "zhangsan",
        "phone_number": "13800138000"
    }
    ```

    ## 参数说明

    | 参数 | 类型 | 必填 | 说明 |
    |------|------|------|------|
    | username | string | 是 | 用户名 |
    | phone_number | string | 是 | 手机号码 |

    ## 响应示例

    ```json
    {
        "success": true,
        "message": "手机号绑定成功"
    }
    ```

    ## 错误码

    | 状态码 | 说明 |
    |--------|------|
    | 200 | 绑定成功 |
    | 400 | 手机号格式错误 |
    | 404 | 用户不存在 |
    """
)
async def bind_phone(req: BindPhoneRequest, session: AsyncSession = Depends(get_session)):
    if not req.phone_number or len(req.phone_number) < 11:
        raise HTTPException(status_code=400, detail="手机号格式错误")

    repo = UserRepository(session)
    updated = await repo.update_user(req.username, {"phone_number": req.phone_number})
    if not updated:
        raise HTTPException(status_code=404, detail="用户不存在")

    await session.commit()
    return {"success": True, "message": "手机号绑定成功"}


@router.get("/profile",
    summary="获取用户信息",
    description="""
    ## 功能说明

    获取当前用户的个人信息。

    ## 请求示例

    ```
    GET /api/auth/profile?username=zhangsan
    ```

    ## 参数说明

    | 参数 | 类型 | 必填 | 说明 |
    |------|------|------|------|
    | username | string | 是 | 用户名 |

    ## 响应示例

    ```json
    {
        "username": "zhangsan",
        "email": "zhangsan@example.com",
        "phone_number": "138****8000",
        "created_at": "2024-01-01T00:00:00"
    }
    ```

    ## 错误码

    | 状态码 | 说明 |
    |--------|------|
    | 200 | 获取成功 |
    | 404 | 用户不存在 |
    """
)
async def get_profile(username: str, session: AsyncSession = Depends(get_session)):
    repo = UserRepository(session)
    user = await repo.get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    return {
        "username": user["username"],
        "email": user.get("email"),
        "phone_number": user.get("phone_number"),
        "created_at": str(user.get("created_at", ""))
    }
