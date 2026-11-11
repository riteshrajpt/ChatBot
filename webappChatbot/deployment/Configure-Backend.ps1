# Run in an elevated Windows PowerShell 5.1 session on the IIS server.
# Passwords are prompted, never accepted as command-line parameters or printed.
[CmdletBinding()]
param(
    [string]$AppPoolName = 'CompileonApi',
    [Parameter(Mandatory=$true)][uri]$PublicSiteUrl,
    [string]$SqlServer = 'tcp:87.76.165.37,1433',
    [string]$Database = 'DbChatBoxTest',
    [string]$SqlUsername = 'sa',
    [string]$MailUsername = 'HolostikBi@holostik.com',
    [switch]$EnableMail,
    [switch]$TrustServerCertificate
)
$ErrorActionPreference = 'Stop'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run Windows PowerShell as Administrator on the server.'
}
if (-not $PublicSiteUrl.IsAbsoluteUri -or $PublicSiteUrl.Scheme -ne 'https' -or
    $PublicSiteUrl.AbsolutePath -ne '/' -or $PublicSiteUrl.Query -or $PublicSiteUrl.Fragment -or $PublicSiteUrl.UserInfo) {
    throw 'PublicSiteUrl must be the HTTPS site origin, for example https://www.example.com (no subfolder).'
}
$iisVersion = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\InetStp').MajorVersion
if ($iisVersion -lt 10) { throw 'This configuration helper requires IIS 10.' }
Add-Type -AssemblyName System.Data
Add-Type -Path (Join-Path $env:windir 'System32\inetsrv\Microsoft.Web.Administration.dll')
$serverManager = New-Object Microsoft.Web.Administration.ServerManager
try {
    $pool = $serverManager.ApplicationPools[$AppPoolName]
    if ($null -eq $pool) { throw 'Create the dedicated backend application pool and /api application first (see DEPLOYMENT.md).' }
    $uses = @($serverManager.Sites | ForEach-Object { $_.Applications } | Where-Object { $_.ApplicationPoolName -eq $AppPoolName })
    if ($uses.Count -ne 1 -or $uses[0].Path -ne '/api') {
        throw 'This app pool must be assigned only to the /api application, not the frontend or another application.'
    }
    $sqlSecret = Read-Host 'SQL login password' -AsSecureString
    $sqlCredential = New-Object Management.Automation.PSCredential($SqlUsername, $sqlSecret)
    $connection = New-Object Data.SqlClient.SqlConnectionStringBuilder
    $connection['Data Source'] = $SqlServer
    $connection['Initial Catalog'] = $Database
    $connection['User ID'] = $SqlUsername
    $connection['Password'] = $sqlCredential.GetNetworkCredential().Password
    $connection['Encrypt'] = $true
    $connection['TrustServerCertificate'] = [bool]$TrustServerCertificate
    $connection['Connect Timeout'] = 15
    $values = [ordered]@{
        'ASPNETCORE_ENVIRONMENT' = 'Production'
        'ConnectionStrings__Dbconnection' = $connection.ConnectionString
        'Cors__AllowedOrigins__0' = $PublicSiteUrl.GetLeftPart([UriPartial]::Authority)
        'AllowedHosts' = $PublicSiteUrl.DnsSafeHost
        'Mail__Mode' = 'Disabled'
        'Mail__Host' = 'smtp.office365.com'
        'Mail__Port' = '587'
        'Mail__Username' = $MailUsername
        'Mail__FromAddress' = $MailUsername
        'Mail__FromName' = 'Compileon Innovation'
        'Mail__EnableSsl' = 'true'
        'Mail__PublicSiteUrl' = $PublicSiteUrl.GetLeftPart([UriPartial]::Authority)
    }
    if ($EnableMail) {
        $mailSecret = Read-Host 'Authorized Office 365 mailbox SMTP password' -AsSecureString
        $mailCredential = New-Object Management.Automation.PSCredential($MailUsername, $mailSecret)
        $values['Mail__Password'] = $mailCredential.GetNetworkCredential().Password
        $values['Mail__Mode'] = 'Smtp'
    }
    $variables = $pool.GetCollection('environmentVariables')
    # Replace only this application's configuration keys, including previous origin entries.
    $stale = @($variables | Where-Object {
        $name = [string]$_['name']
        $values.Contains($name) -or $name.StartsWith('Mail__') -or $name.StartsWith('Cors__AllowedOrigins__')
    })
    foreach ($entry in $stale) { $variables.Remove($entry) }
    foreach ($name in $values.Keys) {
        $entry = $variables.CreateElement('add')
        $entry['name'] = $name
        $entry['value'] = [string]$values[$name]
        $variables.Add($entry)
    }
    $pool.ManagedRuntimeVersion = ''
    $pool.Enable32BitAppOnWin64 = $false
    $pool.AutoStart = $true
    $pool.SetAttributeValue('startMode', 'AlwaysRunning')
    $pool.ProcessModel.IdleTimeout = [TimeSpan]::Zero
    $pool.ProcessModel.MaxProcesses = 1
    $pool.Recycling.DisallowOverlappingRotation = $true
    $serverManager.CommitChanges()
    if ($pool.State -eq [Microsoft.Web.Administration.ObjectState]::Started) { $null = $pool.Recycle() }
    else { $null = $pool.Start() }
    Write-Output 'Backend configuration saved to IIS server configuration; backend pool started/recycled.'
    Write-Output ('Email mode: ' + $values['Mail__Mode'] + '. See DEPLOYMENT.md for verification.')
}
finally {
    $serverManager.Dispose()
    if ($null -ne $values) { $values.Clear() }
    if ($null -ne $connection) { $connection.Clear() }
    $sqlCredential = $null
    $mailCredential = $null
    $sqlSecret = $null
    $mailSecret = $null
}
