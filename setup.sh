#!/usr/bin/env bash
# =============================================================================
#  AETHERIA: Endless Frontiers  –  Universal Setup & Launch Script
#  Works on: Ubuntu / Debian / Fedora / Arch / macOS
#  Usage:   bash setup.sh          (first run – installs Node.js if needed)
#           bash setup.sh --port 3000   (custom port)
# =============================================================================
set -euo pipefail

PORT="${PORT:-8080}"
for arg in "$@"; do
  case "$arg" in
    --port) shift; PORT="${1:-8080}";;
  esac
done

# ─── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

banner() {
cat <<'EOF'

  ╔══════════════════════════════════════════════════════════╗
  ║                                                          ║
  ║        ⬡  A E T H E R I A                               ║
  ║           Endless Frontiers                              ║
  ║                                                          ║
  ║        AAA  Browser  3-D  RPG  –  Auto Setup             ║
  ║                                                          ║
  ╚══════════════════════════════════════════════════════════╝

EOF
}

ok()   { echo -e "${GREEN}  ✔  $*${NC}"; }
info() { echo -e "${CYAN}  ➜  $*${NC}"; }
warn() { echo -e "${YELLOW}  ⚠  $*${NC}"; }
fail() { echo -e "${RED}  ✘  $*${NC}"; exit 1; }
step() { echo -e "${BOLD}\n── $* ──${NC}"; }

# ─── Detect OS ────────────────────────────────────────────────────────────────
OS="$(uname -s)"
DISTRO=""
if [ -f /etc/os-release ]; then
  . /etc/os-release
  DISTRO="${ID:-}"
fi

banner

# ─── Check / Install Node.js ──────────────────────────────────────────────────
step "Checking Node.js"

install_node_linux() {
  info "Installing Node.js 20 LTS…"
  case "$DISTRO" in
    ubuntu|debian|linuxmint|pop|elementary|kali|raspbian)
      info "Detected Debian/Ubuntu family – using NodeSource PPA"
      if ! command -v curl &>/dev/null; then
        sudo apt-get update -qq && sudo apt-get install -y curl
      fi
      curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - 
      sudo apt-get install -y nodejs
      ;;
    fedora|rhel|centos|rocky|almalinux)
      info "Detected Red Hat family – using NodeSource RPM"
      curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
      sudo dnf install -y nodejs || sudo yum install -y nodejs
      ;;
    arch|manjaro|endeavouros|garuda)
      info "Detected Arch family – using pacman"
      sudo pacman -S --noconfirm nodejs npm
      ;;
    opensuse*|sles)
      info "Detected openSUSE"
      sudo zypper install -y nodejs20
      ;;
    *)
      warn "Unknown distro '$DISTRO'. Attempting snap…"
      if command -v snap &>/dev/null; then
        sudo snap install node --classic --channel=20
      else
        fail "Cannot auto-install Node.js on this system.
       Please install manually from https://nodejs.org and re-run setup.sh"
      fi
      ;;
  esac
}

install_node_mac() {
  info "Detected macOS"
  if command -v brew &>/dev/null; then
    info "Homebrew found – installing node@20"
    brew install node@20 || brew install node
    # Make sure brew node is in PATH
    eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || true)"
    eval "$(/usr/local/bin/brew shellenv 2>/dev/null || true)"
  else
    info "Homebrew not found – installing Homebrew first (requires internet)…"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || /usr/local/bin/brew shellenv)"
    brew install node@20
  fi
}

if command -v node &>/dev/null; then
  NODE_VER="$(node --version)"
  # Require at least Node 14
  MAJOR="${NODE_VER//v/}"; MAJOR="${MAJOR%%.*}"
  if [ "$MAJOR" -lt 14 ]; then
    warn "Node.js $NODE_VER is too old (need ≥ 14). Upgrading…"
    if [ "$OS" = "Darwin" ]; then install_node_mac; else install_node_linux; fi
  else
    ok "Node.js $NODE_VER is already installed"
  fi
else
  warn "Node.js not found – installing automatically…"
  if [ "$OS" = "Darwin" ]; then install_node_mac; else install_node_linux; fi
  if ! command -v node &>/dev/null; then
    fail "Node.js installation failed. Please install from https://nodejs.org and retry."
  fi
fi

ok "Node.js $(node --version)  /  npm $(npm --version)"

# ─── Install npm dependencies ─────────────────────────────────────────────────
step "Installing npm packages"
if [ -f "package.json" ]; then
  npm install --no-optional 2>&1 | tail -5
  ok "npm packages installed"
else
  warn "No package.json found – skipping npm install"
fi

# ─── Verify project files ─────────────────────────────────────────────────────
step "Verifying game files"
REQUIRED=(server.js index.html src/game.js src/player.js src/universe.js)
ALL_OK=true
for f in "${REQUIRED[@]}"; do
  if [ -f "$f" ]; then ok "$f"; else warn "MISSING: $f"; ALL_OK=false; fi
done
$ALL_OK || warn "Some files are missing – game may not load correctly."

# ─── Get local IP for LAN access ─────────────────────────────────────────────
get_ip() {
  if [ "$OS" = "Darwin" ]; then
    ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "unknown"
  else
    hostname -I 2>/dev/null | awk '{print $1}' || echo "unknown"
  fi
}
LOCAL_IP="$(get_ip)"

# ─── Start server ─────────────────────────────────────────────────────────────
step "Starting game server on port $PORT"

# Kill any previous instance on this port
fuser -k "${PORT}/tcp" 2>/dev/null || true

node server.js "$PORT" &
SERVER_PID=$!

# Wait up to 3 seconds for server to come up
for i in 1 2 3; do
  sleep 1
  if kill -0 "$SERVER_PID" 2>/dev/null; then break; fi
done

if ! kill -0 "$SERVER_PID" 2>/dev/null; then
  fail "Server failed to start. Check that port $PORT is free."
fi

ok "Server running  (PID $SERVER_PID)"

echo ""
echo -e "${BOLD}${GREEN}  ════════════════════════════════════════"
echo -e "    GAME IS READY!"
echo -e "  ════════════════════════════════════════${NC}"
echo -e "  ${CYAN}Local  ▶  http://localhost:${PORT}${NC}"
echo -e "  ${CYAN}Network▶  http://${LOCAL_IP}:${PORT}${NC}  (same Wi-Fi / LAN)"
echo ""
echo -e "  Press ${YELLOW}Ctrl+C${NC} to stop the server."
echo ""

# ─── Open browser ─────────────────────────────────────────────────────────────
URL="http://localhost:${PORT}"
if [ "$OS" = "Darwin" ]; then
  open "$URL" 2>/dev/null && info "Opened browser: $URL"
elif command -v xdg-open &>/dev/null; then
  xdg-open "$URL" 2>/dev/null && info "Opened browser: $URL"
elif command -v sensible-browser &>/dev/null; then
  sensible-browser "$URL" 2>/dev/null && info "Opened browser: $URL"
else
  info "Open your browser and navigate to: $URL"
fi

# ─── Keep running until Ctrl+C ────────────────────────────────────────────────
trap 'echo -e "\n${YELLOW}Stopping server…${NC}"; kill "$SERVER_PID" 2>/dev/null; exit 0' INT TERM
wait "$SERVER_PID"
