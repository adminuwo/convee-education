#!/usr/bin/env bash
# ==============================================================================
# Convee Education — Firebase Test Lab Automation Runner
# Usage:
#   ./run-firebase-test.sh android <path-to-apk> [gcp-project-id]
#   ./run-firebase-test.sh ios <path-to-ipa> [gcp-project-id]
# ==============================================================================

set -e

PLATFORM="${1:-android}"
APP_PATH="$2"
PROJECT_ID="${3:-${GCP_PROJECT_ID:-}}"

if [ -z "$APP_PATH" ]; then
  echo "Error: App file path not provided."
  echo "Usage:"
  echo "  $0 android ./app-release.apk [project-id]"
  echo "  $0 ios ./ConveeEducation-Firebase-Test.ipa [project-id]"
  exit 1
fi

PROJECT_FLAG=""
if [ -n "$PROJECT_ID" ]; then
  PROJECT_FLAG="--project=$PROJECT_ID"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ "$PLATFORM" = "android" ]; then
  echo "=========================================="
  echo "Starting Firebase Test Lab — Android Robo"
  echo "App: $APP_PATH"
  echo "=========================================="

  gcloud firebase test android run $PROJECT_FLAG \
    --type=robo \
    --app="$APP_PATH" \
    --robo-script="$SCRIPT_DIR/firebase-robo-script.json" \
    --device=model=panther,version=34,locale=en,orientation=portrait \
    --device=model=oriole,version=33,locale=en,orientation=portrait \
    --timeout=5m \
    --results-bucket="${FIREBASE_RESULTS_BUCKET:-}"

elif [ "$PLATFORM" = "ios" ]; then
  echo "======================================"
  echo "Starting Firebase Test Lab — iOS Robo"
  echo "App: $APP_PATH"
  echo "======================================"

  gcloud firebase test ios run $PROJECT_FLAG \
    --type=robo \
    --test="$APP_PATH" \
    --device=model=iphone14pro,version=16.6,locale=en,orientation=portrait \
    --device=model=iphone13pro,version=15.7,locale=en,orientation=portrait \
    --timeout=5m \
    --results-bucket="${FIREBASE_RESULTS_BUCKET:-}"

else
  echo "Error: Unknown platform '$PLATFORM'. Use 'android' or 'ios'."
  exit 1
fi

echo "Firebase Test Lab execution finished successfully."
