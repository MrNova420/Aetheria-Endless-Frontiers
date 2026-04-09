# 📱 Mobile Release Guide – Aetheria: Endless Frontiers

Full step-by-step instructions for building and distributing the game as a native Android and iOS app using Capacitor 5.

---

## Prerequisites

| Tool | Required For | Install |
|------|-------------|---------|
| Node.js ≥ 14 | Both | https://nodejs.org |
| npm ≥ 6 | Both | (comes with Node.js) |
| Android Studio | Android | https://developer.android.com/studio |
| Java 17 JDK | Android | https://adoptium.net |
| macOS + Xcode ≥ 14 | iOS only | App Store on Mac |
| Apple Developer account ($99/yr) | iOS App Store | https://developer.apple.com |

---

## Quick Build (Local Testing)

```bash
# 1. Install all dependencies
npm install

# 2. Run the automated build script
# Linux/macOS:
bash scripts/build-mobile.sh

# Windows:
scripts\build-mobile.bat
```

This will:
1. Run `npx cap add android` (first time only)
2. Run `npx cap add ios` (macOS only, first time only)
3. Run `npx cap sync` to copy web assets into the native projects
4. Build a debug Android APK (if Android Studio / Gradle is available)

---

## Manual Build Steps

### Android

```bash
# One-time setup
npm install
npx cap add android

# Every build
npx cap sync

# Open in Android Studio to build/run
npx cap open android
```

In Android Studio:
1. Wait for Gradle sync to finish
2. Click **Build → Build Bundle(s)/APK(s) → Build APK(s)**
3. APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

**To install on a device via USB:**
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

**To install without USB (sideload):**
1. Copy the `.apk` to the device
2. On the device: Settings → Security → Allow unknown sources
3. Open the APK file

---

### iOS (macOS only)

```bash
# One-time setup
npm install
npx cap add ios

# Every build
npx cap sync

# Open in Xcode
npx cap open ios
```

In Xcode:
1. Select your Apple Developer team in Signing & Capabilities
2. Click **Product → Build** (⌘B)
3. For device testing: connect iPhone, select it as target, click Run (⌘R)

---

## Release Signing (Required for App Stores)

### Android Release APK

**Step 1: Generate a keystore** (do this ONCE, store it securely)
```bash
keytool -genkey -v \
  -keystore release.keystore \
  -alias aetheria \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

**Step 2: Configure signing in `android/app/build.gradle`**
```groovy
android {
    signingConfigs {
        release {
            storeFile file("../../release.keystore")
            storePassword "YOUR_STORE_PASSWORD"
            keyAlias "aetheria"
            keyPassword "YOUR_KEY_PASSWORD"
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

**Step 3: Build release APK**
```bash
cd android
./gradlew assembleRelease
# Output: app/build/outputs/apk/release/app-release.apk
```

**⚠️ Keep `release.keystore` safe — you need the same keystore for every update.**

---

### iOS Release IPA

1. In Xcode, set Build Configuration to **Release**
2. Go to **Product → Archive**
3. In the Organizer, click **Distribute App**
4. Choose **App Store Connect** for App Store, or **Ad Hoc** for direct distribution
5. Follow the signing wizard

**Requirements:**
- Apple Developer account ($99/year): https://developer.apple.com/programs/
- App registered in App Store Connect: https://appstoreconnect.apple.com
- Valid provisioning profile

---

## Publishing to Stores

### Google Play Store

1. Create account at https://play.google.com/console ($25 one-time fee)
2. Create new app → Fill in store listing (description, screenshots, category)
3. Upload the signed release APK (or AAB bundle)
4. Set content rating (Everyone / 7+)
5. Set pricing (Free)
6. Submit for review (usually 2-7 days)

**Minimum required assets:**
- App icon: 512×512 PNG
- Feature graphic: 1024×500 PNG
- At least 2 screenshots (phone)

### Apple App Store

1. Register app ID at https://developer.apple.com/account
2. Create app in App Store Connect
3. Fill in metadata, upload screenshots (6.7" iPhone required)
4. Upload IPA via Xcode Organizer or Transporter
5. Submit for review (usually 1-3 days)

**Minimum required assets:**
- App icon: 1024×1024 PNG (no alpha)
- At least 3 iPhone screenshots

---

## TestFlight (iOS Beta Testing)

TestFlight allows up to 10,000 beta testers without full App Store review:

1. Upload build to App Store Connect
2. Go to **TestFlight** tab
3. Add testers by email or make it public
4. Testers install via TestFlight app

---

## Termux / Android Sideload (No Store Required)

The fastest way to distribute on Android without the Play Store:

```bash
# Build debug APK
npm install
bash scripts/build-mobile.sh

# The APK is at:
# android/app/build/outputs/apk/debug/app-debug.apk

# Share it via:
# - Google Drive / OneDrive link
# - Direct download from GitHub Releases
# - QR code pointing to the APK URL
```

Users need to enable **"Install from unknown sources"** on their device.

---

## GitHub Releases (Recommended Distribution)

1. Go to https://github.com/MrNova420/Aetheria-Endless-Frontiers/releases
2. Click **Draft a new release**
3. Create tag `v1.0.0-beta.1`
4. Upload `app-debug.apk` as a release asset
5. Write release notes
6. Publish

Users can then download the APK directly from the GitHub release page.

---

## Web Version Hosting (Alternative to App)

The game works perfectly as a hosted web app — no app store needed.

**Free hosting options:**
- **GitHub Pages**: Enable in repo Settings → Pages → branch `main` / `copilot/...`
- **Vercel**: `npx vercel --prod` (auto-detects `server.js`)
- **Netlify**: Drag-and-drop the repo folder
- **Render**: Connect GitHub repo, set start command to `node server.js`

For GitHub Pages, add a `gh-pages` branch with just the static files, or use the root of `main`.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `JAVA_HOME not set` | Install JDK 17, set `JAVA_HOME` env var |
| `SDK location not found` | Open Android Studio → SDK Manager, note SDK path, set `ANDROID_HOME` |
| `Gradle build failed` | Run `cd android && ./gradlew clean assembleDebug` and check error |
| `Xcode: No provisioning profile` | Sign in to Apple Developer account in Xcode Preferences |
| `App crashes on launch` | Check `logcat` (Android) or Xcode console for JS errors |
| `White screen` | The `webDir` in `capacitor.config.json` must point to the folder with `index.html` |
| `Audio not playing` | Browser/WebView requires user gesture before playing audio — this is by design |
