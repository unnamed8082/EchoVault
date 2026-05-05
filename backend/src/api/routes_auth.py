"""
认证 API 路由（简单 JWT）
"""

from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field
from jose import JWTError, jwt
from passlib.context import CryptContext

router = APIRouter(prefix="/api/auth", tags=["auth"])

# 配置（实际应该从 config 读取）
SECRET_KEY = "test-secret-key-only-for-development"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

# 密码上下文
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Bearer token
bearer_scheme = HTTPBearer(auto_error=False)


class UserRegister(BaseModel):
    """用户注册"""
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)


class UserLogin(BaseModel):
    """用户登录"""
    username: str
    password: str


class TokenResponse(BaseModel):
    """Token 响应"""
    access_token: str
    token_type: str = "bearer"


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """创建 JWT token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)):
    """获取当前用户"""
    if not credentials:
        return None
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    return {"username": username}


@router.post("/register", response_model=TokenResponse, summary="用户注册", description="注册新用户账户")
async def register(user: UserRegister):
    """
    ## 功能说明
    
    注册新用户账户，生成访问令牌。
    
    **注意：当前为演示实现，未连接真实数据库。**
    
    ## 请求示例
    
    ```json
    {
        "username": "testuser",
        "email": "test@example.com",
        "password": "password123"
    }
    ```
    
    ## 参数说明
    
    | 参数 | 类型 | 必填 | 说明 |
    |------|------|------|------|
    | username | string | 是 | 用户名，3-50个字符 |
    | email | string | 是 | 邮箱地址 |
    | password | string | 是 | 密码，最少6个字符 |
    
    ## 响应示例
    
    ```json
    {
        "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "token_type": "bearer"
    }
    ```
    
    ## 错误码
    
    | 状态码 | 说明 |
    |--------|------|
    | 200 | 注册成功 |
    """
    # 这里只是占位，实际应该保存到数据库
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return TokenResponse(access_token=access_token)


@router.post("/login", response_model=TokenResponse, summary="用户登录", description="用户登录获取访问令牌")
async def login(user: UserLogin):
    """
    ## 功能说明
    
    用户登录，验证凭据后生成访问令牌。
    
    **注意：当前为演示实现，未验证真实用户凭据。**
    
    ## 请求示例
    
    ```json
    {
        "username": "testuser",
        "password": "password123"
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
        "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "token_type": "bearer"
    }
    ```
    
    ## 错误码
    
    | 状态码 | 说明 |
    |--------|------|
    | 200 | 登录成功 |
    """
    # 这里只是占位，实际应该验证用户名和密码
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return TokenResponse(access_token=access_token)
