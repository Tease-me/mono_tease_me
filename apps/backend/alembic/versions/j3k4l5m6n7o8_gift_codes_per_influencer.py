"""gift codes unique per user and influencer

Revision ID: j3k4l5m6n7o8
Revises: i2j3k4l5m6n7
Create Date: 2026-06-12 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "j3k4l5m6n7o8"
down_revision: Union[str, Sequence[str], None] = "i2j3k4l5m6n7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("uq_gift_codes_user_id", "gift_codes", type_="unique")
    op.create_unique_constraint(
        "uq_gift_codes_user_influencer",
        "gift_codes",
        ["user_id", "influencer_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_gift_codes_user_influencer", "gift_codes", type_="unique")
    op.create_unique_constraint("uq_gift_codes_user_id", "gift_codes", ["user_id"])
