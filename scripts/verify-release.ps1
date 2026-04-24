param()

$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $PSScriptRoot 'release.ps1'
$testRoot = Join-Path $PSScriptRoot '.tmp-release-test'
$remotePath = Join-Path $testRoot 'remote.git'
$workPath = Join-Path $testRoot 'work'

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

if (Test-Path $testRoot) {
  Remove-Item -LiteralPath $testRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $testRoot | Out-Null

try {
  Invoke-Git -Arguments @('init', '--bare', $remotePath)
  Invoke-Git -Arguments @('init', $workPath)
  Invoke-Git -Arguments @('-C', $workPath, 'config', 'user.name', 'Release Test')
  Invoke-Git -Arguments @('-C', $workPath, 'config', 'user.email', 'release-test@example.com')
  Invoke-Git -Arguments @('-C', $workPath, 'branch', '-M', 'main')
  Invoke-Git -Arguments @('-C', $workPath, 'remote', 'add', 'origin', $remotePath)

  Set-Content -LiteralPath (Join-Path $workPath 'tracked.txt') -Value 'initial'
  Invoke-Git -Arguments @('-C', $workPath, 'add', 'tracked.txt')
  Invoke-Git -Arguments @('-C', $workPath, 'commit', '-m', 'initial commit')
  Invoke-Git -Arguments @('-C', $workPath, 'push', '-u', 'origin', 'main')

  Add-Content -LiteralPath (Join-Path $workPath 'tracked.txt') -Value 'release-change'
  Invoke-Git -Arguments @('-C', $workPath, 'add', 'tracked.txt')
  Invoke-Git -Arguments @('-C', $workPath, 'commit', '-m', 'release commit')

  $headBefore = Invoke-Git -Arguments @('-C', $workPath, 'rev-parse', 'HEAD')

  & powershell -NoProfile -ExecutionPolicy Bypass -File $scriptPath `
    -RepoPath $workPath

  if ($LASTEXITCODE -ne 0) {
    throw "release.ps1 failed with exit code $LASTEXITCODE"
  }

  $remoteHead = Invoke-Git -Arguments @('--git-dir', $remotePath, 'rev-parse', 'main')
  if ($remoteHead -ne $headBefore) {
    throw "Remote main does not match local HEAD.`nLocal:  $headBefore`nRemote: $remoteHead"
  }

  $remoteMessage = Invoke-Git -Arguments @('--git-dir', $remotePath, 'log', '-1', '--pretty=%s', 'main')
  if ($remoteMessage -ne 'release commit') {
    throw "Unexpected remote main commit message: $remoteMessage"
  }

  Write-Output 'release verification passed.'
}
finally {
  if (Test-Path $testRoot) {
    Remove-Item -LiteralPath $testRoot -Recurse -Force
  }
}
