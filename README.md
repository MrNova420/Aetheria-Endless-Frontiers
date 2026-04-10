# 🌌 Aetheria: Endless Frontiers

A No Man's Sky-inspired 3D browser RPG with procedural worlds, real-time exploration, combat, ship flight, crafting, and mobile support via Capacitor.

> **Beta 2** – fully playable in any WebGL2 browser, no install required.

---

## 🚀 Quick Start

### Method 1 – Node.js server (recommended)
```bash
npm install
npm start
# Open http://localhost:8080
```

### Method 2 – Python fallback
```bash
python3 -m http.server 8080
# Open http://localhost:8080
```

### Method 3 – Direct file
Open `index.html` directly in Chrome/Firefox (some features require a server).

---

## 🎮 Controls

| Key / Input | Action |
|-------------|--------|
| `W A S D` | Move |
| `Shift` | Sprint |
| `Space` | Jetpack thrust |
| `F` | Scanner pulse |
| `Left click` (held) | Mine resource node |
| `Right click` | Attack nearest creature |
| `1` – `0` | Select quickslot |
| `G` | Enter / Exit ship |
| `Tab` | Inventory |
| `N` | Crafting menu |
| `T` | Tech tree |
| `M` | Galaxy map |
| `P` | Manual save |
| `O` | Load save |
| `Esc` | Pause |

---

## 📋 Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | ≥ 14 | Server + build scripts |
| npm | ≥ 6 | Package management |
| Chrome/Firefox/Edge | Latest | WebGL2 support |
| Android Studio *(optional)* | Latest | Android APK |
| Xcode *(optional, macOS)* | ≥ 14 | iOS IPA |

---

## ⚙️ Setup

### Windows
```bat
setup.bat
```
Or with PowerShell (auto-installs Node.js if missing):
```powershell
powershell -ExecutionPolicy Bypass -File setup.ps1
```

### Linux / macOS
```bash
chmod +x setup.sh
./setup.sh
```

---

## 📱 Termux (Android Terminal)

Play directly on Android using [Termux](https://f-droid.org/packages/com.termux/) — no app store needed.

```bash
# In Termux on Android
pkg install git nodejs -y
git clone https://github.com/MrNova420/Aetheria-Endless-Frontiers.git
cd Aetheria-Endless-Frontiers
bash setup-termux.sh
```

Then open **http://localhost:8080** in Chrome on the same device.  
To play from another device on the same Wi-Fi, use the LAN IP shown in the terminal.

---

## 📱 Mobile App Build (Android & iOS)

Aetheria uses **Capacitor 5** to wrap the web game as a native app.

### Install dependencies
```bash
npm install
```

### Linux / macOS
```bash
chmod +x scripts/build-mobile.sh
npm run mobile:build
```

### Windows
```bat
scripts\build-mobile.bat
```

### Manual steps
```bash
npx cap add android        # first time only
npx cap add ios            # macOS only, first time only
npx cap sync               # sync web assets
npx cap open android       # open Android Studio
npx cap open ios           # open Xcode (macOS)
```

**Android APK location after build:**
```
android/app/build/outputs/apk/release/app-release.apk
```

---

## 🎮 Controls

### Keyboard & Mouse

| Key / Input | Action |
|-------------|--------|
| `W A S D` | Move |
| `Mouse` | Look / Aim |
| `Space` | Jump / Jetpack |
| `Shift` | Sprint |
| `E` | Interact / Mine |
| `F` | Scan / Analyse |
| `G` | Enter / Exit Ship |
| `Tab` | Open Inventory |
| `C` | Open Crafting |
| `M` | Galaxy Map |
| `Escape` | Pause |
| `1–5` | Quick-bar slots |

### Ship Flight

| Key | Action |
|-----|--------|
| `W / S` | Throttle |
| `A / D` | Yaw |
| `Mouse` | Pitch / Roll |
| `Space` | Boost |
| `G` | Land / Exit |

### Touch (Mobile)

| Control | Action |
|---------|--------|
| Left joystick | Move |
| Right drag | Look |
| Jump button | Jump |
| Mine button | Mine / Interact |
| Scan button | Scan |
| INV button | Inventory |

---

## 📦 Asset Download

CC0 3D models and textures can be downloaded automatically:

```bash
npm run assets           # full download
npm run assets:quick     # essential assets only
```

Or manually run:
```bash
# Linux/macOS
./scripts/download-assets.sh

# Windows
scripts\download-assets.bat
```

See [LICENSE-ASSETS.md](LICENSE-ASSETS.md) for full credits.

---

## ✨ Game Features

- 🪐 **Procedural planets** – 8+ biome types: lush, barren, toxic, frozen, volcanic, aquatic, desert, exotic
- ⛏️ **Mining & resources** – 20+ resource types with rarity tiers and scanning system
- 🚀 **Ship flight** – atmospheric → space → galaxy-map seamless transitions
- 🏗️ **Crafting system** – 40+ recipes, tech upgrades, multi-step crafting chains
- 👾 **Creatures & flora** – procedurally generated fauna and plant-life per biome
- 🌌 **Galaxy map** – 100 star systems with warp travel
- 🎒 **Inventory** – 48-slot grid with equipment slots, rarity colouring
- 🎵 **Procedural audio** – Web Audio API synthesised SFX and ambient music
- 📱 **Mobile ready** – full touch controls, Capacitor Android/iOS build

---

## 🛠️ Tech Stack

| Technology | Version | Role |
|-----------|---------|------|
| Three.js | r162 | 3D rendering (WebGL2) |
| WebGL2 | – | GPU shaders, post-processing |
| Web Audio API | – | Procedural sound |
| Capacitor | 5.7 | Android / iOS wrapper |
| Node.js | ≥14 | Dev server |

---

## 📁 Project Structure

```
aetheria-endless-frontiers/
├── index.html              # Entry point
├── server.js               # Node.js static server
├── capacitor.config.json   # Mobile config
├── css/
│   └── style.css           # NMS holographic UI styles
├── src/
│   ├── game.js             # Main game loop & state machine
│   ├── assets.js           # GLTFLoader + TextureLoader + manifest
│   ├── player.js           # Player controller + physics
│   ├── ship.js             # Ship flight system
│   ├── planet.js           # Planet generator + atmosphere
│   ├── terrain.js          # Chunked terrain + LOD
│   ├── flora.js            # Procedural vegetation
│   ├── creatures.js        # AI creature system
│   ├── mining.js           # Resource extraction
│   ├── inventory.js        # Item management
│   ├── crafting.js         # Recipe system
│   ├── galaxy.js           # Star system generation
│   ├── space.js            # Space scene renderer
│   ├── ui.js               # HUD & menus
│   ├── audio.js            # Web Audio manager
│   ├── shaders.js          # Custom GLSL shaders
│   ├── noise.js            # Perlin / simplex noise
│   └── config.js           # Game constants
├── assets/
│   └── manifest.json       # Asset registry
├── scripts/
│   ├── download-assets.js  # CC0 asset downloader (Node)
│   ├── download-assets.sh  # Linux/macOS wrapper
│   ├── download-assets.bat # Windows wrapper
│   ├── build-mobile.sh     # Capacitor build (Linux/macOS)
│   └── build-mobile.bat    # Capacitor build (Windows)
├── setup.sh                # Linux/macOS auto-setup
├── setup.bat               # Windows auto-setup
└── setup.ps1               # PowerShell auto-setup
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Architecture, module API, adding features |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System diagrams, data-flow, memory management |
| [docs/LIMITATIONS.md](docs/LIMITATIONS.md) | Known bugs, gaps, what still needs doing |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Beta 2 → v1.0 → v2.0 feature plan |
| [docs/MOBILE_RELEASE.md](docs/MOBILE_RELEASE.md) | iOS + Android store release guide |
| [LICENSE-ASSETS.md](LICENSE-ASSETS.md) | CC0 asset credits |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit: `git commit -m "feat: description"`
4. Push: `git push origin feat/my-feature`
5. Open a Pull Request

Please keep new features modular (one file per system in `src/`).

---

## 📄 License

- **Game code** – MIT License © 2026 MrNova420
- **Assets** – CC0 1.0 Universal (see [LICENSE-ASSETS.md](LICENSE-ASSETS.md))

---

*Built with Three.js, Web Audio API, and Capacitor.*
