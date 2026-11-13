from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, model_validator

from app.schemas.orders import OrderEventPayload


class OrderPlacedMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event_id: UUID
    event_type: Literal["order.placed"]
    aggregate_type: Literal["order"]
    aggregate_id: UUID
    created_at: datetime
    payload: OrderEventPayload

    @model_validator(mode="after")
    def validate_order_reference(self):
        if self.payload.order_id != self.aggregate_id:
            raise ValueError("Payload order_id must match aggregate_id.")
        if self.payload.event_type != self.event_type:
            raise ValueError("Payload event_type must match envelope event_type.")
        if not self.payload.items:
            raise ValueError("Order event must include at least one item.")
        if any(item.quantity <= 0 for item in self.payload.items):
            raise ValueError("Order event item quantities must be positive.")
        return self
