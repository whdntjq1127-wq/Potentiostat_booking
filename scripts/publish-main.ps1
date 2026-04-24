param(
  [string]$RepoPath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [string]$Remote = 'origin',
  [string]$TargetBranch = 'main'
)

$ErrorActionPreference = 'Stop'

function Invoke-Git {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $output = & git @Arguments 2>&1 | ForEach-Object { "$_" }
  $ErrorActionPreference = $previousPreference

  if ($LASTEXITCODE -ne 0) {
    throw "git $($Arguments -join ' ') failed.`n$($output -join "`n")"
  }

  return ($output -join "`n").Trim()
}

function Get-GitStatus {
  return Invoke-Git -Arguments @('-C', $RepoPath, 'status', '--porcelain')
}

function Get-CurrentBranch {
  return Invoke-Git -Arguments @(
    '-C',
    $RepoPath,
    'symbolic-ref',
    '--quiet',
    '--short',
    'HEAD'
  )
}

if (-not (Test-Path -LiteralPath $RepoPath)) {
  throw "RepoPath does not exist: $RepoPath"
}

$RepoPath = (Resolve-Path -LiteralPath $RepoPath).Path

Invoke-Git -Arguments @('-C', $RepoPath, 'rev-parse', '--is-inside-work-tree') | Out-Null
Invoke-Git -Arguments @('-C', $RepoPath, 'remote', 'get-url', $Remote) | Out-Null

$status = Get-GitStatus
if ($status) {
  throw "Working tree is not clean. Commit or stash changes before publishing to main.`n$status"
}

$currentBranch = Get-CurrentBranch
if ($currentBranch -ne $TargetBranch) {
  throw "Current branch is '$currentBranch'. Check out '$TargetBranch' before publishing."
}

$headCommit = Invoke-Git -Arguments @('-C', $RepoPath, 'rev-parse', 'HEAD')
$headMessage = Invoke-Git -Arguments @('-C', $RepoPath, 'log', '-1', '--pretty=%s')

Invoke-Git -Arguments @(
  '-C',
  $RepoPath,
  'push',
  $Remote,
  "${headCommit}:refs/heads/$TargetBranch"
) | Out-Null

Write-Output "Published $headCommit to $Remote/$TargetBranch"
Write-Output "Commit message: $headMessage"
