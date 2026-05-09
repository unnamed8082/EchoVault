"""
人格蒸馏管道测试套件 - TDD风格
按照测试驱动开发思想：红 -> 绿 -> 重构
"""

import sys
import tempfile
import shutil
from pathlib import Path
from datetime import datetime
import pytest

# 添加 src 到路径
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
sys.path.insert(0, str(Path(__file__).parent.parent / "tools"))

# 导入后端代码
from models.personality_model import (
    PersonalityModel,
    PersonalityTraits,
    RelationshipMemory,
    LessonsLearned
)
from models.skill_schema import SkillFile, SkillMetadata, SkillType
from tools.skill_writer import SkillWriter
from tools.version_manager import VersionManager


@pytest.fixture
def temp_data_dir():
    """临时数据目录 - 每个测试独立"""
    temp_dir = Path(tempfile.mkdtemp())
    (temp_dir / "skills").mkdir()
    (temp_dir / "versions").mkdir()
    yield temp_dir
    shutil.rmtree(temp_dir)


@pytest.fixture
def skill_writer(temp_data_dir):
    """SkillWriter 实例"""
    return SkillWriter(
        temp_data_dir / "skills",
        temp_data_dir / "versions"
    )


@pytest.fixture
def version_manager(temp_data_dir):
    """VersionManager 实例"""
    return VersionManager(temp_data_dir / "versions")


@pytest.fixture
def sample_personality_model():
    """测试用的人格模型"""
    return PersonalityModel(
        name="测试用户",
        slug="test-user",
        version="v1.0",
        created_at=datetime.now().isoformat(),
        updated_at=datetime.now().isoformat(),
        persona=PersonalityTraits(
            hard_rules=["不说脏话", "不讨论政治"],
            identity={"职业": "软件工程师", "爱好": "阅读"},
            speech_style={"语速": "慢", "风格": "幽默"},
            emotion_pattern={"高兴": "发哈哈", "生气": "沉默"},
            relationship_behavior={"关心": "嘘寒问暖"}
        ),
        memory=RelationshipMemory(
            shared_experiences=["一起吃火锅", "一起看电影"],
            date_locations=["老北京火锅", "万达影城"],
            inside_jokes=["那个梗", "你懂的"],
            conflict_patterns=["冷战", "讲道理"],
            sweet_moments=["第一次约会", "生日惊喜"],
            timeline=[{"date": "2024-01-01", "event": "认识"}]
        ),
        lessons=None,
        personality_tags=["幽默", "理性"]
    )


class TestSkillWriter:
    """SkillWriter 测试类"""

    def test_init_creates_directories(self, temp_data_dir):
        """测试初始化时创建目录"""
        skill_writer = SkillWriter(
            temp_data_dir / "skills",
            temp_data_dir / "versions"
        )
        assert skill_writer.skills_dir.exists()
        assert skill_writer.versions_dir.exists()

    def test_create_skill_from_model(self, skill_writer, sample_personality_model):
        """测试从模型创建Skill"""
        skill = skill_writer.create_skill_from_model(sample_personality_model)
        assert skill.metadata.name == "测试用户"
        assert skill.metadata.slug == "test-user"
        assert skill.persona_content
        assert skill.memory_content
        assert "测试用户 - 人格画像" in skill.persona_content
        assert "不说脏话" in skill.persona_content
        assert "测试用户 - 关系记忆" in skill.memory_content
        assert "一起吃火锅" in skill.memory_content

    def test_create_skill_with_lessons(self, skill_writer):
        """测试创建包含经验教训的Skill"""
        model = PersonalityModel(
            name="用户2",
            slug="user2",
            version="v1.0",
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat(),
            persona=PersonalityTraits(),
            memory=RelationshipMemory(),
            lessons=LessonsLearned(
                personality_profiling={"分析": "内容"},
                action_items=[{"title": "课题1", "phenomenon": "现象1", "root_cause": "", "action": ""}]
            )
        )
        skill = skill_writer.create_skill_from_model(model)
        assert skill.lessons_content
        assert "经验教训" in skill.lessons_content
        assert "可行动课题" in skill.lessons_content

    def test_save_and_load_skill(self, skill_writer, sample_personality_model):
        """测试保存和加载Skill"""
        skill = skill_writer.create_skill_from_model(sample_personality_model)
        save_success = skill_writer.save_skill(skill)
        assert save_success

        loaded_skill = skill_writer.load_skill("test-user")
        assert loaded_skill
        assert loaded_skill.metadata.slug == "test-user"
        assert loaded_skill.persona_content == skill.persona_content
        assert loaded_skill.memory_content == skill.memory_content

    def test_list_skills_empty(self, skill_writer):
        """测试列出空的Skill列表"""
        skills = skill_writer.list_skills()
        assert isinstance(skills, list)
        assert len(skills) == 0

    def test_list_skills_with_item(self, skill_writer, sample_personality_model):
        """测试列出包含Item的Skill列表"""
        skill = skill_writer.create_skill_from_model(sample_personality_model)
        skill_writer.save_skill(skill)
        skills = skill_writer.list_skills()
        assert len(skills) == 1
        assert "test-user" in skills

    def test_delete_skill(self, skill_writer, sample_personality_model):
        """测试删除Skill"""
        skill = skill_writer.create_skill_from_model(sample_personality_model)
        skill_writer.save_skill(skill)

        skills_before = skill_writer.list_skills()
        assert len(skills_before) == 1

        delete_success = skill_writer.delete_skill("test-user")
        assert delete_success

        skills_after = skill_writer.list_skills()
        assert len(skills_after) == 0

    def test_delete_nonexistent_skill_returns_false(self, skill_writer):
        """测试删除不存在的Skill"""
        assert not skill_writer.delete_skill("nonexistent")

    def test_save_skill_creates_correct_file_structure(
        self,
        skill_writer,
        sample_personality_model
    ):
        """测试保存Skill时创建正确的文件结构"""
        skill = skill_writer.create_skill_from_model(sample_personality_model)
        skill_writer.save_skill(skill)

        skill_dir = skill_writer.skills_dir / "test-user"
        assert skill_dir.exists()
        assert (skill_dir / "SKILL.md").exists()
        assert (skill_dir / "persona.md").exists()
        assert (skill_dir / "memory.md").exists()
        assert not (skill_dir / "lessons.md").exists()

    def test_save_skill_with_lessons_creates_all_files(
        self,
        skill_writer
    ):
        """测试保存包含经验教训的Skill时创建所有文件"""
        model = PersonalityModel(
            name="用户3",
            slug="user3",
            version="v1.0",
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat(),
            persona=PersonalityTraits(),
            memory=RelationshipMemory(),
            lessons=LessonsLearned(
                personality_profiling={},
                action_items=[]
            )
        )
        skill = skill_writer.create_skill_from_model(model)
        skill_writer.save_skill(skill)

        skill_dir = skill_writer.skills_dir / "user3"
        assert (skill_dir / "lessons.md").exists()


class TestPersonalityModel:
    """人格模型测试类"""

    def test_create_model(self):
        """测试创建基本模型"""
        model = PersonalityModel(
            name="用户",
            slug="user",
            version="v1.0",
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat()
        )
        assert model.name == "用户"
        assert model.slug == "user"
        assert model.version == "v1.0"

    def test_to_dict_and_from_dict(self, sample_personality_model):
        """测试序列化和反序列化"""
        data = sample_personality_model.to_dict()
        assert data["name"] == "测试用户"
        assert data["slug"] == "test-user"

        loaded = PersonalityModel.from_dict(data)
        assert loaded.name == sample_personality_model.name
        assert loaded.persona.hard_rules == sample_personality_model.persona.hard_rules
        assert loaded.memory.shared_experiences == sample_personality_model.memory.shared_experiences


class TestBoundaryConditions:
    """边界条件测试类"""

    def test_empty_memory_works(self, skill_writer):
        """测试空记忆仍然可以创建Skill"""
        model = PersonalityModel(
            name="空记忆用户",
            slug="empty-memory",
            version="v1.0",
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat(),
            persona=PersonalityTraits(),
            memory=RelationshipMemory()
        )
        skill = skill_writer.create_skill_from_model(model)
        assert skill
        assert "空记忆用户 - 关系记忆" in skill.memory_content

    def test_persona_with_all_fields(self, skill_writer):
        """测试包含所有字段的Persona"""
        persona = PersonalityTraits(
            hard_rules=["规则1", "规则2"],
            identity={"field1": "v1", "field2": "v2"},
            speech_style={"field1": "v1", "field2": "v2"},
            emotion_pattern={"field1": "v1", "field2": "v2"},
            relationship_behavior={"field1": "v1", "field2": "v2"}
        )
        model = PersonalityModel(
            name="全字段用户",
            slug="full-fields",
            version="v1.0",
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat(),
            persona=persona,
            memory=RelationshipMemory()
        )
        skill = skill_writer.create_skill_from_model(model)
        assert "规则1" in skill.persona_content
        assert "field1" in skill.persona_content


class TestVersionManager:
    """版本管理器测试类"""

    def test_save_version(self, version_manager, skill_writer, sample_personality_model):
        """测试保存版本"""
        skill = skill_writer.create_skill_from_model(sample_personality_model)
        version = version_manager.save_version(skill, "测试变更")
        assert version is not None
        assert version.startswith("v")

    def test_list_versions_empty(self, version_manager):
        """测试列出空的版本列表"""
        versions = version_manager.list_versions("nonexistent")
        assert isinstance(versions, list)
        assert len(versions) == 0

    def test_list_versions_with_items(
        self,
        version_manager,
        skill_writer,
        sample_personality_model
    ):
        """测试列出包含版本的列表"""
        skill = skill_writer.create_skill_from_model(sample_personality_model)
        version_manager.save_version(skill, "版本1")
        version_manager.save_version(skill, "版本2")

        versions = version_manager.list_versions("test-user")
        assert len(versions) == 2

    def test_rollback_version(
        self,
        version_manager,
        skill_writer,
        temp_data_dir
    ):
        """测试版本回滚"""
        model_v1 = PersonalityModel(
            name="回滚测试用户",
            slug="rollback-test",
            version="v1.0",
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat(),
            persona=PersonalityTraits(hard_rules=["规则1"])
        )
        skill_v1 = skill_writer.create_skill_from_model(model_v1)
        version_manager.save_version(skill_v1, "初始版本")
        skill_writer.save_skill(skill_v1)

        # 更新到v2
        model_v2 = PersonalityModel(
            name="回滚测试用户",
            slug="rollback-test",
            version="v2.0",
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat(),
            persona=PersonalityTraits(hard_rules=["规则2"])
        )
        skill_v2 = skill_writer.create_skill_from_model(model_v2)
        skill_writer.save_skill(skill_v2)

        # 回滚
        success = version_manager.rollback_to("rollback-test", "v1.0", temp_data_dir / "skills")
        assert success
