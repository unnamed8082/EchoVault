"""
Skill Writer - Skill 文件管理工具
负责创建、更新、删除 Skill 文件
"""

import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Any
import sys

# 添加 src 到路径
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from models.skill_schema import SkillFile, SkillMetadata, SkillType
from models.personality_model import PersonalityModel


class SkillWriter:
    """Skill 文件管理器"""
    
    def __init__(self, skills_dir: Path, versions_dir: Optional[Path] = None):
        self.skills_dir = Path(skills_dir)
        self.versions_dir = Path(versions_dir) if versions_dir else self.skills_dir / "versions"
        
        self.skills_dir.mkdir(parents=True, exist_ok=True)
        self.versions_dir.mkdir(parents=True, exist_ok=True)
    
    def create_skill_from_model(
        self,
        model: PersonalityModel,
        author: str = "",
        description: str = ""
    ) -> SkillFile:
        """从人格模型创建 Skill"""
        metadata = SkillMetadata(
            name=model.name,
            slug=model.slug,
            version=model.version,
            author=author,
            description=description or f"{model.name} 的数字分身",
            type=SkillType.CHAT,
            tags=model.personality_tags,
            created_at=model.created_at or datetime.now().isoformat(),
            updated_at=model.updated_at or datetime.now().isoformat(),
        )
        
        # 生成 persona.md 内容
        persona_content = self._generate_persona_md(model)
        
        # 生成 memory.md 内容
        memory_content = self._generate_memory_md(model)
        
        # 生成 lessons.md 内容（如果有）
        lessons_content = ""
        if model.lessons:
            lessons_content = self._generate_lessons_md(model)
        
        skill = SkillFile(
            metadata=metadata,
            persona_content=persona_content,
            memory_content=memory_content,
            lessons_content=lessons_content,
        )
        
        return skill
    
    def _generate_persona_md(self, model: PersonalityModel) -> str:
        """生成 persona.md 内容"""
        content = f"# {model.name} - 人格画像\n\n"
        
        content += "## 基本信息\n\n"
        if model.mbti:
            content += f"- MBTI: {model.mbti.value}\n"
        if model.attachment_style:
            content += f"- 依恋类型: {model.attachment_style.value}\n"
        if model.love_languages:
            content += f"- 爱的语言: {', '.join([ll.value for ll in model.love_languages])}\n"
        if model.zodiac_sign:
            content += f"- 星座: {model.zodiac_sign}\n"
        if model.personality_tags:
            content += f"- 标签: {', '.join(model.personality_tags)}\n"
        
        content += "\n## 五层人格结构\n\n"
        
        content += "### 硬规则\n\n"
        for rule in model.persona.hard_rules:
            content += f"- {rule}\n"
        
        content += "\n### 身份\n\n"
        for key, value in model.persona.identity.items():
            content += f"- {key}: {value}\n"
        
        content += "\n### 说话风格\n\n"
        for key, value in model.persona.speech_style.items():
            content += f"- {key}: {value}\n"
        
        content += "\n### 情感模式\n\n"
        for key, value in model.persona.emotion_pattern.items():
            content += f"- {key}: {value}\n"
        
        content += "\n### 关系行为\n\n"
        for key, value in model.persona.relationship_behavior.items():
            content += f"- {key}: {value}\n"
        
        if model.corrections:
            content += "\n## 对话修正\n\n"
            for corr in model.corrections:
                content += f"- {corr.get('note', '')}\n"
        
        return content
    
    def _generate_memory_md(self, model: PersonalityModel) -> str:
        """生成 memory.md 内容"""
        content = f"# {model.name} - 关系记忆\n\n"
        
        content += "## 共同经历\n\n"
        for exp in model.memory.shared_experiences:
            content += f"- {exp}\n"
        
        content += "\n## 约会地点\n\n"
        for loc in model.memory.date_locations:
            content += f"- {loc}\n"
        
        content += "\n## 内部笑话\n\n"
        for joke in model.memory.inside_jokes:
            content += f"- {joke}\n"
        
        content += "\n## 争吵模式\n\n"
        for conflict in model.memory.conflict_patterns:
            content += f"- {conflict}\n"
        
        content += "\n## 甜蜜瞬间\n\n"
        for moment in model.memory.sweet_moments:
            content += f"- {moment}\n"
        
        if model.memory.timeline:
            content += "\n## 关系时间线\n\n"
            for item in model.memory.timeline:
                date = item.get('date', '')
                event = item.get('event', '')
                content += f"- {date}: {event}\n"
        
        return content
    
    def _generate_lessons_md(self, model: PersonalityModel) -> str:
        """生成 lessons.md 内容"""
        content = f"# {model.name} - 经验教训\n\n"
        
        content += "## 性格画像分析\n\n"
        for key, value in model.lessons.personality_profiling.items():
            content += f"- {key}: {value}\n"
        
        content += "\n## 沟通模式\n\n"
        for key, value in model.lessons.communication_patterns.items():
            content += f"- {key}: {value}\n"
        
        content += "\n## 冲突循环\n\n"
        for cycle in model.lessons.conflict_cycles:
            content += f"- {cycle}\n"
        
        content += "\n## 需求错配\n\n"
        for key, value in model.lessons.needs_mismatch.items():
            content += f"- {key}: {value}\n"
        
        content += "\n## 边界\n\n"
        for boundary in model.lessons.boundaries:
            content += f"- {boundary}\n"
        
        content += "\n## 成长轨迹\n\n"
        for key, value in model.lessons.growth_trajectory.items():
            content += f"- {key}: {value}\n"
        
        content += "\n## 分手复盘\n\n"
        for key, value in model.lessons.breakup_debrief.items():
            content += f"- {key}: {value}\n"
        
        if model.lessons.action_items:
            content += "\n## 可行动课题\n\n"
            for item in model.lessons.action_items:
                content += f"### {item.get('title', '')}\n\n"
                content += f"- 现象: {item.get('phenomenon', '')}\n"
                content += f"- 根因: {item.get('root_cause', '')}\n"
                content += f"- 行动: {item.get('action', '')}\n\n"
        
        return content
    
    def save_skill(self, skill: SkillFile) -> bool:
        """保存 Skill"""
        try:
            skill.save(self.skills_dir)
            return True
        except Exception as e:
            print(f"保存 Skill 失败: {e}")
            return False
    
    def load_skill(self, slug: str) -> Optional[SkillFile]:
        """加载 Skill"""
        return SkillFile.load(self.skills_dir, slug)
    
    def list_skills(self) -> List[str]:
        """列出所有 Skill"""
        skills = []
        for dir_path in self.skills_dir.iterdir():
            if dir_path.is_dir() and (dir_path / "SKILL.md").exists():
                skills.append(dir_path.name)
        return sorted(skills)
    
    def delete_skill(self, slug: str) -> bool:
        """删除 Skill"""
        skill_dir = self.skills_dir / slug
        if skill_dir.exists():
            shutil.rmtree(skill_dir)
            return True
        return False
