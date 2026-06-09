"""merge_heads_add_mjfp_last_notified_derived_step

Revision ID: f94e3d2c1b0a
Revises: 802c5d8a4781, b2c3d4e5f6g8, c3d4e5f6g7h9, g5h6i7j8k9l0
Create Date: 2026-05-11

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f94e3d2c1b0a"
down_revision: Union[str, Sequence[str], None] = (
    "802c5d8a4781",
    "b2c3d4e5f6g8",
    "c3d4e5f6g7h9",
    "g5h6i7j8k9l0",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "pre_influencers",
        sa.Column("mjfp_last_notified_derived_step", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("pre_influencers", "mjfp_last_notified_derived_step")
