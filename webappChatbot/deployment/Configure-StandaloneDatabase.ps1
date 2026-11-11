# Run interactively on the RDP server in Windows PowerShell as Administrator.
# SQL password is prompted; only the backend pool's database setting is changed.
[CmdletBinding()]
param(
    [ValidateRange(1,65535)][int]$BackendPort = 81,
    [string]$BackendSiteName = '',
    [string]$SqlServer = 'tcp:87.76.165.37,1433',
    [string]$Database = 'DbChatBoxTest',
    [string]$SqlUsername = 'sa',
    [switch]$TrustServerCertificate
)
$ErrorActionPreference = 'Stop'
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run on the RDP server in Windows PowerShell as Administrator.'
}
Add-Type -AssemblyName System.Data
Add-Type -Path (Join-Path $env:windir 'System32\inetsrv\Microsoft.Web.Administration.dll')
$manager = New-Object Microsoft.Web.Administration.ServerManager
$sqlConnection = $null
$builder = $null
try {
    $sites = @($manager.Sites | Where-Object {
        $candidate = $_
        ($BackendSiteName -eq '' -or $candidate.Name -eq $BackendSiteName) -and
        @($candidate.Bindings | Where-Object { $_.Protocol -eq 'http' -and $_.BindingInformation -match (':' + $BackendPort + ':') }).Count -gt 0
    })
    if ($sites.Count -ne 1) { throw 'Expected one backend website on the selected port. Pass -BackendSiteName if several sites share the port.' }
    $site = $sites[0]
    $application = $site.Applications['/']
    $folder = [IO.Path]::GetFullPath([Environment]::ExpandEnvironmentVariables($application.VirtualDirectories['/'].PhysicalPath))
    $poolName = $application.ApplicationPoolName
    $pool = $manager.ApplicationPools[$poolName]
    $uses = @($manager.Sites | ForEach-Object { $_.Applications } | Where-Object { $_.ApplicationPoolName -eq $poolName })
    if ($uses.Count -ne 1) { throw 'The backend must have a dedicated pool before configuring its database environment variable.' }
    Write-Output ('Backend site: ' + $site.Name + '; pool: ' + $poolName)
    Write-Output ('Backend folder: ' + $folder)
    foreach ($file in @('AChatBotApi.dll','System.Data.SqlClient.dll','sni.dll','web.config')) {
        if (-not (Test-Path -LiteralPath (Join-Path $folder $file))) { throw ('Missing published dependency ' + $file + '. Deploy the complete supplied backend ZIP first.') }
    }
    $variables = $pool.GetCollection('environmentVariables')
    $webConfigPath = Join-Path $folder 'web.config'
    $xml = New-Object Xml.XmlDocument
    $xml.PreserveWhitespace = $true
    $xml.Load($webConfigPath)
    $webOverrides = @($xml.SelectNodes('//aspNetCore/environmentVariables/environmentVariable') | Where-Object {
        $_.GetAttribute('name') -ieq 'ConnectionStrings__Dbconnection' -or $_.GetAttribute('name') -ieq 'ConnectionStrings:Dbconnection'
    })
    $existingPool = @($variables | Where-Object {
        [string]$_['name'] -ieq 'ConnectionStrings__Dbconnection' -or [string]$_['name'] -ieq 'ConnectionStrings:Dbconnection'
    })
    $hasJson = $false
    $jsonPath = Join-Path $folder 'appsettings.json'
    if (Test-Path -LiteralPath $jsonPath) {
        $settings = [IO.File]::ReadAllText($jsonPath) | ConvertFrom-Json
        $hasJson = -not [string]::IsNullOrWhiteSpace([string]$settings.ConnectionStrings.Dbconnection)
        $settings = $null
    }
    Write-Output ('Database setting in base JSON: ' + $hasJson + '; backend pool: ' + ($existingPool.Count -gt 0) + '; ANCM override: ' + ($webOverrides.Count -gt 0))
    Write-Output ('Testing SQL server ' + $SqlServer + ', database ' + $Database + ' before saving settings.')
    $secret = Read-Host 'Existing SQL login password' -AsSecureString
    $credential = New-Object Management.Automation.PSCredential($SqlUsername, $secret)
    $builder = New-Object Data.SqlClient.SqlConnectionStringBuilder
    $builder['Data Source'] = $SqlServer
    $builder['Initial Catalog'] = $Database
    $builder['User ID'] = $SqlUsername
    $builder['Password'] = $credential.GetNetworkCredential().Password
    $builder['Encrypt'] = $true
    $builder['TrustServerCertificate'] = [bool]$TrustServerCertificate
    $builder['Connect Timeout'] = 10
    $sqlConnection = New-Object Data.SqlClient.SqlConnection($builder.ConnectionString)
    try { $sqlConnection.Open() }
    catch [Data.SqlClient.SqlException] {
        $sqlError = $_.Exception
        $number = $sqlError.Number
        $detail = switch ($number) {
            18456 { 'SQL login rejected: check SQL authentication, login and password.' }
            4060 { 'Database cannot be opened: check database name and login permissions.' }
            -2 { 'SQL connection timed out: check the address, SQL TCP listener and firewall from this server.' }
            53 { 'SQL server could not be reached: check address, TCP listener and firewall.' }
            default {
                if ($sqlError.Message -match 'certificate|SSL Provider|TLS') { 'SQL TLS/certificate validation failed. Check the SQL certificate and selected trust setting.' }
                else { 'SQL connection failed. Check network/listener, authentication and TLS configuration.' }
            }
        }
        throw ('SQL test failed; error number ' + $number + '. ' + $detail + ' No IIS settings were changed.')
    }
    Write-Output 'PASS: SQL connection opened successfully.'
    $tables = @('Botlist','Botknowledge','Qlist','BotConversationMain','botconversations','WebsiteChatSessions','WebsiteChatMessages','WebsiteInquiries','SuperAdmins','AdminSessions','SupportTickets','SupportMessages','InquiryResponses','EmailOutbox')
    $missing = New-Object 'Collections.Generic.List[string]'
    foreach ($table in $tables) {
        $command = $sqlConnection.CreateCommand()
        try {
            $command.CommandText = 'SELECT CASE WHEN OBJECT_ID(@name, N''U'') IS NULL THEN 0 ELSE 1 END'
            $command.CommandTimeout = 10
            $null = $command.Parameters.AddWithValue('@name', 'dbo.' + $table)
            if ([int]$command.ExecuteScalar() -ne 1) { $missing.Add('dbo.' + $table) }
        } finally { $command.Dispose() }
    }
    if ($missing.Count) { throw ('Required tables are missing or not visible: ' + ($missing -join ', ') + '. Select the existing application database or review schema/permissions. No IIS settings were changed.') }
    $sqlConnection.Close()
    Write-Output 'PASS: required application tables are present.'
    $backup = Join-Path $env:ProgramData ('Compileon\IIS-Backups\' + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $backup -Force | Out-Null
    # Existing secret values are protected with this server user's DPAPI in the backup.
    $oldValues = @($existingPool | ForEach-Object { @{Name=[string]$_['name']; Value=[string]$_['value']} })
    $oldWebValues = @($webOverrides | ForEach-Object { @{Name=$_.GetAttribute('name'); Value=$_.GetAttribute('value')} })
    $backupJson = @{Site=$site.Name; Pool=$poolName; PoolValues=$oldValues; WebValues=$oldWebValues} | ConvertTo-Json -Depth 5
    ConvertTo-SecureString -String $backupJson -AsPlainText -Force | Export-Clixml -LiteralPath (Join-Path $backup 'previous-database-settings.xml')
    foreach ($entry in $existingPool) { $variables.Remove($entry) }
    $entry = $variables.CreateElement('add')
    $entry['name'] = 'ConnectionStrings__Dbconnection'
    $entry['value'] = $builder.ConnectionString
    $variables.Add($entry)
    $manager.CommitChanges()
    # A web.config environment override would otherwise mask the pool value.
    if ($webOverrides.Count) {
        foreach ($override in $webOverrides) { $null = $override.ParentNode.RemoveChild($override) }
        $xml.Save($webConfigPath)
    }
    Write-Output ('Database setting saved to the dedicated IIS backend pool; protected previous-settings backup: ' + $backup)
    if ($pool.State -eq [Microsoft.Web.Administration.ObjectState]::Started) { $null = $pool.Recycle() }
    else { $null = $pool.Start() }
    $status = 0
    for ($attempt = 0; $attempt -lt 3; $attempt++) {
        try { $status = [int](Invoke-WebRequest -UseBasicParsing -Uri ('http://localhost:' + $BackendPort + '/api/Botknowledge/Qulist') -TimeoutSec 15).StatusCode }
        catch { if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode } else { $status = 0 } }
        if ($status -eq 200) { break }
        Start-Sleep -Milliseconds 500
    }
    Write-Output ('Backend database-backed FAQ endpoint: HTTP ' + $status)
    if ($status -ne 200) { throw 'SQL connection/table checks passed, but the published API still failed. Paste this output and the backend exception from Event Viewer for the next diagnosis.' }
    Write-Output 'PASS: the backend API can read its database. Retry the normal UI login.'
}
finally {
    if ($null -ne $sqlConnection) { $sqlConnection.Dispose() }
    if ($null -ne $builder) { $builder.Clear() }
    $credential = $null; $secret = $null; $backupJson = $null; $oldValues = $null; $oldWebValues = $null
    $manager.Dispose()
}
