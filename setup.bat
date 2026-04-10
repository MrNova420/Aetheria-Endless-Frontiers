@echo off
setlocal enabledelayedexpansion
title AETHERIA: Endless Frontiers – Setup ^& Launch

:: ============================================================
::  AETHERIA: Endless Frontiers  –  Windows Setup Script
::  Double-click this file to install Node.js (if needed)
::  and launch the game automatically in your browser.
:: ============================================================

set PORT=8080
set GAME_URL=http://localhost:%PORT%

echo.
echo   +----------------------------------------------------+
echo   ^|                                                    ^|
echo   ^|    ^^^  A E T H E R I A                             ^|
echo   ^|       Endless Frontiers                            ^|
echo   ^|                                                    ^|
echo   ^|    AAA Browser 3-D RPG  -  Windows Setup          ^|
echo   ^|                                                    ^|
echo   +----------------------------------------------------+
echo.

:: ── Check Node.js ─────────────────────────────────────────────
echo [1/4] Checking for Node.js...
where node >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    for /f "tokens=*" %%V in ('node --version 2^>nul') do set NODE_VER=%%V
    echo   OK  Node.js !NODE_VER! found
    goto :check_done
)

echo   Node.js not found. Attempting automatic installation...
echo.

:: ── Try winget (Windows 10 1709+ / Windows 11) ────────────────
where winget >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo   Using Windows Package Manager (winget)...
    winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements --silent
    if !ERRORLEVEL! EQU 0 (
        echo   Node.js installed successfully via winget.
        echo.
        echo   IMPORTANT: You may need to close and re-open this window
        echo   for Node.js to be recognised. If so, run setup.bat again.
        echo.
        :: Refresh PATH
        for /f "tokens=*" %%P in ('powershell -NoProfile -Command "[System.Environment]::GetEnvironmentVariable(\"PATH\",\"Machine\") + \";\" + [System.Environment]::GetEnvironmentVariable(\"PATH\",\"User\")"') do set "PATH=%%P"
        goto :check_done
    )
    echo   winget install failed – falling back to PowerShell downloader...
)

:: ── Fallback: download installer via PowerShell ───────────────
echo   Downloading Node.js 20 LTS installer...
set INSTALLER=%TEMP%\node_installer.msi
set NODE_URL=https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%INSTALLER%' -UseBasicParsing; Write-Host 'Download complete.' } catch { Write-Host 'Download failed:' $_.Exception.Message; exit 1 }"

if not exist "%INSTALLER%" (
    echo.
    echo   Could not download Node.js automatically.
    echo   Please download and install it manually from:
    echo   https://nodejs.org
    echo.
    echo   Then run setup.bat again.
    echo.
    start https://nodejs.org/en/download/
    pause
    exit /b 1
)

echo   Installing Node.js silently (this may take ~60 seconds)...
msiexec /i "%INSTALLER%" /quiet /norestart ADDLOCAL=ALL
if %ERRORLEVEL% NEQ 0 (
    echo   Silent install failed. Running interactive installer...
    msiexec /i "%INSTALLER%"
)
del /f /q "%INSTALLER%" 2>nul

:: Refresh PATH after install
for /f "tokens=*" %%P in ('powershell -NoProfile -Command "[System.Environment]::GetEnvironmentVariable(\"PATH\",\"Machine\") + \";\" + [System.Environment]::GetEnvironmentVariable(\"PATH\",\"User\")"') do set "PATH=%%P"

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo   Node.js was installed but is not in PATH yet.
    echo   Please close this window and run setup.bat again.
    pause
    exit /b 1
)
echo   Node.js installed successfully.

:check_done

:: ── Verify game files ─────────────────────────────────────────
echo.
echo [2/4] Verifying game files...
set MISSING=0
if not exist "server.js"      ( echo   MISSING: server.js       & set MISSING=1 )
if not exist "index.html"     ( echo   MISSING: index.html      & set MISSING=1 )
if not exist "src\game.js"    ( echo   MISSING: src\game.js     & set MISSING=1 )
if not exist "src\universe.js" ( echo   MISSING: src\universe.js & set MISSING=1 )
if not exist "src\player.js"  ( echo   MISSING: src\player.js   & set MISSING=1 )
if %MISSING% EQU 0 (
    echo   All core game files present.
) else (
    echo   WARNING: Some files missing – game may not work correctly.
)

:: ── Install npm packages ──────────────────────────────────────
echo.
echo [3/5] Installing npm packages...
if exist "package.json" (
    call npm install --no-optional
    if %ERRORLEVEL% EQU 0 ( echo   npm packages installed. ) else ( echo   WARNING: npm install had errors. )
) else (
    echo   No package.json found - skipping.
)

:: ── Kill any existing server on port ──────────────────────────
echo.
echo [4/5] Freeing port %PORT%...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%PORT% " 2^>nul') do (
    taskkill /PID %%P /F >nul 2>&1
)
echo   Port %PORT% is free.

:: ── Start server ──────────────────────────────────────────────
echo.
echo [5/5] Starting game server...
start /B "" node server.js %PORT%
timeout /t 2 /nobreak >nul

:: Verify server started
netstat -ano | findstr ":%PORT% " >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo   WARNING: Server may not have started. Check for errors above.
) else (
    echo   Server is running on port %PORT%.
)

:: ── Open browser ──────────────────────────────────────────────
echo.
echo   Opening game in default browser...
start "" "%GAME_URL%"
timeout /t 1 /nobreak >nul

:: ── Final info ────────────────────────────────────────────────
echo.
echo   +----------------------------------------------------+
echo   ^|   GAME IS RUNNING!                                ^|
echo   ^|                                                   ^|
echo   ^|   Local   ^>  %GAME_URL%              ^|
echo   ^|                                                   ^|
echo   ^|   Recommended: Chrome, Firefox, or Edge           ^|
echo   +----------------------------------------------------+
echo.
echo   This window keeps the server alive.
echo   Close this window to stop the server.
echo.
echo   Press any key to close the server...
pause >nul

:: Kill server on exit
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%PORT% " 2^>nul') do (
    taskkill /PID %%P /F >nul 2>&1
)
echo   Server stopped.
endlocal
