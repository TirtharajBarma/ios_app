# Monevo Complete Release, Build & OTA Update Guide (HELP-DOCS)

This is the definitive, beginner-friendly manual for distributing, compiling, and updating Monevo. Keep this document as your permanent cheat sheet.

---

## 1. Quick Decision Matrix: "What do I want to do?"

| Goal | Command to Run | Needs Xcode? | Needs Android Studio / Java? | Needs Cable? |
| :--- | :--- | :---: | :---: | :---: |
| **Push JS / UI / Bug Fix (OTA Update)** | `npm run update "v1.1.9: description"` | ❌ No | ❌ No | ❌ No |
| **Install on iPhone via USB (Standalone / Final)** | `npm run ios:release` | ✅ Yes | ❌ No | ✅ Yes |
| **Install on iPhone via USB (Live Metro Dev)** | `npm run ios:device` | ✅ Yes | ❌ No | ✅ Yes |
| **Build `.ipa` locally (for AltStore / TrollStore)** | `npm run build:ipa` | ✅ Yes | ❌ No | ❌ No |
| **Build `.ipa` in Cloud (NO Xcode on Mac)** | `npx eas build -p ios --profile preview` | ❌ No | ❌ No | ❌ No |
| **Build Android `.apk` (Zero setup / EAS Cloud)** | `npx eas build -p android --profile preview` | ❌ No | ❌ No | ❌ No |
| **Build Android `.apk` locally (With Android Studio)** | `npx expo run:android --variant release` | ❌ No | ✅ Yes (Auto-configured) | ❌ No |
| **Build Android `.apk` locally (Headless Terminal)** | `cd android && ./gradlew assembleRelease` | ❌ No | ✅ Yes (JDK 17 + SDK) | ❌ No |

---

## 2. Demystifying the Concepts (Why things work the way they do)

### A. Why `npm run ...` vs `npx expo run ...` vs `.sh` scripts?
`npm run <name>` is just a **custom shortcut (alias)** that points to a longer command in your [`package.json`](file:///Users/tirtharaj/Desktop/Desktop/github/subscription/package.json):

* `npm run build:ipa` ➡️ Just runs: `bash scripts/build-ipa.sh`
* `npm run ios:release` ➡️ Just runs: `EXPO_LOCAL_NO_PUSH=1 expo run:ios --configuration Release --device`
* `npm run ios:device` ➡️ Just runs: `EXPO_LOCAL_NO_PUSH=1 expo prebuild --platform ios && expo run:ios --device`
* `npm run update` ➡️ Just runs: `node scripts/publish-update.js`
* `npm run set-version` ➡️ Just runs: `node scripts/set-version.js`

> 💡 **Takeaway:** Running `npm run build:ipa` and running `bash scripts/build-ipa.sh` are **100% identical**. The npm shortcut simply saves you from typing the full path.

---

### B. iPhone Cable Push: Dev Mode (`ios:device`) vs. Release Mode (`ios:release`)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ DEV MODE (`npm run ios:device`)                                                         │
│ • Installs a developer test runner on your iPhone.                                     │
│ • Streams JavaScript live from your Mac via Metro bundler over the cable or Wi-Fi.     │
│ • Changing code on your Mac instantly hot-reloads on your iPhone screen.               │
│ ⚠️ If you disconnect the cable or turn off your Mac, the app will stop loading JS.    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ RELEASE MODE (`npm run ios:release`)                                                   │
│ • Compiles the production app binary (just like downloaded from the App Store).        │
│ • Bakes the entire JavaScript bundle directly inside the phone's memory.               │
│ • Metro server is NOT used; no hot-reloading.                                          │
│ 🟢 You can disconnect the cable, turn off your Mac, go outside — it works forever!    │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

Both local commands require **Xcode** on your Mac to compile the native Swift/Objective-C code and App Intents.

---

### C. What is Gradle? (And why were there multiple Android options?)

* **For iOS**, Apple’s native build engine is called **Xcode**.
* **For Android**, Google’s native build engine is called **Gradle**.
* **Every Android app in the world is compiled by Gradle.** Inside your project's `/android` folder, there is an executable script called `./gradlew` (Gradle Wrapper).

#### Why are there 3 different ways to build Android?
They are **NOT different compilers** — all 3 secretly call **Gradle** under the hood:

```
                      ┌────────────────────────┐
                      │    YOUR PREFERENCE     │
                      └───────────┬────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         ▼                        ▼                        ▼
[1. Android Studio GUI]   [2. npx expo run:android]   [3. Direct CLI]
   Click "Build APK"        Runs from root folder      cd android && ./gradlew
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  │
                                  ▼
                     ALL 3 CALL THE SAME ENGINE:
                          ★ GRADLE ★
                                  │
                                  ▼
                   Produces android-release.apk
```

#### What does Gradle need to run on your Mac?
Because Gradle is a Java program, it requires:
1. **Java JDK 17**
2. **Android SDK** (Google's Android compiler libraries)

* **If you have Android Studio installed:** Android Studio **automatically downloads Java and Android SDK for you**. You don't have to manually download anything.
* **If you do NOT want Android Studio:** You have to install Java via Homebrew (`brew install openjdk@17`) and the Android Command Line Tools yourself.
* **If you use EAS Cloud (`npx eas build`):** Expo runs Gradle on **their remote servers in the cloud**. You don't need Android Studio, Java, or the SDK on your Mac at all!

---

### D. Do I need Xcode if I use EAS?
* **NO! You do NOT need Xcode on your Mac.**
* When you run `npx eas build -p ios --profile preview`, the entire Xcode compilation happens on Expo's remote macOS cloud servers.
* *Note:* You do need an Apple Developer Account ($99/yr) so EAS can generate Apple provisioning profiles and certificates for your devices.

---

## 3. Workflow 1: Publishing an OTA Update (95% of the Time)

Use this for **all JavaScript, TypeScript, React components, screen designs, styles, calculations, and bug fixes**.

### The Command:
```bash
npm run update "v1.1.9: Fixed transaction filter bug and polished Ledger UI"
```

### What this command does automatically:
1. Updates the version number across [`package.json`](file:///Users/tirtharaj/Desktop/Desktop/github/subscription/package.json), [`app.json`](file:///Users/tirtharaj/Desktop/Desktop/github/subscription/app.json), and [`constants/version.ts`](file:///Users/tirtharaj/Desktop/Desktop/github/subscription/constants/version.ts).
2. Bakes the release notes into `app.json.expo.extra`.
3. Publishes the bundle to the EAS `preview` channel.
4. Users open **Settings → Software Update** in the app, see your release notes, and tap **[Download and Install]**.

> ⚠️ **The Golden Rule of OTA:**
> Pure JavaScript/TypeScript packages (like `date-fns`) are 100% OTA-safe. But if you run `npx expo install` for a library that touches native iOS/Android code (e.g. camera, Bluetooth, new biometric hardware), you **MUST** do a native build (Workflow 2 or 3).

---

## 4. Workflow 2: Direct Push to iPhone via USB Cable

### Prerequisites on your iPhone (One-time setup):
1. Plug iPhone into Mac via USB cable.
2. Tap **"Trust This Computer"** on the iPhone screen and enter passcode.
3. Enable **Developer Mode**: On iPhone, go to **Settings → Privacy & Security → Developer Mode → Turn ON** (the iPhone will restart).
4. After restart, unlock the phone and tap **Turn On** to confirm.

---

### Scenario A: Standalone Release on iPhone (Recommended for daily use)
```bash
npm run ios:release
```
* Compiles your app in standalone **Release** mode.
* Installs it directly to your plugged iPhone.
* **You can disconnect the cable, close your Mac, and use the app independently forever.**

---

### Scenario B: Live Development with Metro Hot-Reloading
```bash
npm run ios:device
```
* Compiles the app in **Development** mode.
* Installs on your iPhone and establishes a live connection to the Metro bundler running on your Mac.
* Keep the cable connected or stay on the same Wi-Fi network. Every code edit updates on the iPhone screen in real time.

---

## 5. Workflow 3: Building iOS `.ipa` Files

### Option A: Local Build with Xcode (Creates sideloadable `.ipa`)
```bash
npm run build:ipa
```
* **Script executed:** [`scripts/build-ipa.sh`](file:///Users/tirtharaj/Desktop/Desktop/github/subscription/scripts/build-ipa.sh)
* **What it needs:** Xcode installed on your Mac.
* **Output:** Creates `./monevo.ipa` in the root folder.
* **How to install on iPhone:** Sideload via AltStore, TrollStore, Sideloadly, or Apple Configurator.

---

### Option B: Cloud Build via EAS (NO Xcode required on Mac)
```bash
npx eas build --platform ios --profile preview
```
* Compiles on Expo’s cloud servers.
* Terminal gives you a direct link / QR code to install the ad-hoc build on your registered iPhone.

---

## 6. Workflow 4: Building Android `.apk` Files

### Option A: EAS Cloud Build (Easiest — Zero local tools required)
```bash
npx eas build --platform android --profile preview
```
* **Needs Android Studio?** ❌ No.
* **Needs Java?** ❌ No.
* Compiles on Expo cloud servers. Profile is already configured in [`eas.json`](file:///Users/tirtharaj/Desktop/Desktop/github/subscription/eas.json#L12-L16) to output a direct `.apk`.
* When complete, terminal prints a download URL for the `.apk`.

---

### Option B: Local Build WITH Android Studio
If Android Studio is already installed on your Mac:

1. Ensure environment variables are in your `~/.zshrc`:
   ```bash
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools
   ```
   *(Run `source ~/.zshrc` to reload).*

2. Run from the project root:
   ```bash
   npx expo run:android --variant release
   ```
   *(Or navigate into the android folder and run `./gradlew assembleRelease`).*

3. **Output `.apk` location:**
   `android/app/build/outputs/apk/release/app-release.apk`

---

### Option C: Local Build WITHOUT Android Studio (Terminal Only)
If you do not want the Android Studio visual app on your Mac:

1. **Install Java 17 and Android CLI tools via Homebrew:**
   ```bash
   brew install openjdk@17
   sudo ln -sfn /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-17.jdk
   brew install --cask android-commandlinetools
   ```

2. **Add to `~/.zshrc`:**
   ```bash
   export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
   export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools
   ```

3. **Accept Android licenses and install platform tools:**
   ```bash
   yes | sdkmanager --licenses
   sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"
   ```

4. **Build the APK:**
   ```bash
   cd android && ./gradlew assembleRelease
   ```
   **Output:** `android/app/build/outputs/apk/release/app-release.apk`

---

## 7. Version Bumping Rules

### For OTA Updates:
Just run `npm run update "v1.X.X: Notes"`. It bumps and synchronizes all files automatically.

### For Native Binary Builds (`.apk` / `.ipa`):
Before compiling a new native binary, bump the version using:
```bash
npm run set-version 1.2.0 "v1.2.0: Major native release"
```
This updates [`package.json`](file:///Users/tirtharaj/Desktop/Desktop/github/subscription/package.json), [`app.json`](file:///Users/tirtharaj/Desktop/Desktop/github/subscription/app.json), and [`constants/version.ts`](file:///Users/tirtharaj/Desktop/Desktop/github/subscription/constants/version.ts) simultaneously so your phone recognizes the build as a clean base installation and avoids version downgrade conflicts.

---

## 8. Summary Checklist Before Running Commands

* **Just fixing a bug or editing UI?** ➡️ `npm run update "v1.X.X: Message"`
* **Testing on your iPhone today?** ➡️ Plug USB cable ➡️ `npm run ios:release`
* **Need an Android `.apk` quickly without setup?** ➡️ `npx eas build -p android --profile preview`
* **Need an iOS `.ipa` for AltStore/TrollStore?** ➡️ `npm run build:ipa`
