"""forward-recorded book captures"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0002_book_captures"
down_revision = "0001_killlab"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "book_captures",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("symbol", sa.Text(), nullable=False),
        sa.Column("provenance", sa.Text(), nullable=False),
        sa.Column("payload_sha256", sa.Text(), nullable=False),
        sa.Column("body", postgresql.JSONB(), nullable=False),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=False),
        schema="killlab",
    )


def downgrade() -> None:
    op.drop_table("book_captures", schema="killlab")
