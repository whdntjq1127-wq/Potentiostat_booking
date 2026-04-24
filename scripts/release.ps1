param(
  [string]$RepoPath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [string]$Remote = 'origin',
  [string]$AutosaveBranch = 'autosave',
  [string]$TargetBranch = 'main',
  [switch]$SkipAutosave
)

$ErrorActionPreference = 'Stop'

$autosaveScript = Join-Path $PSScriptRoot 'git-autosave.ps1'
$publishScript = Join-Path $PSScriptRoot 'publish-main.ps1'

if (-not (Test-Path -LiteralPath $RepoPath)) {
  throw "RepoPath does not exist: $RepoPath"
}

$RepoPath = (Resolve-Path -LiteralPath $RepoPath).Path

if (-not (Test-Path -LiteralPath $autosaveScript)) {
  throw "Missing autosave script: $autosaveScript"
}

if (-not (Test-Path -LiteralPath $publishScript)) {
  throw "Missing publish script: $publishScript"
}

Write-Output "Release repo: $RepoPath"
Write-Output "Remote: $Remote"
Write-Output "Autosave branch: $AutosaveBranch"
Write-Output "Target branch: $TargetBranch"

if (-not $SkipAutosave) {
  & powershell -NoProfile -ExecutionPolicy Bypass -File $autosaveScript `
    -RepoPath $RepoPath `
    -Remote $Remote `
    -Branch $AutosaveBranch `
    -RunOnce

  if ($LASTEXITCODE -ne 0) {
    throw "git-autosave.ps1 failed with exit code $LASTEXITCODE"
  }
}

& powershell -NoProfile -ExecutionPolicy Bypass -File $publishScript `
  -RepoPath $RepoPath `
  -Remote $Remote `
  -TargetBranch $TargetBranch

if ($LASTEXITCODE -ne 0) {
  throw "publish-main.ps1 failed with exit code $LASTEXITCODE"
}

Write-Output "Release completed for $Remote/$TargetBranch"
