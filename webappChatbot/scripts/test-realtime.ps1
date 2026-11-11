$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
if (Test-Path .local\mail-settings.json) {
    $mail = Get-Content .local\mail-settings.json -Raw | ConvertFrom-Json
    if ($mail.Mode -ne 'Disabled') { throw 'Pause outbound mail before running synthetic realtime tests.' }
}
$node = Join-Path $root '.tools\node-v14.21.3-win-x64\node.exe'
if (-not (Test-Path $node)) { $node = (Get-Command node -ErrorAction Stop).Source }
$testCode = 0
if (Test-Path .local\signalr-test-state.json) {
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'cleanup-signalr-test.ps1')
    if ($LASTEXITCODE -ne 0) { throw 'Could not clean up the prior synthetic test run.' }
}
try {
    & $node (Join-Path $PSScriptRoot 'test-signalr.cjs')
    $testCode = $LASTEXITCODE
} finally {
    if (Test-Path .local\signalr-test-state.json) {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'cleanup-signalr-test.ps1')
        if ($LASTEXITCODE -ne 0) { $testCode = 1 }
    }
}
exit $testCode
