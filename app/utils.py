from pathlib import Path
from typing import Optional, Tuple

from PIL import Image


AVATAR_SIZE: Tuple[int, int] = (100, 100)


def ensure_media_path(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def resize_avatar(source_path: Path, destination: Path) -> str:
    ensure_media_path(destination)
    with Image.open(source_path) as image:
        image = image.convert("RGB")
        image.thumbnail(AVATAR_SIZE)
        image.save(destination, format="JPEG")
    return str(destination)


def save_report_photo(source_path: Path, destination: Path) -> str:
    ensure_media_path(destination)
    with Image.open(source_path) as image:
        image = image.convert("RGB")
        image.save(destination, format="JPEG", quality=90)
    return str(destination)


def normalize_comment(comment: Optional[str]) -> Optional[str]:
    if comment is None:
        return None
    stripped = comment.strip()
    if not stripped:
        return None
    lines = [line.strip() for line in stripped.splitlines() if line.strip()]
    trimmed_lines = lines[:2]
    return "\n".join(trimmed_lines)
