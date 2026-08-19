# ☁️ Google Cloud Run Deployment Guide for Convee Platform

This guide provides complete, step-by-step instructions to deploy the **Convee Education & Collaboration Platform** to **Google Cloud Run (GCP)**.

---

## 🏗️ Architecture Overview

The Convee platform is deployed as 3 scalable, serverless microservices on Google Cloud Run:

```
                  ┌────────────────────────┐
                  │    End User Browser    │
                  └───────────┬────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼ (HTTPS)                       ▼ (API / WebSockets)
    ┌──────────────────┐            ┌──────────────────┐
    │ convee-frontend  │            │  convee-backend  │
    │  (React + Nginx) │            │ (Node + Express) │
    └──────────────────┘            └─────────┬────────┘
                                              │
                      ┌───────────────────────┼───────────────────────┐
                      ▼                       ▼                       ▼
             ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
             │convee-llm-bridge│     │ Cloud SQL (PG)  │     │ Cloud Storage   │
             │(FastAPI+Vertex) │     │   (Database)    │     │  (GCS Bucket)   │
             └─────────────────┘     └─────────────────┘     └─────────────────┘
```

| Service Name | Stack | Purpose |
| :--- | :--- | :--- |
| **`convee-frontend`** | React 19, Tailwind CSS, Nginx (Alpine) | Responsive SPA web application with client-side routing & Gzip compression |
| **`convee-backend`** | Node.js 20, Express, Prisma ORM, Socket.IO | Core REST API, realtime sockets, DB migrations, GCS file uploads |
| **`convee-llm-bridge`** | Python 3.11, FastAPI, Google GenAI SDK | AI proxy routing student/parent queries to Vertex AI Gemini 2.5 Flash |

---

## ⚡ Quick Start: 1-Click Automated Deployment

### For Windows (PowerShell):
```powershell
.\deploy-cloudrun.ps1
```

### For Linux / macOS (Bash):
```bash
chmod +x deploy-cloudrun.sh
./deploy-cloudrun.sh
```

The script will automatically:
1. Enable all required GCP APIs (`run`, `artifactregistry`, `aiplatform`, `storage`, `secretmanager`).
2. Grant IAM permissions to the Cloud Run service account for Vertex AI & GCS.
3. Build & push Docker images to Google Artifact Registry.
4. Deploy the 3 microservices in topological order and wire their URLs together.

---

## 📋 Prerequisites & Manual Setup (Step-by-Step)

If you prefer to configure each component manually, follow the steps below:

### 1. Install Google Cloud SDK & Login
```bash
# Login to Google Cloud
gcloud auth login

# Set your project ID
export PROJECT_ID="your-gcp-project-id"
export REGION="asia-south1"
gcloud config set project $PROJECT_ID
```

### 2. Enable Required GCP APIs
```bash
gcloud services enable \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com \
    aiplatform.googleapis.com \
    storage.googleapis.com \
    secretmanager.googleapis.com \
    sqladmin.googleapis.com
```

### 3. Create Artifact Registry Repository
```bash
gcloud artifacts repositories create convee-docker-repo \
    --repository-format=docker \
    --location=$REGION \
    --description="Convee Platform Docker Repository"
```

### 4. Create Cloud Storage (GCS) Bucket for File Uploads
```bash
export GCS_BUCKET="convee-objects-${PROJECT_ID}"
gsutil mb -p $PROJECT_ID -l $REGION gs://${GCS_BUCKET}

# Configure CORS for browser file uploads/downloads
echo '[{"origin": ["*"],"responseHeader": ["Content-Type","Authorization","Content-Disposition"],"method": ["GET","POST","PUT","DELETE","HEAD"],"maxAgeSeconds": 3600}]' > gcs-cors.json
gsutil cors set gcs-cors.json gs://${GCS_BUCKET}
rm gcs-cors.json
```

### 5. Setup PostgreSQL Database (Cloud SQL or Managed DB)
You can use **Google Cloud SQL for PostgreSQL** or external PostgreSQL (e.g. Neon, Supabase, AWS RDS).

#### To create a Cloud SQL instance:
```bash
gcloud sql instances create convee-db-instance \
    --database-version=POSTGRES_16 \
    --tier=db-f1-micro \
    --region=$REGION \
    --root-password="YourStrongPassword123!"

gcloud sql databases create convee --instance=convee-db-instance
```

**Connection String Formats:**
- **Cloud SQL Unix Socket (Recommended for Cloud Run)**:
  `postgresql://postgres:YourStrongPassword123!@/convee?host=/cloudsql/PROJECT_ID:REGION:convee-db-instance`
- **Standard TCP Connection / Neon / Supabase**:
  `postgresql://postgres:YourStrongPassword123!@YOUR_HOST:5432/convee?schema=public&sslmode=prefer`

### 6. Configure Service Account IAM Permissions
Grant the default Cloud Run service account access to Vertex AI and Google Cloud Storage:

```bash
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
export SA_EMAIL="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Vertex AI Gemini Access
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/aiplatform.user"

# Cloud Storage Access
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/storage.objectAdmin"

# Cloud SQL Client (if using Cloud SQL)
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/cloudsql.client"
```

---

## 🚀 Manual Deployment of Services

### Step 1: Deploy `convee-llm-bridge`
```bash
# Build image
gcloud builds submit ./llm_bridge \
    --tag ${REGION}-docker.pkg.dev/${PROJECT_ID}/convee-docker-repo/convee-llm-bridge:latest

# Deploy to Cloud Run
gcloud run deploy convee-llm-bridge \
    --image ${REGION}-docker.pkg.dev/${PROJECT_ID}/convee-docker-repo/convee-llm-bridge:latest \
    --region $REGION \
    --platform managed \
    --allow-unauthenticated \
    --cpu 1 \
    --memory 1Gi \
    --min-instances 0 \
    --max-instances 10 \
    --set-env-vars "VERTEX_PROJECT_ID=${PROJECT_ID},VERTEX_LOCATION=${REGION},VERTEX_GEMINI_MODEL=gemini-2.5-flash"
```

Obtain the LLM Bridge URL:
```bash
export LLM_BRIDGE_URL=$(gcloud run services describe convee-llm-bridge --region $REGION --format="value(status.url)")
echo "LLM Bridge URL: $LLM_BRIDGE_URL"
```

---

### Step 2: Deploy `convee-backend`
```bash
# Build image
gcloud builds submit ./backend \
    --tag ${REGION}-docker.pkg.dev/${PROJECT_ID}/convee-docker-repo/convee-backend:latest

# Deploy to Cloud Run
gcloud run deploy convee-backend \
    --image ${REGION}-docker.pkg.dev/${PROJECT_ID}/convee-docker-repo/convee-backend:latest \
    --region $REGION \
    --platform managed \
    --allow-unauthenticated \
    --cpu 1 \
    --memory 1Gi \
    --min-instances 0 \
    --max-instances 10 \
    --session-affinity \
    --set-env-vars "NODE_ENV=production,DATABASE_URL=${DATABASE_URL},JWT_SECRET=your-secure-jwt-secret,LLM_BRIDGE_URL=${LLM_BRIDGE_URL},VERTEX_PROJECT_ID=${PROJECT_ID},VERTEX_LOCATION=${REGION},GCS_PROJECT_ID=${PROJECT_ID},GCS_BUCKET_NAME=${GCS_BUCKET},CORS_ORIGINS=*"
```

*(Optional: If connecting to Cloud SQL via socket, append `--add-cloudsql-instances=${PROJECT_ID}:${REGION}:convee-db-instance`)*

Obtain the Backend URL:
```bash
export BACKEND_URL=$(gcloud run services describe convee-backend --region $REGION --format="value(status.url)")
echo "Backend URL: $BACKEND_URL"
```

---

### Step 3: Deploy `convee-frontend`
```bash
# Build image with Backend URL injected
docker build \
    --build-arg REACT_APP_BACKEND_URL="${BACKEND_URL}" \
    -t "${REGION}-docker.pkg.dev/${PROJECT_ID}/convee-docker-repo/convee-frontend:latest" \
    ./frontend

docker push "${REGION}-docker.pkg.dev/${PROJECT_ID}/convee-docker-repo/convee-frontend:latest"

# Deploy to Cloud Run
gcloud run deploy convee-frontend \
    --image ${REGION}-docker.pkg.dev/${PROJECT_ID}/convee-docker-repo/convee-frontend:latest \
    --region $REGION \
    --platform managed \
    --allow-unauthenticated \
    --cpu 1 \
    --memory 512Mi \
    --min-instances 0 \
    --max-instances 10
```

Obtain the Frontend URL:
```bash
export FRONTEND_URL=$(gcloud run services describe convee-frontend --region $REGION --format="value(status.url)")
echo "Frontend URL: $FRONTEND_URL"
```

---

## 🧪 Local Testing with Docker Compose

Before deploying to Google Cloud, test all containers locally:

```bash
# Start all 4 containers (PostgreSQL, LLM Bridge, Backend, Frontend)
docker compose up --build

# Open the app in your browser:
# Frontend: http://localhost:3000
# Backend Docs: http://localhost:8001/api/docs
# LLM Bridge: http://localhost:8002/health
```

---

## 🔒 Production Best Practices

1. **Custom Domain & SSL**:
   Map your custom domain (e.g. `app.convee.edu` or `api.convee.edu`) using:
   ```bash
   gcloud beta run domain-mappings create --service convee-frontend --domain app.yourdomain.com --region $REGION
   gcloud beta run domain-mappings create --service convee-backend --domain api.yourdomain.com --region $REGION
   ```
2. **WebSockets & Session Affinity**:
   Cloud Run natively supports WebSockets. Ensure `--session-affinity` is enabled on `convee-backend` so Socket.io handshakes connect to the same container instance.
3. **Secret Manager**:
   Store sensitive secrets (`DATABASE_URL`, `JWT_SECRET`, `OPENAI_API_KEY`) in **GCP Secret Manager** and mount them in Cloud Run using `--set-secrets`.
4. **Health Check Probes**:
   - Backend liveness / startup probe: `/api/health`
   - LLM Bridge probe: `/health`
   - Frontend probe: `/healthz`
