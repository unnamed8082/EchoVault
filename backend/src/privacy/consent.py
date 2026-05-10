import sqlite3
from pathlib import Path
from fastapi import HTTPException, Depends

DB_PATH = Path(__file__).parent.parent.parent / "data" / "echovault.db"


class ConsentManager:

    def __init__(self, db_path: str = str(DB_PATH)):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS consent_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL,
                    consent_type TEXT NOT NULL,
                    accepted INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            conn.commit()

    def has_valid_consent(self, username: str, consent_type: str) -> bool:
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute(
                """
                SELECT accepted FROM consent_records
                WHERE username = ? AND consent_type = ?
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (username, consent_type),
            ).fetchone()
            if row is None:
                return False
            return bool(row[0])

    def record_consent(self, username: str, consent_type: str, accepted: bool):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO consent_records (username, consent_type, accepted)
                VALUES (?, ?, ?)
                """,
                (username, consent_type, int(accepted)),
            )
            conn.commit()

    def require_consent(self, consent_type: str):
        async def _check(username: str):
            if not self.has_valid_consent(username, consent_type):
                raise HTTPException(
                    status_code=403,
                    detail=f"Consent '{consent_type}' not granted for user '{username}'",
                )
            return username
        return _check


consent_manager = ConsentManager()
