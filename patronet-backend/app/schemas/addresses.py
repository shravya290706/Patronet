from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class AddressCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: str = Field(min_length=1, max_length=100)
    phone: str = Field(min_length=1, max_length=20)
    address_line_1: str = Field(min_length=1, max_length=500)
    address_line_2: str | None = Field(default=None, max_length=500)
    city: str = Field(min_length=1, max_length=100)
    state: str = Field(min_length=1, max_length=100)
    pincode: str = Field(min_length=1, max_length=10)
    country: str = Field(min_length=1, max_length=100)
    label: str | None = Field(default=None, max_length=50)
    is_default: bool = False

    @field_validator(
        "full_name",
        "phone",
        "address_line_1",
        "city",
        "state",
        "pincode",
        "country",
    )
    @classmethod
    def required_values_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This value must not be blank.")
        return value

    @field_validator("address_line_2", "label")
    @classmethod
    def optional_values_are_trimmed(
        cls, value: str | None
    ) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None


class AddressUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: str | None = Field(default=None, min_length=1, max_length=100)
    phone: str | None = Field(default=None, min_length=1, max_length=20)
    address_line_1: str | None = Field(default=None, min_length=1, max_length=500)
    address_line_2: str | None = Field(default=None, max_length=500)
    city: str | None = Field(default=None, min_length=1, max_length=100)
    state: str | None = Field(default=None, min_length=1, max_length=100)
    pincode: str | None = Field(default=None, min_length=1, max_length=10)
    country: str | None = Field(default=None, min_length=1, max_length=100)
    label: str | None = Field(default=None, max_length=50)
    is_default: bool | None = None

    @field_validator(
        "full_name",
        "phone",
        "address_line_1",
        "city",
        "state",
        "pincode",
        "country",
    )
    @classmethod
    def provided_required_values_must_not_be_blank(
        cls, value: str | None
    ) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("This value must not be blank.")
        return value

    @field_validator("address_line_2", "label")
    @classmethod
    def optional_values_are_trimmed(
        cls, value: str | None
    ) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None

    @model_validator(mode="after")
    def validate_patch_fields(self):
        if not self.model_fields_set:
            raise ValueError("At least one address field must be provided.")
        for field in (
            "full_name",
            "phone",
            "address_line_1",
            "city",
            "state",
            "pincode",
            "country",
            "is_default",
        ):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null.")
        return self


class AddressResponse(BaseModel):
    id: UUID
    full_name: str
    phone: str
    address_line_1: str
    address_line_2: str | None
    city: str
    state: str
    pincode: str
    country: str | None
    label: str | None
    is_default: bool
    created_at: datetime
