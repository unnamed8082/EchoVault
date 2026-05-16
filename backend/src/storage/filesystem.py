import shutil
from pathlib import Path
from typing import List, Optional

from models.skill_schema import SkillFile
from storage.base import StorageBackend


class FilesystemStorage(StorageBackend):

    def __init__(self, skills_dir: Path, uploads_dir: Path):
        self.skills_dir = Path(skills_dir)
        self.uploads_dir = Path(uploads_dir)
        self.skills_dir.mkdir(parents=True, exist_ok=True)
        self.uploads_dir.mkdir(parents=True, exist_ok=True)

    async def save_skill(self, skill_file: SkillFile) -> bool:
        try:
            skill_file.save(self.skills_dir)
            return True
        except Exception:
            return False

    async def load_skill(self, slug: str) -> Optional[SkillFile]:
        return SkillFile.load(self.skills_dir, slug)

    async def list_skills(self) -> List[str]:
        skills = []
        if not self.skills_dir.exists():
            return skills
        for dir_path in self.skills_dir.iterdir():
            if dir_path.is_dir() and (dir_path / "SKILL.md").exists():
                skills.append(dir_path.name)
        return sorted(skills)

    async def delete_skill(self, slug: str) -> bool:
        skill_dir = self.skills_dir / slug
        if skill_dir.exists():
            shutil.rmtree(skill_dir)
            return True
        return False

    async def save_file(self, slug: str, filename: str, content: bytes) -> str:
        target_dir = self.uploads_dir / slug
        target_dir.mkdir(parents=True, exist_ok=True)
        target_path = target_dir / filename
        target_path.write_bytes(content)
        return str(target_path)

    async def load_file(self, slug: str, filename: str) -> Optional[bytes]:
        target_path = self.uploads_dir / slug / filename
        if target_path.exists():
            return target_path.read_bytes()
        return None

    async def list_files(self, slug: str) -> List[str]:
        target_dir = self.uploads_dir / slug
        if not target_dir.exists():
            return []
        return sorted([f.name for f in target_dir.iterdir() if f.is_file()])

    async def save_upload(self, filename: str, content: bytes) -> bool:
        try:
            target_path = self.uploads_dir / filename
            target_path.write_bytes(content)
            return True
        except Exception:
            return False
