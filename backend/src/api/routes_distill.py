"""
人格蒸馏 API 路由
使用 StorageBackend 抽象层
"""

import sys
import json
from pathlib import Path
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel, Field

sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "tools"))

from config import settings
from storage.factory import create_storage_backend

router = APIRouter(tags=["distill"])

storage = create_storage_backend(
    "filesystem",
    skills_dir=settings.SKILLS_DIR,
    uploads_dir=settings.UPLOADS_DIR,
)


class DistillRequest(BaseModel):
    name: str = Field(..., description="分身名称")
    slug: str = Field(..., description="唯一标识符")
    persona_traits: Dict[str, Any] = Field(default_factory=dict, description="人格特质")
    memory_items: Dict[str, Any] = Field(default_factory=dict, description="记忆内容")


class DistillResponse(BaseModel):
    success: bool
    message: str
    slug: Optional[str] = None


@router.post("/",
    summary="创建数字分身",
)
async def create_distill(req: DistillRequest):
    from models.skill_schema import SkillFile, SkillMetadata, SkillType
    from datetime import datetime

    persona_str = json.dumps(req.persona_traits, ensure_ascii=False, indent=2) if req.persona_traits else ""
    memory_str = json.dumps(req.memory_items, ensure_ascii=False, indent=2) if req.memory_items else ""

    skill = SkillFile(
        metadata=SkillMetadata(
            name=req.name,
            slug=req.slug,
            version="v1.0",
            author="user",
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat(),
        ),
        persona_content=persona_str,
        memory_content=memory_str,
    )

    success = await storage.save_skill(skill)
    if not success:
        raise HTTPException(status_code=400, detail="数字分身创建失败")

    return DistillResponse(
        success=True,
        message=f"数字分身 '{req.name}' 创建成功",
        slug=req.slug,
    )


@router.post("/upload",
    summary="上传文件到蒸馏流程",
)
async def upload_file(file: UploadFile = File(...)):
    content = await file.read()
    success = await storage.save_upload(file.filename, content)
    if not success:
        raise HTTPException(status_code=500, detail="文件保存失败")

    return {
        "filename": file.filename,
        "saved_path": f"uploads/{file.filename}",
        "message": "文件上传成功"
    }


@router.get("/skills",
    summary="获取所有数字分身",
)
async def list_skills():
    slugs = await storage.list_skills()
    return {"skills": slugs}


@router.get("/skills/{slug}",
    summary="获取数字分身详情",
)
async def get_skill(slug: str):
    skill = await storage.load_skill(slug)
    if not skill:
        raise HTTPException(status_code=404, detail=f"数字分身 '{slug}' 不存在")

    persona_traits = {}
    if skill.persona_content:
        try:
            persona_traits = json.loads(skill.persona_content)
        except (json.JSONDecodeError, TypeError):
            persona_traits = {"raw": skill.persona_content}

    memory_items = {}
    if skill.memory_content:
        try:
            memory_items = json.loads(skill.memory_content)
        except (json.JSONDecodeError, TypeError):
            memory_items = {"raw": skill.memory_content}

    return {
        "slug": skill.metadata.slug,
        "name": skill.metadata.name,
        "persona_traits": persona_traits,
        "memory_items": memory_items,
        "lessons_content": skill.lessons_content,
    }


@router.delete("/skills/{slug}",
    summary="删除数字分身",
)
async def delete_skill(slug: str):
    skill = await storage.load_skill(slug)
    if not skill:
        raise HTTPException(status_code=404, detail=f"数字分身 '{slug}' 不存在")

    success = await storage.delete_skill(slug)
    if not success:
        raise HTTPException(status_code=500, detail="删除失败")

    return {"success": True, "message": f"数字分身 '{slug}' 已删除"}


@router.get("/skills/{slug}/versions",
    summary="获取版本历史",
)
async def list_versions(slug: str):
    skill = await storage.load_skill(slug)
    if not skill:
        raise HTTPException(status_code=404, detail=f"数字分身 '{slug}' 不存在")

    versions = await storage.list_versions(slug)
    return {"versions": versions}
