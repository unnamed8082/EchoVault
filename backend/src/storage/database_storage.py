from datetime import datetime
from typing import List, Optional

from sqlalchemy import select, insert, update, delete

from database import skills_table, skill_files_table
from models.skill_schema import SkillFile, SkillMetadata, SkillType
from storage.base import StorageBackend


class DatabaseStorage(StorageBackend):

    def __init__(self, session_factory):
        self.session_factory = session_factory

    async def save_skill(self, skill_file: SkillFile) -> bool:
        async with self.session_factory() as session:
            try:
                slug = skill_file.metadata.slug
                stmt = select(skills_table).where(skills_table.c.slug == slug)
                result = await session.execute(stmt)
                existing = result.first()

                if existing:
                    stmt = (
                        update(skills_table)
                        .where(skills_table.c.slug == slug)
                        .values(
                            name=skill_file.metadata.name,
                            description=skill_file.metadata.description,
                            type=skill_file.metadata.type.value,
                            version=skill_file.metadata.version,
                            persona_content=skill_file.persona_content,
                            memory_content=skill_file.memory_content,
                            lessons_content=skill_file.lessons_content,
                            tags=skill_file.metadata.tags,
                            updated_at=datetime.utcnow(),
                        )
                    )
                    await session.execute(stmt)
                else:
                    stmt = insert(skills_table).values(
                        slug=slug,
                        name=skill_file.metadata.name,
                        description=skill_file.metadata.description,
                        type=skill_file.metadata.type.value,
                        version=skill_file.metadata.version,
                        persona_content=skill_file.persona_content,
                        memory_content=skill_file.memory_content,
                        lessons_content=skill_file.lessons_content,
                        tags=skill_file.metadata.tags,
                    )
                    await session.execute(stmt)

                await session.commit()
                return True
            except Exception:
                await session.rollback()
                return False

    async def load_skill(self, slug: str) -> Optional[SkillFile]:
        async with self.session_factory() as session:
            stmt = select(skills_table).where(skills_table.c.slug == slug)
            result = await session.execute(stmt)
            row = result.first()

            if not row:
                return None

            metadata = SkillMetadata(
                name=row.name or "",
                slug=row.slug,
                version=row.version or "v1.0",
                description=row.description or "",
                type=SkillType(row.type) if row.type else SkillType.CHAT,
                tags=row.tags or [],
            )

            return SkillFile(
                metadata=metadata,
                persona_content=row.persona_content or "",
                memory_content=row.memory_content or "",
                lessons_content=row.lessons_content or "",
            )

    async def list_skills(self) -> List[str]:
        async with self.session_factory() as session:
            stmt = select(skills_table.c.slug)
            result = await session.execute(stmt)
            return sorted([row[0] for row in result.all()])

    async def delete_skill(self, slug: str) -> bool:
        async with self.session_factory() as session:
            try:
                stmt = delete(skill_files_table).where(
                    skill_files_table.c.skill_slug == slug
                )
                await session.execute(stmt)

                stmt = delete(skills_table).where(skills_table.c.slug == slug)
                await session.execute(stmt)

                await session.commit()
                return True
            except Exception:
                await session.rollback()
                return False

    async def save_file(self, slug: str, filename: str, content: bytes) -> str:
        async with self.session_factory() as session:
            try:
                stmt = insert(skill_files_table).values(
                    skill_slug=slug,
                    filename=filename,
                    content=content.decode("utf-8"),
                )
                result = await session.execute(stmt)
                await session.commit()
                return f"db://{slug}/{filename}"
            except Exception:
                await session.rollback()
                raise

    async def load_file(self, slug: str, filename: str) -> Optional[bytes]:
        async with self.session_factory() as session:
            stmt = select(skill_files_table).where(
                skill_files_table.c.skill_slug == slug,
                skill_files_table.c.filename == filename,
            )
            result = await session.execute(stmt)
            row = result.first()

            if not row:
                return None

            return row.content.encode("utf-8") if isinstance(row.content, str) else row.content

    async def list_files(self, slug: str) -> List[str]:
        async with self.session_factory() as session:
            stmt = select(skill_files_table.c.filename).where(
                skill_files_table.c.skill_slug == slug
            )
            result = await session.execute(stmt)
            return sorted([row[0] for row in result.all()])
