from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class CustomerRegister(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    phone: str | None = Field(default=None, max_length=20)

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Name must not be blank.")
        return value


class CustomerLogin(BaseModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=1, max_length=128)


class CustomerProfile(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    email: str
    phone: str | None
    created_at: datetime


class AccessTokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int
