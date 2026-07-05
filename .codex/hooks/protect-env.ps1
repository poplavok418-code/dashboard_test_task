$ErrorActionPreference = "Stop"

$inputJson = ($input | Out-String)
if ([string]::IsNullOrWhiteSpace($inputJson)) {
  $inputJson = [Console]::In.ReadToEnd()
}
if ([string]::IsNullOrWhiteSpace($inputJson)) {
  exit 0
}

try {
  $hookInput = $inputJson | ConvertFrom-Json
} catch {
  exit 0
}

$toolName = [string]$hookInput.tool_name
if ($toolName -ne "Bash") {
  exit 0
}

$command = [string]$hookInput.tool_input.command
if ([string]::IsNullOrWhiteSpace($command)) {
  exit 0
}

$normalized = $command -replace '\\', '/'
$lower = $normalized.ToLowerInvariant()

$envPathPattern = '(^|[\s''"`=:/\\])(\./)?\.env($|[\s''"`;|&>)])'
$mentionsEnvFile = $lower -match $envPathPattern -or $lower -match '(^|[\s''"`=:/\\])mail_test_task/\.env($|[\s''"`;|&>)])'

$contentReaders = @(
  'cat',
  'type',
  'gc',
  'get-content',
  'more',
  'less',
  'head',
  'tail',
  'sed',
  'awk'
)

$searchCommands = @(
  'rg',
  'grep',
  'select-string',
  'sls',
  'findstr'
)

function Test-CommandWord {
  param(
    [string]$Text,
    [string[]]$Words
  )

  foreach ($word in $Words) {
    $escaped = [Regex]::Escape($word)
    if ($Text -match "(^|[\s;|&])$escaped(\.exe|\.cmd|\.ps1)?($|[\s;|&])") {
      return $true
    }
  }

  return $false
}

$isContentRead = Test-CommandWord -Text $lower -Words $contentReaders
$isSearch = Test-CommandWord -Text $lower -Words $searchCommands
$explicitlyExcludesEnv = $lower -match '(\-\-glob\s+!?\!?\.env|\-g\s+!?\!?\.env|\-\-exclude\s+\.env|\-\-exclude\s*=\s*\.env)'

$blocksEnvRead = $mentionsEnvFile -and ($isContentRead -or $isSearch)
$blocksRepoSearch = $isSearch -and -not $explicitlyExcludesEnv

if ($blocksEnvRead -or $blocksRepoSearch) {
  $reason = "Blocked by repository policy: .env is protected. Do not read it or run grep/search commands that can scan it."
  $payload = @{
    hookSpecificOutput = @{
      hookEventName = "PreToolUse"
      permissionDecision = "deny"
      permissionDecisionReason = $reason
    }
  }

  $payload | ConvertTo-Json -Depth 10 -Compress
  exit 0
}

exit 0
