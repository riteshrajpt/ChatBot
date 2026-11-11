[CmdletBinding()]
param([string]$ReleaseName = 'compileon-20261111', [switch]$WithDatabase)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
if ($ReleaseName -notmatch '^[A-Za-z0-9_-]+$') { throw 'Invalid release name.' }
$release = Join-Path $projectRoot ('releases\' + $ReleaseName)
$backend = Join-Path $release 'backend'
$executable = Join-Path $backend 'AChatBotApi.exe'
$config = Get-Content (Join-Path $backend 'appsettings.json') -Raw | ConvertFrom-Json
if ($config.ConnectionStrings.Dbconnection -or $config.Mail.Password -or $config.Mail.Mode -ne 'Disabled') { throw 'Published settings are not sanitized.' }
foreach ($file in @('web.config','coreclr.dll','hostfxr.dll','sni.dll','System.Data.SqlClient.dll')) {
    if (-not (Test-Path (Join-Path $backend $file))) { throw ('Published dependency missing: ' + $file) }
}
$deps = Get-Content (Join-Path $backend 'AChatBotApi.deps.json') -Raw | ConvertFrom-Json
if (-not ($deps.libraries.PSObject.Properties.Name -contains 'System.Data.SqlClient/4.8.6')) { throw 'Patched SQL client missing.' }
$null = [xml](Get-Content (Join-Path $backend 'web.config') -Raw)
$snapshot = @{}
$names = @('ASPNETCORE_ENVIRONMENT','ASPNETCORE_URLS','Mail__Mode','ConnectionStrings__Dbconnection','Cors__AllowedOrigins__0','AllowedHosts','Logging__EventLog__LogLevel__Default')
foreach ($name in $names) { $snapshot[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
$process = $null
function Check-Request {
    param([string]$Path, [string]$Method='GET', [int]$Expected=200, [string]$Origin='')
    $headers = @{}
    if ($Origin) { $headers['Origin'] = $Origin }
    $response = $null
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri ('http://127.0.0.1:5037' + $Path) -Method $Method -Headers $headers -TimeoutSec 25
        $status = [int]$response.StatusCode
    } catch {
        if ($null -eq $_.Exception.Response) { throw ('Published API request failed: ' + $Path) }
        $status = [int]$_.Exception.Response.StatusCode
    }
    if ($status -ne $Expected) { throw ('Unexpected HTTP status for ' + $Path + ': ' + $status) }
    Write-Host ('PASS ' + $Method + ' ' + $Path + ' -> ' + $status)
    return $response
}
try {
    $env:ASPNETCORE_ENVIRONMENT = 'Production'
    $env:ASPNETCORE_URLS = 'http://127.0.0.1:5037'
    $env:Mail__Mode = 'Disabled'
    $env:ConnectionStrings__Dbconnection = ''
    $env:Cors__AllowedOrigins__0 = 'https://package-check.example'
    $env:AllowedHosts = '*'
    $env:Logging__EventLog__LogLevel__Default = 'None'
    if ($WithDatabase) {
        . (Join-Path $PSScriptRoot 'database-connection.ps1')
        $env:ConnectionStrings__Dbconnection = Get-ChatbotConnectionString
    }
    $process = Start-Process -FilePath $executable -WorkingDirectory $backend -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $projectRoot '.local\publish-smoke.stdout.log') -RedirectStandardError (Join-Path $projectRoot '.local\publish-smoke.stderr.log')
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        if ($process.HasExited) { throw 'Published self-contained API exited during startup.' }
        try {
            $null = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5037/WeatherForecast' -TimeoutSec 1
            $ready = $true; break
        } catch { Start-Sleep -Milliseconds 500 }
    }
    if (-not $ready) { throw 'Published self-contained API did not start.' }
    $null = Check-Request '/WeatherForecast'
    $swagger = Check-Request '/swagger/index.html'
    if (-not $swagger.Content.Contains('v1/swagger.json')) { throw 'Swagger UI schema endpoint is missing.' }
    $schema = (Check-Request '/swagger/v1/swagger.json').Content | ConvertFrom-Json
    if (-not $schema.openapi -or -not $schema.paths.PSObject.Properties.Count) { throw 'Swagger OpenAPI document is invalid or empty.' }
    $null = Check-Request '/api/admin/auth/me' -Expected 401
    $null = Check-Request '/api/ChatBot' -Method POST -Expected 401
    $null = Check-Request '/api/ChatBot/0' -Method PUT -Expected 401
    $null = Check-Request '/api/ChatBot?ID=0' -Method DELETE -Expected 401
    $hub = @(Check-Request '/hubs/chat/negotiate?negotiateVersion=1' -Method POST -Origin 'https://package-check.example')[-1]
    $negotiation = $hub.Content | ConvertFrom-Json
    if (-not $negotiation.connectionToken -or -not $negotiation.availableTransports) { throw 'SignalR negotiation response is invalid.' }
    if ($hub.Headers['Access-Control-Allow-Origin'] -ne 'https://package-check.example') { throw 'Configured production origin was not accepted.' }
    $blocked = @(Check-Request '/hubs/chat/negotiate?negotiateVersion=1' -Method POST -Origin 'https://unconfigured.example')[-1]
    if ($blocked.Headers['Access-Control-Allow-Origin']) { throw 'Unconfigured CORS origin was accepted.' }
    $null = Check-Request '/hubs/admin/negotiate?negotiateVersion=1' -Method POST -Expected 401
    if ($WithDatabase) {
        $questions = @(Check-Request '/api/Botknowledge/Qulist')[-1]
        $null = $questions.Content | ConvertFrom-Json
        Write-Output 'PASS published SQL client read-only database request.'
    }
    Write-Output 'PASS self-contained Production API smoke checks; email delivery stayed disabled.'
}
finally {
    if ($null -ne $process -and -not $process.HasExited) {
        $owned = Get-Process -Id $process.Id -ErrorAction SilentlyContinue
        if ($null -ne $owned -and $owned.Path -eq $executable) { Stop-Process -Id $process.Id -Force }
    }
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $snapshot[$name], 'Process') }
}
