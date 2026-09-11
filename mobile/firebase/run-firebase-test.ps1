# ==============================================================================
# Convee Education — Firebase Test Lab Automation Runner (PowerShell)
# Usage:
#   .\run-firebase-test.ps1 -Platform android -AppPath .\app-release.apk [-ProjectId "my-project"]
#   .\run-firebase-test.ps1 -Platform ios -AppPath .\ConveeEducation-Firebase-Test.ipa [-ProjectId "my-project"]
# ==============================================================================

param (
    [Parameter(Mandatory=$true)]
    [ValidateSet("android", "ios")]
    [string]$Platform,

    [Parameter(Mandatory=$true)]
    [string]$AppPath,

    [Parameter(Mandatory=$false)]
    [string]$ProjectId = $env:GCP_PROJECT_ID
)

if (-not (Test-Path $AppPath)) {
    Write-Error "Error: Specified app file does not exist at '$AppPath'."
    exit 1
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RoboScript = Join-Path $ScriptDir "firebase-robo-script.json"

$ProjectArg = @()
if ($ProjectId) {
    $ProjectArg = @("--project=$ProjectId")
}

if ($Platform -eq "android") {
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "Starting Firebase Test Lab — Android Robo" -ForegroundColor Green
    Write-Host "App: $AppPath" -ForegroundColor Yellow
    Write-Host "Robo Script: $RoboScript" -ForegroundColor Yellow
    Write-Host "==========================================" -ForegroundColor Cyan

    & gcloud firebase test android run @ProjectArg `
        --type=robo `
        --app="$AppPath" `
        --robo-script="$RoboScript" `
        --device=model=panther,version=34,locale=en,orientation=portrait `
        --device=model=oriole,version=33,locale=en,orientation=portrait `
        --timeout=5m
}
elseif ($Platform -eq "ios") {
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "Starting Firebase Test Lab — iOS Robo" -ForegroundColor Green
    Write-Host "App: $AppPath" -ForegroundColor Yellow
    Write-Host "==========================================" -ForegroundColor Cyan

    & gcloud firebase test ios run @ProjectArg `
        --type=robo `
        --test="$AppPath" `
        --device=model=iphone14pro,version=16.6,locale=en,orientation=portrait `
        --device=model=iphone13pro,version=15.7,locale=en,orientation=portrait `
        --timeout=5m
}

Write-Host "Firebase Test Lab execution finished." -ForegroundColor Green
