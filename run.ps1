param (
    [string]$Action = ""
)

$RootDir = $PSScriptRoot

function Show-Menu {
    Clear-Host
    Write-Host "========================================================" -ForegroundColor Cyan
    Write-Host "     Convee Education - Master Control Launcher        " -ForegroundColor Yellow
    Write-Host "========================================================" -ForegroundColor Cyan
    Write-Host " 1. Start Backend (Dev Mode - port 8001)"
    Write-Host " 2. Start LLM Bridge AI (FastAPI / Gemini - port 8002)"
    Write-Host " 3. Start Frontend Web (React - port 3000)"
    Write-Host " 4. Start Mobile App (Expo - port 8081)"
    Write-Host " 5. Build All (Backend tsc + Frontend craco build)"
    Write-Host " 6. Sync Database (Prisma db push + generate)"
    Write-Host " 7. Build Android APK (Firebase preview via EAS)"
    Write-Host " 8. Build iOS Simulator Package (for Appetize.io)"
    Write-Host " 9. Run Backend Tests"
    Write-Host " 0. Exit"
    Write-Host "========================================================" -ForegroundColor Cyan
    $choice = Read-Host "Enter option [0-9]"
    return $choice
}

switch ($Action.ToLower()) {
    "backend-dev" {
        Write-Host "Starting Backend in dev mode..." -ForegroundColor Green
        Set-Location "$RootDir\backend"
        npm run dev
        exit
    }
    "llm-bridge" {
        Write-Host "Starting LLM Bridge AI service..." -ForegroundColor Green
        Set-Location "$RootDir\llm_bridge"
        python -m uvicorn main:app --host 0.0.0.0 --port 8002 --reload
        exit
    }
    "frontend-dev" {
        Write-Host "Starting Frontend web..." -ForegroundColor Green
        Set-Location "$RootDir\frontend"
        npm start
        exit
    }
    "mobile-dev" {
        Write-Host "Starting Mobile Expo..." -ForegroundColor Green
        Set-Location "$RootDir\mobile"
        npx expo start
        exit
    }
    "build-all" {
        Write-Host "Building Backend..." -ForegroundColor Cyan
        Set-Location "$RootDir\backend"
        npm run build
        Write-Host "Building Frontend..." -ForegroundColor Cyan
        Set-Location "$RootDir\frontend"
        npm run build
        Write-Host "All components built successfully!" -ForegroundColor Green
        exit
    }
    "build-apk" {
        Write-Host "Building Android APK for Firebase..." -ForegroundColor Cyan
        Set-Location "$RootDir\mobile"
        npx eas-cli build --platform android --profile preview
        exit
    }
    "sync-db" {
        Write-Host "Syncing Prisma schema to DB..." -ForegroundColor Cyan
        Set-Location "$RootDir\backend"
        npx prisma db push
        npx prisma generate
        exit
    }
    default {
        # Interactive Mode
        do {
            $opt = Show-Menu
            switch ($opt) {
                "1" {
                    Set-Location "$RootDir\backend"
                    npm run dev
                }
                "2" {
                    Set-Location "$RootDir\llm_bridge"
                    python -m uvicorn main:app --host 0.0.0.0 --port 8002 --reload
                }
                "3" {
                    Set-Location "$RootDir\frontend"
                    npm start
                }
                "4" {
                    Set-Location "$RootDir\mobile"
                    npx expo start
                }
                "5" {
                    Set-Location "$RootDir\backend"
                    npm run build
                    Set-Location "$RootDir\frontend"
                    npm run build
                    Read-Host "Build complete. Press Enter to continue..."
                }
                "6" {
                    Set-Location "$RootDir\backend"
                    npx prisma db push
                    npx prisma generate
                    Read-Host "Database synced. Press Enter to continue..."
                }
                "7" {
                    Set-Location "$RootDir\mobile"
                    npx eas-cli build --platform android --profile preview
                }
                "8" {
                    Set-Location "$RootDir\mobile"
                    npx eas-cli build --platform ios --profile preview
                }
                "9" {
                    Set-Location "$RootDir\backend"
                    npm test
                    Read-Host "Tests complete. Press Enter to continue..."
                }
                    Read-Host "Tests complete. Press Enter to continue..."
                }
                "0" {
                    Write-Host "Exiting." -ForegroundColor Yellow
                    exit
                }
                default {
                    Write-Host "Invalid selection." -ForegroundColor Red
                    Start-Sleep -Seconds 1
                }
            }
        } while ($opt -ne "0")
    }
}
