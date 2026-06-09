"""Add telegram_invite table and telegram_id to users

Revision ID: a1b2c3d4e5f7
Revises: 650aff9a0d41
Create Date: 2026-03-20 08:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f7'
down_revision: Union[str, Sequence[str], None] = '650aff9a0d41'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Create telegram_invite table
    op.create_table(
        'telegram_invite',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('code', sa.String(length=32), nullable=False),
        sa.Column('telegram_user_id', sa.BigInteger(), nullable=False),
        sa.Column('influencer_id', sa.String(), nullable=False),
        sa.Column('claimed_by_user_id', sa.Integer(), nullable=True),
        sa.Column('is_claimed', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('claimed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['influencer_id'], ['influencers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['claimed_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_telegram_invite_code', 'telegram_invite', ['code'], unique=True)
    op.create_index(
        'ix_telegram_invite_tg_user_influencer',
        'telegram_invite',
        ['telegram_user_id', 'influencer_id'],
    )

    # 2. Add telegram_id column to users table
    op.add_column('users', sa.Column('telegram_id', sa.BigInteger(), nullable=True))
    op.create_index('ix_users_telegram_id', 'users', ['telegram_id'], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_users_telegram_id', table_name='users')
    op.drop_column('users', 'telegram_id')
    op.drop_index('ix_telegram_invite_tg_user_influencer', table_name='telegram_invite')
    op.drop_index('ix_telegram_invite_code', table_name='telegram_invite')
    op.drop_table('telegram_invite')
