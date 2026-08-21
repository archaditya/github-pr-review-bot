# apps/ai-service/Dockerfile — multi-stage, dev target used by docker-compose.local.yml,
# prod target used by docker-compose.prod.yml (ADR-008)

FROM python:3.12-slim AS base
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# --- dev: source bind-mounted by compose, uvicorn --reload ---
FROM base AS dev
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# --- prod: no reload, no bind mounts, minimal image ---
FROM base AS prod
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
