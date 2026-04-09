@echo off
:: scripts\download-assets.bat  –  Windows asset download helper
:: Forwards all arguments to the Node.js downloader.
cd /d "%~dp0.."
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js is required. Run setup.bat first to install it.
    pause
    exit /b 1
)
node scripts\download-assets.js %*
