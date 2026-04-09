#!/usr/bin/env bash
# =============================================================================
#  scripts/build-mobile.sh  –  Aetheria: Endless Frontiers  –  Mobile Builder
#  Builds Android APK and/or iOS IPA using Capacitor 5.
# =============================================================================
set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[1;33m'
CYN='\033[0;36m'; BLD='\033[1m'; RST='\033[0m'

info()    { echo -e "${CYN}[INFO]${RST}  $*"; }
success() { echo -e "${GRN}[OK]${RST}    $*"; }
warn()    { echo -e "${YLW}[WARN]${RST}  $*"; }
error()   { echo -e "${RED}[ERR]${RST}   $*"; }

# ── Banner ───────────────────────────────────────────────────────────────────
echo -e "${BLD}${CYN}"
echo "  ╔═══════════════════════════════════════════════════╗"
echo "  ║        AETHERIA: Endless Frontiers                ║"
echo "  ║        Mobile Build Script  (Capacitor 5)        ║"
echo "  ╚═══════════════════════════════════════════════════╝"
echo -e "${RST}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

# ── 1. Check Node.js ─────────────────────────────────────────────────────────
info "Checking prerequisites…"
if ! command -v node &>/dev/null; then
  error "Node.js is not installed. Visit https://nodejs.org and install LTS."
  exit 1
fi
NODE_VER=$(node --version)
success "Node.js $NODE_VER found."

if ! command -v npm &>/dev/null; then
  error "npm not found. Reinstall Node.js."
  exit 1
fi

# ── 2. npm install ───────────────────────────────────────────────────────────
if [ ! -d "$ROOT/node_modules" ]; then
  info "node_modules not found – running npm install…"
  npm install
  success "Dependencies installed."
else
  info "node_modules present – skipping install. (Run 'npm install' manually to update.)"
fi

# ── 3. Assets ────────────────────────────────────────────────────────────────
read -rp "$(echo -e "${YLW}Download quick CC0 assets? [y/N]:${RST} ")" DL_ASSETS
if [[ "$DL_ASSETS" =~ ^[Yy]$ ]]; then
  info "Downloading assets (--quick)…"
  node scripts/download-assets.js --quick || warn "Asset download had errors – continuing anyway."
fi

# ── 4. Detect platforms ──────────────────────────────────────────────────────
PLATFORM=""
case "$(uname -s)" in
  Darwin) PLATFORM="macos" ;;
  Linux)  PLATFORM="linux" ;;
  *)      PLATFORM="other" ;;
esac

BUILD_ANDROID=false
BUILD_IOS=false

if [ "$PLATFORM" = "macos" ]; then
  read -rp "$(echo -e "${YLW}Build for Android? [y/N]:${RST} ")" ANS_A
  [[ "$ANS_A" =~ ^[Yy]$ ]] && BUILD_ANDROID=true
  read -rp "$(echo -e "${YLW}Build for iOS? [y/N]:${RST} ")" ANS_I
  [[ "$ANS_I" =~ ^[Yy]$ ]] && BUILD_IOS=true
else
  BUILD_ANDROID=true
  warn "iOS builds require macOS + Xcode. Skipping iOS on $PLATFORM."
fi

# ── 5. Add Capacitor platforms ───────────────────────────────────────────────
if $BUILD_ANDROID && [ ! -d "$ROOT/android" ]; then
  info "Adding Android platform…"
  npx cap add android
  success "Android platform added."
fi

if $BUILD_IOS && [ ! -d "$ROOT/ios" ]; then
  if [ "$PLATFORM" = "macos" ]; then
    info "Adding iOS platform…"
    npx cap add ios
    success "iOS platform added."
  else
    warn "iOS requires macOS. Skipping."
    BUILD_IOS=false
  fi
fi

# ── 6. Sync web assets ───────────────────────────────────────────────────────
info "Syncing web assets with Capacitor…"
npx cap sync
success "Sync complete."

# ── 7. Build Android ─────────────────────────────────────────────────────────
if $BUILD_ANDROID; then
  if command -v studio &>/dev/null || [ -d "/Applications/Android Studio.app" ] || \
     [ -d "$HOME/android-studio" ] || command -v adb &>/dev/null; then

    info "Building Android release APK…"
    if npx cap build android --prod 2>/dev/null; then
      APK_PATH="$ROOT/android/app/build/outputs/apk/release/app-release.apk"
      success "Android build complete!"
      echo -e "${GRN}  APK location: ${BLD}$APK_PATH${RST}"
    else
      warn "Automated build failed – opening Android Studio…"
      npx cap open android || true
      echo -e "${YLW}  Build manually in Android Studio: Build > Generate Signed Bundle/APK${RST}"
    fi
  else
    warn "Android Studio not found – cannot build automatically."
    info "Opening Android Studio project (if Android Studio is installed elsewhere)…"
    npx cap open android 2>/dev/null || true
    echo ""
    echo -e "${YLW}  ► Install Android Studio from https://developer.android.com/studio${RST}"
    echo -e "${YLW}  ► Then open:  $ROOT/android  in Android Studio${RST}"
    echo -e "${YLW}  ► Run:  Build > Build Bundle(s) / APK(s) > Build APK(s)${RST}"
  fi
fi

# ── 8. Build iOS ─────────────────────────────────────────────────────────────
if $BUILD_IOS; then
  if command -v xcodebuild &>/dev/null; then
    info "Opening Xcode for iOS build…"
    npx cap open ios
    echo ""
    echo -e "${GRN}  ► Xcode is now open. Select your Team in Signing & Capabilities,${RST}"
    echo -e "${GRN}    then Product > Archive to create an IPA.${RST}"
  else
    warn "Xcode not found. Install from the Mac App Store."
    echo -e "${YLW}  ► Then run:  npx cap open ios${RST}"
  fi
fi

# ── 9. Summary ───────────────────────────────────────────────────────────────
echo ""
echo -e "${BLD}${CYN}═══════════════════════════════════════════════════${RST}"
echo -e "${BLD}  Build Complete!${RST}"
if $BUILD_ANDROID; then
  APK="$ROOT/android/app/build/outputs/apk/release/app-release.apk"
  if [ -f "$APK" ]; then
    echo -e "  ${GRN}Android APK:${RST} $APK"
  else
    echo -e "  ${YLW}Android:${RST} Finish build in Android Studio"
  fi
fi
if $BUILD_IOS; then
  echo -e "  ${GRN}iOS:${RST} Finish archive in Xcode"
fi
echo -e "${BLD}${CYN}═══════════════════════════════════════════════════${RST}"
echo ""
