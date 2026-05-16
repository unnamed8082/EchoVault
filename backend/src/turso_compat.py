import os
import logging

logger = logging.getLogger(__name__)


def patch_aiosqlite_for_turso():
    turso_url = os.environ.get("TURSO_DATABASE_URL")
    if not turso_url:
        logger.info("TURSO_DATABASE_URL not set, using local SQLite")
        return False

    try:
        import libsql_experimental as libsql
        import aiosqlite.core

        aiosqlite.core.sqlite3 = libsql
        logger.info("aiosqlite patched for Turso/libsql support")
        return True
    except ImportError:
        logger.warning(
            "libsql-experimental not installed, falling back to local SQLite"
        )
        return False


USE_TURSO = patch_aiosqlite_for_turso()
