from typing import Literal

from pydantic import BaseModel


class FunnelEventReport(BaseModel):
    event_type: Literal["link_clicked", "registration_started"]
    invite_code: str


class FunnelStageCount(BaseModel):
    stage: str
    count: int


class FunnelOverviewOut(BaseModel):
    period: str
    total_funnel_entries: int
    stages: dict[str, int]
    conversion_rates: dict[str, float]
