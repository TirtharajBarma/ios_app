# The Complete EAS Update & OTA Architecture Master Guide
> **The Zero-Guesswork Blueprint for Over-The-Air (OTA) Updates in Expo / React Native Apps**
> *Drop this file into any new Expo project, and any AI or engineer will be able to implement, configure, and maintain flawless EAS Updates without missing a single edge case.*

---

## Table of Contents
1. [Mental Model & How EAS Update Works Under the Hood](#1-mental-model--how-eas-update-works-under-the-hood)
2. [Pros, Cons & Hard Limitations](#2-pros-cons--hard-limitations)
3. [Versioning Architecture: `runtimeVersion`, `appVersion`, and `set-version`](#3-versioning-architecture-runtimeversion-appversion-and-set-version)
4. [Project Configurations (`app.json` & `eas.json`)](#4-project-configurations-appjson--easjson)
5. [Automated Publishing & Version Synchronization Scripts](#5-automated-publishing--version-synchronization-scripts)
6. [Constants & Release History Store (`constants/version.ts`)](#6-constants--release-history-store-constantsversionts)
7. [The Core Update Engine (`services/updates/updateManager.ts`)](#7-the-core-update-engine-servicesupdatesupdatemanagerts)
8. [App Lifecycle & Startup Integration (`app/_layout.tsx`)](#8-app-lifecycle--startup-integration-app_layouttsx)
9. [Apple HIG Native Software Update Screen (`app/settings/updates.tsx`)](#9-apple-hig-native-software-update-screen-appsettingsupdatestsx)
10. [Native Plugins & Edge-Case Safeguards](#10-native-plugins--edge-case-safeguards)
11. [Step-by-Step Setup Runbook for a New Expo App](#11-step-by-step-setup-runbook-for-a-new-expo-app)
12. [Troubleshooting & Emergency Cheat Sheet](#12-troubleshooting--emergency-cheat-sheet)

---

## 1. Mental Model & How EAS Update Works Under the Hood

### The Architecture: Shell vs Bundle
A compiled React Native mobile application consists of two distinct layers:
1. **The Native Binary Shell (The "House")**:
   - Compiled Objective-C/Swift (iOS) and Java/Kotlin/C++ (Android).
   - Native modules (`expo-sqlite`, `react-native-reanimated`, camera, biometrics, etc.).
   - App permissions, `Info.plist`, `AndroidManifest.xml`, app icons, splash screens.
   - Built via `eas build` or Xcode / Android Studio, packaged as `.ipa` or `.apk`/`.aab`.
2. **The JavaScript Bundle & Assets (The "Furniture")**:
   - All your React components, hooks, Zustand/Redux stores, CSS/Tailwind styles.
   - Inlined static assets (images, fonts, JSON vectors).
   - Bundled by Metro into a single Hermes bytecode bundle.

```
┌────────────────────────────────────────────────────────┐
│               MOBILE DEVICE (iOS / Android)            │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Native Shell (Runtime Version: "1")       │  │
│  │   [React Native Engine, SQLite, Haptics, Pods]   │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │   Active JavaScript Bundle (Hermes Bytecode)│  │  │
│  │  │   • Screen components & hooks              │  │  │
│  │  │   • Business logic & state management      │  │  │
│  │  │   • Styles & embedded UI assets            │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────┘  │
└───────────────────────────▲────────────────────────────┘
                            │
              EAS Update Protocol (HTTPS)
                            │
┌───────────────────────────┴────────────────────────────┐
│                  EXPO CLOUD SERVERS                    │
│   https://u.expo.dev/<project-id>                      │
│   • Channel: "preview" / "production"                  │
│   • Target Runtime: "1"                                │
│   • Manifest: JS Bundle URL + Asset Hashes + Metadata  │
└────────────────────────────────────────────────────────┘
```

### The Update Lifecycle
1. **Cold Launch (App Start)**:
   - When the user launches the app, the native shell boots.
   - If `checkAutomatically: "ON_LOAD"` is enabled, `expo-updates` sends an HTTP query to `https://u.expo.dev/<projectId>` with headers specifying the channel and runtime version.
   - **Non-blocking Timeout (`fallbackToCacheTimeout: 3000`)**: If the server responds within 3 seconds with a new update manifest, it downloads the new bundle before showing the first screen. If the request takes longer or the device is offline, the app **instantly boots the existing cached/embedded bundle**. The user never sees a stalled blank screen.
2. **Background Discovery & Auto-Apply**:
   - During runtime, `checkAndAutoApplyUpdates()` queries `Updates.checkForUpdateAsync()`.
   - If a new update is found, it downloads assets quietly in the background via `Updates.fetchUpdateAsync()`.
   - Once downloaded, the update sits ready in local storage.
   - The user can tap **"Restart to Update"** (which calls `Updates.reloadAsync()`), OR the system will automatically apply it after a 48-hour cooldown on next cold start.

---

## 2. Pros, Cons & Hard Limitations

### The Pros (Why this pattern is magical)
- **Instant Hotfixes**: Bypass Apple App Store (24–48 hr) and Google Play (several hr) review bottlenecks. Fix critical calculation bugs, layout glitches, or API URL changes in under 60 seconds.
- **Unified Cross-Platform Release**: One terminal command pushes the fix to both iOS and Android simultaneously.
- **Bandwidth Efficiency**: Expo only downloads modified bundle chunks and new assets that the client does not already have in its local cache.
- **Zero Sideload Friction for Testers**: Testers with internal APKs or TestFlight/sideloaded IPAs get instant updates without reinstalling packages.

### The Cons & Gotchas
- **Cold-Start Latency Risk**: If `fallbackToCacheTimeout` is omitted or set too high, devices on poor 3G connections could freeze on splash screen waiting for network responses.
- **Disk Storage**: Older downloaded bundles must be pruned (handled automatically by `expo-updates`, but custom local storage caches must be cleaned).
- **Silent Failures if Untracked**: If an update has a fatal JavaScript syntax or rendering exception, the app could crash on reload. (Expo has built-in rollback to embedded bundle if an update crashes on launch, but defensive coding is essential).

### ⚠️ Hard Limitations: When OTA CANNOT Be Used
You **CANNOT** use EAS Update for:
| Change Type | Can OTA Update? | Action Required |
|---|:---:|---|
| Modifying React components, hooks, UI styles | ✅ **YES** | `npm run update "v1.2.3: Fix UI"` |
| Fixing business calculations, state stores, strings | ✅ **YES** | `npm run update "v1.2.3: Fix bug"` |
| Adding new images/assets imported in JS | ✅ **YES** | `npm run update "v1.2.3: New illustrations"` |
| Adding a new native package (`npx expo install ...`) | ❌ **NO** | Must build a new native binary (`APK`/`IPA`) |
| Modifying `Info.plist` or `AndroidManifest.xml` | ❌ **NO** | Must build a new native binary |
| Modifying App Permissions (Camera, FaceID, Location) | ❌ **NO** | Must build a new native binary |
| Modifying App Icon or Native Splash Screen color | ❌ **NO** | Must build a new native binary |
| Modifying Custom Config Plugins (`plugins/*.js`) | ❌ **NO** | Must build a new native binary |
| Upgrading Expo SDK (e.g. SDK 56 to 57) | ❌ **NO** | Must build a new native binary |

> [!CAUTION]
> **What happens if you push native changes via OTA?**
> If you add a package like `expo-camera` in JavaScript, do not rebuild the binary, and push an EAS update to an existing binary, the JavaScript code will call `NativeModules.ExpoCamera`, which will evaluate to `undefined`. The app will crash immediately upon launching the update!

### App Store Guideline Compliance (Apple Guideline 3.3.2)
Apple explicitly allows OTA updates via JavaScript engines (like React Native and WebViews) under Section 3.3.2 of the Apple Developer Program License Agreement, provided:
- The update does **not** change the primary purpose or category of the app.
- The update does **not** introduce prohibited features (e.g., hidden external payment gateways bypassing IAP if digital goods are sold).

---

## 3. Versioning Architecture: `runtimeVersion`, `appVersion`, and `set-version`

Understanding the difference between these three numbers is where 95% of developers get confused:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. MARKETING / SEMANTIC VERSION (e.g., "1.2.2")                            │
│    Location: package.json ("version"), app.json ("expo.version")            │
│    Purpose: Displayed to the user on the App Store, Settings, and UI.       │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. NATIVE BINARY BUILD NUMBER (e.g., iOS build "1", Android versionCode 1)  │
│    Location: app.json ("ios.buildNumber", "android.versionCode")            │
│    Purpose: Store ingestion requirement; increments on every native build.  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. RUNTIME VERSION (e.g., "1")                                              │
│    Location: app.json ("expo.runtimeVersion")                               │
│    Purpose: The compatibility bridge between the Native Shell and JS bundle.│
│    RULE: An OTA update with runtimeVersion "1" can ONLY be installed by a   │
│          native app that was built with runtimeVersion "1".                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Why We Use Fixed String `runtimeVersion: "1"`
Expo allows three policies for `runtimeVersion`:
1. `{"policy": "appVersion"}`: Binds runtime version to marketing version (e.g. `"1.2.2"`). **BAD FOR OTA**: If you increment marketing version to `1.2.3` for a minor bugfix, existing `1.2.2` installs will refuse to download the update!
2. `{"policy": "fingerprint"}`: Generates a hash of native code. Excellent, but can be brittle if git line endings or dev machines differ slightly.
3. **Explicit Fixed String (Recommended: `"1"`, `"2"`, `"3"`)**:
   - You set `"runtimeVersion": "1"` in `app.json`.
   - All OTA updates target runtime `"1"`.
   - You can push version `1.0.1`, `1.1.0`, `1.2.5` over the air to that exact same native binary.
   - When—and only when—you add a new native dependency or change native plugins, you increment to `"runtimeVersion": "2"`, compile a new native APK/IPA, and from then on, all new updates target `"2"`.

---

## 4. Project Configurations (`app.json` & `eas.json`)

### `app.json` Configuration
Add the following blocks to `app.json`:

```json
{
  "expo": {
    "name": "YourApp",
    "slug": "your-app-slug",
    "version": "1.0.0",
    "owner": "your-expo-username",
    "runtimeVersion": "1",
    "updates": {
      "url": "https://u.expo.dev/<YOUR_EAS_PROJECT_ID>",
      "requestHeaders": {
        "expo-channel-name": "preview"
      },
      "checkAutomatically": "ON_LOAD",
      "fallbackToCacheTimeout": 3000
    },
    "extra": {
      "eas": {
        "projectId": "<YOUR_EAS_PROJECT_ID>"
      },
      "updateVersion": "v1.0.0",
      "updateDescription": "Initial release",
      "updateNotes": [
        "Base release"
      ],
      "easUpdateMessage": "v1.0.0: Initial release"
    }
  }
}
```

> [!IMPORTANT]
> **Why `requestHeaders: { "expo-channel-name": "preview" }`?**
> When you build a local `.apk` or build a sideloadable `.ipa` without EAS Cloud build flags, the binary might not have an embedded channel string. Setting this request header ensures the app **always asks the server for the preview channel**, making ad-hoc and sideloaded builds update reliably.

---

### `eas.json` Configuration
Define your build profiles and channel bindings:

```json
{
  "cli": {
    "version": ">= 3.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "channel": "development"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      },
      "channel": "preview"
    },
    "production": {
      "channel": "production"
    }
  }
}
```

---

## 5. Automated Publishing & Version Synchronization Scripts

Instead of manually editing 4 different files whenever you publish an update, we automate everything with two Node.js scripts in `scripts/`.

### 1. `scripts/publish-update.js` (For OTA Updates)
Creates atomic synchronization across `package.json`, `app.json`, and `constants/version.ts`, then publishes to EAS without shell escaping bugs.

```javascript
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const messageArg = args.join(' ').trim();

if (!messageArg) {
  console.error('\x1b[31m[Error] Please provide a release message.\x1b[0m');
  console.log('\x1b[33mUsage:\x1b[0m npm run update "v1.0.1: Fix navigation glitch and improve performance"');
  process.exit(1);
}

// 1. Extract version tag (e.g., "v1.0.1")
const versionMatch = messageArg.match(/(?:^|[\s:(\[-])(?:version|ver|v)?\s*(\d+\.\d+(?:\.\d+)?)/i);
const extractedVersion = versionMatch ? `v${versionMatch[1]}` : 'v1.0.0';

// 2. Extract description (after ':' or '-')
let description = messageArg;
const colonIdx = messageArg.indexOf(':');
const dashIdx = messageArg.indexOf('-');
if (colonIdx !== -1) {
  description = messageArg.substring(colonIdx + 1).trim();
} else if (dashIdx !== -1) {
  description = messageArg.substring(dashIdx + 1).trim();
}

// 3. Parse individual bullet notes
const noteLines = description
  .split(/[\n•;|]/)
  .map((s) => s.replace(/^[\s•\-\*–—]+\s*/, '').trim())
  .filter((s) => s.length > 0);

const notesArray = noteLines.length > 0 ? noteLines : [description];

// 4. Update constants/version.ts
const versionFilePath = path.join(__dirname, '..', 'constants', 'version.ts');
let currentFile = '';
try {
  currentFile = fs.readFileSync(versionFilePath, 'utf-8');
} catch {}

let updatedContent = currentFile;
if (
  updatedContent.includes('export const CURRENT_RELEASE_VERSION') &&
  updatedContent.includes('export const INITIAL_RELEASE_HISTORY')
) {
  updatedContent = updatedContent.replace(
    /export const CURRENT_RELEASE_VERSION = ".*?";/,
    `export const CURRENT_RELEASE_VERSION = "${extractedVersion}";`
  );
  updatedContent = updatedContent.replace(
    /export const RELEASE_DESCRIPTION = .*?;/,
    `export const RELEASE_DESCRIPTION = ${JSON.stringify(description)};`
  );

  // Prepend to INITIAL_RELEASE_HISTORY if not already present
  if (!updatedContent.includes(`version: "${extractedVersion}"`)) {
    const todayStr = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const formattedNotes = JSON.stringify(notesArray, null, 6).replace(/\n/g, '\n    ');
    const newItemStr = `  {\n    version: "${extractedVersion}",\n    date: "${todayStr}",\n    title: ${JSON.stringify(description)},\n    notes: ${formattedNotes},\n    type: "ota",\n    isNativeBuild: false,\n  },`;

    updatedContent = updatedContent.replace(
      /export const INITIAL_RELEASE_HISTORY: ReleaseHistoryItem\[\] = \[\n/,
      `export const INITIAL_RELEASE_HISTORY: ReleaseHistoryItem[] = [\n${newItemStr}\n`
    );
  }
  fs.writeFileSync(versionFilePath, updatedContent, 'utf-8');
}

// 5. Synchronize package.json and app.json
const semverRaw = extractedVersion.replace(/^v/i, '');
try {
  const pkgPath = path.join(__dirname, '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  pkg.version = semverRaw;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');

  const appJsonPath = path.join(__dirname, '..', 'app.json');
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));
  if (appJson.expo) {
    appJson.expo.version = semverRaw;
    if (!appJson.expo.extra) appJson.expo.extra = {};
    appJson.expo.extra.updateVersion = extractedVersion;
    appJson.expo.extra.updateDescription = description;
    appJson.expo.extra.updateNotes = notesArray;
    appJson.expo.extra.easUpdateMessage = messageArg;
  }
  fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n', 'utf-8');
} catch (e) {
  console.warn('Warning: Could not sync version in package.json/app.json', e);
}

console.log(`\x1b[32m✔ Version synchronized to ${extractedVersion} across version.ts, package.json, and app.json\x1b[0m`);
console.log(`\x1b[36m🚀 Publishing EAS Update to channel preview...\x1b[0m\n`);

// 6. Run eas update via spawnSync to avoid shell metacharacter quoting bugs (&, ', ")
const result = spawnSync(
  'npx',
  ['eas', 'update', '--branch', 'preview', '--environment', 'preview', '--non-interactive', '--message', messageArg],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  }
);

if (result.status !== 0) {
  process.exit(result.status || 1);
}

console.log(`\n\x1b[32m✔ Update ${extractedVersion} published successfully!\x1b[0m`);
```

---

### 2. `scripts/set-version.js` (For Native Binary Builds)
When preparing a native APK or IPA build with new native code, use this to mark the release as a binary release:

```javascript
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const verArg = (args[0] || '').trim();

if (!verArg) {
  console.error('\x1b[31m[Error] Please provide a version number.\x1b[0m');
  console.log('\x1b[33mUsage:\x1b[0m npm run set-version 1.1.0 [optional description]');
  process.exit(1);
}

const cleanedVer = verArg.replace(/^v/i, '');
const versionTag = `v${cleanedVer}`;
const description = args.slice(1).join(' ').trim() || `${versionTag}: Native Release Build`;

// 1. Update package.json
const pkgPath = path.join(__dirname, '..', 'package.json');
try {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  pkg.version = cleanedVer;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
} catch (err) {
  console.error('Failed to update package.json', err);
}

// 2. Update app.json
const appJsonPath = path.join(__dirname, '..', 'app.json');
try {
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));
  if (appJson.expo) {
    appJson.expo.version = cleanedVer;
    if (!appJson.expo.extra) appJson.expo.extra = {};
    appJson.expo.extra.updateVersion = versionTag;
    appJson.expo.extra.updateDescription = description;
  }
  fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n', 'utf-8');
} catch (err) {
  console.error('Failed to update app.json', err);
}

// 3. Update constants/version.ts
const versionFilePath = path.join(__dirname, '..', 'constants', 'version.ts');
try {
  let content = fs.readFileSync(versionFilePath, 'utf-8');
  content = content.replace(
    /export const CURRENT_RELEASE_VERSION = ".*?";/,
    `export const CURRENT_RELEASE_VERSION = "${versionTag}";`
  );
  content = content.replace(
    /export const RELEASE_DESCRIPTION = .*?;/,
    `export const RELEASE_DESCRIPTION = ${JSON.stringify(description)};`
  );

  if (
    content.includes('export const INITIAL_RELEASE_HISTORY: ReleaseHistoryItem[] = [') &&
    !content.includes(`version: "${versionTag}"`)
  ) {
    const todayStr = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const newItemStr = `  {\n    version: "${versionTag}",\n    date: "${todayStr}",\n    notes: [\n      ${JSON.stringify(description)}\n    ],\n    isNativeBuild: true,\n  },`;
    content = content.replace(
      /export const INITIAL_RELEASE_HISTORY: ReleaseHistoryItem\[\] = \[\n/,
      `export const INITIAL_RELEASE_HISTORY: ReleaseHistoryItem[] = [\n${newItemStr}\n`
    );
  }

  fs.writeFileSync(versionFilePath, content, 'utf-8');
  console.log(`\x1b[32m✔ All versions synchronized to ${versionTag} (${cleanedVer}) for native builds!\x1b[0m`);
} catch (err) {
  console.error('Failed to update constants/version.ts', err);
}
```

---

### Add Scripts to `package.json`
```json
"scripts": {
  "update": "node scripts/publish-update.js",
  "set-version": "node scripts/set-version.js"
}
```

---

## 6. Constants & Release History Store (`constants/version.ts`)

Create `constants/version.ts`:

```typescript
/**
 * Application Version and Release Configuration
 * Auto-synced with EAS Updates & Local Builds
 */
export const CURRENT_RELEASE_VERSION = "v1.0.0";
export const RELEASE_DESCRIPTION = "Initial base release";
export const APP_BINARY_VERSION = "v1.0.0 (Build 1)";
export const ADMIN_NAME = "Developer";
export const AUTHOR_CREDIT = "Built with ❤️";

export interface ReleaseHistoryItem {
  version: string;
  date: string;
  title?: string;
  notes: string[];
  type?: 'ota' | 'binary';
  isNativeBuild?: boolean;
}

export const INITIAL_RELEASE_HISTORY: ReleaseHistoryItem[] = [
  {
    version: "v1.0.0",
    date: "Current Release",
    title: "Initial Base Release",
    notes: [
      "Initial production release with offline-first support",
    ],
    type: "binary",
    isNativeBuild: true,
  },
];
```

---

## 7. The Core Update Engine (`services/updates/updateManager.ts`)

Create `services/updates/updateManager.ts`. This contains all business logic:
- Real-time EAS hooks integration (`Updates.useUpdates()`).
- Semantic version comparison (`semverCompare`) preventing downgrades.
- Embedded launch detection to evict stale OTA cache.
- Native build keyword detection.
- 48-hour unapplied auto-apply background timer.

```typescript
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Linking } from 'react-native';
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CURRENT_RELEASE_VERSION,
  RELEASE_DESCRIPTION,
  INITIAL_RELEASE_HISTORY,
  ADMIN_NAME,
  ReleaseHistoryItem,
} from '@/constants/version';

const DISCOVERED_KEY = '@app_update_discovered_at';
const PENDING_MESSAGE_KEY = '@app_update_pending_message';
const ACTIVE_VERSION_KEY = '@app_update_active_version';
const ACTIVE_MESSAGE_KEY = '@app_update_active_message';
const LAST_CHECKED_KEY = '@app_update_last_checked_at';
const RELEASE_HISTORY_KEY = '@app_update_history_v2';
const AUTO_OTA_KEY = '@app_setting_auto_ota_v1';
const AUTO_APPLY_48H_KEY = '@app_setting_auto_apply_48h_v1';
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000; // 48 hours

// ── Types ───────────────────────────────────────────────────

export interface ParsedRelease {
  version: string;
  cleanVersion: string;
  notes: string[];
  summary: string;
  isNativeRequired: boolean;
  nativeNotice?: string;
  buildUrl?: string | null;
  rawMessage: string;
}

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'up_to_date'
  | 'native_required'
  | 'dev_mode'
  | 'error';

export interface AppUpdateInfo {
  isEnabled: boolean;
  isUpdateAvailable: boolean;
  isUpdatePending: boolean;
  isDownloading: boolean;
  downloadProgress: number;
  activeVersion: string;
  activeRelease: ParsedRelease;
  availableRelease: ParsedRelease | null;
  history: ReleaseHistoryItem[];
  updateId: string | null;
  channel: string;
  runtimeVersion: string;
  isEmbeddedLaunch: boolean;
  createdAt: Date | null;
  lastCheckedAt: number | null;
  discoveredAt: number | null;
  daysRemainingBeforeAutoUpdate: number | null;
  manualStatus: UpdateStatus;
  errorMessage: string | null;
  autoOtaEnabled: boolean;
  autoApply48hEnabled: boolean;
  setAutoOtaEnabled: (val: boolean) => Promise<void>;
  setAutoApply48hEnabled: (val: boolean) => Promise<void>;
  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  restartToApply: () => Promise<void>;
  openBuildUrl: () => Promise<void>;
  contactAdmin: (targetVersion?: string) => Promise<void>;
}

// ── Semantic Version Utilities ─────────────────────────────

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  raw: string;
}

export function parseSemVer(verStr: string | null | undefined): SemVer | null {
  if (!verStr || typeof verStr !== 'string') return null;
  const cleaned = verStr.trim().replace(/^v/i, '');
  const match = cleaned.match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!match) return null;

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: match[3] ? parseInt(match[3], 10) : 0,
    raw: verStr.trim(),
  };
}

export function semverCompare(vA: string | null | undefined, vB: string | null | undefined): number {
  const parsedA = parseSemVer(vA);
  const parsedB = parseSemVer(vB);

  if (!parsedA && !parsedB) return 0;
  if (!parsedA) return -1;
  if (!parsedB) return 1;

  if (parsedA.major !== parsedB.major) return parsedA.major > parsedB.major ? 1 : -1;
  if (parsedA.minor !== parsedB.minor) return parsedA.minor > parsedB.minor ? 1 : -1;
  if (parsedA.patch !== parsedB.patch) return parsedA.patch > parsedB.patch ? 1 : -1;
  return 0;
}

// ── Manifest Message & Version Extraction ──────────────────

export function extractUpdateMessage(manifest: any): string | null {
  if (!manifest) return null;
  let parsed = manifest;
  if (typeof manifest === 'string') {
    try {
      parsed = JSON.parse(manifest);
    } catch {
      return manifest.trim().length > 0 ? manifest.trim() : null;
    }
  }

  if (parsed?.extra?.expoClient?.extra?.easUpdateMessage) return String(parsed.extra.expoClient.extra.easUpdateMessage);
  if (parsed?.extra?.expoClient?.extra?.updateMessage) return String(parsed.extra.expoClient.extra.updateMessage);
  if (parsed?.extra?.updateMessage) return String(parsed.extra.updateMessage);
  if (parsed?.extra?.easUpdateMessage) return String(parsed.extra.easUpdateMessage);
  if (parsed?.extra?.expoClient?.extra?.updateDescription) return String(parsed.extra.expoClient.extra.updateDescription);

  if (parsed?.metadata) {
    if (typeof parsed.metadata === 'object' && parsed.metadata !== null) {
      if (parsed.metadata.message) return String(parsed.metadata.message);
      if (parsed.metadata.msg) return String(parsed.metadata.msg);
    }
    if (typeof parsed.metadata === 'string') {
      try {
        const metaObj = JSON.parse(parsed.metadata);
        if (metaObj?.message) return String(metaObj.message);
      } catch {
        if (!parsed.metadata.startsWith('{')) return String(parsed.metadata).trim();
      }
    }
  }

  if (parsed?.extra?.expoClient?.extra?.eas?.message) return String(parsed.extra.expoClient.extra.eas.message);
  if (parsed?.extra?.eas?.message) return String(parsed.extra.eas.message);
  if (parsed?.message) return String(parsed.message);

  return null;
}

export function extractManifestVersion(manifest: any): string | null {
  if (!manifest) return null;
  let parsed = manifest;
  if (typeof manifest === 'string') {
    try {
      parsed = JSON.parse(manifest);
    } catch {
      return null;
    }
  }

  if (parsed?.extra?.expoClient?.extra?.updateVersion) return String(parsed.extra.expoClient.extra.updateVersion);
  if (parsed?.extra?.updateVersion) return String(parsed.extra.updateVersion);
  if (parsed?.extra?.expoClient?.version) {
    const v = String(parsed.extra.expoClient.version).trim();
    return v.startsWith('v') ? v : `v${v}`;
  }

  const msg = extractUpdateMessage(parsed);
  if (msg) {
    const match = msg.match(/(?:^|[\s:(\[-])(?:version|ver|v)?\s*(\d+\.\d+(?:\.\d+)?)/i);
    if (match && match[1]) return `v${match[1]}`;
  }
  return null;
}

// ── Release Payload Parser ──────────────────────────────────

export function parseReleasePayload(
  rawMessage: string | null | undefined,
  fallbackVersion: string = CURRENT_RELEASE_VERSION
): ParsedRelease {
  let cleanRaw = (rawMessage || '').trim();
  const isEssentiallyEmpty = !cleanRaw || /^(?:v)?\d+\.\d+(?:\.\d+)?:\s*$/i.test(cleanRaw);

  if (isEssentiallyEmpty) {
    const sem = parseSemVer(fallbackVersion);
    const vStr = sem ? `v${sem.major}.${sem.minor}.${sem.patch}` : fallbackVersion;
    const histItem = INITIAL_RELEASE_HISTORY.find((h) => h.version === vStr);

    return {
      version: vStr,
      cleanVersion: sem ? `${sem.major}.${sem.minor}.${sem.patch}` : fallbackVersion.replace(/^v/i, ''),
      notes: histItem?.notes || ['Verified performance optimizations, bug fixes, and improvements.'],
      summary: histItem?.title || 'Performance optimizations and improvements.',
      isNativeRequired: false,
      buildUrl: null,
      rawMessage: '',
    };
  }

  const nativeKeywordsRegex =
    /(?:new\s+native\s+build\s+required|apk\/ipa\s+required|new\s+apk|new\s+ipa|requires?\s+(?:a\s+)?new\s+(?:native\s+)?build)/i;
  const isNativeRequired = nativeKeywordsRegex.test(cleanRaw);

  const urlMatch = cleanRaw.match(/https:\/\/[^\s"'`<>]+/i);
  let buildUrl: string | null = urlMatch ? urlMatch[0] : null;

  const rawLines = cleanRaw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const firstLine = rawLines[0] || '';

  const versionMatch = firstLine.match(/(?:^|[\s:(\[-])(?:version|ver|v)?\s*(\d+\.\d+(?:\.\d+)?)/i);
  const finalVersion = versionMatch ? `v${versionMatch[1]}` : fallbackVersion;
  const sem = parseSemVer(finalVersion);
  const cleanVersion = sem ? `${sem.major}.${sem.minor}.${sem.patch}` : finalVersion.replace(/^v/i, '');

  const stripBulletPrefix = (s: string) =>
    s
      .replace(/^[\s•\-\*–—\u2022\u25E6\u2023\u2219]+\s*/, '')
      .replace(/^\d+[\.\)]\s*/, '')
      .replace(/^(?:v|ver|version)?\s*\d+\.\d+(?:\.\d+)?\s*[:\-–—]?\s*/i, '')
      .trim();

  const cleanNotes: string[] = [];
  if (rawLines.length > 1) {
    for (let i = 1; i < rawLines.length; i++) {
      const line = stripBulletPrefix(rawLines[i]);
      if (line.length > 0) cleanNotes.push(line);
    }
  } else {
    let desc = firstLine.replace(/^(?:v|ver|version)?\s*\d+\.\d+(?:\.\d+)?\s*[:\-–—]\s*/i, '').trim();
    if (desc.includes('•') || desc.includes(';') || desc.includes(' | ')) {
      cleanNotes.push(...desc.split(/[•;|]/).map(stripBulletPrefix).filter((p) => p.length > 0));
    } else if (desc.length > 0) {
      cleanNotes.push(stripBulletPrefix(desc));
    }
  }

  if (cleanNotes.length === 0) {
    cleanNotes.push('Performance optimizations and bug fixes.');
  }

  return {
    version: finalVersion,
    cleanVersion,
    notes: cleanNotes,
    summary: cleanNotes.join(' · '),
    isNativeRequired,
    buildUrl,
    rawMessage: cleanRaw,
  };
}

// ── Release History & Version Resolvers ─────────────────────

export async function getReleaseHistory(): Promise<ReleaseHistoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(RELEASE_HISTORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return INITIAL_RELEASE_HISTORY;
}

export async function recordAppliedRelease(release: ParsedRelease): Promise<void> {
  try {
    const history = await getReleaseHistory();
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const newItem: ReleaseHistoryItem = {
      version: release.version,
      date: dateStr,
      notes: release.notes,
      isNativeBuild: release.isNativeRequired,
    };
    const filtered = history.filter((h) => h.version !== release.version);
    await AsyncStorage.setItem(RELEASE_HISTORY_KEY, JSON.stringify([newItem, ...filtered].slice(0, 15)));
  } catch {}
}

export async function getActiveAppVersion(): Promise<string> {
  try {
    const manifestVer = (Updates.manifest as any)?.extra?.expoClient?.version;
    if (manifestVer) {
      return `v${String(manifestVer).replace(/^v/i, '')}`;
    }
    const cached = await AsyncStorage.getItem(ACTIVE_VERSION_KEY);
    if (cached) return cached;
  } catch {}
  return CURRENT_RELEASE_VERSION;
}

// ── Silent Background Auto-Apply ────────────────────────────

export async function checkAndAutoApplyUpdates(): Promise<void> {
  if (!Updates.isEnabled) return;

  try {
    const autoOtaVal = await AsyncStorage.getItem(AUTO_OTA_KEY);
    if (autoOtaVal === 'false') return;

    const discoveredStr = await AsyncStorage.getItem(DISCOVERED_KEY);
    const discoveredAt = discoveredStr ? parseInt(discoveredStr, 10) : null;

    const checkResult = await Updates.checkForUpdateAsync();

    if (checkResult.isAvailable) {
      const now = Date.now();
      const firstSeen = discoveredAt || now;
      if (!discoveredAt) await AsyncStorage.setItem(DISCOVERED_KEY, now.toString());

      const msg = extractUpdateMessage(checkResult.manifest);
      const manifestVer = extractManifestVersion(checkResult.manifest);
      const targetVer = manifestVer || parseReleasePayload(msg).version;
      const activeVer = await getActiveAppVersion();

      // Guard: Never downgrade active build
      if (!checkResult.isRollBackToEmbedded && targetVer && semverCompare(targetVer, activeVer) <= 0) {
        await AsyncStorage.removeItem(DISCOVERED_KEY);
        return;
      }

      const parsed = parseReleasePayload(msg, targetVer || undefined);
      if (parsed.isNativeRequired) return;

      if (msg) await AsyncStorage.setItem(PENDING_MESSAGE_KEY, msg);

      const fetchResult = await Updates.fetchUpdateAsync();
      const autoApplyVal = await AsyncStorage.getItem(AUTO_APPLY_48H_KEY);
      const isAutoApplyEnabled = autoApplyVal !== 'false';

      // 48-hour silent auto-apply
      if (fetchResult.isNew && isAutoApplyEnabled && now - firstSeen >= TWO_DAYS_MS) {
        if (msg) {
          await AsyncStorage.setItem(ACTIVE_MESSAGE_KEY, msg);
          await AsyncStorage.setItem(ACTIVE_VERSION_KEY, parsed.version);
          await recordAppliedRelease(parsed);
        }
        await AsyncStorage.removeItem(DISCOVERED_KEY);
        await AsyncStorage.removeItem(PENDING_MESSAGE_KEY);
        await Updates.reloadAsync();
      }
    } else {
      await AsyncStorage.removeItem(DISCOVERED_KEY);
      await AsyncStorage.removeItem(PENDING_MESSAGE_KEY);
    }
  } catch {
    // Fail silently in background
  }
}

// ── Unified Hook for UI ────────────────────────────────────

export function useAppUpdateManager(): AppUpdateInfo {
  const [discoveredAt, setDiscoveredAt] = useState<number | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [storedMessage, setStoredMessage] = useState<string | null>(null);
  const [activeVersion, setActiveVersion] = useState<string>(CURRENT_RELEASE_VERSION);
  const [history, setHistory] = useState<ReleaseHistoryItem[]>(INITIAL_RELEASE_HISTORY);
  const [manualStatus, setManualStatus] = useState<UpdateStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isManualDownloading, setIsManualDownloading] = useState(false);
  const [autoOtaEnabled, setAutoOtaEnabledState] = useState<boolean>(true);
  const [autoApply48hEnabled, setAutoApply48hEnabledState] = useState<boolean>(true);
  const [checkedManifest, setCheckedManifest] = useState<any | null>(null);

  const {
    currentlyRunning,
    availableUpdate,
    downloadedUpdate,
    isUpdateAvailable: hookAvailable,
    isUpdatePending: hookPending,
    downloadProgress: hookProgress,
    isDownloading: hookDownloading,
  } = Updates.useUpdates();

  useEffect(() => {
    async function loadData() {
      const isEmbedded = Boolean(currentlyRunning.isEmbeddedLaunch || !currentlyRunning.updateId);
      // Evict stale OTA keys if running fresh embedded binary
      if (isEmbedded) {
        await AsyncStorage.multiRemove([ACTIVE_VERSION_KEY, ACTIVE_MESSAGE_KEY, PENDING_MESSAGE_KEY, DISCOVERED_KEY]).catch(() => {});
      }

      const ver = isEmbedded ? CURRENT_RELEASE_VERSION : await getActiveAppVersion();
      const hist = await getReleaseHistory();
      setActiveVersion(ver);
      setHistory(hist);

      const discVal = await AsyncStorage.getItem(DISCOVERED_KEY);
      if (discVal) setDiscoveredAt(parseInt(discVal, 10));

      const lastCheckedVal = await AsyncStorage.getItem(LAST_CHECKED_KEY);
      if (lastCheckedVal) setLastCheckedAt(parseInt(lastCheckedVal, 10));

      const pendMsg = await AsyncStorage.getItem(PENDING_MESSAGE_KEY);
      const activeMsg = await AsyncStorage.getItem(ACTIVE_MESSAGE_KEY);
      setStoredMessage(isEmbedded ? RELEASE_DESCRIPTION : (pendMsg || activeMsg));
    }
    loadData();
  }, [currentlyRunning]);

  const isUpdatePending = hookPending || manualStatus === 'downloaded';
  const isUpdateAvailable = hookAvailable || manualStatus === 'available';
  const isDownloading = hookDownloading || isManualDownloading;
  const downloadProgress = hookProgress || (isDownloading ? 0.6 : 0);

  const activeRelease = useMemo(() => {
    return parseReleasePayload(storedMessage, activeVersion);
  }, [storedMessage, activeVersion]);

  const availableRelease = useMemo(() => {
    if (!isUpdateAvailable && !isUpdatePending && manualStatus !== 'native_required') return null;
    const targetManifest = checkedManifest || downloadedUpdate?.manifest || availableUpdate?.manifest;
    const msg = extractUpdateMessage(targetManifest) || storedMessage;
    const ver = extractManifestVersion(targetManifest);
    return parseReleasePayload(msg, ver || undefined);
  }, [isUpdateAvailable, isUpdatePending, manualStatus, checkedManifest, downloadedUpdate, availableUpdate, storedMessage]);

  const daysRemainingBeforeAutoUpdate = discoveredAt
    ? Math.max(0, Math.ceil((discoveredAt + TWO_DAYS_MS - Date.now()) / (24 * 60 * 60 * 1000)))
    : null;

  const handleCheckForUpdates = useCallback(async () => {
    if (!Updates.isEnabled) {
      setManualStatus('dev_mode');
      return;
    }
    setManualStatus('checking');
    setErrorMessage(null);
    try {
      const now = Date.now();
      setLastCheckedAt(now);
      await AsyncStorage.setItem(LAST_CHECKED_KEY, now.toString());

      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        setCheckedManifest(result.manifest);
        const msg = extractUpdateMessage(result.manifest);
        const parsed = parseReleasePayload(msg);
        if (parsed.isNativeRequired) {
          setManualStatus('native_required');
        } else {
          setManualStatus('available');
          setDiscoveredAt(now);
          await AsyncStorage.setItem(DISCOVERED_KEY, now.toString());
        }
      } else {
        setManualStatus('up_to_date');
      }
    } catch {
      setManualStatus('error');
      setErrorMessage('Unable to check for updates. Check internet connection.');
    }
  }, []);

  const handleDownloadUpdate = useCallback(async () => {
    if (!Updates.isEnabled) return;
    setIsManualDownloading(true);
    setErrorMessage(null);
    try {
      const result = await Updates.fetchUpdateAsync();
      const msg = extractUpdateMessage(result.manifest);
      if (msg) await AsyncStorage.setItem(PENDING_MESSAGE_KEY, msg);
      setManualStatus('downloaded');
    } catch {
      setManualStatus('error');
      setErrorMessage('Download failed. Please check your connection.');
    } finally {
      setIsManualDownloading(false);
    }
  }, []);

  const handleRestartToApply = useCallback(async () => {
    try {
      if (storedMessage) {
        await AsyncStorage.setItem(ACTIVE_MESSAGE_KEY, storedMessage);
        const parsed = parseReleasePayload(storedMessage, activeVersion);
        await recordAppliedRelease(parsed);
      }
      await AsyncStorage.removeItem(PENDING_MESSAGE_KEY);
      await AsyncStorage.removeItem(DISCOVERED_KEY);
      await Updates.reloadAsync();
    } catch {
      Updates.reloadAsync().catch(() => {});
    }
  }, [storedMessage, activeVersion]);

  return {
    isEnabled: Updates.isEnabled,
    isUpdateAvailable,
    isUpdatePending,
    isDownloading,
    downloadProgress,
    activeVersion,
    activeRelease,
    availableRelease,
    history,
    updateId: currentlyRunning.updateId || Updates.updateId || null,
    channel: Updates.channel || 'preview',
    runtimeVersion: Updates.runtimeVersion || '1',
    isEmbeddedLaunch: Boolean(currentlyRunning.isEmbeddedLaunch),
    createdAt: currentlyRunning.createdAt || Updates.createdAt || null,
    lastCheckedAt,
    discoveredAt,
    daysRemainingBeforeAutoUpdate,
    manualStatus,
    errorMessage,
    autoOtaEnabled,
    autoApply48hEnabled,
    setAutoOtaEnabled: async (val) => setAutoOtaEnabledState(val),
    setAutoApply48hEnabled: async (val) => setAutoApply48hEnabledState(val),
    checkForUpdates: handleCheckForUpdates,
    downloadUpdate: handleDownloadUpdate,
    restartToApply: handleRestartToApply,
    openBuildUrl: async () => availableRelease?.buildUrl && Linking.openURL(availableRelease.buildUrl),
    contactAdmin: async () => Linking.openURL(`https://api.whatsapp.com/send?text=${encodeURIComponent(`New build ${activeVersion}`)}`),
  };
}
```

---

## 8. App Lifecycle & Startup Integration (`app/_layout.tsx`)

In your root layout (`app/_layout.tsx`), trigger the non-blocking background update check during app bootstrap:

```typescript
import { useEffect } from "react";
import { Stack } from "expo-router";
import { checkAndAutoApplyUpdates } from "@/services/updates/updateManager";

export default function RootLayout() {
  useEffect(() => {
    async function initialize() {
      // 1. Initialize DB / Auth / Storage here first...
      
      // 2. Non-blocking OTA check (unawaited fire-and-forget)
      checkAndAutoApplyUpdates().catch(() => {});
    }
    initialize();
  }, []);

  return <Stack />;
}
```

---

## 9. Apple HIG Native Software Update Screen (`app/settings/updates.tsx`)

Create a screen at `app/settings/updates.tsx` providing users and testers with an authentic iOS-style update manager:

```tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CheckCircle2,
  RefreshCw,
  RotateCw,
  Download,
  AlertCircle,
  Copy,
  ExternalLink,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useAppUpdateManager } from '@/services/updates/updateManager';

export default function UpdatesScreen() {
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);

  const {
    isUpdateAvailable,
    isUpdatePending,
    isDownloading,
    downloadProgress,
    activeVersion,
    activeRelease,
    availableRelease,
    history,
    updateId,
    channel,
    runtimeVersion,
    isEmbeddedLaunch,
    manualStatus,
    errorMessage,
    checkForUpdates,
    downloadUpdate,
    restartToApply,
    openBuildUrl,
    contactAdmin,
  } = useAppUpdateManager();

  const isChecking = manualStatus === 'checking';
  const pct = Math.round(downloadProgress * 100);

  const copyHash = async (hash: string) => {
    await Clipboard.setStringAsync(hash);
    Haptics.selectionAsync();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isChecking} onRefresh={checkForUpdates} tintColor="#FF6B4A" />}
    >
      {/* ── 1. Hero Status Card ── */}
      <View style={styles.heroCard}>
        {isChecking ? (
          <ActivityIndicator size="large" color="#FF6B4A" style={styles.icon} />
        ) : isUpdatePending ? (
          <RotateCw size={44} color="#34C759" style={styles.icon} />
        ) : isUpdateAvailable ? (
          <Download size={44} color="#FF6B4A" style={styles.icon} />
        ) : manualStatus === 'error' ? (
          <AlertCircle size={44} color="#FF3B30" style={styles.icon} />
        ) : (
          <CheckCircle2 size={44} color="#34C759" style={styles.icon} />
        )}

        <Text style={styles.heroTitle}>
          {isUpdatePending
            ? `Ready to Install ${availableRelease?.version}`
            : isUpdateAvailable
            ? `Update Available: ${availableRelease?.version}`
            : `Cashveil ${activeVersion}`}
        </Text>

        <Text style={styles.heroSubtitle}>
          {isChecking
            ? 'Checking for updates...'
            : isUpdatePending
            ? 'Update downloaded. Restart the app to apply.'
            : isUpdateAvailable
            ? availableRelease?.summary || 'New improvements ready to download.'
            : 'Your app is up to date with the latest release.'}
        </Text>

        {/* Action Button */}
        {isUpdatePending ? (
          <TouchableOpacity style={[styles.btn, styles.btnGreen]} onPress={restartToApply}>
            <RotateCw size={18} color="#000" />
            <Text style={styles.btnTextBlack}>Restart to Apply</Text>
          </TouchableOpacity>
        ) : isUpdateAvailable ? (
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={downloadUpdate}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <Text style={styles.btnTextWhite}>Downloading {pct}%...</Text>
            ) : (
              <>
                <Download size={18} color="#FFF" />
                <Text style={styles.btnTextWhite}>Download and Install</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.btnOutline} onPress={checkForUpdates} disabled={isChecking}>
            <RefreshCw size={16} color="#FFF" />
            <Text style={styles.btnOutlineText}>Check for Updates</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── 2. What's New In Available Update ── */}
      {isUpdateAvailable && availableRelease && (
        <View style={styles.card}>
          <Text style={styles.cardHeader}>What's New in {availableRelease.version}</Text>
          {availableRelease.notes.map((note, idx) => (
            <Text key={idx} style={styles.bulletItem}>• {note}</Text>
          ))}
        </View>
      )}

      {/* ── 3. Build & System Details ── */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>About This Build</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Active Version</Text>
          <Text style={styles.rowValue}>{activeVersion}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Channel</Text>
          <Text style={styles.rowValue}>{channel}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Runtime Version</Text>
          <Text style={styles.rowValue}>{runtimeVersion}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Installation Source</Text>
          <Text style={styles.rowValue}>{isEmbeddedLaunch ? 'Embedded Binary' : 'Over-the-Air (OTA)'}</Text>
        </View>
        {updateId && (
          <TouchableOpacity style={styles.row} onPress={() => copyHash(updateId)}>
            <Text style={styles.rowLabel}>Update ID</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.rowCode}>{updateId.slice(0, 8)}...</Text>
              <Copy size={13} color="#8E8E93" />
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* ── 4. Release History ── */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>Release History</Text>
        {history.map((item, idx) => (
          <View key={idx} style={styles.historyRow}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={styles.historyVersion}>{item.version}</Text>
              <Text style={styles.historyDate}>{item.date}</Text>
            </View>
            {item.notes.map((n, i) => (
              <Text key={i} style={styles.historyNote}>• {n}</Text>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#070A10' },
  content: { padding: 16, paddingBottom: 60 },
  heroCard: {
    backgroundColor: '#121620',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E2433',
  },
  icon: { marginBottom: 12 },
  heroTitle: { fontSize: 20, fontWeight: '700', color: '#FFF', marginBottom: 6, textAlign: 'center' },
  heroSubtitle: { fontSize: 14, color: '#8E8E93', textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  btnPrimary: { backgroundColor: '#FF6B4A' },
  btnGreen: { backgroundColor: '#34C759' },
  btnTextWhite: { color: '#FFF', fontWeight: '600', fontSize: 15 },
  btnTextBlack: { color: '#000', fontWeight: '700', fontSize: 15 },
  btnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#2C3446',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  btnOutlineText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  card: {
    backgroundColor: '#121620',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E2433',
  },
  cardHeader: { fontSize: 15, fontWeight: '700', color: '#FFF', marginBottom: 12 },
  bulletItem: { fontSize: 14, color: '#D1D5DB', marginBottom: 6, lineHeight: 20 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1A202E',
  },
  rowLabel: { fontSize: 14, color: '#8E8E93' },
  rowValue: { fontSize: 14, color: '#FFF', fontWeight: '500' },
  rowCode: { fontSize: 13, fontFamily: 'Courier', color: '#FF6B4A' },
  historyRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1A202E' },
  historyVersion: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  historyDate: { fontSize: 12, color: '#8E8E93' },
  historyNote: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
});
```

---

## 10. Native Plugins & Edge-Case Safeguards

### Safeguard A: Free Apple Developer Accounts (`with-ios-local-no-push.js`)
Free/Personal Apple Developer teams cannot sign apps with Push Notification entitlements (`aps-environment`), failing device builds with:
`Personal development teams do not support the Push Notifications capability.`

Create `plugins/with-ios-local-no-push.js`:
```javascript
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withIosLocalNoPush(config) {
  if (process.env.EXPO_LOCAL_NO_PUSH !== '1') {
    return config;
  }
  return withEntitlementsPlist(config, (config) => {
    if (config.modResults['aps-environment']) {
      delete config.modResults['aps-environment'];
      console.log('[with-ios-local-no-push] Removed aps-environment for local developer build');
    }
    return config;
  });
};
```
Reference it in `app.json` plugins:
```json
"plugins": [
  "./plugins/with-ios-local-no-push"
]
```
When running local builds on your iPhone with a free personal account, run:
```bash
EXPO_LOCAL_NO_PUSH=1 npx expo run:ios --device
```
Official EAS Cloud release builds and CI builds do **not** set this environment flag, so APNs push entitlements and background updates stay 100% active in production!

### Safeguard B: Safe App Reset using `Updates.reloadAsync()`
When restoring database backups (e.g. importing a JSON backup into SQLite), attempting to manually re-render dozens of UI screens or reset global stores often leads to state desynchronization.
Call `Updates.reloadAsync()`:
```typescript
import * as Updates from 'expo-updates';

// After successful database restoration:
Updates.reloadAsync().catch(() => {});
```
This cleanly restarts the JavaScript runtime, mounting all stores directly from the newly populated SQLite database.

---

## 11. Step-by-Step Setup Runbook for a New Expo App

Follow these exact steps to implement this entire setup in any new Expo app:

### Step 1: Install Dependencies
```bash
npx expo install expo-updates @react-native-async-storage/async-storage expo-clipboard expo-haptics
```

### Step 2: Configure EAS Update in Expo
```bash
npm install -g eas-cli
eas login
eas update:configure
```
*(This automatically adds the `projectId` and `updates.url` to `app.json`)*

### Step 3: Configure `app.json`
Verify the `updates` block has `fallbackToCacheTimeout` and `requestHeaders`:
```json
"runtimeVersion": "1",
"updates": {
  "url": "https://u.expo.dev/<YOUR_PROJECT_ID>",
  "requestHeaders": {
    "expo-channel-name": "preview"
  },
  "checkAutomatically": "ON_LOAD",
  "fallbackToCacheTimeout": 3000
}
```

### Step 4: Configure `eas.json`
Create or update `eas.json` with `preview` and `production` channels (see Section 4).

### Step 5: Copy Files
1. Copy `scripts/publish-update.js` and `scripts/set-version.js` into your `scripts/` folder.
2. Copy `constants/version.ts` into your `constants/` folder.
3. Copy `services/updates/updateManager.ts` into your `services/updates/` folder.
4. Copy `app/settings/updates.tsx` into your `app/` directory (or wherever your Settings are).
5. Add `checkAndAutoApplyUpdates().catch(() => {})` in `app/_layout.tsx`.
6. Add scripts to `package.json`:
   ```json
   "update": "node scripts/publish-update.js",
   "set-version": "node scripts/set-version.js"
   ```

### Step 6: Build Your Base Native Binary
For Android APK (installable on any phone):
```bash
npx eas build --platform android --profile preview
```
For iOS (TestFlight / Ad-hoc / Development build):
```bash
npx eas build --platform ios --profile preview
```

### Step 7: Push Your First Live OTA Update
Make any JavaScript or CSS change in your code, then run:
```bash
npm run update "v1.0.1: Fixed button styles and improved dashboard"
```
Open your installed app on your phone. You will see the update download and apply seamlessly!

---

## 12. Troubleshooting & Emergency Cheat Sheet

### Q: I ran `npm run update`, but my app on the phone isn't updating!
1. **Check Channel Mismatch**: Does the build's channel match the update's branch?
   - In `app.json`: `requestHeaders.expo-channel-name` is `"preview"`.
   - In `publish-update.js`: `npx eas update --branch preview`.
2. **Check Runtime Version Mismatch**:
   - If your binary was built with `runtimeVersion: "1"`, the update **must** also be published with `runtimeVersion: "1"`. Run `eas update:view` on the EAS dashboard to confirm the runtime version matches.
3. **Check Development Mode**:
   - `expo-updates` is **disabled in Expo Go and debug mode** (`__DEV__ === true`). It only operates in standalone preview and production builds.

### Q: The app crashed on launch after an OTA update!
- Expo has an automatic rollback feature: If an OTA bundle crashes twice consecutively during startup, Expo will automatically discard the update and roll back to the embedded binary shell.
- To diagnose: Inspect device logs via `npx react-native log-android` or `npx react-native log-ios`.

### Q: How do I roll back an update immediately?
Use the EAS CLI to republish a previous good commit or repoint the channel:
```bash
npx eas channel:rollout preview --percent 0
# or publish a quick hotfix update:
npm run update "v1.0.2: Rollback of previous changes"
```

---
*Generated for the project repository — keep this file for drop-in replication across all future Expo applications.*
