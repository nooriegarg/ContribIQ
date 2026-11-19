from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def enable_pgvector(conn: AsyncConnection) -> None:
    await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    await conn.commit()
