# Read-only: no IIS changes, restarts, database access or credential output.
[CmdletBinding()]
param([ValidateRange(1,65535)][int]$Port = 81)
$ErrorActionPreference = 'Stop'
$expected = 'E9FF59C21AE014A8EF234A5B8336E6DFB54EBB6588AFFE372172E69770AF9A61'
$previous = 'A04611ECEE402B34505B8F3DEE718ED9507999D459B46EDDB20B7A45FF970BC6'
Write-Output '=== IIS mapping and deployed build ==='
$manager = $null
try {
    Add-Type -Path (Join-Path $env:windir 'System32\inetsrv\Microsoft.Web.Administration.dll')
    $manager = New-Object Microsoft.Web.Administration.ServerManager
    $sites = @($manager.Sites | Where-Object {
        @($_.Bindings | Where-Object { $_.BindingInformation -match (':' + $Port + ':') }).Count -gt 0
    })
    if (-not $sites.Count) { Write-Output ('No IIS website is bound to port ' + $Port + '.') }
    foreach ($site in $sites) {
        Write-Output ('Site: ' + $site.Name + '; state: ' + $site.State)
        foreach ($binding in $site.Bindings) {
            Write-Output ('  Binding: ' + $binding.Protocol + ' ' + $binding.BindingInformation)
        }
        foreach ($application in $site.Applications) {
            Write-Output ('  Application: ' + $application.Path + '; pool: ' + $application.ApplicationPoolName)
            $folder = [Environment]::ExpandEnvironmentVariables($application.VirtualDirectories['/'].PhysicalPath)
            Write-Output ('    Physical folder: ' + $folder)
            $assembly = Join-Path $folder 'AChatBotApi.dll'
            if (Test-Path -LiteralPath $assembly) {
                $hash = (Get-FileHash -LiteralPath $assembly -Algorithm SHA256).Hash
                $label = if ($hash -eq $expected) { 'LATEST Swagger-enabled package' }
                         elseif ($hash -eq $previous) { 'OLD package: Swagger disabled in Production' }
                         else { 'Different build; not the supplied Swagger-enabled DLL' }
                Write-Output ('    Backend build: ' + $label)
                Write-Output ('    DLL SHA256: ' + $hash)
                Write-Output ('    DLL last modified UTC: ' + (Get-Item -LiteralPath $assembly).LastWriteTimeUtc.ToString('u'))
            } else {
                Write-Output '    AChatBotApi.dll is absent from this application folder.'
            }
            $webConfig = Join-Path $folder 'web.config'
            if (Test-Path -LiteralPath $webConfig) {
                try {
                    $xml = [xml][IO.File]::ReadAllText($webConfig)
                    $handler = $xml.SelectSingleNode('//handlers/add[@modules="AspNetCoreModuleV2"]')
                    Write-Output ('    Local ASP.NET Core IIS handler present: ' + ($null -ne $handler))
                } catch { Write-Output '    web.config could not be parsed (contents omitted).' }
            } else { Write-Output '    web.config is missing.' }
            Write-Output ('    Frontend index.html present: ' + (Test-Path -LiteralPath (Join-Path $folder 'index.html')))
        }
    }
} catch {
    Write-Output 'Unable to inspect IIS. Run this script in Windows PowerShell as Administrator on the server.'
} finally {
    if ($null -ne $manager) { $manager.Dispose() }
}
Write-Output '=== HTTP route checks (no credentials, no writes) ==='
foreach ($base in @('', '/api')) {
    foreach ($route in @('/WeatherForecast','/swagger/index.html','/swagger/v1/swagger.json')) {
        $url = 'http://localhost:' + $Port + $base + $route
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 5
            $detail = [string]$response.Headers['Content-Type']
            if ($route -eq '/swagger/index.html' -and $response.Content -notmatch 'SwaggerUIBundle') {
                $detail += '; response is not the expected Swagger UI'
            }
            if ($route -eq '/swagger/v1/swagger.json') {
                try {
                    $document = $response.Content | ConvertFrom-Json
                    if ($document.openapi) { $detail += '; OpenAPI ' + $document.openapi }
                    else { $detail += '; response has no OpenAPI version' }
                } catch { $detail += '; response is not OpenAPI JSON' }
            }
            Write-Output ($url + ' -> ' + [int]$response.StatusCode + ' (' + $detail + ')')
        } catch {
            if ($_.Exception.Response) { Write-Output ($url + ' -> HTTP ' + [int]$_.Exception.Response.StatusCode) }
            else { Write-Output ($url + ' -> no HTTP response') }
        }
    }
}
Write-Output 'Expected Swagger-enabled DLL SHA256:'
Write-Output $expected
Write-Output 'A matching file on disk may still need its dedicated application pool recycled after deployment.'
