FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml /app/pyproject.toml
COPY killlab /app/killlab
COPY alembic.ini /app/alembic.ini
COPY alembic /app/alembic
RUN pip install --no-cache-dir .
ENV KILLAB_ENV=production
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && uvicorn killlab.api:app --host 0.0.0.0 --port ${PORT:-8000}"]
