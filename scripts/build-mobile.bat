@echo off
:: =============================================================================
::  scripts\build-mobile.bat  –  Aetheria: Endless Frontiers  –  Mobile Builder
::  Windows CMD version – builds Android APK using Capacitor 5.
:: =============================================================================
setlocal EnableDelayedExpansion

echo.
echo  ╔═══════════════════════════════════════════════════╗
echo  ║        AETHERIA: Endless Frontiers                ║
echo  ║        Mobile Build Script  (Capacitor 5)        ║
echo  ╚═══════════════════════════════════════════════════╝
echo.

:: ── Change to repo root ──────────────────────────────────────────────────────
cd /d "%~dp0.."

:: ── 1. Check Node.js ─────────────────────────────────────────────────────────
echo [INFO]  Checking prerequisites...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERR]   Node.js is not installed.
    echo         Download from: https://nodejs.org/en/download/
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do set NODE_VER=%%v
echo [OK]    Node.js !NODE_VER! found.

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERR]   npm not found. Reinstall Node.js.
    pause
    exit /b 1
)

:: ── 2. npm install ───────────────────────────────────────────────────────────
if not exist "node_modules" (
    echo [INFO]  node_modules missing – running npm install...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERR]   npm install failed.
        pause
        exit /b 1
    )
    echo [OK]    Dependencies installed.
) else (
    echo [INFO]  node_modules present – skipping install.
)

:: ── 3. Assets ────────────────────────────────────────────────────────────────
set /p DL_ASSETS="Download quick CC0 assets? [y/N]: "
if /i "!DL_ASSETS!"=="y" (
    echo [INFO]  Downloading assets...
    node scripts\download-assets.js --quick
    if %errorlevel% neq 0 (
        echo [WARN]  Asset download had errors – continuing anyway.
    )
)

:: ── 4. Add Android platform if missing ──────────────────────────────────────
if not exist "android" (
    echo [INFO]  Adding Android platform...
    call npx cap add android
    if %errorlevel% neq 0 (
        echo [ERR]   Failed to add Android platform.
        pause
        exit /b 1
    )
    echo [OK]    Android platform added.
)

:: ── 5. Sync ──────────────────────────────────────────────────────────────────
echo [INFO]  Syncing web assets with Capacitor...
call npx cap sync
if %errorlevel% neq 0 (
    echo [ERR]   cap sync failed.
    pause
    exit /b 1
)
echo [OK]    Sync complete.

:: ── 6. Build Android ─────────────────────────────────────────────────────────
echo [INFO]  Attempting Android build...
call npx cap build android --prod
if %errorlevel% neq 0 (
    echo [WARN]  Automated build failed – opening Android Studio...
    call npx cap open android
    echo.
    echo  ┌─────────────────────────────────────────────────────────┐
    echo  │  Finish the build in Android Studio:                    │
    echo  │    Build ^> Build Bundle(s) / APK(s) ^> Build APK(s)    │
    echo  │  APK will be at:                                        │
    echo  │    android\app\build\outputs\apk\release\app-release.apk│
    echo  └─────────────────────────────────────────────────────────┘
) else (
    echo [OK]    Android build complete!
    echo.
    echo  APK location:
    echo    android\app\build\outputs\apk\release\app-release.apk
)

echo.
echo  ═══════════════════════════════════════════════════
echo   Build script complete. Check above for APK path.
echo  ═══════════════════════════════════════════════════
echo.
pause
