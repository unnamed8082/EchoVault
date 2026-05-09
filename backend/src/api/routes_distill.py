"""
人格蒸馏 API 路由
"""

from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from pydantic import BaseModel, Field

# 导入模型
from models.personality_model import (
    PersonalityModel, PersonalityTraits, RelationshipMemory, LessonsLearned
)
from models.skill_schema import SkillFile, SkillMetadata, SkillType

# 导入工具
import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "tools"))
from skill_writer import SkillWriter
from version_manager import VersionManager

import re
import unicodedata

router = APIRouter()

ALLOWED_EXTENSIONS = {'.txt', '.csv', '.html', '.json', '.md', '.log', '.xml', '.yml', '.yaml'}
MAX_FILE_SIZE = 10 * 1024 * 1024


def sanitize_filename(filename: str) -> str:
    filename = unicodedata.normalize('NFKD', filename)
    filename = filename.replace('\x00', '')
    filename = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '', filename)
    filename = filename.replace('..', '')
    filename = filename.strip('. ')
    if not filename:
        filename = 'unnamed'
    return filename


def is_allowed_file_type(filename: str) -> bool:
    ext = Path(filename).suffix.lower()
    return ext in ALLOWED_EXTENSIONS

# 路径配置
BASE_DIR = Path(__file__).parent.parent.parent
DATA_DIR = BASE_DIR / "data"
SKILLS_DIR = DATA_DIR / "skills"
VERSIONS_DIR = DATA_DIR / "versions"
UPLOADS_DIR = DATA_DIR / "uploads"

# 确保目录存在
SKILLS_DIR.mkdir(parents=True, exist_ok=True)
VERSIONS_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# 初始化工具
skill_writer = SkillWriter(SKILLS_DIR, VERSIONS_DIR)
version_manager = VersionManager(VERSIONS_DIR)


class DistillRequest(BaseModel):
    """
    人格蒸馏请求

    - `name`: 名字或代号（必填）
    - `slug`: 唯一标识符，用于URL和文件路径（必填）
    - `description`: 可选的描述
    - `persona_traits`: 人格特征
        - `hard_rules`: 硬规则列表
        - `identity`: 身份信息字典
        - `speech_style`: 说话风格
        - `emotion_pattern`: 情感模式
        - `relationship_behavior`: 关系行为
    - `memory_items`: 记忆内容
        - `shared_experiences`: 共同经历列表
        - `date_locations`: 约会地点
        - `inside_jokes`: 内部笑话
        - `conflict_patterns`: 冲突模式
        - `sweet_moments`: 甜蜜瞬间
        - `timeline`: 关系时间线
    - `include_lessons`: 是否包含经验教训分析
    - `lessons_data`: 经验教训数据
    """
    name: str = Field(..., description="名字或代号", examples=["小明"])
    slug: str = Field(..., description="唯一标识符，只能包含字母、数字、连字符和下划线", examples=["xiaoming"])
    description: Optional[str] = Field(None, description="可选的描述", examples=["小明的数字分身"])
    persona_traits: Dict[str, Any] = Field(
        default_factory=dict,
        description="人格特征",
        examples=[{
            "hard_rules": ["不说脏话", "不聊工作"],
            "identity": {"职业": "程序员", "爱好": "游戏"},
            "speech_style": {"语气": "轻松", "用词": "简洁"},
            "emotion_pattern": {"表达习惯": "直接表达"},
            "relationship_behavior": {"互动模式": "主动互动"}
        }]
    )
    memory_items: Dict[str, Any] = Field(
        default_factory=dict,
        description="记忆内容",
        examples=[{
            "shared_experiences": ["一起去爬山", "一起打游戏"],
            "date_locations": ["咖啡厅", "电影院"],
            "inside_jokes": ["那个梗"],
            "conflict_patterns": ["容易在决策时争执"],
            "sweet_moments": ["第一次牵手"]
        }]
    )
    include_lessons: bool = Field(False, description="是否包含经验教训分析")
    lessons_data: Optional[Dict[str, Any]] = Field(None, description="经验教训数据")


class DistillResponse(BaseModel):
    """
    人格蒸馏响应

    - `success`: 是否成功
    - `slug`: Skill 的唯一标识
    - `version`: 当前版本号
    - `skill_path`: Skill 文件存储路径
    """
    success: bool = Field(..., description="是否成功")
    slug: str = Field(..., description="Skill 的唯一标识")
    version: str = Field(..., description="当前版本号")
    skill_path: str = Field(..., description="Skill 文件存储路径")


class SkillListResponse(BaseModel):
    """
    技能列表响应

    - `skills`: Skill slug 列表
    """
    skills: List[str] = Field(..., description="Skill slug 列表")


class VersionInfo(BaseModel):
    """
    版本信息

    - `version`: 版本号
    - `created_at`: 创建时间（ISO格式）
    - `change_note`: 更新说明
    """
    version: str = Field(..., description="版本号")
    created_at: str = Field(..., description="创建时间，ISO 8601 格式")
    change_note: str = Field(..., description="版本变更说明")


@router.post("/", response_model=DistillResponse, summary="蒸馏人格", description="从用户提供的信息中蒸馏人格特征并创建 Skill 文件")
async def distill_personality(request: DistillRequest):
    """
    ## 功能说明

    从用户提供的信息中蒸馏人格特征，创建一个完整的 Skill 文件，包括：

    - `persona.md`: 人格画像
    - `memory.md`: 关系记忆
    - `lessons.md`: 经验教训（可选）
    - `SKILL.md`: Skill 配置文件

    ## 请求示例

    ```json
    {
        "name": "小明",
        "slug": "xiaoming",
        "description": "小明的数字分身",
        "persona_traits": {
            "hard_rules": ["不说脏话", "不聊工作"],
            "identity": {"职业": "程序员"},
            "speech_style": {"语气": "轻松"},
            "tags": ["幽默", "聪明"]
        },
        "memory_items": {
            "shared_experiences": ["一起去爬山"]
        }
    }
    ```

    ## 响应示例

    ```json
    {
        "success": true,
        "slug": "xiaoming",
        "version": "v1.0",
        "skill_path": "data/skills/xiaoming"
    }
    ```

    ## 状态码

    - `200 OK`: 成功
    - `500 Internal Server Error`: 服务器错误
    """
    try:
        # 构建人格模型
        persona = PersonalityTraits(
            hard_rules=request.persona_traits.get("hard_rules", []),
            identity=request.persona_traits.get("identity", {}),
            speech_style=request.persona_traits.get("speech_style", {}),
            emotion_pattern=request.persona_traits.get("emotion_pattern", {}),
            relationship_behavior=request.persona_traits.get("relationship_behavior", {}),
        )
        
        memory = RelationshipMemory(
            shared_experiences=request.memory_items.get("shared_experiences", []),
            date_locations=request.memory_items.get("date_locations", []),
            inside_jokes=request.memory_items.get("inside_jokes", []),
            conflict_patterns=request.memory_items.get("conflict_patterns", []),
            sweet_moments=request.memory_items.get("sweet_moments", []),
            timeline=request.memory_items.get("timeline", []),
        )
        
        lessons = None
        if request.include_lessons and request.lessons_data:
            lessons = LessonsLearned(
                personality_profiling=request.lessons_data.get("personality_profiling", {}),
                communication_patterns=request.lessons_data.get("communication_patterns", {}),
                conflict_cycles=request.lessons_data.get("conflict_cycles", []),
                needs_mismatch=request.lessons_data.get("needs_mismatch", {}),
                boundaries=request.lessons_data.get("boundaries", []),
                growth_trajectory=request.lessons_data.get("growth_trajectory", {}),
                breakup_debrief=request.lessons_data.get("breakup_debrief", {}),
                action_items=request.lessons_data.get("action_items", []),
            )
        
        model = PersonalityModel(
            name=request.name,
            slug=request.slug,
            version="v1.0",
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat(),
            persona=persona,
            memory=memory,
            lessons=lessons,
            personality_tags=request.persona_traits.get("tags", []),
        )
        
        # 创建 Skill
        skill = skill_writer.create_skill_from_model(
            model,
            description=request.description or f"{request.name} 的数字分身"
        )
        
        # 保存 Skill
        success = skill_writer.save_skill(skill)
        
        if not success:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="保存 Skill 失败")
        
        # 保存初始版本
        version_manager.save_version(skill, "初始版本")
        
        return DistillResponse(
            success=True,
            slug=request.slug,
            version=skill.metadata.version,
            skill_path=str(SKILLS_DIR / request.slug)
        )
        
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/upload/{slug}", summary="上传素材文件", description="为指定的 Skill 上传素材文件，用于后续蒸馏分析")
async def upload_materials(slug: str, files: List[UploadFile] = File(..., description="要上传的文件列表")):
    """
    ## 功能说明

    为指定的 Skill 上传素材文件（聊天记录、图片等），文件会保存在 `uploads/{slug}/` 目录下。

    ## 参数说明

    - `slug`: Skill 的唯一标识
    - `files`: 要上传的文件列表

    ## 响应示例

    ```json
    {
        "success": true,
        "uploaded_files": ["file1.txt", "file2.jpg"]
    }
    ```
    """
    upload_dir = UPLOADS_DIR / slug
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    uploaded_files = []
    
    for file in files:
        safe_name = sanitize_filename(file.filename or "unnamed")
        if not is_allowed_file_type(safe_name):
            raise HTTPException(status_code=400, detail=f"File type not allowed: {safe_name}")
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File too large")
        file_path = upload_dir / safe_name
        file_path.write_bytes(content)
        uploaded_files.append(str(file_path))
    
    return {"success": True, "uploaded_files": uploaded_files}


@router.get("/skills", response_model=SkillListResponse, summary="列出所有 Skill", description="获取系统中所有 Skill 的 slug 列表")
async def list_skills():
    """
    ## 功能说明

    获取系统中所有已创建的 Skill 列表。

    ## 响应示例

    ```json
    {
        "skills": ["xiaoming", "user2"]
    }
    ```
    """
    skills = skill_writer.list_skills()
    return SkillListResponse(skills=skills)


@router.get("/skills/{slug}", summary="获取 Skill 详情", description="根据 slug 获取 Skill 的完整信息")
async def get_skill(slug: str):
    """
    ## 功能说明

    获取指定 Skill 的详细信息，包括基本信息、人格特征、记忆内容等。

    ## 参数说明

    - `slug`: Skill 的唯一标识

    ## 响应示例

    ```json
    {
        "slug": "xiaoming",
        "name": "小明",
        "version": "v1.0",
        "description": "小明的数字分身",
        "persona": "...persona.md 内容...",
        "memory": "...memory.md 内容...",
        "lessons": "...lessons.md 内容..."
    }
    ```

    ## 状态码

    - `200 OK`: 成功
    - `404 Not Found`: Skill 不存在
    """
    skill = skill_writer.load_skill(slug)
    if not skill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill 不存在")
    
    return {
        "slug": skill.metadata.slug,
        "name": skill.metadata.name,
        "version": skill.metadata.version,
        "description": skill.metadata.description,
        "persona": skill.persona_content,
        "memory": skill.memory_content,
        "lessons": skill.lessons_content,
    }


@router.delete("/skills/{slug}", summary="删除 Skill", description="永久删除指定的 Skill，包括其所有版本")
async def delete_skill(slug: str):
    """
    ## 功能说明

    永久删除指定的 Skill 及其所有文件。

    ## 参数说明

    - `slug`: Skill 的唯一标识

    ## 响应示例

    ```json
    {
        "success": true
    }
    ```

    ## 状态码

    - `200 OK`: 成功
    - `404 Not Found`: Skill 不存在
    """
    success = skill_writer.delete_skill(slug)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill 不存在")
    
    return {"success": True}


@router.get("/skills/{slug}/versions", response_model=List[VersionInfo], summary="列出版本", description="获取指定 Skill 的所有版本历史")
async def list_versions(slug: str):
    """
    ## 功能说明

    获取指定 Skill 的所有历史版本信息。

    ## 参数说明

    - `slug`: Skill 的唯一标识

    ## 响应示例

    ```json
    [
        {
            "version": "v1.0",
            "created_at": "2024-01-01T00:00:00",
            "change_note": "初始版本"
        }
    ]
    ```
    """
    versions = version_manager.list_versions(slug)
    return [
        VersionInfo(
            version=v["version"],
            created_at=v["created_at"],
            change_note=v.get("change_note", "")
        )
        for v in versions
    ]


@router.post("/skills/{slug}/rollback/{version}", summary="回滚版本", description="将 Skill 回滚到指定的历史版本")
async def rollback_version(
    slug: str,
    version: str
):
    """
    ## 功能说明

    将 Skill 回滚到指定的历史版本，并自动保存新版本。

    ## 参数说明

    - `slug`: Skill 的唯一标识
    - `version`: 要回滚到的版本号

    ## 响应示例

    ```json
    {
        "success": true,
        "version": "v1.0"
    }
    ```

    ## 状态码

    - `200 OK`: 成功
    - `404 Not Found`: 版本不存在
    """
    success = version_manager.rollback_to(slug, version, SKILLS_DIR)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="版本不存在")
    
    return {"success": True, "version": version}
