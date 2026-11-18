[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$RepoPath,
    [switch]$SkipBackup
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Join-Path $scriptRoot 'cv-strategist-next'

if (-not (Test-Path (Join-Path $projectRoot 'package.json'))) {
    throw "The package project folder was not found: $projectRoot"
}
if (-not (Test-Path $RepoPath)) {
    throw "Repository path does not exist: $RepoPath"
}
$RepoPath = (Resolve-Path $RepoPath).Path
if (-not (Test-Path (Join-Path $RepoPath '.git'))) {
    throw "The selected folder is not a Git repository (missing .git): $RepoPath"
}

$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$backupPath = Join-Path (Split-Path $RepoPath -Parent) ("cv-strategist-pre-recovery-" + $stamp)

if (-not $SkipBackup) {
    New-Item -ItemType Directory -Path $backupPath -Force | Out-Null
    Get-ChildItem -LiteralPath $RepoPath -Force | Where-Object {
        $_.Name -notin @('.git', 'node_modules', '.next', '.env', '.env.local', '.env.production')
    } | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $backupPath -Recurse -Force
    }
    Write-Host "Working-tree backup created: $backupPath" -ForegroundColor Green
}

# Preserve Git history, local environment secrets, and installed build caches.
Get-ChildItem -LiteralPath $RepoPath -Force | Where-Object {
    $_.Name -notin @('.git', 'node_modules', '.next', '.env', '.env.local', '.env.production')
} | ForEach-Object {
    Remove-Item -LiteralPath $_.FullName -Recurse -Force
}

Get-ChildItem -LiteralPath $projectRoot -Force | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $RepoPath -Recurse -Force
}

Write-Host ''
Write-Host 'Recovery files copied successfully.' -ForegroundColor Green
Write-Host "Repository: $RepoPath"
Write-Host 'Canonical Next.js application: src/app (no competing root app folder).'
Write-Host ''
Write-Host 'Next steps (run these yourself after reviewing the files):' -ForegroundColor Cyan
Write-Host '  cd <repository-path>'
Write-Host '  npm install'
Write-Host '  npm run typecheck'
Write-Host '  npm test'
Write-Host '  npm run build'
Write-Host '  git status'
Write-Host '  git add -A'
Write-Host '  git commit -m "Restore complete CV Strategist AI application"'
Write-Host '  git push origin main'
Write-Host ''
Write-Host 'The script did NOT alter .env files, .git history, node_modules, .next, Render settings, or the database.' -ForegroundColor Yellow
