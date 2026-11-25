from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import get_settings

settings = get_settings()


async def _setup_conn(conn, branch):
    if branch:
        return
    from pgvector.asyncpg import register_vector
    await conn.run_sync(lambda c: c.connection.run_async(register_vector))


engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
)

engine.sync_engine.dispose()

from sqlalchemy import event

@event.listens_for(engine.sync_engine, "connect")
def _on_connect(dbapi_conn, _record) -> None:
    dbapi_conn.run_async(
        __import__('pgvector.asyncpg', fromlist=['register_vector']).register_vector
    )


AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
