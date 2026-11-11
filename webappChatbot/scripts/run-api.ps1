param([switch]$Build, [switch]$Background)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot
$source = Join-Path (Split-Path $projectRoot -Parent) 'APIchatbot'
$staging = Join-Path $projectRoot '.local\api\source'
$runtime = Join-Path $projectRoot '.tools\dotnet\dotnet.exe'
$assembly = Join-Path $staging 'bin\Debug\net5.0\AChatBotApi.dll'
if (-not (Test-Path $runtime)) { throw 'Local ASP.NET Core 5 runtime is missing. See README.md.' }
if ($Build -or -not (Test-Path $assembly)) {
    if (-not (Test-Path (Join-Path $source 'AChatBotApi.csproj'))) { throw 'Companion APIchatbot project is missing.' }
    New-Item -ItemType Directory -Path $staging -Force | Out-Null
    Copy-Item -Path (Join-Path $source '*') -Destination $staging -Recurse -Force
    $env:DOTNET_CLI_HOME = Join-Path $projectRoot '.tools\dotnet-home'
    $env:NUGET_PACKAGES = Join-Path $projectRoot '.tools\nuget'
    $env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
    & dotnet build (Join-Path $staging 'AChatBotApi.csproj') --configuration Debug --nologo
    if ($LASTEXITCODE -ne 0) { throw 'API build failed.' }
}
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:ASPNETCORE_URLS = 'http://127.0.0.1:5000'
$env:Logging__EventLog__LogLevel__Default = 'None'
if (Test-Path (Join-Path $projectRoot '.local\database-settings.json')) {
    . (Join-Path $PSScriptRoot 'database-connection.ps1')
    $env:ConnectionStrings__Dbconnection = Get-ChatbotConnectionString
}
if (Test-Path (Join-Path $projectRoot '.local\mail-settings.json')) {
    $mailSettings = Get-Content (Join-Path $projectRoot '.local\mail-settings.json') -Raw | ConvertFrom-Json
    foreach ($name in @('Host','Port','Username','FromAddress','FromName','EnableSsl','Mode','PublicSiteUrl')) {
        [Environment]::SetEnvironmentVariable(('Mail__' + $name), [string]$mailSettings.$name, 'Process')
    }
    $env:Mail__PickupDirectory = Join-Path $projectRoot '.local\mail-preview'
    if (Test-Path (Join-Path $projectRoot '.local\mail-credential.xml')) {
        $mailCredential = Import-Clixml (Join-Path $projectRoot '.local\mail-credential.xml')
        $env:Mail__Password = $mailCredential.GetNetworkCredential().Password
    }
}
Set-Location $staging
if ($Background) {
    $apiProcess = Start-Process -FilePath $runtime -ArgumentList $assembly -WorkingDirectory $staging -WindowStyle Hidden -RedirectStandardOutput (Join-Path $projectRoot '.local\api.stdout.log') -RedirectStandardError (Join-Path $projectRoot '.local\api.stderr.log') -PassThru
    @{ ProcessId = $apiProcess.Id; Runtime = $runtime; Database = 'DbChatBoxTest'; Port = 5000 } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $projectRoot '.local\api-background.json') -Encoding UTF8
    Remove-Item Env:\ConnectionStrings__Dbconnection -ErrorAction SilentlyContinue
    Remove-Item Env:\Mail__Password -ErrorAction SilentlyContinue
    Write-Output ('Started background API process ' + $apiProcess.Id)
    exit 0
}
& $runtime $assembly
exit $LASTEXITCODE
