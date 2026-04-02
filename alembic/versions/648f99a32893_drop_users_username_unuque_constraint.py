"""Drop users username unuque constraint

Revision ID: 648f99a32893
Revises: e6f7a8b9c0d1
Create Date: 2026-04-02 00:46:47.192828

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "648f99a32893"
down_revision: Union[str, Sequence[str], None] = "e6f7a8b9c0d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_constraint(op.f("users_username_key"), "users", type_="unique")
    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(None, "users", type_="unique")
    # ### end Alembic commands ###
