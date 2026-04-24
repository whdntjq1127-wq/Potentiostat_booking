param(
  [string]$RepoPath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [int]$IntervalSeconds = 300,
  [string]$Branch = 'autosave',
  [string]$Remote = 'origin',
  [string]$MessagePrefix = '[skip render] autosave',
  [switch]$RunOnce
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

function Resolve-TargetBranch {
  return $Branch
}

function Get-RemoteBranchTree {
  param(
    [Parameter(Mandatory = $true)]
    [string]$TargetBranch
  )

  $remoteBranchRef = "refs/heads/$TargetBranch"
  $branchInfo = Invoke-Git -Arguments @(
    '-C',
    $RepoPath,
    'ls-remote',
    '--heads',
    $Remote,
    $remoteBranchRef
  )

  if (-not $branchInfo) {
    return $null
  }

  Invoke-Git -Arguments @(
    '-C',
    $RepoPath,
    'fetch',
    '--quiet',
    '--no-tags',
    $Remote,
    $remoteBranchRef
  ) | Out-Null

  return Invoke-Git -Arguments @(
    '-C',
    $RepoPath,
    'rev-parse',
    'FETCH_HEAD^{tree}'
  )
}

function Invoke-GitWithEnvironment {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments,
    [Parameter(Mandatory = $true)]
    [hashtable]$Environment
  )

  $previousValues = @{}

  foreach ($entry in $Environment.GetEnumerator()) {
    $previousValues[$entry.Key] = [Environment]::GetEnvironmentVariable(
      $entry.Key,
      'Process'
    )
    [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process')
  }

  try {
    return Invoke-Git -Arguments $Arguments
  }
  finally {
    foreach ($entry in $Environment.GetEnumerator()) {
      [Environment]::SetEnvironmentVariable(
        $entry.Key,
        $previousValues[$entry.Key],
        'Process'
      )
    }
  }
}

function Save-Changes {
  param(
    [Parameter(Mandatory = $true)]
    [string]$TargetBranch
  )

  $statusBefore = Get-GitStatus
  if (-not $statusBefore) {
    Write-Output "[$(Get-Date -Format 'u')] No changes detected."
    return $false
  }

  $headCommit = Invoke-Git -Arguments @('-C', $RepoPath, 'rev-parse', 'HEAD')
  $gitIndexPath = Invoke-Git -Arguments @('-C', $RepoPath, 'rev-parse', '--git-path', 'index')
  $temporaryIndex = [System.IO.Path]::GetTempFileName()

  try {
    Copy-Item -LiteralPath $gitIndexPath -Destination $temporaryIndex -Force

    $environment = @{ GIT_INDEX_FILE = $temporaryIndex }
    Invoke-GitWithEnvironment -Arguments @('-C', $RepoPath, 'add', '-A') -Environment $environment | Out-Null

    $treeId = Invoke-GitWithEnvironment -Arguments @(
      '-C',
      $RepoPath,
      'write-tree'
    ) -Environment $environment
    $headTree = Invoke-Git -Arguments @('-C', $RepoPath, 'rev-parse', 'HEAD^{tree}')
    $remoteTree = Get-RemoteBranchTree -TargetBranch $TargetBranch

    if ($treeId -eq $headTree) {
      Write-Output "[$(Get-Date -Format 'u')] No content changes to autosave."
      return $false
    }

    if ($remoteTree -and $treeId -eq $remoteTree) {
      Write-Output "[$(Get-Date -Format 'u')] Autosave branch already has the latest content."
      return $false
    }

    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $message = "${MessagePrefix}: $timestamp"
    $commitId = Invoke-Git -Arguments @(
      '-C',
      $RepoPath,
      'commit-tree',
      $treeId,
      '-p',
      $headCommit,
      '-m',
      $message
    )

    Invoke-Git -Arguments @(
      '-C',
      $RepoPath,
      'push',
      $Remote,
      "${commitId}:refs/heads/$TargetBranch"
    ) | Out-Null

    Write-Output "[$(Get-Date -Format 'u')] Pushed autosave commit to $TargetBranch with message '$message'."
    return $true
  }
  finally {
    if (Test-Path -LiteralPath $temporaryIndex) {
      Remove-Item -LiteralPath $temporaryIndex -Force
    }
  }
}

if ($IntervalSeconds -lt 1) {
  throw 'IntervalSeconds must be at least 1.'
}

if (-not (Test-Path -LiteralPath $RepoPath)) {
  throw "RepoPath does not exist: $RepoPath"
}

$resolvedRepoPath = (Resolve-Path -LiteralPath $RepoPath).Path
$RepoPath = $resolvedRepoPath

Invoke-Git -Arguments @('-C', $RepoPath, 'rev-parse', '--is-inside-work-tree') | Out-Null
Invoke-Git -Arguments @('-C', $RepoPath, 'remote', 'get-url', $Remote) | Out-Null

$targetBranch = Resolve-TargetBranch
Write-Output "Watching $RepoPath"
Write-Output "Remote: $Remote"
Write-Output "Autosave Branch: $targetBranch"
Write-Output "Interval: $IntervalSeconds seconds"

do {
  Save-Changes -TargetBranch $targetBranch | Out-Null

  if ($RunOnce) {
    break
  }

  Start-Sleep -Seconds $IntervalSeconds
} while ($true)
