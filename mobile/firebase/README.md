# Firebase Test Lab Guide — Convee Education Mobile

This directory contains automated testing scripts and configuration for running **Firebase Test Lab** across physical & virtual device matrices for both **Android (APK)** and **iOS (IPA)**.

---

## 1. Running in Firebase Web Console

### A. Android (APK) with Robo Script
1. Navigate to [Firebase Console](https://console.firebase.google.com/) → Select your project → **Test Lab**.
2. Click **Run a test** and select **Robo**.
3. Upload your **`app-release.apk`** (or `app-debug.apk`).
4. Click **Continue** to configure the test:
   * Expand **Robo script (optional)**:
     * Upload the [`firebase-robo-script.json`](./firebase-robo-script.json) file located in this directory.
     * *The Robo script will automatically enter credentials (`director@demo.edu` / `Demo1234!`), submit the login form, open the hamburger navigation drawer, check the notification center, and switch through bottom tabs before exploratory crawling.*
   * *(Alternative without script file)* Under **Authentication credentials**, set:
     * **Username field**: `email-input` (or `e.g. director@demo.edu`)
     * **Username**: `director@demo.edu`
     * **Password field**: `password-input` (or `••••••••`)
     * **Password**: `Demo1234!`
5. Select your test devices (e.g. *Google Pixel 8, Samsung Galaxy S23 on Android 14/15*).
6. Click **Start 1 test**.

---

### B. iOS (IPA) Robo Test
1. In Firebase Test Lab, select **Run a test** → **Robo (iOS)**.
2. Upload **`ConveeEducation-Firebase-Test.ipa`**.
3. Under **Authentication credentials**:
   * **Username label**: `email-input`
   * **Username**: `director@demo.edu`
   * **Password label**: `password-input`
   * **Password**: `Demo1234!`
4. Select target iOS devices (e.g. *iPhone 15, iPhone 14 Pro on iOS 17.x*).
5. Click **Start test**.

---

## 2. Running via Command Line (`gcloud`)

### Prerequisites
Make sure the Google Cloud SDK is installed and authenticated:
```bash
gcloud auth login
gcloud config set project YOUR_FIREBASE_PROJECT_ID
```

### Windows (PowerShell):
```powershell
cd mobile/firebase

# Test Android APK
.\run-firebase-test.ps1 -Platform android -AppPath "path\to\app-release.apk"

# Test iOS IPA
.\run-firebase-test.ps1 -Platform ios -AppPath "path\to\ConveeEducation-Firebase-Test.ipa"
```

### Linux / macOS (Bash):
```bash
cd mobile/firebase
chmod +x run-firebase-test.sh

# Test Android APK
./run-firebase-test.sh android path/to/app-release.apk

# Test iOS IPA
./run-firebase-test.sh ios path/to/ConveeEducation-Firebase-Test.ipa
```

---

## 3. What Firebase Tests & Validates
* **No Crashes / ANRs**: Validates zero fatal Java/Kotlin or Objective-C/Swift exceptions.
* **Authentication Flow**: Verifies API token hydration and state transition into the main tab dashboard.
* **Responsive Layout**: Checks for UI overflows, descender clipping, and viewport padding across different screen resolutions and aspect ratios.
* **Network & Memory**: Captures network requests, CPU utilization, frame rendering rate (FPS), and memory leaks.
