from sqlalchemy import select, insert, update
from sqlalchemy.ext.asyncio import AsyncSession

from database import users_table
from repositories.base import BaseRepository


class UserRepository(BaseRepository):

    def __init__(self, session: AsyncSession):
        super().__init__(session)

    async def create_user(self, username: str, email: str, password_hash: str):
        stmt = insert(users_table).values(
            username=username,
            email=email,
            password_hash=password_hash,
        )
        await self.session.execute(stmt)

    async def get_user_by_username(self, username: str):
        stmt = select(users_table).where(users_table.c.username == username)
        result = await self.session.execute(stmt)
        row = result.first()
        if row is None:
            return None
        return row._asdict()

    async def update_user(self, username: str, **kwargs):
        stmt = (
            update(users_table)
            .where(users_table.c.username == username)
            .values(**kwargs)
        )
        await self.session.execute(stmt)

    async def verify_user_exists(self, username: str) -> bool:
        stmt = select(users_table.c.username).where(users_table.c.username == username)
        result = await self.session.execute(stmt)
        return result.first() is not None
