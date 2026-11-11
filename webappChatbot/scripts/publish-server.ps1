[CmdletBinding()]
param([string]$ReleaseName = ('compileon-' + (Get-Date -Format 'yyyyMMdd-HHmmss')), [switch]$BackendOnly)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot
if ($ReleaseName -notmatch '^[A-Za-z0-9_-]+$') { throw 'ReleaseName may contain only letters, digits, hyphens and underscores.' }
$releaseRoot = Join-Path $projectRoot ('releases\' + $ReleaseName)
if (Test-Path $releaseRoot) { throw 'Release folder already exists. Use a new ReleaseName.' }
$stage = Join-Path $projectRoot ('.local\publish\' + $ReleaseName)
if (Test-Path $stage) { throw 'Staging folder already exists. Use a new ReleaseName.' }
$apiSource = Join-Path (Split-Path $projectRoot -Parent) 'APIchatbot'
$apiStage = Join-Path $stage 'api-source'
$frontend = Join-Path $releaseRoot 'frontend'
$backend = Join-Path $releaseRoot 'backend'
$operations = Join-Path $releaseRoot 'server-setup'
New-Item -ItemType Directory -Path $apiStage,$releaseRoot,$operations -Force | Out-Null
# Copy source only; never copy developer settings, credentials, bin/obj or local files.
foreach ($folder in @('Controllers','Hubs','Model','Repository','Security','Services')) {
    Copy-Item -LiteralPath (Join-Path $apiSource $folder) -Destination $apiStage -Recurse
}
Get-ChildItem -LiteralPath $apiSource -File | Where-Object { $_.Extension -in '.cs','.csproj' } | Copy-Item -Destination $apiStage
Copy-Item -LiteralPath (Join-Path $projectRoot 'deployment\backend.appsettings.json') -Destination (Join-Path $apiStage 'appsettings.json')
# Use project-local caches rather than the developer's NuGet configuration.
$nugetConfig = Join-Path $stage 'NuGet.Config'
@'
<?xml version="1.0" encoding="utf-8"?>
<configuration><packageSources><clear /><add key="nuget.org" value="https://api.nuget.org/v3/index.json" /></packageSources></configuration>
'@ | Set-Content -LiteralPath $nugetConfig -Encoding UTF8
$env:DOTNET_CLI_HOME = Join-Path $projectRoot '.tools\dotnet-home'
$env:NUGET_PACKAGES = Join-Path $projectRoot '.tools\nuget'
$env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
& dotnet restore (Join-Path $apiStage 'AChatBotApi.csproj') -r win-x64 --configfile $nugetConfig --nologo
if ($LASTEXITCODE -ne 0) { throw 'Backend restore failed.' }
& dotnet publish (Join-Path $apiStage 'AChatBotApi.csproj') --no-restore -c Release -r win-x64 --self-contained true -p:PublishSingleFile=false -p:PublishTrimmed=false -p:DebugType=None -p:DebugSymbols=false -o $backend --nologo
if ($LASTEXITCODE -ne 0) { throw 'Backend publish failed.' }
if (-not $BackendOnly) {
$localNode = Join-Path $projectRoot '.tools\node-v14.21.3-win-x64'
$env:PATH = $localNode + ';' + $env:PATH
$env:NG_CLI_ANALYTICS = 'false'
New-Item -ItemType Directory -Path (Join-Path $projectRoot '.local\temp') -Force | Out-Null
$env:TEMP = Join-Path $projectRoot '.local\temp'
$env:TMP = $env:TEMP
& (Join-Path $localNode 'node.exe') node_modules\@angular\cli\bin\ng build --configuration production --source-map=false --progress=false --output-path $frontend
if ($LASTEXITCODE -ne 0) { throw 'Frontend production build failed.' }
# Vendor source maps are copied assets even when Angular source maps are disabled.
foreach ($map in @(Get-ChildItem -LiteralPath $frontend -Recurse -File -Filter '*.map')) {
    if (-not $map.FullName.StartsWith($frontend + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Source map is outside the frontend output.' }
    Remove-Item -LiteralPath $map.FullName
}
Copy-Item -LiteralPath (Join-Path $projectRoot 'deployment\frontend.web.config') -Destination (Join-Path $frontend 'web.config')
}
Copy-Item -LiteralPath (Join-Path $projectRoot 'deployment\Configure-Backend.ps1') -Destination $operations
foreach ($tool in @('Configure-StandaloneDatabase.ps1','Apply-FrontendProxy.ps1','frontend.separate-ports.web.config','SEPARATE_PORTS_SETUP.md')) {
    Copy-Item -LiteralPath (Join-Path $projectRoot ('deployment\' + $tool)) -Destination $operations
}
Copy-Item -LiteralPath (Join-Path $projectRoot 'deployment\DEPLOYMENT.md') -Destination $operations
Copy-Item -LiteralPath (Join-Path $projectRoot 'deployment\DEPLOYMENT.md') -Destination $releaseRoot
# Schemas are for a deliberately selected new database only; no production data export.
Copy-Item -LiteralPath (Join-Path $projectRoot 'database') -Destination $operations -Recurse
Add-Type -AssemblyName System.IO.Compression.FileSystem
$parts = if ($BackendOnly) { @('backend','server-setup') } else { @('frontend','backend','server-setup') }
foreach ($part in $parts) {
    $zip = Join-Path $releaseRoot ($part + '.zip')
    [IO.Compression.ZipFile]::CreateFromDirectory((Join-Path $releaseRoot $part), $zip, [IO.Compression.CompressionLevel]::Optimal, $false)
}
$hashes = Get-ChildItem -LiteralPath $releaseRoot -Filter '*.zip' | Get-FileHash -Algorithm SHA256 | ForEach-Object { $_.Hash.ToLowerInvariant() + '  ' + (Split-Path $_.Path -Leaf) }
$hashes | Set-Content -LiteralPath (Join-Path $releaseRoot 'SHA256SUMS.txt') -Encoding ASCII
Write-Output ('Deployment packages created in ' + $releaseRoot)
