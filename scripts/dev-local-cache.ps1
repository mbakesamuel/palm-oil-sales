# Put `.next` on a fast local disk via directory junction (Windows).
# Use when the repo is on Desktop / OneDrive and you see "Slow filesystem detected".
#
# WARNING: With Next.js 16 + Turbopack, this junction can break module resolution
# ("Next.js package not found", "@tailwindcss/postcss" not found). Prefer Windows
# Defender exclusions or moving the whole repo to C:\dev\... instead.
# If you hit those errors: rmdir .next, delete %LOCALAPPDATA%\pos-app-next-dev, npm run dev.
#
# One-time setup: stop `next dev`, delete `.next` if present, then run:
#   .\scripts\dev-local-cache.ps1
#
# To undo: remove the `.next` junction (`rmdir .next`), your cache stays under %LOCALAPPDATA%.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$link = Join-Path $root ".next"
$target = Join-Path $env:LOCALAPPDATA "pos-app-next-dev"

Set-Location $root

if (Test-Path $link) {
  $item = Get-Item -LiteralPath $link -Force
  if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
    Write-Host ".next is already linked to: $target"
  } else {
    Write-Error @"
.next exists as a normal folder. Stop the dev server, run:
  npm run dev:clean
Then run this script again to link .next to a faster path.
"@
  }
} else {
  New-Item -ItemType Directory -Force -Path $target | Out-Null
  cmd /c mklink /J "`"$link`"" "`"$target`""
  if ($LASTEXITCODE -ne 0) {
    throw "mklink failed. Run PowerShell as Administrator or enable Developer Mode (Settings -> System -> For developers)."
  }
  Write-Host "Linked .next -> $target"
}

Write-Host "Starting next dev..."
npm run dev
