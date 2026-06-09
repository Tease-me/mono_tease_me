"""add first login bonus tracking to users

Revision ID: 7f1c2a8b9d4e
Revises: 6a2b9d1e4c3f, 6fd6b6ee7702
Create Date: 2026-04-19 18:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "7f1c2a8b9d4e"
down_revision: Union[str, Sequence[str], None] = ("6a2b9d1e4c3f", "6fd6b6ee7702")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("first_login_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("login_bonus_granted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "users",
        sa.Column("login_bonus_pending", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )


def downgrade() -> None:
    op.drop_column("users", "login_bonus_pending")
    op.drop_column("users", "login_bonus_granted_at")
    op.drop_column("users", "first_login_at")
