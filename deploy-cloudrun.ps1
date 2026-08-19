# ==============================================================================
# Convee Platform - 1-Click Google Cloud Run Deployment Script (PowerShell)
# ==============================================================================
[CmdletBinding()]
param(
    [string]$ProjectId,
    [string]$Region = "asia-south1",
    [string]$DatabaseUrl,
    [string]$JwtSecret,
    [string]$GcsBucket
)

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "   🚀 Convee Platform - Google Cloud Run Deployment  " -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

# 1. Check gcloud CLI
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Error: 'gcloud' CLI is not found in PATH." -ForegroundColor Red
    Write-Host "Please install Google Cloud SDK: https://cloud.google.com/sdk/docs/install"
    exit 1
}

if (-not $ProjectId) {
    $currentProj = (gcloud config get-value project 2>$null).Trim()
    $prompt = if ($currentProj) { "Enter GCP Project ID [$currentProj]: " } else { "Enter GCP Project ID: " }
    $inputProj = Read-Host -Prompt $prompt
    $ProjectId = if ($inputProj) { $inputProj } else { $currentProj }
}

if (-not $ProjectId) {
    Write-Host "❌ Error: Project ID cannot be empty." -ForegroundColor Red
    exit 1
}

Write-Host "`nSetting gcloud active project to $ProjectId..." -ForegroundColor Yellow
gcloud config set project $ProjectId

$RepoName = "convee-docker-repo"
$LlmService = "convee-llm-bridge"
$BackendService = "convee-backend"
$FrontendService = "convee-frontend"

# 2. Enable APIs
Write-Host "`nEnabling required Google Cloud APIs..." -ForegroundColor Yellow
gcloud services enable `
    run.googleapis.com `
    artifactregistry.googleapis.com `
    cloudbuild.googleapis.com `
    aiplatform.googleapis.com `
    storage.googleapis.com `
    secretmanager.googleapis.com `
    --quiet

# 3. Artifact Registry
Write-Host "`nEnsuring Artifact Registry repository exists..." -ForegroundColor Yellow
$repoExists = gcloud artifacts repositories describe $RepoName --location=$Region 2>$null
if (-not $repoExists) {
    Write-Host "Creating Docker repository '$RepoName' in $Region..."
    gcloud artifacts repositories create $RepoName `
        --repository-format=docker `
        --location=$Region `
        --description="Convee Platform Docker Repository"
}

# 4. IAM Permissions for Vertex AI & GCS
Write-Host "`nConfiguring Service Account IAM roles..." -ForegroundColor Yellow
$projectNumber = (gcloud projects describe $ProjectId --format="value(projectNumber)").Trim()
$defaultComputeSa = "${projectNumber}-compute@developer.gserviceaccount.com"

gcloud projects add-iam-policy-binding $ProjectId `
    --member="serviceAccount:${defaultComputeSa}" `
    --role="roles/aiplatform.user" `
    --condition=None --quiet 2>$null

gcloud projects add-iam-policy-binding $ProjectId `
    --member="serviceAccount:${defaultComputeSa}" `
    --role="roles/storage.objectAdmin" `
    --condition=None --quiet 2>$null

# 5. Database & Secrets Prompt
if (-not $DatabaseUrl) {
    Write-Host "`nDatabase Configuration:" -ForegroundColor Yellow
    $DatabaseUrl = Read-Host -Prompt "Enter PostgreSQL DATABASE_URL (e.g. postgresql://user:pass@host:5432/convee?schema=public)"
}

if (-not $DatabaseUrl) {
    Write-Host "❌ Error: DATABASE_URL is required." -ForegroundColor Red
    exit 1
}

if (-not $JwtSecret) {
    $JwtSecret = [System.Guid]::NewGuid().ToString("N") + [System.Guid]::NewGuid().ToString("N")
}

if (-not $GcsBucket) {
    $GcsBucket = "convee-objects-${ProjectId}"
}

# ------------------------------------------------------------------------------
# STEP 1: Deploy LLM Bridge
# ------------------------------------------------------------------------------
Write-Host "`n[1/3] Building & Deploying LLM Bridge Microservice..." -ForegroundColor Cyan
$llmImage = "${Region}-docker.pkg.dev/${ProjectId}/${RepoName}/${LlmService}:latest"

gcloud builds submit ./llm_bridge --tag $llmImage

gcloud run deploy $LlmService `
    --image $llmImage `
    --region $Region `
    --platform managed `
    --allow-unauthenticated `
    --cpu 1 `
    --memory 1Gi `
    --min-instances 0 `
    --max-instances 10 `
    --set-env-vars "VERTEX_PROJECT_ID=${ProjectId},VERTEX_LOCATION=${Region},VERTEX_GEMINI_MODEL=gemini-2.5-flash" `
    --quiet

$llmBridgeUrl = (gcloud run services describe $LlmService --region $Region --format="value(status.url)").Trim()
Write-Host "✅ LLM Bridge deployed at: $llmBridgeUrl" -ForegroundColor Green

# ------------------------------------------------------------------------------
# STEP 2: Deploy Backend
# ------------------------------------------------------------------------------
Write-Host "`n[2/3] Building & Deploying Backend Service..." -ForegroundColor Cyan
$backendImage = "${Region}-docker.pkg.dev/${ProjectId}/${RepoName}/${BackendService}:latest"

gcloud builds submit ./backend --tag $backendImage

gcloud run deploy $BackendService `
    --image $backendImage `
    --region $Region `
    --platform managed `
    --allow-unauthenticated `
    --cpu 1 `
    --memory 1Gi `
    --min-instances 0 `
    --max-instances 10 `
    --session-affinity `
    --set-env-vars "NODE_ENV=production,DATABASE_URL=${DatabaseUrl},JWT_SECRET=${JwtSecret},LLM_BRIDGE_URL=${llmBridgeUrl},VERTEX_PROJECT_ID=${ProjectId},VERTEX_LOCATION=${Region},GCS_PROJECT_ID=${ProjectId},GCS_BUCKET_NAME=${GcsBucket},CORS_ORIGINS=*" `
    --quiet

$backendUrl = (gcloud run services describe $BackendService --region $Region --format="value(status.url)").Trim()
Write-Host "✅ Backend API & WebSockets deployed at: $backendUrl" -ForegroundColor Green

# ------------------------------------------------------------------------------
# STEP 3: Deploy Frontend
# ------------------------------------------------------------------------------
Write-Host "`n[3/3] Building & Deploying Frontend React SPA..." -ForegroundColor Cyan
$frontendImage = "${Region}-docker.pkg.dev/${ProjectId}/${RepoName}/${FrontendService}:latest"

gcloud builds submit ./frontend `
    --tag $frontendImage `
    --substitutions="_REACT_APP_BACKEND_URL=${backendUrl}"

gcloud run deploy $FrontendService `
    --image $frontendImage `
    --region $Region `
    --platform managed `
    --allow-unauthenticated `
    --cpu 1 `
    --memory 512Mi `
    --min-instances 0 `
    --max-instances 10 `
    --quiet

$frontendUrl = (gcloud run services describe $FrontendService --region $Region --format="value(status.url)").Trim()
Write-Host "✅ Frontend deployed at: $frontendUrl" -ForegroundColor Green

# ------------------------------------------------------------------------------
# SUMMARY
# ------------------------------------------------------------------------------
Write-Host "`n=====================================================" -ForegroundColor Green
Write-Host "   🎉 CONVEE PLATFORM DEPLOYED SUCCESSFULLY!         " -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host "🌐 Frontend App:     $frontendUrl"
Write-Host "⚙️  Backend API Docs: $backendUrl/api/docs"
Write-Host "🤖 LLM Bridge:       $llmBridgeUrl/health"
Write-Host "📦 GCS Bucket:       gs://$GcsBucket"
Write-Host "=====================================================`n"
