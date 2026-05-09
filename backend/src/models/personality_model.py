"""
Personality Model - 人格蒸馏模型
定义了从聊天记录、社交媒体内容等数据源中提取人格特征的数据结构
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from enum import Enum


class AttachmentStyle(Enum):
    """依恋类型"""
    SECURE = "安全型"
    ANXIOUS = "焦虑型"
    AVOIDANT = "回避型"
    DISORGANIZED = "混乱型"


class LoveLanguage(Enum):
    """爱的语言"""
    WORDS = "肯定的言辞"
    TIME = "精心的时刻"
    GIFTS = "接受礼物"
    ACTIONS = "服务的行动"
    PHYSICAL = "身体的接触"


class MBTIType(Enum):
    """MBTI 类型"""
    INTJ = "INTJ"
    INTP = "INTP"
    ENTJ = "ENTJ"
    ENTP = "ENTP"
    INFJ = "INFJ"
    INFP = "INFP"
    ENFJ = "ENFJ"
    ENFP = "ENFP"
    ISTJ = "ISTJ"
    ISFJ = "ISFJ"
    ESTJ = "ESTJ"
    ESFJ = "ESFJ"
    ISTP = "ISTP"
    ISFP = "ISFP"
    ESTP = "ESTP"
    ESFP = "ESFP"


@dataclass
class PersonalityTraits:
    """性格特征层"""
    hard_rules: List[str] = field(default_factory=list)  # 硬规则（绝对不会说/做的事）
    identity: Dict[str, Any] = field(default_factory=dict)  # 身份（自我认知、社会角色）
    speech_style: Dict[str, Any] = field(default_factory=dict)  # 说话风格（语气、用词、语速）
    emotion_pattern: Dict[str, Any] = field(default_factory=dict)  # 情感模式（触发点、表达习惯）
    relationship_behavior: Dict[str, Any] = field(default_factory=dict)  # 关系行为（互动模式、边界）


@dataclass
class RelationshipMemory:
    """关系记忆层"""
    shared_experiences: List[str] = field(default_factory=list)  # 共同经历
    date_locations: List[str] = field(default_factory=list)  # 约会地点
    inside_jokes: List[str] = field(default_factory=list)  # 内部笑话
    conflict_patterns: List[str] = field(default_factory=list)  # 争吵模式
    sweet_moments: List[str] = field(default_factory=list)  # 甜蜜瞬间
    timeline: List[Dict[str, Any]] = field(default_factory=list)  # 关系时间线


@dataclass
class LessonsLearned:
    """经验教训层（来自 ex-cure-skill）"""
    personality_profiling: Dict[str, Any] = field(default_factory=dict)  # 性格画像
    communication_patterns: Dict[str, Any] = field(default_factory=dict)  # 沟通模式
    conflict_cycles: List[str] = field(default_factory=list)  # 冲突循环
    needs_mismatch: Dict[str, Any] = field(default_factory=dict)  # 需求错配
    boundaries: List[str] = field(default_factory=list)  # 边界
    growth_trajectory: Dict[str, Any] = field(default_factory=dict)  # 成长轨迹
    breakup_debrief: Dict[str, Any] = field(default_factory=dict)  # 分手复盘
    action_items: List[Dict[str, str]] = field(default_factory=list)  # 可行动课题


@dataclass
class PersonalityModel:
    """完整的人格模型"""
    name: str
    slug: str
    version: str = "v1.0"
    created_at: str = ""
    updated_at: str = ""
    
    # 元数据
    mbti: Optional[MBTIType] = None
    attachment_style: Optional[AttachmentStyle] = None
    love_languages: List[LoveLanguage] = field(default_factory=list)
    zodiac_sign: Optional[str] = None
    personality_tags: List[str] = field(default_factory=list)
    
    # 核心三层
    persona: PersonalityTraits = field(default_factory=PersonalityTraits)
    memory: RelationshipMemory = field(default_factory=RelationshipMemory)
    lessons: Optional[LessonsLearned] = None
    
    # 修正层（对话中动态更新）
    corrections: List[Dict[str, Any]] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """序列化为字典"""
        return {
            "name": self.name,
            "slug": self.slug,
            "version": self.version,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "mbti": self.mbti.value if self.mbti else None,
            "attachment_style": self.attachment_style.value if self.attachment_style else None,
            "love_languages": [ll.value for ll in self.love_languages],
            "zodiac_sign": self.zodiac_sign,
            "personality_tags": self.personality_tags,
            "persona": {
                "hard_rules": self.persona.hard_rules,
                "identity": self.persona.identity,
                "speech_style": self.persona.speech_style,
                "emotion_pattern": self.persona.emotion_pattern,
                "relationship_behavior": self.persona.relationship_behavior,
            },
            "memory": {
                "shared_experiences": self.memory.shared_experiences,
                "date_locations": self.memory.date_locations,
                "inside_jokes": self.memory.inside_jokes,
                "conflict_patterns": self.memory.conflict_patterns,
                "sweet_moments": self.memory.sweet_moments,
                "timeline": self.memory.timeline,
            },
            "lessons": {
                "personality_profiling": self.lessons.personality_profiling,
                "communication_patterns": self.lessons.communication_patterns,
                "conflict_cycles": self.lessons.conflict_cycles,
                "needs_mismatch": self.lessons.needs_mismatch,
                "boundaries": self.lessons.boundaries,
                "growth_trajectory": self.lessons.growth_trajectory,
                "breakup_debrief": self.lessons.breakup_debrief,
                "action_items": self.lessons.action_items,
            } if self.lessons else None,
            "corrections": self.corrections,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "PersonalityModel":
        """从字典反序列化"""
        model = cls(
            name=data["name"],
            slug=data["slug"],
            version=data.get("version", "v1.0"),
            created_at=data.get("created_at", ""),
            updated_at=data.get("updated_at", ""),
        )
        
        if data.get("mbti"):
            model.mbti = MBTIType(data["mbti"])
        if data.get("attachment_style"):
            model.attachment_style = AttachmentStyle(data["attachment_style"])
        if data.get("love_languages"):
            model.love_languages = [LoveLanguage(ll) for ll in data["love_languages"]]
        model.zodiac_sign = data.get("zodiac_sign")
        model.personality_tags = data.get("personality_tags", [])
        
        if "persona" in data:
            model.persona = PersonalityTraits(
                hard_rules=data["persona"].get("hard_rules", []),
                identity=data["persona"].get("identity", {}),
                speech_style=data["persona"].get("speech_style", {}),
                emotion_pattern=data["persona"].get("emotion_pattern", {}),
                relationship_behavior=data["persona"].get("relationship_behavior", {}),
            )
        
        if "memory" in data:
            model.memory = RelationshipMemory(
                shared_experiences=data["memory"].get("shared_experiences", []),
                date_locations=data["memory"].get("date_locations", []),
                inside_jokes=data["memory"].get("inside_jokes", []),
                conflict_patterns=data["memory"].get("conflict_patterns", []),
                sweet_moments=data["memory"].get("sweet_moments", []),
                timeline=data["memory"].get("timeline", []),
            )
        
        if data.get("lessons"):
            model.lessons = LessonsLearned(
                personality_profiling=data["lessons"].get("personality_profiling", {}),
                communication_patterns=data["lessons"].get("communication_patterns", {}),
                conflict_cycles=data["lessons"].get("conflict_cycles", []),
                needs_mismatch=data["lessons"].get("needs_mismatch", {}),
                boundaries=data["lessons"].get("boundaries", []),
                growth_trajectory=data["lessons"].get("growth_trajectory", {}),
                breakup_debrief=data["lessons"].get("breakup_debrief", {}),
                action_items=data["lessons"].get("action_items", []),
            )
        
        model.corrections = data.get("corrections", [])
        
        return model
