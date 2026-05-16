from abc import ABC, abstractmethod
from typing import List, Optional

from models.skill_schema import SkillFile


class StorageBackend(ABC):

    @abstractmethod
    async def save_skill(self, skill_file: SkillFile) -> bool:
        ...

    @abstractmethod
    async def load_skill(self, slug: str) -> Optional[SkillFile]:
        ...

    @abstractmethod
    async def list_skills(self) -> List[str]:
        ...

    @abstractmethod
    async def delete_skill(self, slug: str) -> bool:
        ...

    @abstractmethod
    async def save_file(self, slug: str, filename: str, content: bytes) -> str:
        ...

    @abstractmethod
    async def load_file(self, slug: str, filename: str) -> Optional[bytes]:
        ...

    @abstractmethod
    async def list_files(self, slug: str) -> List[str]:
        ...

    async def save_upload(self, filename: str, content: bytes) -> bool:
        raise NotImplementedError

    async def list_versions(self, slug: str) -> List[str]:
        return []
