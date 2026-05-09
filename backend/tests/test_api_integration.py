"""
API 集成测试
测试所有 FastAPI 端点的功能
"""

import sys
import tempfile
import shutil
from pathlib import Path
from datetime import datetime
import pytest
import pytest_asyncio
from httpx import AsyncClient

# 添加 src 到路径
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
sys.path.insert(0, str(Path(__file__).parent.parent / "tools"))

# 导入后端代码
from main import app


@pytest.fixture
def temp_data_dir():
    """临时数据目录 - 每个测试独立"""
    temp_dir = Path(tempfile.mkdtemp())
    (temp_dir / "skills").mkdir()
    (temp_dir / "versions").mkdir()
    (temp_dir / "uploads").mkdir()
    yield temp_dir
    shutil.rmtree(temp_dir)


@pytest_asyncio.fixture
async def async_client(temp_data_dir):
    """异步测试客户端，使用临时数据目录"""
    # 暂时修改 API 路由中的路径配置
    import api.routes_distill
    import api.routes_chat
    
    original_data_dir = Path(api.routes_distill.DATA_DIR)
    original_skills_dir = Path(api.routes_distill.SKILLS_DIR)
    original_versions_dir = Path(api.routes_distill.VERSIONS_DIR)
    original_uploads_dir = Path(api.routes_distill.UPLOADS_DIR)
    
    try:
        # 替换为临时目录
        api.routes_distill.DATA_DIR = temp_data_dir
        api.routes_distill.SKILLS_DIR = temp_data_dir / "skills"
        api.routes_distill.VERSIONS_DIR = temp_data_dir / "versions"
        api.routes_distill.UPLOADS_DIR = temp_data_dir / "uploads"
        
        # 为聊天路由设置相同路径
        api.routes_chat.DATA_DIR = temp_data_dir
        api.routes_chat.SKILLS_DIR = temp_data_dir / "skills"
        
        # 重新初始化工具
        from skill_writer import SkillWriter
        from version_manager import VersionManager
        api.routes_distill.skill_writer = SkillWriter(
            api.routes_distill.SKILLS_DIR,
            api.routes_distill.VERSIONS_DIR
        )
        api.routes_distill.version_manager = VersionManager(api.routes_distill.VERSIONS_DIR)
        
        api.routes_chat.skill_writer = SkillWriter(
            api.routes_chat.SKILLS_DIR,
            temp_data_dir / "versions"
        )
        
        # 创建测试客户端
        async with AsyncClient(app=app, base_url="http://testserver") as client:
            yield client
    finally:
        # 恢复原始路径
        api.routes_distill.DATA_DIR = original_data_dir
        api.routes_distill.SKILLS_DIR = original_skills_dir
        api.routes_distill.VERSIONS_DIR = original_versions_dir
        api.routes_distill.UPLOADS_DIR = original_uploads_dir


@pytest.mark.asyncio
class TestAPIEndpoints:
    """API 端点测试类"""

    async def test_health_check(self, async_client):
        """测试健康检查端点"""
        response = await async_client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"

    async def test_root_endpoint(self, async_client):
        """测试根端点"""
        response = await async_client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "EchoVault API"
        assert "version" in data

    async def test_distill_personality_success(self, async_client):
        """测试成功的人格蒸馏请求"""
        response = await async_client.post(
            "/api/distill/",
            json={
                "name": "测试用户",
                "slug": "test-user-api",
                "description": "API 测试描述",
                "persona_traits": {
                    "hard_rules": ["不说脏话"],
                    "identity": {"职业": "测试工程师"},
                    "tags": ["幽默", "理性"]
                },
                "memory_items": {
                    "shared_experiences": ["一起吃饭"],
                    "date_locations": ["餐厅"]
                }
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["slug"] == "test-user-api"
        assert "version" in data

    async def test_list_skills_empty(self, async_client):
        """测试列出空的 Skill 列表"""
        response = await async_client.get("/api/distill/skills")
        assert response.status_code == 200
        data = response.json()
        assert "skills" in data
        assert isinstance(data["skills"], list)
        assert len(data["skills"]) == 0

    async def test_list_skills_with_item(self, async_client):
        """测试列出包含 Item 的 Skill 列表"""
        # 先创建一个 Skill
        await async_client.post(
            "/api/distill/",
            json={
                "name": "用户1",
                "slug": "user1",
                "persona_traits": {},
                "memory_items": {}
            }
        )
        # 再列出
        response = await async_client.get("/api/distill/skills")
        assert response.status_code == 200
        data = response.json()
        assert len(data["skills"]) == 1
        assert "user1" in data["skills"]

    async def test_get_skill_success(self, async_client):
        """测试成功获取 Skill"""
        # 先创建
        await async_client.post(
            "/api/distill/",
            json={
                "name": "GetTestUser",
                "slug": "get-test-user",
                "description": "获取测试用",
                "persona_traits": {"tags": ["测试"]},
                "memory_items": {"shared_experiences": ["测试事件"]}
            }
        )
        # 再获取
        response = await async_client.get("/api/distill/skills/get-test-user")
        assert response.status_code == 200
        data = response.json()
        assert data["slug"] == "get-test-user"
        assert data["name"] == "GetTestUser"
        assert "persona" in data
        assert "memory" in data

    async def test_get_nonexistent_skill_returns_404(self, async_client):
        """测试获取不存在的 Skill 返回 404"""
        response = await async_client.get("/api/distill/skills/nonexistent")
        assert response.status_code == 404

    async def test_delete_skill_success(self, async_client):
        """测试删除 Skill"""
        # 先创建
        await async_client.post(
            "/api/distill/",
            json={
                "name": "DeleteTest",
                "slug": "delete-test",
                "persona_traits": {},
                "memory_items": {}
            }
        )
        # 再删除
        response = await async_client.delete("/api/distill/skills/delete-test")
        assert response.status_code == 200
        assert response.json()["success"] is True

        # 验证已删除
        list_response = await async_client.get("/api/distill/skills")
        assert "delete-test" not in list_response.json()["skills"]

    async def test_delete_nonexistent_skill_returns_404(self, async_client):
        """测试删除不存在的 Skill 返回 404"""
        response = await async_client.delete("/api/distill/skills/nonexistent")
        assert response.status_code == 404

    async def test_list_versions_empty(self, async_client):
        """测试列出空的版本列表"""
        response = await async_client.get("/api/distill/skills/nonexistent/versions")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    async def test_list_versions_with_item(self, async_client):
        """测试列出包含版本的 Skill"""
        # 创建 Skill
        await async_client.post(
            "/api/distill/",
            json={
                "name": "版本测试用户",
                "slug": "version-test-user",
                "persona_traits": {},
                "memory_items": {}
            }
        )
        # 列出版本
        response = await async_client.get("/api/distill/skills/version-test-user/versions")
        assert response.status_code == 200
        versions = response.json()
        assert len(versions) == 1
        assert versions[0]["version"] == "v1.0"
        assert versions[0]["change_note"] == "初始版本"

    async def test_rollback_version(self, async_client):
        """测试版本回滚"""
        # 创建初始 Skill
        await async_client.post(
            "/api/distill/",
            json={
                "name": "回滚API测试",
                "slug": "rollback-api-test",
                "persona_traits": {"tags": ["v1"]},
                "memory_items": {}
            }
        )
        # 回滚（虽然还没有其他版本，但应该返回 404 而不是 500）
        response = await async_client.post(
            "/api/distill/skills/rollback-api-test/rollback/v1.0"
        )
        assert response.status_code == 404 or response.status_code == 200

    async def test_distill_with_invalid_input(self, async_client):
        """测试无效输入验证"""
        # 缺少必填字段
        response = await async_client.post(
            "/api/distill/",
            json={
                "description": "缺少必填字段"
            }
        )
        assert response.status_code == 422  # Validation Error


@pytest.mark.asyncio
class TestAuthentication:
    """认证测试类"""

    async def test_register_success(self, async_client):
        """测试用户注册"""
        response = await async_client.post(
            "/api/auth/register",
            json={
                "username": "testuser",
                "email": "test@example.com",
                "password": "testpassword123"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    async def test_login_success(self, async_client):
        """测试用户登录"""
        response = await async_client.post(
            "/api/auth/login",
            json={
                "username": "testuser",
                "password": "testpassword123"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data


@pytest.mark.asyncio
class TestChat:
    """聊天 API 测试类"""

    async def test_chat_without_skill_returns_404(self, async_client):
        """测试不存在的 Skill 返回 404"""
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

    async def test_chat_with_mock_skill(self, async_client):
        """测试创建 Skill 后聊天"""
        # 先创建 Skill
        create_resp = await async_client.post(
            "/api/distill/",
            json={
                "name": "TestBot",
                "slug": "test-chat-bot",
                "persona_traits": {},
                "memory_items": {}
            }
        )
        assert create_resp.status_code == 200
        
        # 测试聊天
        chat_resp = await async_client.post(
            "/api/chat/",
            json={
                "slug": "test-chat-bot",
                "messages": [{"role": "user", "content": "你好"}],
                "provider": "deepseek",
                "model": "deepseek-chat"
            }
        )
        assert chat_resp.status_code == 200
        data = chat_resp.json()
        assert "content" in data
        assert "model" in data
        assert "usage" in data


@pytest.mark.asyncio
class TestLLMConfig:
    """LLM 配置测试类"""

    async def test_list_llm_providers(self, async_client):
        """测试列出 LLM 提供商"""
        response = await async_client.get("/api/models/providers")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0

    async def test_get_model_cost(self, async_client):
        """测试获取模型定价"""
        response = await async_client.get("/api/models/costs/deepseek-chat")
        assert response.status_code == 200
        data = response.json()
        assert "input_cost_per_1k" in data
        assert "output_cost_per_1k" in data

    async def test_save_and_get_config(self, async_client):
        """测试保存和获取配置"""
        # 保存配置
        save_resp = await async_client.post(
            "/api/models/config",
            json={
                "provider": "deepseek",
                "model": "deepseek-chat",
                "api_key": "test-key-123",
                "temperature": 0.8,
                "max_tokens": 1024
            }
        )
        assert save_resp.status_code == 200
        
        # 获取配置（不应返回 API Key）
        get_resp = await async_client.get("/api/models/config")
        assert get_resp.status_code == 200
        data = get_resp.json()
        assert data["provider"] == "deepseek"
        assert data["model"] == "deepseek-chat"
        assert data["temperature"] == 0.8
        assert data["has_api_key"] is True

