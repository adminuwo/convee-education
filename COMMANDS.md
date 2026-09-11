# Convee Education - Master Build & Run Guide

Comprehensive cheat-sheet for building, running, testing, and deploying all components across the **Backend**, **Web Frontend**, and **Mobile App**.

---

## ⚡ Quick Start: Run Everything Locally

| Component | Tech Stack | Local URL | Port |
| :--- | :--- | :--- | :--- |
| **Backend API** | Node.js + Express + Prisma | `http://localhost:8001` | `8001` |
| **LLM Bridge AI** | Python FastAPI (Vertex AI / Gemini) | `http://localhost:8002` | `8002` |
| **Frontend Web** | React + Tailwind | `http://localhost:3000` | `3000` |
| **Mobile App** | React Native (Expo SDK 52) | `http://localhost:8081` | `8081` |
| **Cloud Run (Live)** | GCP Managed Container | `https://convee-education-977864306871.asia-south1.run.app` | `443` |

---

## 1. 🖥️ Backend (`/backend`)

### First-Time Setup & Dependencies
```powershell
cd backend
npm install
```

### Database Synchronization (Prisma + PostgreSQL)
```powershell
cd backend
# Push Prisma schema changes to PostgreSQL database
npx prisma db push

# Generate Prisma Client types
npx prisma generate

# (Optional) Seed the database with default demo data
npm run seed
```

### Build (TypeScript Compilation)
```powershell
cd backend
npm run build
```

### Run
```powershell
# Development Mode (Hot-reload with ts-node-dev)
cd backend
npm run dev

# Production Mode (Runs compiled dist/server.js)
cd backend
npm start
```

### Run Tests
```powershell
cd backend
# Functional test suite
npm test
```

---

## 2. 🤖 LLM Bridge AI Microservice (`/llm_bridge`)

Proxies AI requests to Google Cloud Vertex AI (Gemini 2.5 Flash) and OpenAI on port `8002`.

### Install Python Dependencies
```powershell
cd llm_bridge
pip install -r requirements.txt
```

### Run LLM Bridge (FastAPI / Uvicorn)
```powershell
cd llm_bridge
# Development mode with hot-reload
uvicorn main:app --host 0.0.0.0 --port 8002 --reload

# Or via Python module:
python -m uvicorn main:app --host 0.0.0.0 --port 8002 --reload
```

### Health Check
Once running, verify at:
- Health endpoint: `http://localhost:8002/health`
- Interactive Swagger docs: `http://localhost:8002/docs`

---

## 2. 🌐 Frontend Web App (`/frontend`)

### Install Dependencies
```powershell
cd frontend
npm install
```

### Run Development Server
```powershell
cd frontend
npm start
# Opens interactive web app at http://localhost:3000
```

### Build for Production
```powershell
cd frontend
npm run build
# Creates optimized production build inside /frontend/build
```

---

## 3. 📱 Mobile Application (`/mobile`)

### Install Dependencies
```powershell
cd mobile
npm install
```

### Run Mobile Development Server (Expo)
```powershell
cd mobile
npx expo start
```
*Key controls in the interactive Expo terminal:*
- Press **`a`** ➔ Launch on running **Android Studio Emulator**.
- Press **`w`** ➔ Launch in **Web Browser** preview.
- Press **`r`** ➔ Reload the active app.
- **Scan QR Code** ➔ Opens instantly on any physical **Android or iPhone** with the **Expo Go** app installed.

### Direct Shortcut Launchers
```powershell
cd mobile

# Run directly on Android Emulator
npx expo start --android

# Run Web Preview
npx expo start --web
```

### 📦 Standalone Cloud Builds (Firebase & Online Simulators)

#### A. Generate Standalone Android `.apk` (For Firebase App Distribution)
```powershell
cd mobile
npx eas-cli build --platform android --profile preview
```
*Upload the downloaded `.apk` directly to Firebase Console ➔ App Distribution.*

#### B. Generate iOS Simulator Build (For Web Testing via Appetize.io)
```powershell
cd mobile
npx eas-cli build --platform ios --profile preview
```
*Upload the resulting `.tar.gz` package to [Appetize.io/upload](https://appetize.io/upload) to test the virtual iPhone in your browser on Windows.*

#### C. Generate iOS `.ipa` (For Firebase App Distribution)
```powershell
cd mobile
npx eas-cli build --platform ios --profile firebase-ios
```

---

## 4. 🐳 Docker & Container Builds

### Run with Docker Compose
```powershell
# Build and run Postgres database and backend
docker compose up --build -d

# View running container logs
docker compose logs -f

# Stop containers
docker compose down
```

### Build Single Production Container
```powershell
docker build -t convee-education:latest .
```

---

## 5. ☁️ Google Cloud Run Deployment

```powershell
# Deploy using PowerShell deployment script
.\deploy-cloudrun.ps1
```
Or via gcloud CLI:
```powershell
gcloud run deploy convee-education `
  --image asia-south1-docker.pkg.dev/your-project/convee/backend:latest `
  --region asia-south1 `
  --platform managed `
  --allow-unauthenticated
```

---

## 🛠️ Handy Windows Automation Script (`run.ps1`)

You can run any service directly from the project root using our convenience script:
```powershell
# Run the interactive menu
.\run.ps1

# Quick execution commands:
.\run.ps1 backend-dev    # Starts backend in dev mode
.\run.ps1 frontend-dev   # Starts React web app
.\run.ps1 mobile-dev     # Starts Expo mobile app
.\run.ps1 build-all      # Builds Backend and Frontend
.\run.ps1 build-apk      # Generates Android APK for Firebase
```
