"""
配置管理
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


class Settings(BaseSettings):
    """应用配置"""
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )
    
    # 基础配置
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ENCRYPT_KEY: str = ""
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 9000
    
    # 数据库
    DATABASE_URL: str = "sqlite+aiosqlite:///./data/echovault.db"

    # Turso
    TURSO_DATABASE_URL: str = ""
    TURSO_AUTH_TOKEN: str = ""
    TURSO_LOCAL_DB: str = ""

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:5173"
    
    # 默认模型
    DEFAULT_MODEL: str = "deepseek-chat"
    
    # 日志
    LOG_LEVEL: str = "INFO"
    
    # 路径
    BASE_DIR: Path = Path(__file__).parent.parent
    DATA_DIR: Path = BASE_DIR / "data"
    SKILLS_DIR: Path = DATA_DIR / "skills"
    VERSIONS_DIR: Path = DATA_DIR / "versions"
    UPLOADS_DIR: Path = DATA_DIR / "uploads"
    PROMPTS_DIR: Path = BASE_DIR / "prompts"


# 全局配置实例
settings = Settings()
