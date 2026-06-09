"""Add Pricing to each character

Revision ID: 3919d878330c
Revises: 49ce0c269aed
Create Date: 2026-03-17 23:43:49.595949

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3919d878330c'
down_revision: Union[str, Sequence[str], None] = '49ce0c269aed'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('adult_characters', sa.Column('voice_price_millicents', sa.Integer(), server_default='3000', nullable=False))
    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('adult_characters', 'voice_price_millicents')
    # ### end Alembic commands ###
