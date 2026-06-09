"""add telegram_last_name to provisioned_number

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
Create Date: 2025-03-30 08:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "e6f7a8b9c0d1"
down_revision = "d5e6f7a8b9c0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "provisioned_number",
        sa.Column(
            "telegram_last_name",
            sa.String(128),
            nullable=True,
            comment="Last name used during Telegram sign-up",
        ),
    )


def downgrade() -> None:
    op.drop_column("provisioned_number", "telegram_last_name")
