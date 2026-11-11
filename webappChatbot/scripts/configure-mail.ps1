param([string]$HostName='smtp.office365.com',[int]$Port=587,[string]$Sender,[string]$UserName,[string]$PublicSiteUrl='http://127.0.0.1:4200')
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
if(-not $Sender){$Sender=Read-Host 'Authorized sender email address'}
if(-not $UserName){$UserName=$Sender}
$null=New-Object System.Net.Mail.MailAddress($Sender)
$secret=Read-Host 'SMTP password/app password (not displayed)' -AsSecureString
$credential=New-Object Management.Automation.PSCredential($UserName,$secret)
$credential | Export-Clixml -LiteralPath (Join-Path $root '.local\mail-credential.xml')
@{Host=$HostName;Port=$Port;Username=$UserName;FromAddress=$Sender;FromName='Compileon Innovation';EnableSsl=$true;Mode='Disabled';PublicSiteUrl=$PublicSiteUrl} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $root '.local\mail-settings.json') -Encoding UTF8
if(Test-Path (Join-Path $root '.local\mail-probe.json')){Remove-Item -LiteralPath (Join-Path $root '.local\mail-probe.json')}
Write-Output 'SMTP credentials saved with Windows user protection. Run probe-mail.ps1, then enable-mail.ps1 and restart the API.'
