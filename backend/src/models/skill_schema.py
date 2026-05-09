"""
Skill Schema - Skill 文件结构定义
定义了 AgentSkills 开放标准的 Skill 文件格式
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from enum import Enum
import yaml
from pathlib import Path


class SkillType(Enum):
    """Skill 类型"""
    CHAT = "chat"  # 聊天型
    WORKFLOW = "workflow"  # 工作流型
    ANALYSIS = "analysis"  # 分析型
    TUTOR = "tutor"  # 导师型


class SkillMode(Enum):
    """Skill 运行模式"""
    FULL = "full"  # 完整模式（记忆 + 性格）
    MEMORY_ONLY = "memory"  # 仅记忆模式
    PERSONA_ONLY = "persona"  # 仅性格模式
    REFLECTION = "reflection"  # 反思模式


@dataclass
class SkillMetadata:
    """Skill 元数据（YAML frontmatter）"""
    name: str
    slug: str
    version: str
    author: str = ""
    description: str = ""
    type: SkillType = SkillType.CHAT
    tags: List[str] = field(default_factory=list)
    created_at: str = ""
    updated_at: str = ""
    dependencies: List[str] = field(default_factory=list)
    llm_config: Dict[str, Any] = field(default_factory=dict)


@dataclass
class SkillFile:
    """Skill 文件结构"""
    metadata: SkillMetadata
    persona_content: str = ""  # persona.md 内容
    memory_content: str = ""  # memory.md 内容
    lessons_content: str = ""  # lessons.md 内容（可选）
    
    def save(self, directory: Path):
        """保存 Skill 到目录"""
        dir_path = Path(directory) / self.metadata.slug
        dir_path.mkdir(parents=True, exist_ok=True)
        
        # 保存 SKILL.md（带 YAML frontmatter）
        skill_path = dir_path / "SKILL.md"
        frontmatter = {
            "name": self.metadata.name,
            "slug": self.metadata.slug,
            "version": self.metadata.version,
            "author": self.metadata.author,
            "description": self.metadata.description,
            "type": self.metadata.type.value,
            "tags": self.metadata.tags,
            "created_at": self.metadata.created_at,
            "updated_at": self.metadata.updated_at,
            "dependencies": self.metadata.dependencies,
            "llm_config": self.metadata.llm_config,
        }
        
        content = f"---\n{yaml.dump(frontmatter, allow_unicode=True)}---\n\n"
        content += f"# {self.metadata.name}\n\n"
        content += self.metadata.description + "\n\n"
        skill_path.write_text(content, encoding="utf-8")
        
        # 保存 persona.md
        if self.persona_content:
            (dir_path / "persona.md").write_text(self.persona_content, encoding="utf-8")
        
        # 保存 memory.md
        if self.memory_content:
            (dir_path / "memory.md").write_text(self.memory_content, encoding="utf-8")
        
        # 保存 lessons.md（如果有）
        if self.lessons_content:
            (dir_path / "lessons.md").write_text(self.lessons_content, encoding="utf-8")
    
    @classmethod
    def load(cls, directory: Path, slug: str) -> Optional["SkillFile"]:
        """从目录加载 Skill"""
        dir_path = Path(directory) / slug
        if not dir_path.exists():
            return None
        
        skill_path = dir_path / "SKILL.md"
        if not skill_path.exists():
            return None
        
        content = skill_path.read_text(encoding="utf-8")
        
        # 解析 YAML frontmatter
        if content.startswith("---"):
            parts = content.split("---", 2)
            if len(parts) >= 3:
                frontmatter = yaml.safe_load(parts[1])
                metadata = SkillMetadata(
                    name=frontmatter.get("name", ""),
                    slug=frontmatter.get("slug", slug),
                    version=frontmatter.get("version", "v1.0"),
                    author=frontmatter.get("author", ""),
                    description=frontmatter.get("description", ""),
                    type=SkillType(frontmatter.get("type", "chat")),
                    tags=frontmatter.get("tags", []),
                    created_at=frontmatter.get("created_at", ""),
                    updated_at=frontmatter.get("updated_at", ""),
                    dependencies=frontmatter.get("dependencies", []),
                    llm_config=frontmatter.get("llm_config", {}),
                )
            else:
                metadata = SkillMetadata(name=slug, slug=slug, version="v1.0")
        else:
            metadata = SkillMetadata(name=slug, slug=slug, version="v1.0")
        
        skill = cls(metadata=metadata)
        
        # 加载 persona.md
        persona_path = dir_path / "persona.md"
        if persona_path.exists():
            skill.persona_content = persona_path.read_text(encoding="utf-8")
        
        # 加载 memory.md
        memory_path = dir_path / "memory.md"
        if memory_path.exists():
            skill.memory_content = memory_path.read_text(encoding="utf-8")
        
        # 加载 lessons.md
        lessons_path = dir_path / "lessons.md"
        if lessons_path.exists():
            skill.lessons_content = lessons_path.read_text(encoding="utf-8")
        
        return skill


@dataclass
class SkillState:
    """Skill 运行状态"""
    slug: str
    current_mode: SkillMode = SkillMode.FULL
    conversation_history: List[Dict[str, Any]] = field(default_factory=list)
    last_updated: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "slug": self.slug,
            "current_mode": self.current_mode.value,
            "conversation_history": self.conversation_history,
            "last_updated": self.last_updated,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SkillState":
        return cls(
            slug=data["slug"],
            current_mode=SkillMode(data.get("current_mode", "full")),
            conversation_history=data.get("conversation_history", []),
            last_updated=data.get("last_updated", ""),
        )
