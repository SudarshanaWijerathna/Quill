# Quill: single-origin production image (FastAPI serves the API and the built SPA).

# ---- 1. Build the frontend ------------------------------------------------------------------------
FROM node:22-slim AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
# Same origin: the API is at /api, so VITE_API_URL stays empty.
ARG VITE_SHOW_DEMO_ACCOUNTS=false
ENV VITE_API_URL="" VITE_SHOW_DEMO_ACCOUNTS=$VITE_SHOW_DEMO_ACCOUNTS
RUN npm run build

# ---- 2. Runtime -------------------------------------------------------------------------------------
FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app ./app
COPY --from=web /web/dist ./static
RUN useradd --create-home --uid 1000 quill && mkdir -p /data && chown quill /data
USER quill

# Defaults for production; JWT_SECRET must be provided as a secret (the app refuses to start without it).
ENV ENVIRONMENT=production \
    FRONTEND_DIST=/app/static \
    DATABASE_URL=sqlite:////data/quill.db \
    COOKIE_SECURE=true \
    COOKIE_SAMESITE=lax \
    SEED_DEMO_DATA=false
EXPOSE 8080
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--proxy-headers", "--forwarded-allow-ips", "*"]
