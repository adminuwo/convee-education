# Convee Education Mobile App

React Native & Expo cross-platform mobile application for **Convee Education**, supporting Faculty, Students, and Parents.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd "convee-education-mobile"
npm install
```

### 2. Start the Expo Development Server
```bash
npx expo start
```
From the interactive terminal:
- Press **`a`** to open on an Android emulator / connected device.
- Press **`i`** to open on an iOS simulator (macOS).
- Press **`w`** to test in the web browser.
- Scan the displayed QR code with the **Expo Go** app on your physical mobile device.

---

## 📱 Features & Screens

- **Authentication Gateway (`LoginScreen.tsx`)**:
  - 3-Portal mode switcher: **Faculty**, **Student**, **Parent**.
  - Demo quick-fill credentials for instant testing (`director@demo.edu`, `student@demo.edu`, `parent@demo.edu`).
  - Automatic JWT token management and persistent storage via AsyncStorage.
- **Home Dashboard (`HomeScreen.tsx`)**:
  - Live **AI Executive Daily Briefing** widget with 1-tap refresh.
  - Active tasks count & campus attendance rate gauges.
  - Quick action routing.
- **Homework & Rubrics (`HomeworkScreen.tsx`)**:
  - Filter tabs: *All*, *To Do*, *Under Review*, *Completed*.
  - **Student Flow**: Modal to submit solution text & attach Google Drive / assignment links.
  - **Teacher Flow**: Modal to grade homework across 4 criteria (Accuracy /25, Completeness /25, Formatting /25, Effort /25) and approve completed tasks.
- **Class Attendance (`AttendanceScreen.tsx`)**:
  - **Teacher Flow**: 1-Click attendance tracker with `Present`, `Absent`, `Late`, `Excused` toggles and batch save.
  - Low Attendance (<75%) warning banner for HODs and Principals.
  - **Parent Flow**: Monthly attendance percentage gauge and 30-day class history.
- **Messages & Channels (`ChannelsScreen.tsx` & `ChatRoomScreen.tsx`)**:
  - Academic wings, class sections, and Direct Messages.
  - Full-featured mobile chat room with real-time send/receive.
- **AI Academic Assistant (`AIScreen.tsx`)**:
  - Mobile AI chat assistant with prompt chips for quiz generation, homework tracking, and notice drafting.
- **Account & Settings (`ProfileScreen.tsx`)**:
  - Profile card & organization role badge.
  - **Live / Local Backend Switcher**: 1-tap switch between Cloud Run production backend and local emulator.
  - Dark / Light theme toggle.

---

## 🌐 Backend Connectivity

- **Default Server**: `https://convee-education-977864306871.asia-south1.run.app/api/v1`
- **Local Emulator**: `http://10.0.2.2:8001/api/v1`
- **Custom Local LAN**: Switchable in real-time from the **Profile** screen.
