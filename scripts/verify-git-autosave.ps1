param()

$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $PSScriptRoot 'git-autosave.ps1'
$testRoot = Join-Path $PSScriptRoot '.tmp-git-autosave-test'
$remotePath = Join-Path $testRoot 'remote.git'
$workPath = Join-Path $testRoot 'work'

function Invoke-Git {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments,
    [string]$WorkingDirectory
  )

  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $output = & git @Arguments 2>&1 | ForEach-Object { "$_" }
  $ErrorActionPreference = $previousPreference

  if ($LASTEXITCODE -ne 0) {
    throw "git $($Arguments -join ' ') failed.`n$output"
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
  Invoke-Git -Arguments @('-C', $workPath, 'config', 'user.name', 'Autosave Test')
  Invoke-Git -Arguments @('-C', $workPath, 'config', 'user.email', 'autosave-test@example.com')
  Invoke-Git -Arguments @('-C', $workPath, 'branch', '-M', 'main')
  Invoke-Git -Arguments @('-C', $workPath, 'remote', 'add', 'origin', $remotePath)

  Set-Content -LiteralPath (Join-Path $workPath 'tracked.txt') -Value 'initial'
  Invoke-Git -Arguments @('-C', $workPath, 'add', 'tracked.txt')
  Invoke-Git -Arguments @('-C', $workPath, 'commit', '-m', 'initial commit')
  Invoke-Git -Arguments @('-C', $workPath, 'push', '-u', 'origin', 'main')

  Add-Content -LiteralPath (Join-Path $workPath 'tracked.txt') -Value 'changed'

  & powershell -NoProfile -ExecutionPolicy Bypass -File $scriptPath `
    -RepoPath $workPath `
    -IntervalSeconds 1 `
    -Branch 'autosave' `
    -RunOnce `
    -MessagePrefix 'autosave-test'

  if ($LASTEXITCODE -ne 0) {
    throw "git-autosave.ps1 failed with exit code $LASTEXITCODE"
  }

  $status = Invoke-Git -Arguments @('-C', $workPath, 'status', '--porcelain')
  if (-not $status) {
    throw 'Working tree should remain unchanged after autosave, but it is clean.'
  }

  $localMessage = Invoke-Git -Arguments @('-C', $workPath, 'log', '-1', '--pretty=%s')
  if ($localMessage -ne 'initial commit') {
    throw "Local branch should not receive an autosave commit. Actual: $localMessage"
  }

  $remoteMainMessage = Invoke-Git -Arguments @('--git-dir', $remotePath, 'log', '-1', '--pretty=%s', 'main')
  if ($remoteMainMessage -ne 'initial commit') {
    throw "Remote main should remain unchanged. Actual: $remoteMainMessage"
  }

  $remoteMessage = Invoke-Git -Arguments @('--git-dir', $remotePath, 'log', '-1', '--pretty=%s', 'autosave')
  if ($remoteMessage -notlike 'autosave-test:*') {
    throw "Unexpected remote commit message: $remoteMessage"
  }

  $firstRemoteHead = Invoke-Git -Arguments @('--git-dir', $remotePath, 'rev-parse', 'autosave')
  $remoteContent = Invoke-Git -Arguments @('--git-dir', $remotePath, 'show', 'autosave:tracked.txt')
  if ($remoteContent -notmatch 'changed') {
    throw "Remote autosave branch did not capture the modified file contents.`n$remoteContent"
  }

  & powershell -NoProfile -ExecutionPolicy Bypass -File $scriptPath `
    -RepoPath $workPath `
    -IntervalSeconds 1 `
    -Branch 'autosave' `
    -RunOnce `
    -MessagePrefix 'autosave-test'

  if ($LASTEXITCODE -ne 0) {
    throw "git-autosave.ps1 second run failed with exit code $LASTEXITCODE"
  }

  $secondRemoteHead = Invoke-Git -Arguments @('--git-dir', $remotePath, 'rev-parse', 'autosave')
  if ($secondRemoteHead -ne $firstRemoteHead) {
    throw "Autosave created a duplicate commit without new content.`nFirst:  $firstRemoteHead`nSecond: $secondRemoteHead"
  }

  Write-Output 'git autosave verification passed.'
}
finally {
  if (Test-Path $testRoot) {
    Remove-Item -LiteralPath $testRoot -Recurse -Force
  }
}
