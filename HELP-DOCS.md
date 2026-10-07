# Monevo Release & OTA Update Guide (HELP-DOCS)

This is the definitive guide for distributing and updating Monevo. It covers Over-The-Air (OTA) updates via Expo EAS and Native Binary builds (`.apk`, `.ipa`, and direct USB cable pushes).

---

## 1. Quick Reference: The Two Commands You Will Use

You will only ever need **two commands**. Everything else (version bumping, manifest metadata, changelog generation, cache invalidation) is 100% automated.

```
┌────────────────────────────────────────────────────────┐
│  SCENARIO 1: JS / UI / Bug Fixes (OTA) — 95% of time   │
│  npm run update "v1.1.6: Description of changes"       │
├────────────────────────────────────────────────────────┤
│  SCENARIO 2: Native Builds (.apk / .ipa / USB Cable)   │
│  1. npm run set-version 1.2.0 "Description"            │
│  2. npm run ios:release   (or npm run build:ipa)       │
└────────────────────────────────────────────────────────┘
```

---

## 2. What Is 100% Automatic vs. What You Do Manually

| Component | Status | How It Is Handled |
| :--- | :--- | :--- |
| **`package.json` version** | 🟢 **Automatic** | Synchronized automatically by `npm run update` or `npm run set-version`. |
| **`app.json` version & `extra`** | 🟢 **Automatic** | Bakes `updateVersion`, `updateDescription`, and `updateNotes` directly into `app.json.expo.extra`. |
| **`constants/version.ts` history** | 🟢 **Automatic** | Automatically prepends the new version and release notes to `INITIAL_RELEASE_HISTORY`. |
| **Dynamic Build Number (`Build 1`)**| 🟢 **Automatic** | Dynamically read from `Constants.nativeAppVersion` and `Constants.nativeBuildVersion`. |
| **Stale Cache Purging** | 🟢 **Automatic** | Installing a native build automatically purges old OTA caches on first boot. |
| **Downgrade Prevention** | 🟢 **Automatic** | If EAS has an older OTA version than your phone's native build, the phone ignores it. |
| **What you do manually** | 👤 **Manual** | **Run 1 terminal command.** |

---

## 3. Workflow A: Publishing an OTA Update (95% of Releases)

Use this for **all JavaScript, TypeScript, React components, styling, logic, calculations, and bug fixes**.

### The Command:
```bash
npm run update "v1.1.6: Fixed transaction filter bug and polished Ledger UI"
```

### What Happens Automatically:
1. **Syncs Version:** Updates `app.json`, `package.json`, and `constants/version.ts` to `v1.1.6`.
2. **Bakes Manifest Metadata:** Embeds the version and bullet notes directly into `app.json.expo.extra`.
3. **Uploads to EAS:** Publishes the JS bundle to channel `preview`.
4. **On User Devices (Before Installing):**
   * The user opens **Settings → Software Update**.
   * The phone reads `v1.1.6` from the manifest.
   * Displays the **Apple Update Card**:
     * Title: **Monevo 1.1.6**
     * Badge: **Available**
     * Description: *Fixed transaction filter bug and polished Ledger UI*
     * **What's New** bullet points
     * Button: **[Download and Install]**
5. **After Installation:**
   * User taps **Restart to Update** (or restarts the app).
   * App reloads directly into `v1.1.6 (OTA)`.

> ⚠️ **The Golden Rule for OTA Updates:**
> **NEVER add a package that requires native iOS CocoaPods or Android Gradle code via an OTA update.** If you run `npm install <new-native-package>`, you MUST do a Native Build (Workflow B). Pure JS/TS packages like `date-fns` or React components are always 100% safe.

---

## 4. Workflow B: Building a Native App (`.apk` / `.ipa` / Cable Push)

Use this when you:
1. Added a **new native library** (e.g. native camera, new biometric module).
2. Modified **iOS App Intents / Swift code** in `app-intents/`.
3. Changed the **app icon** or **splash screen**.
4. Want to generate a fresh `.ipa` or `.apk` to distribute to friends or install on your phone.

### Step 1: Bump the Version Across All Files (1 Command)
```bash
npm run set-version 1.2.0 "v1.2.0: Major new ledger features and offline sync"
```

### Step 2: Build the Target Platform

#### For iPhone via USB Cable:
```bash
npm run ios:release
```

#### For iOS Sideloadable `.ipa` File (AltStore / TrollStore / Sideloadly):
```bash
npm run build:ipa
```
*(The output file is saved to `./monevo.ipa`).*

#### For Android `.apk` File:
```bash
npx expo run:android --variant release
```
*(Or via EAS Build: `npx eas build --platform android --profile preview --local`)*

### What Happens Automatically on the Phone:
* The app detects `isEmbeddedLaunch = true`.
* It automatically wipes any previous OTA caches from storage.
* It starts clean as **`v1.2.0 (Base)`**.
* Even if EAS still has older OTA updates (`v1.1.6`), the new semver guard guarantees the phone will **never downgrade**. It displays: **Monevo is up to date (v1.2.0)**.
* Any future OTA update you publish (`v1.2.1`) will seamlessly update their app.

---

## 5. Limitations of OTA Updates (What OTA Can & Cannot Do)

| Feature | Can OTA Update It? | Requirement |
| :--- | :---: | :--- |
| TypeScript / JavaScript code | ✅ **Yes** | `npm run update` |
| React components, screens, modals | ✅ **Yes** | `npm run update` |
| UI styles, Tailwind, layout, colors | ✅ **Yes** | `npm run update` |
| SQLite database queries & schemas | ✅ **Yes** | `npm run update` |
| Supabase API queries & RPCs | ✅ **Yes** | `npm run update` |
| In-app images (`require('@/assets/...')`) | ✅ **Yes** | `npm run update` |
| New native libraries (CocoaPods/Gradle) | ❌ **No** | Must build Native Binary (`.apk`/`.ipa`) |
| Home screen app icon | ❌ **No** | Baked into native asset catalog at compile time |
| Native splash screen | ❌ **No** | Baked into native storyboard/drawables |
| iOS permissions in `Info.plist` | ❌ **No** | Read by iOS during installation only |
| Android permissions in `AndroidManifest` | ❌ **No** | Read by Android during installation only |
| iOS App Intents / Swift files | ❌ **No** | Compiled by Xcode into native machine code |
| Expo SDK upgrades (e.g. SDK 57 → 58) | ❌ **No** | Changes underlying C++/Obj-C/Java runtime |

---

## 6. How the Update System Works Internally

### File Architecture:
* [`constants/version.ts`](file:///Users/tirtharaj/Desktop/Desktop/github/subscription/constants/version.ts) — App version strings and release history.
* [`services/updates/updateManager.ts`](file:///Users/tirtharaj/Desktop/Desktop/github/subscription/services/updates/updateManager.ts) — Core OTA lifecycle, manifest version extraction, semver downgrade protection, and cache management.
* [`app/settings/updates.tsx`](file:///Users/tirtharaj/Desktop/Desktop/github/subscription/app/settings/updates.tsx) — Authentic Apple HIG Software Update screen.
* [`scripts/publish-update.js`](file:///Users/tirtharaj/Desktop/Desktop/github/subscription/scripts/publish-update.js) — Automated EAS update publisher and multi-file version synchronizer.
* [`scripts/set-version.js`](file:///Users/tirtharaj/Desktop/Desktop/github/subscription/scripts/set-version.js) — Multi-file version bumper for native builds.
* [`scripts/build-ipa.sh`](file:///Users/tirtharaj/Desktop/Desktop/github/subscription/scripts/build-ipa.sh) — Fast local script to build unsigned sideloadable `.ipa`.

### Key Safeguards Active in the Code:
1. **Manifest Metadata Injection:** Version and release notes are bundled directly inside `app.json.expo.extra`, so devices read the update version from the server before downloading.
2. **Zero Fallback to Active Version:** If an update is detected, it will never show the phone's currently active version as available.
3. **Semver Downgrade Protection:** An update is only offered if `semverCompare(serverVersion, activeVersion) > 0`.
4. **Shell Character Safety:** `spawnSync` executes without shell interpolation, so update messages containing `&`, colons, or quotes never corrupt CLI commands.
5. **Clean Metro Configuration:** No hidden Metro hooks rewrite or truncate `constants/version.ts` during bundling.
