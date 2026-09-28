from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool, text

from killlab.config import settings_from_environ
from killlab.models import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata
settings = settings_from_environ()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = settings.direct_url
    connectable = engine_from_config(configuration, prefix="sqlalchemy.", poolclass=pool.NullPool, connect_args={"prepare_threshold": None})
    with connectable.connect() as connection:
        connection.execute(text("CREATE SCHEMA IF NOT EXISTS killlab"))
        connection.commit()
        context.configure(connection=connection, target_metadata=target_metadata, version_table_schema="killlab", include_schemas=True)
        with context.begin_transaction():
            context.run_migrations()


run_migrations_online()
