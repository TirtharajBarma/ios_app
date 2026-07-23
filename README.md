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

Built with [Expo](https://expo.dev) and [React Native](https://reactnative.dev).


A premium subscription management app for iOS and Android. Track recurring payments, get renewal reminders, and visualize your spending — all data stored locally on‑device.

![Expo SDK 57](https://img.shields.io/badge/Expo-57-black) ![React Native](https://img.shields.io/badge/React%20Native-0.86-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue) ![License](https://img.shields.io/badge/License-MIT-green)

---

## Features

- **Subscription Tracking** – Add paid subscriptions and free trials with full billing details
- **Smart Reminders** – Local push notifications before renewals (configurable: same day to 30 days)
- **Analytics Dashboard** – Spending by category, billing cycle breakdown, average cost per sub
- **Swipe to Delete** – Quick swipe actions on subscription cards
- **Long‑Press Menu** – Context menu with View, Edit, Delete options
- **Edit Subscriptions** – Pre‑populated forms for updating existing subscriptions
- **Export/Import** – Backup your data as JSON, share across devices
- **Onboarding** – Beautiful 4‑slide intro flow on first launch
- **Dark Mode** – Premium iOS‑style dark theme with glassmorphism effects
- **Offline‑First** – All data stored in SQLite on‑device, no account required

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo SDK 57, React Native 0.86, React 19 |
| Navigation | Expo Router (file‑based) |
| State | Zustand 5 |
| Database | Expo SQLite |
| Forms | React Hook Form + Zod 4 |
| Styling | NativeWind (Tailwind‑CSS) + StyleSheet |
| Animations | React Native Reanimated 4 |
| Gestures | React Native Gesture Handler |
| Notifications | Expo Notifications (local) |
| Icons | Lucide React Native |
| Date Utils | date‑fns 4 |

---

## Prerequisites

- **Node.js** 22.13+ and **npm** (or yarn/pnpm/bun)
- **Expo CLI** – `npm install -g expo-cli` (optional, `npx expo` works too)
- **iOS**: Xcode 16.4+ and **CocoaPods**
- **Android**: Android Studio with **SDK 36** and **JDK 17+**

---

## Installation

```bash
# Clone the repo
git clone https://github.com/your-username/subscription.git
cd subscription

# Install dependencies
npm install
```

---

## Running the App

### 1. Expo Go (quick development, limited features)
```bash
npx expo start
```
Scan the QR code with the Expo Go app.

### 2. iOS Simulator (full native features)
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
For full native capabilities (push notifications, local storage) you need a **development build**.

```bash
# Install EAS CLI (once)
npm install -g eas-cli

eas login

eas build --profile development --platform ios   # or --platform android
```
When the build finishes, install the generated `.ipa`/`.apk` on your device (USB cable or TestFlight).

#### Development with cable & Metro (debug)
```bash
npm start                     # keep Metro running
npx expo run:ios --device    # or npx expo run:android --device
```
This uses a **Debug** build that talks to Metro.

#### Release (standalone) build – JS bundled inside the app
```bash
npx expo run:ios --device --configuration Release
```
The app works without Metro; ideal for testing the final user experience.

---

## Clean Pre‑build & Re‑Signing

If you change native configuration (e.g., `app.json`, bundle identifier, icons, plugins) run:
```bash
npx expo prebuild --clean
```
After a clean pre‑build you will need to re‑check the Xcode signing settings:
1. Open `ios/subscription.xcworkspace` in Xcode.
2. Select the **subscription** target → **Signing & Capabilities**.
3. Enable **Automatically manage signing**.
4. Choose your Apple‑ID team.
5. Ensure the bundle identifier matches `com.tirtharajbarma.subscription`.
6. If you are using a free Apple ID, **remove the Push Notifications capability** (it isn’t supported for free signing).

---

## 7‑Day Re‑Signing (Free Apple ID)

When you sign an app with a free Apple ID the provisioning profile expires after ~7 days. To continue using the app:
1. Connect the iPhone via USB.
2. Run the same Release command again:
```bash
npx expo run:ios --device --configuration Release
```
Xcode will re‑generate a fresh development profile and reinstall the app.

---

## Project Structure (high‑level)
```
subscription/
├─ app/                  # Expo Router screens
│  ├─ _layout.tsx       # Root stack + DB init + onboarding check
│  ├─ onboarding.tsx    # Intro flow
│  └─ (tabs)/
│     ├─ _layout.tsx    # Bottom tab bar
│     ├─ index.tsx       # Home – list + stats
│     ├─ analytics.tsx  # Dashboard
│     └─ settings.tsx     # Export/Import, preferences
├─ components/           # UI components (cards, forms, common)
├─ constants/            # Design tokens (colors, spacing, typography)
├─ database/             # SQLite schema & queries
├─ store/                # Zustand stores
├─ types/                # TypeScript interfaces
├─ utils/                # Helpers (date, notifications, math)
└─ assets/data/          # Service catalog (50+ services)
```

---

## Key Commands

```bash
npm start                # Start Expo dev server (Metro)
npm run ios              # iOS simulator
npm run android          # Android emulator
npx expo run:ios --device                         # Debug build on a connected iPhone
npx expo run:ios --device --configuration Release   # Release build (standalone)
npm run typecheck        # TypeScript checking
npm run lint             # ESLint
```

---

## Troubleshooting (selected)

| Issue | Fix |
|-------|-----|
| `npm install` fails | Delete `node_modules` and `package-lock.json`, then run `npm install` again |
| iOS build fails | Run `cd ios && pod install` or delete `ios/` and execute `npx expo prebuild` |
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

Built with [Expo](https://expo.dev) and [React Native](https://reactnative.dev).


A premium subscription management app for iOS and Android. Track recurring payments, get renewal reminders, and visualize your spending — all data stored locally on-device.

![Expo SDK 57](https://img.shields.io/badge/Expo-57-black)
![React Native](https://img.shields.io/badge/React%20Native-0.86-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Features

- **Subscription Tracking** — Add paid subscriptions and free trials with full billing details
- **Smart Reminders** — Local push notifications before renewals (configurable: same day to 30 days)
- **Analytics Dashboard** — Spending by category, billing cycle breakdown, average cost per sub
- **Swipe to Delete** — Quick swipe actions on subscription cards
- **Long-Press Menu** — Context menu with View, Edit, Delete options
- **Edit Subscriptions** — Pre-populated forms for updating existing subscriptions
- **Export/Import** — Backup your data as JSON, share across devices
- **Onboarding** — Beautiful 4-slide intro flow on first launch
- **Dark Mode** — Premium iOS-style dark theme with glassmorphism effects
- **Offline-First** — All data stored in SQLite on-device, no account required

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo SDK 57, React Native 0.86, React 19 |
| Navigation | Expo Router (file-based) |
| State | Zustand 5 |
| Database | Expo SQLite |
| Forms | React Hook Form + Zod 4 |
| Styling | NativeWind (Tailwind CSS) + StyleSheet |
| Animations | React Native Reanimated 4 |
| Gestures | React Native Gesture Handler |
| Notifications | Expo Notifications (local) |
| Icons | Lucide React Native |
| Date Utils | date-fns 4 |

---

## Prerequisites

- **Node.js** 22.13+ and **npm** (or yarn/pnpm/bun)
- **Expo CLI** — `npm install -g expo-cli` (optional, `npx expo` works too)
- For iOS: **Xcode 16.4+** and **CocoaPods**
- For Android: **Android Studio** with **SDK 36** and **JDK 17+**

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/your-username/subscription.git
cd subscription
```

### 2. Install dependencies

```bash
npm install
```

### 3. Install Expo CLI (if not installed)

```bash
npm install -g expo-cli
```

---

## Running the App

### Expo Go (Quickest — Development Only)

```bash
npx expo start
```

Scan the QR code with the Expo Go app on your phone. Limited to features supported by Expo Go (no push notifications).

### iOS Simulator

```bash
# Start Expo in dev mode
npx expo start

# Or run directly in the simulator
npx expo run:ios
```

Requires Xcode 16.4+ and CocoaPods. First run may take a few minutes to install pods.

### Android Emulator

```bash
# Start Expo in dev mode
npx expo start

# Or run directly on the emulator
npx expo run:android
```

Requires Android Studio with SDK 36 and an active emulator.

### iOS/Android Physical Device (Development Build)

For full features (local notifications, haptics), create a development build:

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Create a development build
eas build --profile development --platform ios
# or
eas build --profile development --platform android
```

### iPhone With Cable: Development vs Standalone

Use **Debug** while developing. Debug builds need Metro, so keep `npm start` running:

```bash
npm start
npx expo run:ios --device
```

Use **Release** when you want the installed iPhone app to work without your Mac or Metro. Release embeds the JS bundle inside the app:

```bash
npx expo run:ios --device --configuration Release
```

With a free Apple ID, the installed app may expire after about 7 days. To re-sign it, plug the iPhone into the Mac and run the same Release command again:

```bash
npx expo run:ios --device --configuration Release
```

Do not run clean prebuild for normal JS/UI changes. Use this only after native config changes such as `app.json`, plugins, bundle id, icons, permissions, or native modules:

```bash
npx expo prebuild --clean
```

After `prebuild --clean`, Xcode signing may need to be checked again:

- Enable **Automatically manage signing**
- Select your Apple ID team
- Use bundle id `com.tirtharajbarma.subscription`
- Remove **Push Notifications** capability for free Apple ID signing

---

## Project Structure

```
subscription/
├── app/                          # Expo Router screens
│   ├── _layout.tsx               # Root stack + DB init + onboarding check
│   ├── onboarding.tsx            # First-launch intro flow
│   ├── (tabs)/
│   │   ├── _layout.tsx           # Bottom tab bar (Overview, Analytics, Settings)
│   │   ├── index.tsx             # Home screen — subscription list + stats
│   │   ├── analytics.tsx         # Spending analytics dashboard
│   │   └── settings.tsx          # App settings, export/import
│   ├── add/
│   │   ├── search.tsx            # Browse/search services
│   │   ├── select.tsx            # Choose paid or free trial
│   │   ├── paid.tsx              # Add paid subscription form
│   │   └── trial.tsx             # Add free trial form
│   └── subscription/
│       └── [id].tsx              # Subscription detail + edit + delete
│
├── components/
│   ├── ui/                       # 19 reusable design system components
│   ├── cards/                    # Domain-specific card components
│   ├── common/                   # Shared composition components
│   └── form/                     # Form field components
│
├── constants/                    # Design tokens (colors, spacing, typography, etc.)
├── database/                     # SQLite schema, migrations, queries, seed data
├── store/                        # Zustand state management
├── types/                        # TypeScript domain types
├── utils/                        # Date helpers, notifications, subscription math
└── assets/
    └── data/                     # Service catalog (50+ services)
```

---

## Architecture

```
┌─────────────────────────────────────────────┐
│                   UI Layer                   │
│  Screens → Components → Design Tokens       │
├─────────────────────────────────────────────┤
│               State Layer (Zustand)          │
│  useSubscriptionStore                       │
├─────────────────────────────────────────────┤
│             Persistence Layer                │
│  expo-sqlite → migrations → queries         │
└─────────────────────────────────────────────┘
```

- **Write-through pattern**: Every state mutation (add/edit/delete) writes to SQLite first, then updates the in-memory Zustand state
- **Single source of truth**: `types/subscription.ts` defines the canonical `Subscription` interface shared across all layers
- **Design tokens**: All colors, spacing, typography, and shadows live in `constants/` — no hardcoded values in components

---

## Key Commands

```bash
npm start              # Start Expo dev server
npm run ios            # Run on iOS simulator
npm run android        # Run on Android emulator
npx expo run:ios --device                         # Debug iPhone build, needs npm start / Metro
npx expo run:ios --device --configuration Release # Standalone iPhone build, works without Metro
npm run typecheck      # TypeScript type checking
npm run lint           # ESLint
```

---

## How It Works

### Adding a Subscription

1. Tap **Add Subscription** on the home screen
2. Browse or search for a service (Netflix, Spotify, etc.)
3. Choose **Paid** or **Free Trial**
4. Fill in the form (price, billing cycle, payment method, reminders)
5. Submit — saved to SQLite, appears in the list

### Editing a Subscription

1. Tap a subscription card to open details
2. Tap **Edit** in the top right
3. Form opens pre-filled with existing data
4. Update and submit

### Deleting a Subscription

- **Swipe left** on any card in the list, or
- Open detail screen and tap **Delete Subscription**

### Reminders

When adding/editing a subscription, toggle **Enable Reminder** and choose when to be notified (same day, 1 day before, etc.). Notifications are scheduled locally on the device.

---

## Design System

The app uses a dark-mode-first design system following Apple's Human Interface Guidelines:

| Token | Values |
|-------|--------|
| Background | `#000000` (pure black) |
| Surface | `#1C1C1E` |
| Card | `#232325` |
| Accent | `#0A84FF` (iOS blue) |
| Success | `#30D158` |
| Warning | `#FFD60A` |
| Danger | `#FF453A` |
| Typography | SF Pro scale (largeTitle 34pt → caption2 11pt) |

---

## Environment Variables

No environment variables needed. The app is fully offline-first.

---

## Building for Production

### iOS

```bash
eas build --platform ios --profile production
```

### Android

```bash
eas build --platform android --profile production
```

### Local Builds (without EAS)

```bash
# iOS simulator/device Release build
npx expo run:ios --configuration Release

# iPhone Release build that embeds JS and works without npm start
npx expo run:ios --device --configuration Release

# Android
npx expo run:android --variant release
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `npm install` fails | Delete `node_modules` and `package-lock.json`, then `npm install` again |
| iOS build fails | Run `cd ios && pod install` or delete `ios/` and run `npx expo prebuild` |
| iPhone shows `No script URL provided` | You installed a Debug build without Metro. Run `npx expo run:ios --device --configuration Release` for standalone use |
| Free Apple ID signing fails with Push Notifications | Remove the Push Notifications capability and do not include the `expo-notifications` config plugin for the free-signed build |
| Android build fails | Ensure Android Studio SDK 36 is installed, run `npx expo prebuild` |
| Notifications not working | Use a development build, not Expo Go |
| TypeScript errors | Run `npm run typecheck` to see all errors |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## License

MIT

---

Built with [Expo](https://expo.dev) and [React Native](https://reactnative.dev).
