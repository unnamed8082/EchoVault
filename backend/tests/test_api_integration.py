"""
API 集成测试
测试所有 FastAPI 端点的功能
"""

import sys
import tempfile
import shutil
from pathlib import Path
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
sys.path.insert(0, str(Path(__file__).parent.parent / "tools"))

TEST_DIR = Path(tempfile.mkdtemp(prefix="ev_integ_"))
TEST_DB_URL = f"sqlite+aiosqlite:///{TEST_DIR / 'test.db'}"

import os
os.environ["DATABASE_URL"] = TEST_DB_URL

from config import settings
settings.DATA_DIR = TEST_DIR
settings.SKILLS_DIR = TEST_DIR / "skills"
settings.VERSIONS_DIR = TEST_DIR / "versions"
settings.UPLOADS_DIR = TEST_DIR / "uploads"
settings.DATABASE_URL = TEST_DB_URL

(TEST_DIR / "skills").mkdir(exist_ok=True)
(TEST_DIR / "versions").mkdir(exist_ok=True)
(TEST_DIR / "uploads").mkdir(exist_ok=True)


@pytest.fixture(scope="session", autouse=True)
def setup_db():
    import asyncio
    from database import metadata
    from sqlalchemy.ext.asyncio import create_async_engine

    engine = create_async_engine(TEST_DB_URL, echo=False)

    async def _init():
        async with engine.begin() as conn:
            await conn.run_sync(metadata.create_all)

    loop = asyncio.new_event_loop()
    loop.run_until_complete(_init())

    import database
    database.async_engine = engine
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.ext.asyncio import AsyncSession
    database.async_session_factory = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    yield

    async def _dispose():
        await engine.dispose()

    loop.run_until_complete(_dispose())
    loop.close()
    shutil.rmtree(TEST_DIR, ignore_errors=True)


@pytest.fixture
def temp_data_dir():
    return TEST_DIR


@pytest_asyncio.fixture
async def async_client():
    from main import app
    from storage.factory import create_storage_backend

    storage = create_storage_backend(
        "filesystem",
        skills_dir=TEST_DIR / "skills",
        uploads_dir=TEST_DIR / "uploads",
    )

    import api.routes_distill as rd
    import api.routes_chat as rc

    old_rd = getattr(rd, "storage", None)
    old_rc = getattr(rc, "storage", None)
    rd.storage = storage
    rc.storage = storage

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client

    if old_rd is not None:
        rd.storage = old_rd
    if old_rc is not None:
        rc.storage = old_rc


@pytest.mark.asyncio
class TestAPIEndpoints:

    async def test_health_check(self, async_client):
        response = await async_client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"

    async def test_root_endpoint(self, async_client):
        response = await async_client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "EchoVault API"
        assert "version" in data

    async def test_distill_personality_success(self, async_client):
        response = await async_client.post(
            "/api/distill/",
            json={
                "name": "测试用户",
                "slug": "test-user-api",
                "persona_traits": {
                    "tags": ["幽默", "理性"]
                },
                "memory_items": {
                    "shared_experiences": ["一起吃饭"]
                }
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["slug"] == "test-user-api"

    async def test_list_skills_empty(self, async_client):
        response = await async_client.get("/api/distill/skills")
        assert response.status_code == 200
        data = response.json()
        assert "skills" in data
        assert isinstance(data["skills"], list)

    async def test_list_skills_with_item(self, async_client):
        await async_client.post(
            "/api/distill/",
            json={"name": "用户1", "slug": "user1", "persona_traits": {}, "memory_items": {}}
        )
        response = await async_client.get("/api/distill/skills")
        assert response.status_code == 200
        data = response.json()
        assert "user1" in data["skills"]

    async def test_get_skill_success(self, async_client):
        await async_client.post(
            "/api/distill/",
            json={"name": "GetTestUser", "slug": "get-test-user", "persona_traits": {"tags": ["测试"]}, "memory_items": {}}
        )
        response = await async_client.get("/api/distill/skills/get-test-user")
        assert response.status_code == 200
        data = response.json()
        assert data["slug"] == "get-test-user"
        assert data["name"] == "GetTestUser"

    async def test_get_nonexistent_skill_returns_404(self, async_client):
        response = await async_client.get("/api/distill/skills/nonexistent")
        assert response.status_code == 404

    async def test_delete_skill_success(self, async_client):
        await async_client.post(
            "/api/distill/",
            json={"name": "DeleteTest", "slug": "delete-test", "persona_traits": {}, "memory_items": {}}
        )
        response = await async_client.delete("/api/distill/skills/delete-test")
        assert response.status_code == 200
        assert response.json()["success"] is True

        list_response = await async_client.get("/api/distill/skills")
        assert "delete-test" not in list_response.json()["skills"]

    async def test_delete_nonexistent_skill_returns_404(self, async_client):
        response = await async_client.delete("/api/distill/skills/nonexistent")
        assert response.status_code == 404

    async def test_list_versions_empty(self, async_client):
        response = await async_client.get("/api/distill/skills/nonexistent/versions")
        assert response.status_code == 404

    async def test_list_versions_with_item(self, async_client):
        await async_client.post(
            "/api/distill/",
            json={"name": "版本测试", "slug": "version-test", "persona_traits": {}, "memory_items": {}}
        )
        response = await async_client.get("/api/distill/skills/version-test/versions")
        assert response.status_code == 200

    async def test_distill_with_invalid_input(self, async_client):
        response = await async_client.post(
            "/api/distill/",
            json={"description": "缺少必填字段"}
        )
        assert response.status_code == 422


@pytest.mark.asyncio
class TestAuthentication:

    async def test_register_success(self, async_client):
        response = await async_client.post(
            "/api/auth/register",
            json={"username": "testuser", "email": "test@example.com", "password": "testpassword123"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data

    async def test_login_success(self, async_client):
        await async_client.post(
            "/api/auth/register",
            json={"username": "logintest", "email": "login@test.com", "password": "testpassword123"}
        )
        response = await async_client.post(
            "/api/auth/login",
            json={"username": "logintest", "password": "testpassword123"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data


@pytest.mark.asyncio
class TestChat:

    async def test_chat_without_skill_returns_404(self, async_client):
        response = await async_client.post(
            "/api/chat/",
            json={
                "slug": "non-existent-skill",
                "messages": [{"role": "user", "content": "你好"}],
                "provider": "deepseek",
                "model": "deepseek-chat"
            }
        )
        assert response.status_code == 404

    async def test_chat_with_skill(self, async_client):
        await async_client.post(
            "/api/distill/",
            json={"name": "TestBot", "slug": "test-chat-bot", "persona_traits": {}, "memory_items": {}}
        )
        chat_resp = await async_client.post(
            "/api/chat/",
            json={
                "slug": "test-chat-bot",
                "messages": [{"role": "user", "content": "你好"}],
                "provider": "deepseek",
                "model": "deepseek-chat",
                "api_key": "test-key"
            }
        )
        assert chat_resp.status_code in (200, 502)


@pytest.mark.asyncio
class TestPrivacy:

    async def test_post_consent(self, async_client):
        response = await async_client.post(
            "/api/privacy/consent",
            json={"user_id": "test_user", "consent_type": "privacy_policy", "accepted": True}
        )
        assert response.status_code == 200
        assert response.json()["success"] is True

    async def test_consent_status(self, async_client):
        await async_client.post(
            "/api/privacy/consent",
            json={"user_id": "status_user", "consent_type": "privacy_policy", "accepted": True}
        )
        response = await async_client.get("/api/privacy/consent-status?username=status_user")
        assert response.status_code == 200
        assert len(response.json()["records"]) > 0

    async def test_disable_ai(self, async_client):
        response = await async_client.post(
            "/api/privacy/disable-ai",
            json={"username": "test", "confirm": True}
        )
        assert response.status_code == 200

    async def test_erase_data(self, async_client):
        response = await async_client.post(
            "/api/privacy/erase-data",
            json={"username": "test", "confirm": True}
        )
        assert response.status_code == 200
