"""Add lottie text to adult characters

Revision ID: 6fd6b6ee7702
Revises: d7655a7d1e39
Create Date: 2026-03-16 02:46:36.334991

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6fd6b6ee7702'
down_revision: Union[str, Sequence[str], None] = 'd7655a7d1e39'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('adult_characters', sa.Column('lottie_text', sa.Text(), nullable=True))
    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('adult_characters', 'lottie_text')
    # ### end Alembic commands ###
