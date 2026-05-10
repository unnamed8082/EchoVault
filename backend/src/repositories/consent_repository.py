from sqlalchemy import select, insert
from sqlalchemy.ext.asyncio import AsyncSession

from database import consent_records_table
from repositories.base import BaseRepository


class ConsentRepository(BaseRepository):

    def __init__(self, session: AsyncSession):
        super().__init__(session)

    async def record_consent(self, user_id: str, consent_type: str, accepted: bool):
        stmt = insert(consent_records_table).values(
            user_id=user_id,
            consent_type=consent_type,
            accepted=accepted,
        )
        await self.session.execute(stmt)

    async def get_consents(self, user_id: str):
        stmt = select(consent_records_table).where(
            consent_records_table.c.user_id == user_id
        )
        result = await self.session.execute(stmt)
        return result.all()

    async def has_valid_consent(self, user_id: str, consent_type: str) -> bool:
        stmt = (
            select(consent_records_table)
            .where(
                consent_records_table.c.user_id == user_id,
                consent_records_table.c.consent_type == consent_type,
                consent_records_table.c.accepted == True,
            )
            .order_by(consent_records_table.c.created_at.desc())
            .limit(1)
        )
        result = await self.session.execute(stmt)
        row = result.first()
        return row is not None
