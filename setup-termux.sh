#!/usr/bin/env bash
# =============================================================================
#  AETHERIA: Endless Frontiers  –  Termux Setup & Launch Script
#  Termux is an Android terminal emulator that provides a Linux environment.
#
#  INSTALL TERMUX:
#    https://f-droid.org/packages/com.termux/  (F-Droid – recommended)
#    https://play.google.com/store/apps/details?id=com.termux  (Play Store)
#
#  USAGE (inside Termux on Android):
#    pkg install git -y
#    git clone https://github.com/MrNova420/Aetheria-Endless-Frontiers.git
#    cd Aetheria-Endless-Frontiers
#    bash setup-termux.sh
#
#  Then open your Android browser and go to: http://localhost:8080
#  For other devices on the same Wi-Fi use your phone's local IP shown on start.
# =============================================================================

set -euo pipefail

PORT="${PORT:-8080}"
for arg in "$@"; do
  case "$arg" in
    --port) shift; PORT="${1:-8080}";;
    --port=*) PORT="${arg#*=}";;
  esac
done

# ─── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ok()   { echo -e "${GREEN}  ✔  $*${NC}"; }
info() { echo -e "${CYAN}  ➜  $*${NC}"; }
warn() { echo -e "${YELLOW}  ⚠  $*${NC}"; }
fail() { echo -e "${RED}  ✘  $*${NC}"; exit 1; }
step() { echo -e "${BOLD}\n── $* ──${NC}"; }

echo -e "${CYAN}"
cat <<'BANNER'

  ╔══════════════════════════════════════════════════════════╗
  ║                                                          ║
  ║        ⬡  A E T H E R I A                               ║
  ║           Endless Frontiers                              ║
  ║                                                          ║
  ║        Termux  /  Android  Setup                         ║
  ║                                                          ║
  ╚══════════════════════════════════════════════════════════╝

BANNER
echo -e "${NC}"

# ─── Verify we're in Termux ───────────────────────────────────────────────────
step "Detecting environment"
IS_TERMUX=false
if [ -d "/data/data/com.termux" ] || [ -n "${TERMUX_VERSION:-}" ] || command -v pkg &>/dev/null; then
  IS_TERMUX=true
  ok "Termux environment detected"
else
  warn "Termux not detected – running in a standard Linux shell."
  warn "This script is optimised for Termux but will still work on any Linux."
  info "For standard Linux/macOS use  bash setup.sh  instead."
  echo ""
fi

# ─── Update package lists ─────────────────────────────────────────────────────
step "Updating Termux packages"
if $IS_TERMUX; then
  info "Running: pkg update -y"
  pkg update -y 2>/dev/null || warn "pkg update had warnings (usually fine)"
  ok "Package lists updated"
else
  info "Skipping pkg update (not Termux)"
fi

# ─── Install required packages ────────────────────────────────────────────────
step "Installing dependencies"

install_pkg() {
  local pkg_name="$1"
  local check_cmd="${2:-$1}"
  if command -v "$check_cmd" &>/dev/null; then
    ok "$pkg_name already installed ($(command -v "$check_cmd"))"
  else
    if $IS_TERMUX; then
      info "Installing $pkg_name via pkg…"
      pkg install "$pkg_name" -y
      ok "$pkg_name installed"
    else
      warn "$pkg_name not found – please install it manually"
    fi
  fi
}

# Core tools
install_pkg git git
install_pkg nodejs node
install_pkg npm npm

# Optional but useful in Termux
if $IS_TERMUX; then
  install_pkg termux-api termux-open 2>/dev/null || \
    warn "termux-api not available – browser auto-open will be skipped"
fi

# ─── Verify Node.js version ───────────────────────────────────────────────────
step "Checking Node.js version"
NODE_VER=$(node --version 2>/dev/null || echo "v0.0.0")
NODE_MAJOR=$(echo "$NODE_VER" | sed 's/v\([0-9]*\).*/\1/')
if [ "$NODE_MAJOR" -lt 14 ]; then
  fail "Node.js $NODE_VER is too old. Termux: run  pkg install nodejs  to get the latest."
fi
ok "Node.js $NODE_VER (≥14 required)"

# ─── Install npm dependencies ─────────────────────────────────────────────────
step "Installing npm packages"
cd "$(dirname "$0")"
REPO_DIR="$(pwd)"

if [ -f "package.json" ]; then
  info "Running npm install in $REPO_DIR …"
  # On Termux use --no-optional to avoid native build issues
  npm install --no-optional 2>&1 | tail -5
  ok "npm install complete"
else
  fail "package.json not found. Are you running this from the repo root?"
fi

# ─── Optional: download CC0 assets ───────────────────────────────────────────
step "CC0 Asset Download (optional)"
info "The game runs fully procedurally without assets."
info "To download real CC0 models & textures run:"
echo ""
echo "    node scripts/download-assets.js --quick"
echo ""
warn "Skipping auto-download to keep Termux setup fast."
warn "Download requires ~150 MB of network data."

# ─── Get device IP for LAN access ─────────────────────────────────────────────
step "Network information"
# Try multiple methods to find LAN IP
LAN_IP=""
if $IS_TERMUX; then
  # Termux: try ip route
  LAN_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") {print $(i+1); exit}}') || true
fi
if [ -z "$LAN_IP" ]; then
  LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}') || true
fi
if [ -z "$LAN_IP" ]; then
  LAN_IP="<your-phone-ip>"
fi

echo ""
echo -e "${GREEN}  Local  →  http://localhost:${PORT}${NC}"
echo -e "${GREEN}  LAN    →  http://${LAN_IP}:${PORT}${NC}"
echo ""
echo -e "${YELLOW}  ➜  Open the Local URL in any browser on this device.${NC}"
echo -e "${YELLOW}  ➜  Use the LAN URL to play on another device on the same Wi-Fi.${NC}"
echo ""

# ─── Try to open browser automatically ───────────────────────────────────────
open_browser() {
  local url="http://localhost:${PORT}"
  if $IS_TERMUX && command -v termux-open-url &>/dev/null; then
    info "Opening browser via termux-open-url…"
    termux-open-url "$url" &
  elif command -v xdg-open &>/dev/null; then
    xdg-open "$url" &
  elif command -v open &>/dev/null; then
    open "$url" &
  else
    info "Could not auto-open browser. Navigate to: $url"
  fi
}

# ─── Start server ─────────────────────────────────────────────────────────────
step "Starting game server"
info "Server will run on port $PORT"
info "Press Ctrl+C to stop"
echo ""

# Give a moment then open browser
(sleep 2 && open_browser) &

PORT=$PORT node server.js
