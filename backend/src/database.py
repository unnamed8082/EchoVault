from contextlib import asynccontextmanager
from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    create_engine,
    text,
)
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from config import settings

metadata = MetaData()

users = Table(
    "users",
    metadata,
    Column("username", String(150), primary_key=True),
    Column("email", String(255), nullable=False),
    Column("password_hash", String(255), nullable=False),
    Column("phone", String(20), nullable=True),
    Column("created_at", DateTime, server_default=text("CURRENT_TIMESTAMP")),
    Column("updated_at", DateTime, server_default=text("CURRENT_TIMESTAMP")),
    Column("is_active", Boolean, default=True, server_default=text("1")),
)

skills = Table(
    "skills",
    metadata,
    Column("slug", String(200), primary_key=True),
    Column("name", String(200), nullable=False),
    Column("description", Text, nullable=True),
    Column("type", String(50), default="chat", server_default=text("'chat'")),
    Column("version", String(50), nullable=True),
    Column("persona_content", Text, nullable=True),
    Column("memory_content", Text, nullable=True),
    Column("lessons_content", Text, nullable=True),
    Column("tags", JSON, nullable=True),
    Column("created_at", DateTime, server_default=text("CURRENT_TIMESTAMP")),
    Column("updated_at", DateTime, server_default=text("CURRENT_TIMESTAMP")),
)

skill_versions = Table(
    "skill_versions",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("skill_slug", String(200), ForeignKey("skills.slug"), nullable=False),
    Column("version", String(50), nullable=False),
    Column("change_note", Text, nullable=True),
    Column("persona_snapshot", Text, nullable=True),
    Column("memory_snapshot", Text, nullable=True),
    Column("lessons_snapshot", Text, nullable=True),
    Column("created_at", DateTime, server_default=text("CURRENT_TIMESTAMP")),
)

chat_sessions = Table(
    "chat_sessions",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("user_id", String(150), ForeignKey("users.username"), nullable=False),
    Column("skill_slug", String(200), ForeignKey("skills.slug"), nullable=False),
    Column("created_at", DateTime, server_default=text("CURRENT_TIMESTAMP")),
    Column("updated_at", DateTime, server_default=text("CURRENT_TIMESTAMP")),
)

chat_messages = Table(
    "chat_messages",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("session_id", Integer, ForeignKey("chat_sessions.id"), nullable=False),
    Column("role", String(20), nullable=False),
    Column("content", Text, nullable=False),
    Column("created_at", DateTime, server_default=text("CURRENT_TIMESTAMP")),
)

consent_records = Table(
    "consent_records",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("user_id", String(150), nullable=False),
    Column("consent_type", String(100), nullable=False),
    Column("accepted", Boolean, nullable=False),
    Column("created_at", DateTime, server_default=text("CURRENT_TIMESTAMP")),
)

skill_files = Table(
    "skill_files",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("skill_slug", String(200), ForeignKey("skills.slug"), nullable=False),
    Column("filename", String(500), nullable=False),
    Column("content", Text, nullable=False),
    Column("created_at", DateTime, server_default=text("CURRENT_TIMESTAMP")),
)

users_table = users
skills_table = skills
skill_versions_table = skill_versions
chat_sessions_table = chat_sessions
chat_messages_table = chat_messages
consent_records_table = consent_records
skill_files_table = skill_files

async_engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
)

async_session_factory = sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def init_db():
    async with async_engine.begin() as conn:
        await conn.run_sync(metadata.create_all)


@asynccontextmanager
async def get_session():
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


def get_sync_engine():
    sync_url = settings.DATABASE_URL.replace("+aiosqlite", "").replace(
        "sqlite+aiosqlite", "sqlite"
    )
    return create_engine(sync_url, echo=False, pool_pre_ping=True)
