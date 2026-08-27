# apps/indexer-service/Dockerfile — multi-stage, mirrors ai-service pattern (ADR-008)

FROM python:3.12-slim AS base
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# --- dev: source bind-mounted by compose, uvicorn --reload ---
FROM base AS dev
RUN apt-get update && apt-get install -y --no-install-recommends curl git \
    && rm -rf /var/lib/apt/lists/*
COPY . .
EXPOSE 8001
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--reload"]

# --- prod: no reload, no bind mounts, non-root user, minimal image ---
FROM base AS prod
RUN apt-get update && apt-get install -y --no-install-recommends curl git \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --shell /bin/bash appuser \
    && mkdir -p /tmp/repos && chown -R appuser:appuser /tmp/repos && chmod 777 /tmp/repos
COPY . .
USER appuser
EXPOSE 8001
HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
  CMD curl -f http://localhost:8001/health || exit 1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
