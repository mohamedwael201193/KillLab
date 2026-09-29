"""optional thesis on a hypothesis. It is not an engine input."""

from alembic import op
import sqlalchemy as sa

revision = "0003_hypothesis_thesis"
down_revision = "0002_book_captures"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("hypotheses", sa.Column("thesis", sa.Text(), nullable=True), schema="killlab")


def downgrade() -> None:
    op.drop_column("hypotheses", "thesis", schema="killlab")
