# Run on the RDP server in Windows PowerShell as Administrator.
# Keeps the existing backend site, SQL/mail settings and accounts unchanged.
[CmdletBinding()]
param(
    [ValidateRange(1,65535)][int]$FrontendPort = 82,
    [ValidateRange(1,65535)][int]$BackendPort = 81,
    [string]$FrontendSiteName = ''
)
$ErrorActionPreference = 'Stop'
if ($FrontendPort -eq $BackendPort) { throw 'Frontend and backend must use different ports for this setup.' }
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run this script on the RDP server in Windows PowerShell as Administrator.'
}
function Get-RouteStatus {
    param([string]$Url)
    try { return [int](Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 10).StatusCode }
    catch {
        if ($null -ne $_.Exception.Response) { return [int]$_.Exception.Response.StatusCode }
        return 0
    }
}
Add-Type -Path (Join-Path $env:windir 'System32\inetsrv\Microsoft.Web.Administration.dll')
$manager = New-Object Microsoft.Web.Administration.ServerManager
try {
    $sites = @($manager.Sites | Where-Object {
        $candidate = $_
        ($FrontendSiteName -eq '' -or $candidate.Name -eq $FrontendSiteName) -and
        @($candidate.Bindings | Where-Object { $_.Protocol -eq 'http' -and $_.BindingInformation -match (':' + $FrontendPort + ':') }).Count -gt 0
    })
    if ($sites.Count -ne 1) {
        throw ('Expected one HTTP website on port ' + $FrontendPort + '. If several exist, pass -FrontendSiteName with the correct IIS site name.')
    }
    $site = $sites[0]
    if (@($site.Applications | Where-Object { $_.Path -match '^/api(?:/|$)' }).Count) {
        throw 'An api child application already exists. Inspect that application mapping before using the separate-site proxy setup.'
    }
    $folder = [IO.Path]::GetFullPath([Environment]::ExpandEnvironmentVariables($site.Applications['/'].VirtualDirectories['/'].PhysicalPath))
    $webConfig = Join-Path $folder 'web.config'
    if (-not (Test-Path -LiteralPath (Join-Path $folder 'index.html'))) { throw 'The selected site folder does not contain the published frontend index.html.' }
    if (-not (Test-Path -LiteralPath $webConfig)) { throw 'The selected frontend web.config is missing.' }
    Write-Output ('Frontend website: ' + $site.Name)
    Write-Output ('Actual frontend folder: ' + $folder)
    $appHost = $manager.GetApplicationHostConfiguration()
    $modules = $appHost.GetSection('system.webServer/globalModules').GetCollection()
    if (-not @($modules | Where-Object { [string]$_['name'] -eq 'RewriteModule' }).Count) {
        throw 'Install IIS URL Rewrite x64 first: https://www.iis.net/downloads/microsoft/url-rewrite'
    }
    try { $proxy = $appHost.GetSection('system.webServer/proxy'); $oldEnabled = [bool]$proxy['enabled'] }
    catch { throw 'Install ARR 3.0 x64 first: https://www.iis.net/downloads/microsoft/application-request-routing' }
    $oldPreserveHost = [bool]$proxy['preserveHostHeader']
    $backendUrl = 'http://localhost:' + $BackendPort
    $backendStatus = Get-RouteStatus ($backendUrl + '/api/admin/auth/me')
    Write-Output ('Backend anonymous auth/me: HTTP ' + $backendStatus)
    if ($backendStatus -ne 401) { throw 'The backend auth/me endpoint must respond with 401 anonymously before applying the proxy. Check backend port/path/bindings first.' }
    $xml = New-Object Xml.XmlDocument
    $xml.PreserveWhitespace = $true
    $xml.Load($webConfig)
    $webServers = @($xml.SelectNodes('/configuration/location[@path="."]/system.webServer | /configuration/system.webServer'))
    if ($webServers.Count -ne 1) { throw 'Custom or ambiguous web.config layout. The helper stopped without changing it.' }
    $webServer = $webServers[0]
    $rewrite = $webServer.SelectSingleNode('rewrite')
    if ($null -eq $rewrite) { $rewrite = $xml.CreateElement('rewrite'); $null = $webServer.AppendChild($rewrite) }
    $rules = $rewrite.SelectSingleNode('rules')
    if ($null -eq $rules) { $rules = $xml.CreateElement('rules'); $null = $rewrite.AppendChild($rules) }
    if ($rules.SelectNodes('clear | remove').Count) { throw 'Custom rewrite collection directives found. Review those rules manually before applying this helper.' }
    $name = 'Compileon API on backend port 81'
    foreach ($oldRule in @($rules.SelectNodes('rule[@name="Compileon API on backend port 81"]'))) { $null = $rules.RemoveChild($oldRule) }
    $rule = $xml.CreateElement('rule')
    $rule.SetAttribute('name', $name)
    $rule.SetAttribute('stopProcessing', 'true')
    $match = $xml.CreateElement('match'); $match.SetAttribute('url', '^api/(.*)$'); $null = $rule.AppendChild($match)
    $action = $xml.CreateElement('action')
    $action.SetAttribute('type', 'Rewrite')
    $action.SetAttribute('url', ($backendUrl + '/{R:1}'))
    $action.SetAttribute('appendQueryString', 'true')
    $null = $rule.AppendChild($action)
    $null = $rules.PrependChild($rule)
    $backup = Join-Path $env:ProgramData ('Compileon\IIS-Backups\' + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $backup -Force | Out-Null
    Copy-Item -LiteralPath $webConfig -Destination (Join-Path $backup 'frontend.web.config')
    @{ SiteName=$site.Name; FrontendFolder=$folder; ProxyEnabled=$oldEnabled; PreserveHostHeader=$oldPreserveHost } |
        ConvertTo-Json | Set-Content -LiteralPath (Join-Path $backup 'previous-proxy-settings.json') -Encoding UTF8
    Write-Output ('Configuration backup: ' + $backup)
    # Use the backend URL's hostname on the internal request. The backend's
    # loopback IIS binding may accept localhost but reject a public frontend Host.
    $proxy['enabled'] = $true
    $proxy['preserveHostHeader'] = $false
    $manager.CommitChanges()
    $xml.Save($webConfig)
    Write-Output 'Applied API proxy before Angular fallback in the active frontend web.config.'
    $poolName = $site.Applications['/'].ApplicationPoolName
    $poolUses = @($manager.Sites | ForEach-Object { $_.Applications } | Where-Object { $_.ApplicationPoolName -eq $poolName })
    $pool = $manager.ApplicationPools[$poolName]
    if ($poolUses.Count -eq 1 -and $pool.State -eq [Microsoft.Web.Administration.ObjectState]::Started) { $null = $pool.Recycle() }
    $frontendUrl = 'http://localhost:' + $FrontendPort
    $frontendStatus = 0
    for ($attempt = 0; $attempt -lt 5; $attempt++) {
        $frontendStatus = Get-RouteStatus ($frontendUrl + '/api/api/admin/auth/me')
        if ($frontendStatus -eq 401) { break }
        Start-Sleep -Milliseconds 500
    }
    Write-Output ('Frontend anonymous auth/me: HTTP ' + $frontendStatus)
    $loginStatus = Get-RouteStatus ($frontendUrl + '/api/api/admin/auth/login')
    Write-Output ('Frontend login route checked using GET: HTTP ' + $loginStatus + ' (expected 405 because login requires POST)')
    if ($frontendStatus -ne 401 -or $loginStatus -ne 405) {
        throw 'Server verification did not pass. Keep the backup and paste this script output for diagnosis. No admin login was attempted.'
    }
    Write-Output ('PASS: frontend API forwarding is active. Sign in normally at ' + $frontendUrl + '/admin')
}
finally { $manager.Dispose() }
