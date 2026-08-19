#!/usr/bin/env bash
# ==============================================================================
# Convee Platform - 1-Click Google Cloud Run Deployment Script (Bash)
# ==============================================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${BLUE}${BOLD}=====================================================${NC}"
echo -e "${BLUE}${BOLD}   🚀 Convee Platform - Google Cloud Run Deployment  ${NC}"
echo -e "${BLUE}${BOLD}=====================================================${NC}\n"

# 1. Check prerequisites
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ Error: 'gcloud' CLI is not installed or not in PATH.${NC}"
    echo "Please install the Google Cloud SDK: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null || echo "")
read -rp "Enter GCP Project ID [${CURRENT_PROJECT}]: " PROJECT_ID
PROJECT_ID=${PROJECT_ID:-$CURRENT_PROJECT}

if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}❌ Error: Project ID cannot be empty.${NC}"
    exit 1
fi

read -rp "Enter GCP Region [asia-south1]: " REGION
REGION=${REGION:-asia-south1}

REPO_NAME="convee-docker-repo"
LLM_SERVICE="convee-llm-bridge"
BACKEND_SERVICE="convee-backend"
FRONTEND_SERVICE="convee-frontend"

echo -e "\n${YELLOW}Setting gcloud project to ${PROJECT_ID}...${NC}"
gcloud config set project "$PROJECT_ID"

# 2. Enable Required APIs
echo -e "\n${YELLOW}Enabling necessary Google Cloud APIs...${NC}"
gcloud services enable \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com \
    aiplatform.googleapis.com \
    storage.googleapis.com \
    secretmanager.googleapis.com \
    --quiet

# 3. Create Artifact Registry Repository if not exists
echo -e "\n${YELLOW}Ensuring Artifact Registry repository exists...${NC}"
if ! gcloud artifacts repositories describe "$REPO_NAME" --location="$REGION" &>/dev/null; then
    echo "Creating Docker repository '$REPO_NAME' in $REGION..."
    gcloud artifacts repositories create "$REPO_NAME" \
        --repository-format=docker \
        --location="$REGION" \
        --description="Convee Platform Docker Repository"
fi

# Configure Docker auth
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

# 4. Grant Service Account Vertex AI & Storage Permissions
echo -e "\n${YELLOW}Configuring Service Account IAM roles...${NC}"
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
DEFAULT_COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

echo "Granting Vertex AI User & Storage permissions to default Cloud Run service account (${DEFAULT_COMPUTE_SA})..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${DEFAULT_COMPUTE_SA}" \
    --role="roles/aiplatform.user" \
    --condition=None --quiet || true

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${DEFAULT_COMPUTE_SA}" \
    --role="roles/storage.objectAdmin" \
    --condition=None --quiet || true

# 5. Environment Variables & Secrets
echo -e "\n${YELLOW}Database & Security Configuration:${NC}"
read -rp "Enter PostgreSQL DATABASE_URL (e.g. postgresql://user:pass@host:5432/convee?schema=public): " DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ Error: DATABASE_URL is required.${NC}"
    exit 1
fi

read -rp "Enter JWT_SECRET (press Enter to generate random secret): " JWT_SECRET
if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || cat /proc/sys/kernel/random/uuid | tr -d '-')
fi

read -rp "Enter GCS Bucket Name for uploads [convee-objects-${PROJECT_ID}]: " GCS_BUCKET
GCS_BUCKET=${GCS_BUCKET:-"convee-objects-${PROJECT_ID}"}

# Ensure GCS bucket exists
if ! gsutil ls -b "gs://${GCS_BUCKET}" &>/dev/null; then
    echo "Creating GCS bucket gs://${GCS_BUCKET}..."
    gsutil mb -p "$PROJECT_ID" -l "$REGION" "gs://${GCS_BUCKET}" || true
fi

# ------------------------------------------------------------------------------
# STEP 1: Deploy LLM Bridge
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}${BOLD}[1/3] Building & Deploying LLM Bridge Microservice...${NC}"
LLM_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${LLM_SERVICE}:latest"

gcloud builds submit ./llm_bridge --tag "$LLM_IMAGE"

gcloud run deploy "$LLM_SERVICE" \
    --image "$LLM_IMAGE" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --cpu 1 \
    --memory 1Gi \
    --min-instances 0 \
    --max-instances 10 \
    --set-env-vars "VERTEX_PROJECT_ID=${PROJECT_ID},VERTEX_LOCATION=${REGION},VERTEX_GEMINI_MODEL=gemini-2.5-flash" \
    --quiet

LLM_BRIDGE_URL=$(gcloud run services describe "$LLM_SERVICE" --region "$REGION" --format="value(status.url)")
echo -e "${GREEN}✅ LLM Bridge deployed at:${NC} $LLM_BRIDGE_URL"

# ------------------------------------------------------------------------------
# STEP 2: Deploy Backend
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}${BOLD}[2/3] Building & Deploying Backend Service...${NC}"
BACKEND_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${BACKEND_SERVICE}:latest"

gcloud builds submit ./backend --tag "$BACKEND_IMAGE"

gcloud run deploy "$BACKEND_SERVICE" \
    --image "$BACKEND_IMAGE" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --cpu 1 \
    --memory 1Gi \
    --min-instances 0 \
    --max-instances 10 \
    --session-affinity \
    --set-env-vars "NODE_ENV=production,DATABASE_URL=${DATABASE_URL},JWT_SECRET=${JWT_SECRET},LLM_BRIDGE_URL=${LLM_BRIDGE_URL},VERTEX_PROJECT_ID=${PROJECT_ID},VERTEX_LOCATION=${REGION},GCS_PROJECT_ID=${PROJECT_ID},GCS_BUCKET_NAME=${GCS_BUCKET},CORS_ORIGINS=*" \
    --quiet

BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE" --region "$REGION" --format="value(status.url)")
echo -e "${GREEN}✅ Backend API & WebSockets deployed at:${NC} $BACKEND_URL"

# ------------------------------------------------------------------------------
# STEP 3: Deploy Frontend
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}${BOLD}[3/3] Building & Deploying React Frontend SPA...${NC}"
FRONTEND_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${FRONTEND_SERVICE}:latest"

gcloud builds submit ./frontend \
    --tag "$FRONTEND_IMAGE" \
    --substitutions="_REACT_APP_BACKEND_URL=${BACKEND_URL}" || \
docker build \
    --build-arg REACT_APP_BACKEND_URL="$BACKEND_URL" \
    -t "$FRONTEND_IMAGE" ./frontend && docker push "$FRONTEND_IMAGE"

gcloud run deploy "$FRONTEND_SERVICE" \
    --image "$FRONTEND_IMAGE" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --cpu 1 \
    --memory 512Mi \
    --min-instances 0 \
    --max-instances 10 \
    --quiet

FRONTEND_URL=$(gcloud run services describe "$FRONTEND_SERVICE" --region "$REGION" --format="value(status.url)")
echo -e "${GREEN}✅ Frontend deployed at:${NC} $FRONTEND_URL"

# ------------------------------------------------------------------------------
# SUMMARY
# ------------------------------------------------------------------------------
echo -e "\n${GREEN}${BOLD}=====================================================${NC}"
echo -e "${GREEN}${BOLD}   🎉 CONVEE PLATFORM DEPLOYED SUCCESSFULLY!         ${NC}"
echo -e "${GREEN}${BOLD}=====================================================${NC}"
echo -e "🌐 ${BOLD}Frontend App:${NC}     $FRONTEND_URL"
echo -e "⚙️  ${BOLD}Backend API Docs:${NC} $BACKEND_URL/api/docs"
echo -e "🤖 ${BOLD}LLM Bridge:${NC}       $LLM_BRIDGE_URL/health"
echo -e "📦 ${BOLD}GCS Bucket:${NC}       gs://${GCS_BUCKET}"
echo -e "=====================================================\n"
