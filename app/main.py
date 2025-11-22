import tempfile
import time
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import database
from .schemas import ReportOut, UserOut
from .utils import normalize_comment, resize_avatar, save_report_photo

APP_DIR = Path(__file__).resolve().parent
MEDIA_DIR = APP_DIR / "media"
STATIC_DIR = APP_DIR / "static"

app = FastAPI(title="Segnalazioni Ambientali")
app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.on_event("startup")
def startup() -> None:
    database.init_db()


@app.get("/", response_class=FileResponse)
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


def _serialize_user(row) -> UserOut:
    return UserOut(**dict(row))


def _serialize_report(row) -> ReportOut:
    return ReportOut(**dict(row))


@app.post("/auth/local", response_model=UserOut)
@app.post("/auth/google", response_model=UserOut)
async def local_login(
    nickname: str = Form(..., description="Nickname scelto dall'utente"),
    avatar: Optional[UploadFile] = File(None, description="Foto profilo opzionale"),
    email: Optional[str] = Form(None, description="Email (facoltativa, mantenuta per compatibilità)"),
) -> UserOut:
    nickname_clean = nickname.strip()
    email_clean = email.strip() if email else None

    if not nickname_clean:
        raise HTTPException(status_code=400, detail="Il nickname non può essere vuoto")

    existing = None
    if email_clean:
        existing = database.get_user_by_email(email_clean)
    if existing is None:
        existing = database.get_user_by_nickname(nickname_clean)

    if existing:
        if existing["nickname"] != nickname_clean:
            database.update_user_nickname(existing["id"], nickname_clean)
            existing = database.get_user(existing["id"])
        user_row = existing
    else:
        user_row = database.create_user(email_clean, nickname_clean, None)

    if avatar:
        with tempfile.NamedTemporaryFile(delete=False) as temp_file:
            temp_file.write(await avatar.read())
            temp_path = Path(temp_file.name)
        destination = MEDIA_DIR / "avatars" / f"{user_row['id']}.jpg"
        avatar_path = resize_avatar(temp_path, destination)
        database.update_user_avatar(user_row["id"], avatar_path)
        user_row = database.get_user(user_row["id"])
        temp_path.unlink(missing_ok=True)

    return _serialize_user(user_row)


@app.get("/reports", response_model=List[ReportOut])
def get_reports() -> List[ReportOut]:
    rows = database.list_reports()
    return [_serialize_report(row) for row in rows]


@app.post("/reports", response_model=ReportOut)
async def submit_report(
    user_id: int = Form(..., description="ID utente che invia la segnalazione"),
    latitude: float = Form(...),
    longitude: float = Form(...),
    map_url: Optional[str] = Form(None, description="Link condivisibile a Google Maps"),
    comment: Optional[str] = Form(None, description="Massimo due righe di testo"),
    photo: Optional[UploadFile] = File(None, description="Foto della segnalazione"),
) -> ReportOut:
    user_row = database.get_user(user_id)
    if user_row is None:
        raise HTTPException(status_code=404, detail="Utente non trovato")

    normalized_comment = normalize_comment(comment)
    if normalized_comment and normalized_comment.count("\n") > 1:
        raise HTTPException(status_code=400, detail="Il commento deve contenere al massimo due righe")

    photo_path = None
    if photo:
        with tempfile.NamedTemporaryFile(delete=False) as temp_file:
            temp_file.write(await photo.read())
            temp_path = Path(temp_file.name)
        destination = MEDIA_DIR / "reports" / f"{user_id}_{int(time.time())}.jpg"
        photo_path = save_report_photo(temp_path, destination)
        temp_path.unlink(missing_ok=True)

    row = database.create_report(
        user_id=user_row["id"],
        latitude=latitude,
        longitude=longitude,
        map_url=map_url,
        comment=normalized_comment,
        photo_path=photo_path,
    )
    return _serialize_report(row)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
