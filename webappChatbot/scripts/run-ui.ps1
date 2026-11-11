param([switch]$Background)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$localNode = Join-Path $PWD '.tools\node-v14.21.3-win-x64'
if (Test-Path (Join-Path $localNode 'node.exe')) {
    $env:PATH = $localNode + ';' + $env:PATH
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js is missing. See README.md for local setup.'
}
if (-not (Test-Path 'node_modules\@angular\cli\bin\ng')) {
    throw 'Dependencies are missing. Run npm ci as described in README.md.'
}
$env:NG_CLI_ANALYTICS = 'false'
New-Item -ItemType Directory -Path .local\temp -Force | Out-Null
$env:TEMP = Join-Path $PWD '.local\temp'
$env:TMP = $env:TEMP
if ($Background) {
    $nodePath = (Get-Command node).Source
    $uiArguments = @('node_modules\@angular\cli\bin\ng', 'serve', '--host', '127.0.0.1', '--port', '4200') + $args
    $uiProcess = Start-Process -FilePath $nodePath -ArgumentList $uiArguments -WorkingDirectory $PWD -WindowStyle Hidden -RedirectStandardOutput .local\ui.stdout.log -RedirectStandardError .local\ui.stderr.log -PassThru
    @{ ProcessId = $uiProcess.Id; Runtime = $nodePath; Port = 4200 } | ConvertTo-Json | Set-Content -LiteralPath .local\ui-background.json -Encoding UTF8
    Write-Output ('Started background frontend process ' + $uiProcess.Id)
    exit 0
}
& node node_modules\@angular\cli\bin\ng serve --host 127.0.0.1 --port 4200 @args
exit $LASTEXITCODE
