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
                email TEXT NOT NULL UNIQUE,
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


def get_user_by_email(email: str) -> Optional[sqlite3.Row]:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    return row


def get_user(user_id: int) -> Optional[sqlite3.Row]:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return row


def create_user(email: str, nickname: str, avatar_path: Optional[str]) -> sqlite3.Row:
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
