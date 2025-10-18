# PowerShell setup script for DB-Property-Appraisal
# - Checks for Node.js, installs via winget if missing
# - Enables corepack
# - Installs pnpm globally (if not present) and runs pnpm install

param()

Write-Host 'Starting project setup...'

function Command-Exists($cmd) {
    return (Get-Command $cmd -ErrorAction SilentlyContinue) -ne $null
}

# Recommended Node version is in .nvmrc
$recommendedNode = Get-Content -Path "$PSScriptRoot\..\.nvmrc" -ErrorAction SilentlyContinue
if (-not $recommendedNode) { $recommendedNode = '18.20.0' }

if (-not (Command-Exists node)) {
    Write-Host "Node not found. Installing Node LTS via winget (recommended: $recommendedNode)..."
    winget install --id OpenJS.NodeJS.LTS -e --silent
    if (-not (Command-Exists node)) {
        Write-Host 'Node installation via winget did not expose node command. Ensure C:\\Program Files\\nodejs is in your PATH or reinstall Node.' -ForegroundColor Yellow
    }
} else {
    Write-Host 'Node is already installed: ' (node -v)
}

Write-Host 'Enabling corepack...'
if (Command-Exists corepack) { corepack enable } else { Write-Host 'corepack not found but should be available with Node 16.9+. Skipping.' }

if (-not (Command-Exists pnpm)) {
    Write-Host 'Installing pnpm globally via corepack (preferred) or npm as fallback...'
    try {
        corepack prepare pnpm@latest --activate
    } catch {
        npm install -g pnpm
    }
}

Write-Host 'Installing project dependencies with pnpm...'
if (Command-Exists pnpm) { pnpm install } else { npm install }

Write-Host 'Setup finished. To start the dev server, run: pnpm dev (or npm run dev)'
