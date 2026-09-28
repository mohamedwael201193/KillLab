"""Database session. prepare_threshold=None. URI is never logged."""

from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from killlab.config import Settings, to_sqlalchemy_url


def make_engine(url: str):
    if not url:
        raise RuntimeError("database url missing")
    return create_engine(to_sqlalchemy_url(url), pool_pre_ping=True, connect_args={"prepare_threshold": None})


def session_factory(settings: Settings):
    engine = make_engine(settings.database_url)
    return sessionmaker(bind=engine, expire_on_commit=False, class_=Session), engine
