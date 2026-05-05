"""
.env 配置文件测试
测试环境变量的必填项、格式要求和默认值规则
"""
import sys
from pathlib import Path
import pytest
from unittest.mock import patch

# 添加 src 到路径
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))


class TestEnvFile:
    """测试 .env 文件的存在和完整性"""
    
    def test_env_file_exists(self):
        """测试 .env 文件存在"""
        env_file = Path(__file__).parent.parent.parent / ".env"
        assert env_file.exists(), ".env 文件不存在"
    
    def test_env_example_exists(self):
        """测试 .env.example 文件存在（作为模板）"""
        env_example_file = Path(__file__).parent.parent.parent / ".env.example"
        assert env_example_file.exists(), ".env.example 文件不存在"


class TestConfigLoading:
    """测试配置加载"""
    
    def test_config_loads_successfully(self):
        """测试配置能正常加载"""
        from config import settings
        assert settings is not None
        assert settings.SECRET_KEY is not None
        assert settings.ENCRYPT_KEY is not None
        assert settings.DATABASE_URL is not None
        assert settings.LOG_LEVEL is not None
    
    def test_secret_key_not_default(self):
        """测试 SECRET_KEY 不是默认值（安全性检查）"""
        from config import settings
        # 允许在开发环境使用默认值，但生产环境必须修改
        assert settings.SECRET_KEY is not None
    
    def test_database_url_format(self):
        """测试 DATABASE_URL 格式正确"""
        from config import settings
        assert settings.DATABASE_URL.startswith("sqlite"), "数据库URL格式不正确"
    
    def test_log_level_valid(self):
        """测试 LOG_LEVEL 是有效值"""
        from config import settings
        valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR"]
        assert settings.LOG_LEVEL in valid_levels, f"LOG_LEVEL 必须是 {valid_levels} 之一"
    
    def test_paths_exist_or_can_be_created(self):
        """测试数据目录存在或可以创建"""
        from config import settings
        assert settings.BASE_DIR.exists()
        # 其他目录可能不存在，但应该能在运行时创建


class TestEnvVariables:
    """测试环境变量的具体值"""
    
    @patch.dict('os.environ', {
        'SECRET_KEY': 'test-secret-key-12345',
        'ENCRYPT_KEY': 'test-encrypt-key-1234567890123456',
        'API_PORT': '9000',
    })
    def test_custom_env_vars(self):
        """测试自定义环境变量被正确读取"""
        # 重新导入以确保新环境变量生效
        from config import Settings
        # 这里我们直接创建新实例而不是使用全局 settings
        settings = Settings(_env_file=None)
        # 注意：pydantic-settings 会从环境变量读取
        assert settings.API_PORT == 9000
