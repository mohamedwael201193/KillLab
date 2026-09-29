from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


class Hypothesis(Base):
    __tablename__ = "hypotheses"
    __table_args__ = {"schema": "killlab"}
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    raw_text: Mapped[str] = mapped_column(Text)
    family: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class TestSpec(Base):
    __tablename__ = "test_specs"
    __table_args__ = {"schema": "killlab"}
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    hypothesis_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("killlab.hypotheses.id"))
    version: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(Text, default="draft")
    canonical_json: Mapped[dict] = mapped_column(JSONB)
    content_sha256: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Preregistration(Base):
    __tablename__ = "preregistrations"
    __table_args__ = {"schema": "killlab"}
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    test_spec_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("killlab.test_specs.id"), unique=True)
    frozen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    spec_sha256: Mapped[str] = mapped_column(Text)
    confirm_phrase: Mapped[str] = mapped_column(Text)


class TestRun(Base):
    __tablename__ = "test_runs"
    __table_args__ = {"schema": "killlab"}
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    preregistration_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("killlab.preregistrations.id"))
    status: Mapped[str] = mapped_column(Text)
    spec_sha256: Mapped[str] = mapped_column(Text)
    engine_version: Mapped[str] = mapped_column(Text)
    error_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    result_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class LedgerEntry(Base):
    __tablename__ = "research_ledger_entries"
    __table_args__ = {"schema": "killlab"}
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    hypothesis_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("killlab.hypotheses.id"))
    test_run_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    stage: Mapped[str] = mapped_column(Text)
    body: Mapped[dict] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Fill(Base):
    __tablename__ = "fills"
    __table_args__ = {"schema": "killlab"}
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    hypothesis_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("killlab.hypotheses.id"))
    source: Mapped[str] = mapped_column(Text)
    body: Mapped[dict] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class IdempotencyKey(Base):
    __tablename__ = "idempotency_keys"
    __table_args__ = {"schema": "killlab"}
    key: Mapped[str] = mapped_column(Text, primary_key=True)
    response_json: Mapped[dict] = mapped_column(JSONB)
    status_code: Mapped[int] = mapped_column(Integer)


ENGINE_VERSION = "killlab-0.5.0"
SCHEMA_READY = text("SELECT 1")
