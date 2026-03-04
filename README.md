# 🔔 RallyRing - Smart Group Rally System

RallyRing is a high-performance, real-time mobile application designed to "Rally" groups of people instantly. Whether it's for a quick lunch, an emergency meeting, or a spontaneous hangout, RallyRing bypasses the "text message noise" by triggering full-screen, persistent call notifications on members' devices with live status tracking.

---

## 🚀 The Core Idea
In modern messaging, critical "Join me now" requests often get lost in a sea of notifications. RallyRing solves this by treating a group call like a real phone call. 
- **Instant Urgency**: Notifications play a custom ringtone and show up full-screen.
- **Immediate Context**: The caller specifies a *Reason* (e.g., "Food is here!") so others know why to join.
- **Live Accountability**: Everyone in the group can see who has Accepted, who is Pending, and who Rejected in real-time.

---

## 🛠 Tech Stack

### Frontend (Mobile App)
- **Framework**: [React Native](https://reactnative.dev/) (v0.74+) with TypeScript.
- **Navigation**: [React Navigation](https://reactnavigation.org/) with Gesture Handler for smooth transitions.
- **State Management**: [Zustand](https://github.com/pmndrs/zustand) with Persistence (AsyncStorage) – Ensures you stay logged in even after closing the app.
- **Push Notifications**: [Firebase Cloud Messaging (FCM)](https://rnfirebase.io/messaging/usage).
- **Notification UI**: [@notifee/react-native](https://notifee.app/) – Used for high-priority full-screen intents and foreground services.
- **Database (Real-time)**: [Firebase Firestore](https://rnfirebase.io/firestore/usage) – Syncs "Who's joining" status across all devices in < 100ms.
- **Icons**: [Lucide React Native](https://lucide.dev/).

### Backend (API)
- **Runtime**: [Node.js](https://nodejs.org/) & [Express](https://expressjs.com/).
- **Language**: [TypeScript](https://www.typescriptlang.org/).
- **Deployment**: [Vercel](https://vercel.com/) (Serverless functions).
- **Service**: [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup) – Handles secure notification dispatching.

---

## 📦 Key Libraries & Their Purpose

| Library | Why we use it? |
| :--- | :--- |
| **react-native-firebase** | The bridge to Google Firebase. Handles UIDs, Firestore data, and Push Token registration. |
| **@notifee/react-native** | Essential for the "Call" experience. It allows the notification to wake up the screen and show "Accept/Reject" buttons. |
| **zustand/persist** | Stores your Name and UID locally on the phone. This is why the app doesn't ask for your name every time you open it. |
| **lucide-react-native** | Provides the modern, clean icons (Phone, Trash, Users, etc.). |
| **axios** | Handles communication between the App and the Vercel Backend. |

---

## 🔄 App Workflow

1.  **Onboarding**: 
    - User enters First and Last Name.
    - App requests Notification Permissions immediately.
    - A unique 8-character UID is generated and saved in Firestore/Local Storage.
2.  **Group Management**:
    - Users can create a Group (generates a 6-digit Invite Code).
    - Others join using that Code.
    - The creator is assigned as **Admin** (can delete group).
3.  **The Rally (The Call)**:
    - User opens a group, selects which members to notify (Selective Calling).
    - User enters a **Reason** and presses "START RALLY CALL".
    - **Backend**: Finds FCM tokens for selected members -> Dispatches High-Priority "Data" message.
    - **Receivers**: Their phones ring (custom `ringtone.mp3`) and show a full-screen UI.
4.  **Live Feedback**:
    - As people click "Accept" or "Reject", Firestore updates the `call_session`.
    - Every phone in the group updates live to show who is coming.

---

## ⚙️ Installation & Setup

### Prerequisites
- Node.js (v18+)
- Android Studio (for APK building)
- Firebase Project (with Android App + Service Account JSON)

### Backend Setup
1. `cd backend`
2. `npm install`
3. Add your `service-account.json` (from Firebase Console -> Project Settings -> Service Accounts).
4. `npm run dev` or deploy to Vercel.

### Frontend Setup
1. `cd frontend`
2. `npm install`
3. Add your `google-services.json` to `android/app/`.
4. Run locally: `npx react-native run-android`.
5. Build Release APK: `cd android && ./gradlew assembleRelease`.

---

## 🔒 Security & Privacy
- **Zero Login**: No email or password required. Your UID is tied to your device.
- **Privacy**: No tracking. Only your Name and FCM token are stored to enable the call feature.
- **Infrastructure**: Powered by Google Cloud (Firebase) for world-class security.

---

*Created with ❤️ by Harsh Gosaliya*
