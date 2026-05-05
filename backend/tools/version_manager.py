"""
Version Manager - Skill 版本管理工具
负责版本存档和回滚
"""

import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Any
import sys

# 添加 src 到路径
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from models.skill_schema import SkillFile


class VersionManager:
    """版本管理器"""
    
    def __init__(self, versions_dir: Path):
        self.versions_dir = Path(versions_dir)
        self.versions_dir.mkdir(parents=True, exist_ok=True)
    
    def _get_next_version(self, slug: str) -> str:
        """获取下一个版本号"""
        skill_versions_dir = self.versions_dir / slug
        
        if not skill_versions_dir.exists():
            return "v1.0"
        
        existing_versions = []
        for dir_path in skill_versions_dir.iterdir():
            if dir_path.is_dir() and dir_path.name.startswith("v"):
                existing_versions.append(dir_path.name)
        
        if not existing_versions:
            return "v1.0"
        
        # 找出最新版本号
        latest = 0
        for v in existing_versions:
            try:
                num = float(v[1:])
                if num > latest:
                    latest = num
            except:
                pass
        
        return f"v{latest + 0.1:.1f}"
    
    def save_version(
        self,
        skill: SkillFile,
        change_note: str = "",
        version: Optional[str] = None
    ) -> str:
        """保存版本"""
        if not version:
            version = self._get_next_version(skill.metadata.slug)
        
        skill_versions_dir = self.versions_dir / skill.metadata.slug / version
        skill_versions_dir.mkdir(parents=True, exist_ok=True)
        
        # 保存 Skill 文件
        skill.save(skill_versions_dir)
        
        # 保存版本信息
        version_info = {
            "version": version,
            "slug": skill.metadata.slug,
            "created_at": datetime.now().isoformat(),
            "change_note": change_note,
        }
        
        (skill_versions_dir / "version.json").write_text(
            json.dumps(version_info, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )
        
        return version
    
    def list_versions(self, slug: str) -> List[Dict[str, Any]]:
        """列出所有版本"""
        skill_versions_dir = self.versions_dir / slug
        
        if not skill_versions_dir.exists():
            return []
        
        versions = []
        for dir_path in skill_versions_dir.iterdir():
            if dir_path.is_dir() and dir_path.name.startswith("v"):
                version_file = dir_path / "version.json"
                if version_file.exists():
                    info = json.loads(version_file.read_text(encoding="utf-8"))
                    versions.append(info)
        
        # 按时间倒序排列
        versions.sort(key=lambda x: x["created_at"], reverse=True)
        return versions
    
    def load_version(self, slug: str, version: str) -> Optional[SkillFile]:
        """加载指定版本"""
        version_dir = self.versions_dir / slug / version
        if not version_dir.exists():
            return None
        
        # SkillFile.save 会在传入目录下创建 slug 子目录，实际的 skill 文件在 version_dir / slug 中
        # 所以我们需要从 version_dir 目录，使用原始的 slug 来加载
        return SkillFile.load(version_dir, slug)
    
    def rollback_to(self, slug: str, version: str, skills_dir: Path) -> bool:
        """回滚到指定版本"""
        version_skill = self.load_version(slug, version)
        if not version_skill:
            return False
        
        # 先保存当前版本
        current_skill = SkillFile.load(skills_dir, slug)
        if current_skill:
            self.save_version(current_skill, "回滚前存档")
        
        # 回滚
        version_skill.save(skills_dir)
        return True
    
    def delete_version(self, slug: str, version: str) -> bool:
        """删除指定版本"""
        version_dir = self.versions_dir / slug / version
        if version_dir.exists():
            shutil.rmtree(version_dir)
            return True
        return False
