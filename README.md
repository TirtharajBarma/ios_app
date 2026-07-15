# SubTracker

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
# iOS
npx expo run:ios --configuration Release

# Android
npx expo run:android --variant release
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `npm install` fails | Delete `node_modules` and `package-lock.json`, then `npm install` again |
| iOS build fails | Run `cd ios && pod install` or delete `ios/` and run `npx expo prebuild` |
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
