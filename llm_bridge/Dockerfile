# Python FastAPI microservice for Convee LLM Bridge on Google Cloud Run
# ======================================================================

FROM python:3.11-slim

WORKDIR /app

# Set Python environment flags
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

# Install runtime dependencies (ca-certificates for secure HTTPS calls to Vertex AI / OpenAI)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy microservice code
COPY main.py .

# Create non-root user for security
RUN useradd -u 8888 appuser && chown -R appuser /app
USER appuser

# Expose port (Cloud Run sets $PORT dynamically, default 8080)
EXPOSE 8080

# Start Uvicorn bound to 0.0.0.0 and $PORT
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080} --workers 2"]
