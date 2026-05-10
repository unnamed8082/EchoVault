from datetime import datetime
from typing import List, Optional

from sqlalchemy import select, insert, update, delete, desc
from sqlalchemy.ext.asyncio import AsyncSession

from database import skills_table, skill_versions_table
from repositories.base import BaseRepository


class SkillRepository(BaseRepository):

    def __init__(self, session: AsyncSession):
        super().__init__(session)

    async def save_skill(
        self,
        slug: str,
        name: str,
        description: str,
        version: str,
        persona_content: str,
        memory_content: str,
        lessons_content: str,
        tags: Optional[List[str]] = None,
    ):
        existing = await self.get_skill(slug)
        if existing:
            stmt = (
                update(skills_table)
                .where(skills_table.c.slug == slug)
                .values(
                    name=name,
                    description=description,
                    version=version,
                    persona_content=persona_content,
                    memory_content=memory_content,
                    lessons_content=lessons_content,
                    tags=tags,
                    updated_at=datetime.utcnow(),
                )
            )
            await self.session.execute(stmt)
        else:
            stmt = insert(skills_table).values(
                slug=slug,
                name=name,
                description=description,
                version=version,
                persona_content=persona_content,
                memory_content=memory_content,
                lessons_content=lessons_content,
                tags=tags,
            )
            await self.session.execute(stmt)

    async def get_skill(self, slug: str):
        stmt = select(skills_table).where(skills_table.c.slug == slug)
        result = await self.session.execute(stmt)
        return result.first()

    async def list_skills(self):
        stmt = select(skills_table)
        result = await self.session.execute(stmt)
        return result.all()

    async def delete_skill(self, slug: str):
        stmt = delete(skills_table).where(skills_table.c.slug == slug)
        await self.session.execute(stmt)

    async def save_version(
        self,
        slug: str,
        version: str,
        change_note: str,
        persona_snapshot: str,
        memory_snapshot: str,
        lessons_snapshot: str,
    ):
        stmt = insert(skill_versions_table).values(
            skill_slug=slug,
            version=version,
            change_note=change_note,
            persona_snapshot=persona_snapshot,
            memory_snapshot=memory_snapshot,
            lessons_snapshot=lessons_snapshot,
        )
        await self.session.execute(stmt)

    async def list_versions(self, slug: str):
        stmt = (
            select(skill_versions_table)
            .where(skill_versions_table.c.skill_slug == slug)
            .order_by(desc(skill_versions_table.c.created_at))
        )
        result = await self.session.execute(stmt)
        return result.all()
