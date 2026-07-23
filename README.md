# SubTracker

A premium subscription‑management app for iOS and Android. Track recurring payments, get renewal reminders, and visualise your spending — all data stored locally on‑device.

![Expo SDK 57](https://img.shields.io/badge/Expo-57-black) ![React Native](https://img.shields.io/badge/React%20Native-0.86-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue) ![License](https://img.shields.io/badge/License-MIT-green)

---

## Features

- **Subscription Tracking** – add paid subscriptions and free trials with full billing details
- **Smart Reminders** – local push notifications before renewals (configurable from same‑day to 30 days)
- **Analytics Dashboard** – spending by category, billing‑cycle breakdown, average cost per sub
- **Swipe to Delete** – quick swipe actions on subscription cards
- **Long‑Press Menu** – view / edit / delete options
- **Edit Subscriptions** – pre‑populated forms for updating existing entries
- **Export / Import** – backup data as JSON and restore on another device
- **Onboarding** – four‑slide intro flow on first launch
- **Dark Mode** – iOS‑style dark theme with glassmorphism effects
- **Offline‑First** – all data stored in SQLite on‑device, no account required

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Expo SDK 57, React Native 0.86, React 19 |
| **Navigation** | Expo Router (file‑based) |
| **State** | Zustand 5 |
| **Database** | Expo SQLite |
| **Forms** | React Hook Form + Zod 4 |
| **Styling** | NativeWind (Tailwind‑CSS) + StyleSheet |
| **Animations** | React Native Reanimated 4 |
| **Gestures** | React Native Gesture Handler |
| **Notifications** | Expo Notifications (local) |
| **Icons** | Lucide React Native |
| **Date Utils** | date‑fns 4 |

---

## Prerequisites

- **Node.js** 22.13+ and **npm** (or yarn/pnpm/bun)
- **Expo CLI** – `npm install -g expo-cli` (optional, `npx expo` works too)
- **iOS**: Xcode 16.4+ and **CocoaPods**
- **Android**: Android Studio with **SDK 36** and **JDK 17+**

---

## Installation

```bash
# Clone the repository
git clone https://github.com/your-username/subscription.git
cd subscription

# Install JavaScript dependencies
npm install
```

---

## Running the App

### 1. Expo Go (quickest, development‑only)
```bash
npx expo start
```
Scan the QR code with the Expo Go app. Limited to features that Expo Go supports (no push notifications).

### 2. iOS Simulator (full native stack)
```bash
npx expo start          # start Metro
npx expo run:ios       # builds & runs in the simulator
```

### 3. Android Emulator
```bash
npx expo start          # start Metro
npx expo run:android   # builds & runs in the emulator
```

### 4. Physical Device – Development Build (cable)
For full native capabilities (push notifications, local storage) create a **development build**.
```bash
# Install EAS CLI once
npm install -g eas-cli

eas login

eas build --profile development --platform ios   # or --platform android
```
When the build finishes, install the generated `.ipa`/`.apk` on your device (via USB or TestFlight).

#### Debug (cable + Metro)
```bash
npm start                     # keep Metro running
npx expo run:ios --device    # or npx expo run:android --device
```
Uses a **Debug** build that talks to Metro.

#### Release (standalone) – JS bundled inside the app
```bash
npx expo run:ios --device --configuration Release
```
The app works without Metro; ideal for final‑user testing.

---

## Clean Pre‑build & Re‑signing
If you modify native configuration (e.g., `app.json`, icons, bundle identifier, plugins) run:
```bash
npx expo prebuild --clean
```
After the clean pre‑build, verify Xcode signing:
1. Open `ios/subscription.xcworkspace` in Xcode.
2. Select the **subscription** target → **Signing & Capabilities**.
3. Enable **Automatically manage signing**.
4. Choose your Apple‑ID team.
5. Ensure the bundle identifier matches `com.tirtharajbarma.subscription`.
6. For a free Apple ID, **remove the Push Notifications capability** (not supported for free signing).

---

## 7‑Day Re‑signing (Free Apple ID)
Free Apple‑ID provisioning profiles expire after ~7 days. To keep the app running:
1. Connect the iPhone via USB.
2. Re‑run the release command:
```bash
npx expo run:ios --device --configuration Release
```
Xcode will generate a fresh development profile and reinstall the app.

---

## Project Structure (high‑level)
```
subscription/
├─ app/                  # Expo Router screens
│  ├─ _layout.tsx       # Root stack + DB init + onboarding check
│  ├─ onboarding.tsx    # Intro flow
│  └─ (tabs)/
│     ├─ _layout.tsx    # Bottom tab bar
│     ├─ index.tsx      # Home – list + stats
│     ├─ analytics.tsx  # Dashboard
│     └─ settings.tsx   # Export/Import, preferences
├─ components/          # UI components (cards, forms, etc.)
├─ constants/           # Design tokens (colors, spacing, typography)
├─ database/            # SQLite schema & queries
├─ store/               # Zustand stores
├─ types/               # TypeScript interfaces
├─ utils/               # Helpers (date, notifications, math)
└─ assets/data/         # Service catalog (50+ services)
```

---

## Key Commands
```bash
npm start                # Start Expo dev server (Metro)
npm run ios              # Launch iOS simulator
npm run android          # Launch Android emulator
npx expo run:ios --device                         # Debug build on a connected iPhone
npx expo run:ios --device --configuration Release   # Release (standalone) build
npm run typecheck        # TypeScript checking
npm run lint             # ESLint
```

---

## Troubleshooting (selected)

| Issue | Fix |
|-------|-----|
| `npm install` fails | Delete `node_modules` and `package-lock.json`, then run `npm install` again |
| iOS build fails | Run `cd ios && pod install` or delete `ios/` and run `npx expo prebuild` |
| iPhone shows **No script URL provided** | You ran a Debug build without Metro. Use the Release command for a standalone app |
| Free Apple ID signing fails with Push Notifications | Remove the Push Notifications capability and omit the `expo-notifications` plugin for the free‑signed build |
| Android build fails | Ensure Android Studio SDK 36 is installed, then run `npx expo prebuild` |
| Notifications not working | Use a development build (EAS) instead of Expo Go |
| TypeScript errors | Run `npm run typecheck` to view them |

---

## Contributing
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m "Add my feature"`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## License
MIT

---

