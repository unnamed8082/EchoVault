"""
人格蒸馏流程集成测试
测试完整的蒸馏流程，包括创建、保存、加载、回滚等
"""
import sys
import shutil
from pathlib import Path
from unittest.mock import patch, MagicMock
import pytest
from datetime import datetime

# 添加 src 和 tools 到路径
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
sys.path.insert(0, str(Path(__file__).parent.parent / "tools"))

from models.personality_model import (
    PersonalityModel, PersonalityTraits, RelationshipMemory, LessonsLearned,
    MBTIType, AttachmentStyle, LoveLanguage
)
from models.skill_schema import SkillFile
from skill_writer import SkillWriter
from version_manager import VersionManager


@pytest.fixture
def temp_dir(tmp_path):
    """创建临时目录用于测试"""
    skills_dir = tmp_path / "skills"
    versions_dir = tmp_path / "versions"
    skills_dir.mkdir(exist_ok=True)
    versions_dir.mkdir(exist_ok=True)
    return skills_dir, versions_dir


@pytest.fixture
def sample_personality_model():
    """创建一个示例人格模型"""
    persona = PersonalityTraits(
        hard_rules=["不说脏话", "不聊敏感话题"],
        identity={"职业": "软件工程师", "爱好": "游戏、阅读"},
        speech_style={"语气": "轻松幽默", "用词": "简洁"},
        emotion_pattern={"表达习惯": "直接表达", "触发点": "被误会会解释"},
        relationship_behavior={"互动模式": "主动互动", "边界": "尊重隐私"},
    )
    
    memory = RelationshipMemory(
        shared_experiences=["一起去爬山", "一起打游戏"],
        date_locations=["咖啡厅", "电影院"],
        inside_jokes=["那个梗"],
        conflict_patterns=["容易在决策时争执"],
        sweet_moments=["第一次牵手"],
        timeline=[
            {"date": "2023-01-01", "event": "认识"},
            {"date": "2023-02-14", "event": "在一起"},
        ],
    )
    
    lessons = LessonsLearned(
        personality_profiling={"主要性格": "外向", "优点": "乐观"},
        communication_patterns={"沟通习惯": "直接表达"},
        conflict_cycles=["争执→冷战→和好"],
        needs_mismatch={"需要关注": "安全感"},
        boundaries=["不查手机", "尊重个人空间"],
        growth_trajectory={"成长点": "学会沟通"},
        breakup_debrief={"原因": "误会"},
        action_items=[
            {"title": "学会表达", "phenomenon": "不够主动", "root_cause": "害羞", "action": "多尝试"}
        ],
    )
    
    return PersonalityModel(
        name="测试用户",
        slug="test-user",
        version="v1.0",
        created_at=datetime.now().isoformat(),
        updated_at=datetime.now().isoformat(),
        mbti=MBTIType.ENTJ,
        attachment_style=AttachmentStyle.SECURE,
        love_languages=[LoveLanguage.WORDS, LoveLanguage.TIME],
        zodiac_sign="摩羯座",
        personality_tags=["幽默", "聪明"],
        persona=persona,
        memory=memory,
        lessons=lessons,
    )


class TestPersonalityModel:
    """测试人格模型"""
    
    def test_model_creation(self, sample_personality_model):
        """测试模型创建成功"""
        assert sample_personality_model.name == "测试用户"
        assert sample_personality_model.slug == "test-user"
        assert len(sample_personality_model.persona.hard_rules) == 2
        assert len(sample_personality_model.memory.shared_experiences) == 2
        assert sample_personality_model.lessons is not None
    
    def test_model_serialization(self, sample_personality_model):
        """测试模型序列化"""
        data = sample_personality_model.to_dict()
        assert data["name"] == "测试用户"
        assert data["slug"] == "test-user"
        assert "persona" in data
        assert "memory" in data
        assert "lessons" in data
    
    def test_model_deserialization(self, sample_personality_model):
        """测试模型反序列化"""
        data = sample_personality_model.to_dict()
        new_model = PersonalityModel.from_dict(data)
        assert new_model.name == sample_personality_model.name
        assert new_model.slug == sample_personality_model.slug


class TestSkillWriter:
    """测试 SkillWriter 工具"""
    
    def test_create_skill_from_model(self, temp_dir, sample_personality_model):
        """测试从模型创建 Skill"""
        skills_dir, versions_dir = temp_dir
        writer = SkillWriter(skills_dir, versions_dir)
        
        skill = writer.create_skill_from_model(
            sample_personality_model,
            description="测试 Skill"
        )
        
        assert skill is not None
        assert skill.metadata.name == "测试用户"
        assert skill.metadata.slug == "test-user"
        assert "人格画像" in skill.persona_content
        assert "关系记忆" in skill.memory_content
        assert "经验教训" in skill.lessons_content
    
    def test_save_and_load_skill(self, temp_dir, sample_personality_model):
        """测试保存和加载 Skill"""
        skills_dir, versions_dir = temp_dir
        writer = SkillWriter(skills_dir, versions_dir)
        
        skill = writer.create_skill_from_model(sample_personality_model)
        
        # 保存
        save_result = writer.save_skill(skill)
        assert save_result is True
        
        # 检查文件存在
        skill_dir = skills_dir / "test-user"
        assert skill_dir.exists()
        assert (skill_dir / "SKILL.md").exists()
        assert (skill_dir / "persona.md").exists()
        assert (skill_dir / "memory.md").exists()
        assert (skill_dir / "lessons.md").exists()
        
        # 加载
        loaded_skill = writer.load_skill("test-user")
        assert loaded_skill is not None
        assert loaded_skill.metadata.slug == "test-user"
    
    def test_list_and_delete_skill(self, temp_dir, sample_personality_model):
        """测试列出和删除 Skill"""
        skills_dir, versions_dir = temp_dir
        writer = SkillWriter(skills_dir, versions_dir)
        
        # 创建两个 Skill
        skill1 = writer.create_skill_from_model(sample_personality_model)
        writer.save_skill(skill1)
        
        sample_personality_model_2 = sample_personality_model
        sample_personality_model_2.name = "用户2"
        sample_personality_model_2.slug = "user-2"
        skill2 = writer.create_skill_from_model(sample_personality_model_2)
        writer.save_skill(skill2)
        
        # 列出
        skills = writer.list_skills()
        assert len(skills) == 2
        assert "test-user" in skills
        assert "user-2" in skills
        
        # 删除一个
        delete_result = writer.delete_skill("test-user")
        assert delete_result is True
        
        # 验证只有一个剩下
        skills = writer.list_skills()
        assert len(skills) == 1
        assert "user-2" in skills


class TestVersionManager:
    """测试 VersionManager 工具"""
    
    def test_save_and_list_versions(self, temp_dir, sample_personality_model):
        """测试保存和列出版本"""
        skills_dir, versions_dir = temp_dir
        writer = SkillWriter(skills_dir, versions_dir)
        manager = VersionManager(versions_dir)
        
        skill = writer.create_skill_from_model(sample_personality_model)
        writer.save_skill(skill)
        
        # 保存版本
        manager.save_version(skill, "v1.0 初始版本")
        
        # 保存第二个版本（模拟更新）
        skill.metadata.version = "v1.1"
        manager.save_version(skill, "v1.1 更新内容")
        
        # 列出
        versions = manager.list_versions("test-user")
        assert len(versions) == 2
        versions.sort(key=lambda v: v["version"])
        assert versions[0]["version"] == "v1.0"
        assert versions[1]["version"] == "v1.1"
    
    def test_rollback_version(self, temp_dir, sample_personality_model):
        """测试回滚版本"""
        skills_dir, versions_dir = temp_dir
        writer = SkillWriter(skills_dir, versions_dir)
        manager = VersionManager(versions_dir)
        
        # 初始版本
        skill = writer.create_skill_from_model(sample_personality_model)
        writer.save_skill(skill)
        manager.save_version(skill, "v1.0 初始版本")
        
        # 保存更新版本
        skill_updated = writer.create_skill_from_model(sample_personality_model)
        skill_updated.metadata.version = "v1.1"
        skill_updated.metadata.description = "更新描述"
        writer.save_skill(skill_updated)
        manager.save_version(skill_updated, "v1.1 更新")
        
        # 回滚到 v1.0
        rollback_result = manager.rollback_to("test-user", "v1.0", skills_dir)
        assert rollback_result is True
        
        # 验证回滚后的内容
        rolled_skill = writer.load_skill("test-user")
        assert rolled_skill is not None


class TestDistillationFlow:
    """完整蒸馏流程集成测试"""
    
    def test_complete_distillation_workflow(self, temp_dir):
        """测试完整的蒸馏流程"""
        skills_dir, versions_dir = temp_dir
        writer = SkillWriter(skills_dir, versions_dir)
        manager = VersionManager(versions_dir)
        
        # 1. 创建人格模型
        persona = PersonalityTraits(
            hard_rules=["测试规则"],
            identity={"职业": "测试"},
            speech_style={"语气": "测试"},
            emotion_pattern={},
            relationship_behavior={},
        )
        
        memory = RelationshipMemory(
            shared_experiences=["测试经历"],
            date_locations=["测试地点"],
            inside_jokes=[],
            conflict_patterns=[],
            sweet_moments=["测试瞬间"],
            timeline=[],
        )
        
        model = PersonalityModel(
            name="测试流程",
            slug="test-flow",
            version="v1.0",
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat(),
            persona=persona,
            memory=memory,
        )
        
        # 2. 创建并保存 Skill
        skill = writer.create_skill_from_model(model)
        save_result = writer.save_skill(skill)
        assert save_result is True
        
        # 3. 保存初始版本
        manager.save_version(skill, "流程测试 v1.0")
        
        # 4. 更新模型
        model_updated = model
        model_updated.memory.shared_experiences.append("新增经历")
        model_updated.version = "v1.1"
        
        skill_updated = writer.create_skill_from_model(model_updated)
        skill_updated.metadata.version = "v1.1"
        writer.save_skill(skill_updated)
        manager.save_version(skill_updated, "流程测试 v1.1")
        
        # 5. 列出版本
        versions = manager.list_versions("test-flow")
        assert len(versions) == 2
        
        # 6. 列出技能
        skills = writer.list_skills()
        assert "test-flow" in skills
        
        # 7. 回滚
        rollback_result = manager.rollback_to("test-flow", "v1.0", skills_dir)
        assert rollback_result is True
        
        # 8. 验证回滚
        final_skill = writer.load_skill("test-flow")
        assert final_skill is not None
        assert final_skill.metadata.version == "v1.0"
        
        # 9. 删除
        delete_result = writer.delete_skill("test-flow")
        assert delete_result is True
