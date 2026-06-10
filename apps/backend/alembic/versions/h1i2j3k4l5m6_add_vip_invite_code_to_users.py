"""add vip_invite_code to users

Revision ID: h1i2j3k4l5m6
Revises: f94e3d2c1b0a
Create Date: 2026-06-10 19:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "h1i2j3k4l5m6"
down_revision: Union[str, Sequence[str], None] = "f94e3d2c1b0a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("vip_invite_code", sa.String(), nullable=True))
    op.create_index("ix_users_vip_invite_code", "users", ["vip_invite_code"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_users_vip_invite_code", table_name="users")
    op.drop_column("users", "vip_invite_code")
