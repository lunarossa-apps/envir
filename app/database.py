import sqlite3
from pathlib import Path
from typing import Iterable, Optional

DB_PATH = Path(__file__).resolve().parent / "data.db"


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE,
                nickname TEXT NOT NULL,
                avatar_path TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                map_url TEXT,
                comment TEXT,
                photo_path TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );
            """
        )
        _migrate_users_table_if_needed(conn)


def _migrate_users_table_if_needed(conn: sqlite3.Connection) -> None:
    """Ensure the users table allows nullable emails (no Google login required)."""

    info = conn.execute("PRAGMA table_info(users)").fetchall()
    if not info:
        return

    column_by_name = {row[1]: row for row in info}
    email_column = column_by_name.get("email")
    if email_column and email_column[3] == 0:
        # Email is already nullable.
        return

    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS users_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE,
            nickname TEXT NOT NULL,
            avatar_path TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        INSERT INTO users_new (id, email, nickname, avatar_path, created_at)
        SELECT id, email, nickname, avatar_path, created_at FROM users;

        DROP TABLE users;
        ALTER TABLE users_new RENAME TO users;
        """,
    )


def get_user_by_email(email: str) -> Optional[sqlite3.Row]:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    return row


def get_user_by_nickname(nickname: str) -> Optional[sqlite3.Row]:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM users WHERE nickname = ?", (nickname,)).fetchone()
    return row


def get_user(user_id: int) -> Optional[sqlite3.Row]:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return row


def create_user(email: Optional[str], nickname: str, avatar_path: Optional[str]) -> sqlite3.Row:
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO users (email, nickname, avatar_path) VALUES (?, ?, ?)",
            (email, nickname, avatar_path),
        )
        user_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return row


def update_user_avatar(user_id: int, avatar_path: str) -> None:
    with get_connection() as conn:
        conn.execute(
            "UPDATE users SET avatar_path = ? WHERE id = ?",
            (avatar_path, user_id),
        )


def update_user_nickname(user_id: int, nickname: str) -> None:
    with get_connection() as conn:
        conn.execute(
            "UPDATE users SET nickname = ? WHERE id = ?",
            (nickname, user_id),
        )


def create_report(
    *,
    user_id: int,
    latitude: float,
    longitude: float,
    map_url: Optional[str],
    comment: Optional[str],
    photo_path: Optional[str],
) -> sqlite3.Row:
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO reports (user_id, latitude, longitude, map_url, comment, photo_path)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (user_id, latitude, longitude, map_url, comment, photo_path),
        )
        report_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        row = conn.execute(
            "SELECT reports.*, users.nickname FROM reports JOIN users ON users.id = reports.user_id WHERE reports.id = ?",
            (report_id,),
        ).fetchone()
    return row


def list_reports() -> Iterable[sqlite3.Row]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT reports.*, users.nickname FROM reports
            JOIN users ON users.id = reports.user_id
            ORDER BY reports.created_at DESC
            """
        ).fetchall()
    return rows
