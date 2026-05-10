"""
隐私控制 API 路由
"""

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from config import settings

router = APIRouter(tags=["privacy"])

DB_PATH = str(settings.DATA_DIR / "echovault.db")


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
            CREATE TABLE IF NOT EXISTS consent_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                consent_type TEXT NOT NULL,
                accepted BOOLEAN NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                skill_slug TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
            )
        """)


_init_db()


class DisableAIRequest(BaseModel):
    username: str
    confirm: bool


class EraseDataRequest(BaseModel):
    username: str
    confirm: bool


@router.post("/disable-ai", summary="关闭 AI 功能")
async def disable_ai(req: DisableAIRequest):
    if not req.confirm:
        raise HTTPException(status_code=400, detail="需要 confirm=true 才能执行此操作")
    with get_db() as conn:
        conn.execute(
            "INSERT INTO consent_records (user_id, consent_type, accepted) VALUES (?, ?, ?)",
            (req.username, "ai_disabled", True),
        )
    return {"success": True, "message": "AI 功能已关闭"}


@router.post("/erase-data", summary="擦除用户数据")
async def erase_data(req: EraseDataRequest):
    if not req.confirm:
        raise HTTPException(status_code=400, detail="需要 confirm=true 才能执行此操作")
    with get_db() as conn:
        session_rows = conn.execute(
            "SELECT id FROM chat_sessions WHERE user_id = ?", (req.username,)
        ).fetchall()
        session_ids = [row[0] for row in session_rows]
        if session_ids:
            placeholders = ",".join("?" * len(session_ids))
            conn.execute(
                f"DELETE FROM chat_messages WHERE session_id IN ({placeholders})",
                session_ids,
            )
            conn.execute(
                "DELETE FROM chat_sessions WHERE user_id = ?", (req.username,)
            )
        conn.execute(
            "INSERT INTO consent_records (user_id, consent_type, accepted) VALUES (?, ?, ?)",
            (req.username, "data_erased", True),
        )
    return {"success": True, "message": "数据已擦除", "deleted_sessions": len(session_ids)}


@router.get("/consent-status", summary="查询用户同意记录")
async def consent_status(username: str = Query(...)):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, user_id, consent_type, accepted, created_at "
            "FROM consent_records WHERE user_id = ? ORDER BY created_at DESC",
            (username,),
        ).fetchall()
    records = [
        {
            "id": row[0],
            "user_id": row[1],
            "consent_type": row[2],
            "accepted": bool(row[3]),
            "created_at": row[4],
        }
        for row in rows
    ]
    return {"username": username, "records": records}
