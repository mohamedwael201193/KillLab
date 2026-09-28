"""create killlab tables and freeze trigger"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_killlab"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS killlab")
    op.create_table(
        "hypotheses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("raw_text", sa.Text(), nullable=False),
        sa.Column("family", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        schema="killlab",
    )
    op.create_table(
        "test_specs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("hypothesis_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("killlab.hypotheses.id"), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("canonical_json", postgresql.JSONB(), nullable=False),
        sa.Column("content_sha256", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        schema="killlab",
    )
    op.create_table(
        "preregistrations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("test_spec_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("killlab.test_specs.id"), nullable=False, unique=True),
        sa.Column("frozen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("spec_sha256", sa.Text(), nullable=False),
        sa.Column("confirm_phrase", sa.Text(), nullable=False),
        schema="killlab",
    )
    op.create_table(
        "test_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("preregistration_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("killlab.preregistrations.id"), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("spec_sha256", sa.Text(), nullable=False),
        sa.Column("engine_version", sa.Text(), nullable=False),
        sa.Column("error_code", sa.Text()),
        sa.Column("result_json", postgresql.JSONB()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        schema="killlab",
    )
    op.create_table(
        "research_ledger_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("hypothesis_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("killlab.hypotheses.id"), nullable=False),
        sa.Column("test_run_id", postgresql.UUID(as_uuid=True)),
        sa.Column("stage", sa.Text(), nullable=False),
        sa.Column("body", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        schema="killlab",
    )
    op.create_table(
        "fills",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("hypothesis_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("killlab.hypotheses.id"), nullable=False),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("body", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        schema="killlab",
    )
    op.create_table(
        "idempotency_keys",
        sa.Column("key", sa.Text(), primary_key=True),
        sa.Column("response_json", postgresql.JSONB(), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=False),
        schema="killlab",
    )
    op.execute(
        """
        CREATE OR REPLACE FUNCTION killlab.reject_frozen_spec()
        RETURNS trigger AS $$
        BEGIN
          IF OLD.status = 'frozen' THEN
            RAISE EXCEPTION 'frozen spec is immutable';
          END IF;
          IF TG_OP = 'DELETE' THEN
            RETURN OLD;
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        DROP TRIGGER IF EXISTS test_specs_freeze ON killlab.test_specs;
        CREATE TRIGGER test_specs_freeze
        BEFORE UPDATE OR DELETE ON killlab.test_specs
        FOR EACH ROW EXECUTE FUNCTION killlab.reject_frozen_spec();
        """
    )
    op.execute("ALTER TABLE killlab.hypotheses ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE killlab.test_specs ENABLE ROW LEVEL SECURITY")
    op.execute(
        """
        DO $$ BEGIN
          EXECUTE 'REVOKE ALL ON SCHEMA killlab FROM anon, authenticated';
        EXCEPTION WHEN undefined_object THEN
          NULL;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute("DROP SCHEMA IF EXISTS killlab CASCADE")
