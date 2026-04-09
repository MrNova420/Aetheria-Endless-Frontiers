# setup.ps1  –  Aetheria: Endless Frontiers  –  Windows PowerShell Auto-Setup
# Run with:  powershell -ExecutionPolicy Bypass -File setup.ps1

$ErrorActionPreference = 'Stop'

function Write-Banner {
    Write-Host ""
    Write-Host "  ╔═══════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "  ║        AETHERIA: Endless Frontiers                ║" -ForegroundColor Cyan
    Write-Host "  ║        Windows PowerShell Auto-Setup              ║" -ForegroundColor Cyan
    Write-Host "  ╚═══════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Info    { param($m) Write-Host "[INFO]  $m" -ForegroundColor Cyan }
function Write-Ok      { param($m) Write-Host "[OK]    $m" -ForegroundColor Green }
function Write-Warn    { param($m) Write-Host "[WARN]  $m" -ForegroundColor Yellow }
function Write-Err     { param($m) Write-Host "[ERR]   $m" -ForegroundColor Red }

# ── Change to script directory ───────────────────────────────────────────────
Set-Location -Path $PSScriptRoot

Write-Banner

# ── 1. Check / install Node.js ───────────────────────────────────────────────
Write-Info "Checking for Node.js..."
$nodeInstalled = $false
try {
    $nodeVer = & node --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "Node.js $nodeVer found."
        $nodeInstalled = $true
    }
} catch { }

if (-not $nodeInstalled) {
    Write-Warn "Node.js not found. Downloading LTS installer..."

    $installerUrl  = "https://nodejs.org/dist/lts/node-lts-x64.msi"
    $installerPath = "$PSScriptRoot\node-lts-installer.msi"

    Write-Info "Downloading from $installerUrl ..."
    try {
        Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath -UseBasicParsing
    } catch {
        # Fallback: fetch the current LTS version number and build direct URL
        Write-Info "Fetching current LTS version number..."
        $ltsPage  = Invoke-WebRequest -Uri "https://nodejs.org/en/download/" -UseBasicParsing
        $ltsMatch = [regex]::Match($ltsPage.Content, 'node-v(\d+\.\d+\.\d+)-x64\.msi')
        if ($ltsMatch.Success) {
            $ltsVer      = $ltsMatch.Groups[1].Value
            $installerUrl = "https://nodejs.org/dist/v$ltsVer/node-v$ltsVer-x64.msi"
            Write-Info "Downloading Node.js v$ltsVer ..."
            Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath -UseBasicParsing
        } else {
            Write-Err "Could not determine Node.js LTS version."
            Write-Err "Please install manually from https://nodejs.org/"
            Read-Host "Press Enter to exit"
            exit 1
        }
    }

    Write-Info "Running Node.js installer (this may take a minute)..."
    Start-Process msiexec.exe -ArgumentList "/i `"$installerPath`" /quiet /norestart" -Wait

    # Refresh PATH so node is available in this session
    $env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' +
                [System.Environment]::GetEnvironmentVariable('Path','User')

    Remove-Item $installerPath -ErrorAction SilentlyContinue

    try {
        $nodeVer = & node --version 2>&1
        Write-Ok "Node.js $nodeVer installed successfully."
    } catch {
        Write-Err "Node.js installation may require a system restart."
        Write-Warn "Please restart your terminal / computer, then run this script again."
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# ── 2. npm install ───────────────────────────────────────────────────────────
Write-Info "Installing npm dependencies..."
& npm install
if ($LASTEXITCODE -ne 0) {
    Write-Err "npm install failed."
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Ok "Dependencies installed."

# ── 3. Start server ──────────────────────────────────────────────────────────
Write-Info "Starting Aetheria server on http://localhost:8080 ..."
Write-Host ""
Write-Host "  Press Ctrl+C in this window to stop the server." -ForegroundColor Yellow
Write-Host ""

# Open browser after a short delay
Start-Job -ScriptBlock {
    Start-Sleep -Seconds 2
    Start-Process "http://localhost:8080"
} | Out-Null

& node server.js
