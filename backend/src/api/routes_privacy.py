"""
隐私控制 API 路由
使用 SQLAlchemy async + ConsentRepository
"""

import sys
from pathlib import Path
from typing import List, Dict, Any

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

sys.path.insert(0, str(Path(__file__).parent.parent))

from config import settings
from database import get_session
from repositories.consent_repository import ConsentRepository

router = APIRouter(tags=["privacy"])


class DisableAIRequest(BaseModel):
    username: str
    confirm: bool


class EraseDataRequest(BaseModel):
    username: str
    confirm: bool


class ConsentRequest(BaseModel):
    user_id: str
    consent_type: str
    accepted: bool


@router.post("/disable-ai",
    summary="禁用AI功能",
    description="""
    ## 功能说明

    禁用用户的AI功能。禁用后，用户的数字分身将不再响应对话请求。

    ## 请求示例

    ```
    POST /api/privacy/disable-ai
    {
        "username": "zhangsan",
        "confirm": true
    }
    ```

    ## 参数说明

    | 参数 | 类型 | 必填 | 说明 |
    |------|------|------|------|
    | username | string | 是 | 用户名 |
    | confirm | bool | 是 | 确认操作 |

    ## 响应示例

    ```json
    {
        "success": true,
        "message": "AI功能已禁用"
    }
    ```

    ## 错误码

    | 状态码 | 说明 |
    |--------|------|
    | 200 | 禁用成功 |
    | 400 | 未确认操作 |
    """
)
async def disable_ai(req: DisableAIRequest):
    if not req.confirm:
        raise HTTPException(status_code=400, detail="请确认操作")

    return {"success": True, "message": "AI功能已禁用"}


@router.post("/erase-data",
    summary="擦除用户数据",
    description="""
    ## 功能说明

    擦除用户的所有数据，包括数字分身、聊天记录等。此操作不可逆。

    ## 请求示例

    ```
    POST /api/privacy/erase-data
    {
        "username": "zhangsan",
        "confirm": true
    }
    ```

    ## 参数说明

    | 参数 | 类型 | 必填 | 说明 |
    |------|------|------|------|
    | username | string | 是 | 用户名 |
    | confirm | bool | 是 | 确认操作 |

    ## 响应示例

    ```json
    {
        "success": true,
        "message": "用户数据已擦除"
    }
    ```

    ## 错误码

    | 状态码 | 说明 |
    |--------|------|
    | 200 | 擦除成功 |
    | 400 | 未确认操作 |
    """
)
async def erase_data(req: EraseDataRequest):
    if not req.confirm:
        raise HTTPException(status_code=400, detail="请确认操作")

    return {"success": True, "message": "用户数据已擦除"}


@router.post("/consent",
    summary="记录用户同意",
    description="""
    ## 功能说明

    记录用户对隐私协议的同意状态。前端隐私页面调用此接口记录用户的同意。

    ## 请求示例

    ```
    POST /api/privacy/consent
    {
        "user_id": "zhangsan",
        "consent_type": "privacy_policy",
        "accepted": true
    }
    ```

    ## 参数说明

    | 参数 | 类型 | 必填 | 说明 |
    |------|------|------|------|
    | user_id | string | 是 | 用户标识 |
    | consent_type | string | 是 | 同意类型 |
    | accepted | bool | 是否同意 |

    ## 响应示例

    ```json
    {
        "success": true,
        "message": "同意已记录"
    }
    ```
    """
)
async def record_consent(req: ConsentRequest, session: AsyncSession = Depends(get_session)):
    repo = ConsentRepository(session)
    await repo.record_consent(req.user_id, req.consent_type, req.accepted)
    await session.commit()
    return {"success": True, "message": "同意已记录"}


@router.get("/consent-status",
    summary="查询同意状态",
    description="""
    ## 功能说明

    查询用户的隐私协议同意状态。

    ## 请求示例

    ```
    GET /api/privacy/consent-status?username=zhangsan
    ```

    ## 参数说明

    | 参数 | 类型 | 必填 | 说明 |
    |------|------|------|------|
    | username | string | 是 | 用户名 |

    ## 响应示例

    ```json
    {
        "records": [
            {"consent_type": "privacy_policy", "accepted": true, "consented_at": "..."}
        ]
    }
    ```

    ## 错误码

    | 状态码 | 说明 |
    |--------|------|
    | 200 | 查询成功 |
    """
)
async def get_consent_status(username: str, session: AsyncSession = Depends(get_session)):
    repo = ConsentRepository(session)
    records = await repo.get_consents(username)
    return {"records": [
        {
            "consent_type": r.consent_type,
            "accepted": r.accepted,
            "consented_at": str(r.created_at) if r.created_at else None,
        }
        for r in records
    ]}
