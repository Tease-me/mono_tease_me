"""add telegram funnel events

Revision ID: b2c3d4e5f6g8
Revises: a1b2c3d4e5f7
Create Date: 2026-03-23 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6g8'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'telegram_funnel_events',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('event_type', sa.String(length=40), nullable=False),
        sa.Column('telegram_user_id', sa.BigInteger(), nullable=False),
        sa.Column('influencer_id', sa.String(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('invite_code', sa.String(length=32), nullable=True),
        sa.Column('session_id', sa.String(length=64), nullable=True),
        sa.Column('meta', sa.JSON(), nullable=True),
        sa.Column('occurred_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['influencer_id'], ['influencers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_tgfe_tg_user_influencer', 'telegram_funnel_events',
                    ['telegram_user_id', 'influencer_id'])
    op.create_index('ix_tgfe_influencer_event_time', 'telegram_funnel_events',
                    ['influencer_id', 'event_type', 'occurred_at'])
    op.create_index('ix_tgfe_event_type_time', 'telegram_funnel_events',
                    ['event_type', 'occurred_at'])
    op.create_index('ix_tgfe_user_id', 'telegram_funnel_events', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_tgfe_user_id', table_name='telegram_funnel_events')
    op.drop_index('ix_tgfe_event_type_time', table_name='telegram_funnel_events')
    op.drop_index('ix_tgfe_influencer_event_time', table_name='telegram_funnel_events')
    op.drop_index('ix_tgfe_tg_user_influencer', table_name='telegram_funnel_events')
    op.drop_table('telegram_funnel_events')
