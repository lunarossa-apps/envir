from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class UserOut(BaseModel):
    id: int
    email: Optional[str]
    nickname: str
    avatar_path: Optional[str]
    created_at: datetime


class ReportOut(BaseModel):
    id: int
    user_id: int
    nickname: str
    latitude: float
    longitude: float
    map_url: Optional[str] = Field(None, description="Link to the map location")
    comment: Optional[str]
    photo_path: Optional[str]
    created_at: datetime
