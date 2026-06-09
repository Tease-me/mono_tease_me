"""add first message to adult characters

Revision ID: 49ce0c269aed
Revises: a8734854683b
Create Date: 2026-03-17 02:06:25.042322

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '49ce0c269aed'
down_revision: Union[str, Sequence[str], None] = 'a8734854683b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('adult_characters', sa.Column('first_messages', postgresql.ARRAY(sa.String()), nullable=True))
    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('adult_characters', 'first_messages')
    # ### end Alembic commands ###
